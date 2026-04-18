/**
 * lib/scanner-sync.ts
 *
 * Core sync logic: polls every configured Hikvision scanner, then writes
 * AttendanceLog records to the database. Each scanner has its own IP and
 * branch location — scans are tagged with scannerLocation on creation.
 *
 * Called from instrumentation.ts on a setInterval.
 */

import { request } from 'urllib';
import { prisma } from '@/lib/prisma';
import { sendClockInEmail, sendClockOutEmail } from '@/lib/mailer';
import { SCANNERS, ScannerConfig } from '@/lib/scanners';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanEvent {
  employeeNoString: string;
  time: string;           // ISO-8601, e.g. "2025-04-12T08:31:00+08:00"
  serialNo: string | number;
}

interface AcsResponse {
  AcsEvent?: {
    InfoList?: ScanEvent[];
    numOfMatches?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Format a JS Date into the timestamp string Hikvision expects. */
function hikvisionDate(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
  );
}

/** Format an ISO time string for display (HH:MM:SS, 24-hour, KL timezone). */
function displayTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

/** Today's date string in KL timezone, e.g. "2025-04-12". */
function todayKL(): string {
  const kl = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })
  );
  return `${kl.getFullYear()}-${pad(kl.getMonth() + 1)}-${pad(kl.getDate())}`;
}

// ─── Scanner fetch ────────────────────────────────────────────────────────────

/**
 * Fetch all scan events for today from a single Hikvision scanner.
 * Paginates automatically until no more results are returned.
 */
async function fetchTodayEvents(scanner: ScannerConfig): Promise<ScanEvent[]> {
  const { id, ip, user, pass } = scanner;

  if (!ip || !user || !pass) {
    console.error(`[scanner-sync][${id}] Missing ip/user/pass — check SCANNER_${id.toUpperCase().replace('-', '_')}_* env vars`);
    return [];
  }

  const url  = `http://${ip}/ISAPI/AccessControl/AcsEvent?format=json`;
  const auth = `${user}:${pass}`;

  const now          = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const all: ScanEvent[] = [];
  let position = 0;
  let safety   = 0;          // guard against infinite loops

  while (safety < 50) {
    safety++;
    try {
      const { data, res } = await request(url, {
        method: 'POST',
        digestAuth: auth,
        // Use `data` (object) not `content` (raw string) — urllib re-attaches
        // the data object on the Digest Auth retry request. With `content` (raw
        // string), urllib drops the body on the retry and the scanner rejects it.
        data: {
          AcsEventCond: {
            searchID: Date.now().toString(),
            searchResultPosition: position,
            maxResults: 30,
            major: 0,
            minor: 0,
            startTime: hikvisionDate(startOfToday),
            endTime:   hikvisionDate(now),
          },
        },
        contentType: 'application/json',
        dataType: 'json',
        timeout: 8000,
      });

      if (res.statusCode === 401) {
        console.error(`[scanner-sync][${id}] ✗ 401 Unauthorized — verify credentials`);
        break;
      }
      if (res.statusCode !== 200) {
        console.error(`[scanner-sync][${id}] ✗ Unexpected HTTP ${res.statusCode}`);
        break;
      }

      const batch = (data as AcsResponse).AcsEvent?.InfoList ?? [];
      if (batch.length === 0) break;          // no more pages

      all.push(...batch);
      position += batch.length;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('ECONNREFUSED')
        ? '— scanner unreachable, check ip and network'
        : msg.includes('ETIMEDOUT')
        ? '— connection timed out, device may be off'
        : '';
      console.error(`[scanner-sync][${id}] ✗ Network error ${hint}:`, msg);
      break;
    }
  }

  return all;
}

// ─── Per-scanner processing ───────────────────────────────────────────────────

async function processScannerEvents(
  scanner: ScannerConfig,
  staffByEmpNo: Map<string | null, { name: string | null; email: string | null }>,
  today: string,
): Promise<void> {
  const allEvents = await fetchTodayEvents(scanner);

  // Drop placeholder / anonymous scans
  const valid = allEvents.filter(
    e => e.employeeNoString && e.employeeNoString !== '0' && e.employeeNoString !== ''
  );
  if (valid.length === 0) return;

  // Sort by serialNo (ascending = chronological order from the scanner)
  const sorted = [...valid].sort((a, b) => Number(a.serialNo) - Number(b.serialNo));

  // Group scans by employee
  const groups = new Map<string, { time: string; serialNo: string }[]>();
  for (const ev of sorted) {
    if (!groups.has(ev.employeeNoString)) groups.set(ev.employeeNoString, []);
    groups.get(ev.employeeNoString)!.push({
      time:     ev.time,
      serialNo: String(ev.serialNo),
    });
  }

  for (const [empNo, scans] of groups) {
    // ── Resolve name + email from BranchStaff ─────────────────────────────
    const staff    = staffByEmpNo.get(empNo);
    const empName  = staff?.name  ?? empNo;   // fall back to scanner ID
    const empEmail = staff?.email ?? '';

    const first       = scans[0];
    const last        = scans[scans.length - 1];
    const hasClockOut = scans.length > 1;

    const clockInTime  = displayTime(first.time);
    const clockOutTime = hasClockOut ? displayTime(last.time) : null;

    // ── Check if a record already exists for this employee today ──────────
    const existing = await prisma.attendanceLog.findUnique({
      where: { date_empNo: { date: today, empNo } },
    });

    if (!existing) {
      // ── First scan of the day — create the record ──────────────────────
      await prisma.attendanceLog.create({
        data: {
          date:              today,
          empNo,
          empName,
          clockInTime,
          clockInSerialNo:   first.serialNo,
          clockInEmailSent:  false,
          clockOutTime,
          clockOutSerialNo:  null,
          clockOutEmailSent: false,
          scannerLocation:   scanner.location,
        },
      });
      console.log(`[scanner-sync][${scanner.id}] ✅ Created — ${empName}  in: ${clockInTime}  loc: ${scanner.location}`);

      // Send clock-in notification
      if (empEmail) {
        try {
          await sendClockInEmail(empEmail, empName, clockInTime);
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data:  { clockInEmailSent: true },
          });
        } catch (e) {
          console.error(`[scanner-sync][${scanner.id}] Clock-in email failed (${empName}):`, (e as Error).message);
        }
      } else {
        console.warn(`[scanner-sync][${scanner.id}] ⚠ No email for ${empName} (empNo: ${empNo}) — clock-in email skipped. Add email to BranchStaff.`);
      }

      // If the same fetch batch already contains a later scan, handle clock-out now
      if (hasClockOut && clockOutTime) {
        if (empEmail) {
          try {
            await sendClockOutEmail(empEmail, empName, clockOutTime);
            console.log(`[scanner-sync][${scanner.id}] 🔴 Same-batch out — ${empName}  out: ${clockOutTime}`);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
            });
          } catch (e) {
            console.error(`[scanner-sync][${scanner.id}] Clock-out email failed (${empName}):`, (e as Error).message);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
            });
          }
        } else {
          console.warn(`[scanner-sync][${scanner.id}] ⚠ No email for ${empName} (empNo: ${empNo}) — clock-out email skipped.`);
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
          });
        }
      }

    } else {
      // ── Record exists — catch up on anything that was missed ───────────

      // Retry clock-in email if it never sent (e.g. SMTP was down on first run)
      if (!existing.clockInEmailSent && empEmail) {
        try {
          await sendClockInEmail(empEmail, empName, existing.clockInTime);
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data:  { clockInEmailSent: true },
          });
        } catch (e) {
          console.error(`[scanner-sync][${scanner.id}] Clock-in email retry failed (${empName}):`, (e as Error).message);
        }
      }

      // Update clock-out if a new (later) scan has appeared since last run
      if (hasClockOut && last.serialNo !== existing.clockOutSerialNo && clockOutTime) {
        if (empEmail) {
          try {
            await sendClockOutEmail(empEmail, empName, clockOutTime);
            console.log(`[scanner-sync][${scanner.id}] 🔴 Updated out — ${empName}  out: ${clockOutTime}`);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
            });
          } catch (e) {
            console.error(`[scanner-sync][${scanner.id}] Clock-out email failed (${empName}):`, (e as Error).message);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
            });
          }
        } else {
          console.warn(`[scanner-sync][${scanner.id}] ⚠ No email for ${empName} (empNo: ${empNo}) — clock-out email skipped.`);
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
          });
        }
      }
    }
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncScannerToDb(): Promise<void> {
  const today = todayKL();

  // I1: Batch-load all BranchStaff once per sync cycle — shared across all scanners
  const allStaff = await prisma.branchStaff.findMany({
    select: { employeeId: true, name: true, email: true },
  });
  const staffByEmpNo = new Map(allStaff.map(s => [s.employeeId, s]));

  // Process each configured scanner in parallel
  await Promise.all(
    SCANNERS.map(scanner => processScannerEvents(scanner, staffByEmpNo, today))
  );
}
