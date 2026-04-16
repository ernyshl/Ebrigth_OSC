import { NextResponse } from 'next/server';
import { request } from 'urllib';
import { sendClockInEmail, sendClockOutEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ─── Hikvision helpers ────────────────────────────────────────────────────────

function formatHikvisionDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+08:00`;
}

function formatDisplayTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const url = `http://${process.env.SCANNER_IP}/ISAPI/AccessControl/AcsEvent?format=json`;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    let allEvents: any[] = [];
    let currentPosition = 0;
    let isFetching = true;
    let safetyCounter = 0;

    while (isFetching && safetyCounter < 50) {
      safetyCounter++;

      const { data, res } = await request(url, {
        method: 'POST',
        digestAuth: `${process.env.SCANNER_USER}:${process.env.SCANNER_PASS}`,
        data: {
          AcsEventCond: {
            searchID: Date.now().toString(),
            searchResultPosition: currentPosition,
            maxResults: 30,
            major: 0,
            minor: 0,
            startTime: formatHikvisionDate(startOfToday),
            endTime: formatHikvisionDate(now),
          }
        },
        contentType: 'application/json',
        dataType: 'json',
        timeout: 8000,
      });

      if (res.statusCode !== 200) break;

      const eventList = data.AcsEvent?.InfoList || [];
      if (eventList.length > 0) {
        allEvents.push(...eventList);
        currentPosition += eventList.length;
      }
      if (eventList.length === 0 || data.AcsEvent?.numOfMatches === 0) isFetching = false;
    }

    // Filter to valid employee scans only
    const validScans = allEvents.filter(e =>
      e.employeeNoString && e.employeeNoString !== '0' && e.employeeNoString !== ''
    );

    // Sort oldest-first for correct clock-in / clock-out assignment
    const chronological = [...validScans].sort((a, b) => Number(a.serialNo) - Number(b.serialNo));

    const today = todayStr();

    // I2: Batch-load BranchStaff from DB (same source as scanner-sync) instead of CSV
    const allStaff = await prisma.branchStaff.findMany({
      select: { employeeId: true, name: true, email: true },
    });
    const staffByEmpNo = new Map(allStaff.map(s => [s.employeeId, s]));

    // Group scans by employee
    const groups = new Map<string, { time: string; serialNo: string }[]>();
    for (const event of chronological) {
      const empNo = event.employeeNoString;
      if (!groups.has(empNo)) groups.set(empNo, []);
      groups.get(empNo)!.push({ time: event.time, serialNo: String(event.serialNo) });
    }

    // ── Process each employee who scanned today ────────────────────────────────
    for (const [empNo, scans] of groups) {
      const staff   = staffByEmpNo.get(empNo);
      const empName = staff?.name  ?? empNo;
      const empEmail = staff?.email ?? '';

      const first = scans[0];
      const last = scans[scans.length - 1];
      const hasCheckOut = scans.length > 1;

      const clockInTime = formatDisplayTime(first.time);
      const clockOutTime = hasCheckOut ? formatDisplayTime(last.time) : null;

      // Upsert the DB row — create on first scan, update clock-out on subsequent scans
      const existing = await prisma.attendanceLog.findUnique({
        where: { date_empNo: { date: today, empNo } },
      });

      if (!existing) {
        // ── First time we see this person today: create row + send clock-in email ──
        await prisma.attendanceLog.create({
          data: {
            date: today,
            empNo,
            empName,
            clockInTime,
            clockInSerialNo: first.serialNo,
            clockInEmailSent: false, // will be set true below after send
            clockOutTime,
            // clockOutSerialNo tracks the last scan we sent a clock-out email for.
            // Start as null so the first clock-out scan triggers an email.
            clockOutSerialNo: null,
            clockOutEmailSent: false,
          },
        });

        // Send clock-in email
        if (empEmail) {
          try {
            await sendClockInEmail(empEmail, empName, clockInTime);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data: { clockInEmailSent: true },
            });
            console.log(`✅ Clock-in email → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-in email failed for ${empName}:`, e);
          }
        }

        // If there's already a second scan in the same batch, send clock-out email too
        if (hasCheckOut && empEmail) {
          try {
            await sendClockOutEmail(empEmail, empName, clockOutTime!);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data: { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
            });
            console.log(`🔴 Clock-out email → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-out email failed for ${empName}:`, e);
          }
        }

      } else {
        // ── Row exists ─────────────────────────────────────────────────────────────

        // Safety net: send clock-in email if it was never sent
        if (!existing.clockInEmailSent && empEmail) {
          try {
            await sendClockInEmail(empEmail, empName, existing.clockInTime);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data: { clockInEmailSent: true },
            });
            console.log(`✅ Clock-in email (retry) → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-in email failed for ${empName}:`, e);
          }
        }

        // Clock-out email: send whenever there's a new scan we haven't emailed yet.
        // We track this by comparing the latest scan's serialNo with the last serialNo
        // we sent a clock-out email for (clockOutSerialNo). A new scan = different serial.
        if (hasCheckOut && last.serialNo !== existing.clockOutSerialNo) {
          if (empEmail) {
            try {
              // C3: DB update now INSIDE try — only marks as sent if email succeeded
              await sendClockOutEmail(empEmail, empName, clockOutTime!);
              console.log(`🔴 Clock-out email → ${empName} <${empEmail}> (serial ${last.serialNo})`);
              await prisma.attendanceLog.update({
                where: { date_empNo: { date: today, empNo } },
                data: { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
              });
            } catch (e) {
              console.error(`Clock-out email failed for ${empName}:`, e);
              // Still update clockOutTime so UI stays correct; leave clockOutEmailSent: false for retry
              await prisma.attendanceLog.update({
                where: { date_empNo: { date: today, empNo } },
                data: { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
              });
            }
          } else {
            // C1: visible warning when no email address is set
            console.warn(`⚠ No email for ${empName} (empNo: ${empNo}) — clock-out email skipped. Add email to BranchStaff.`);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data: { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
            });
          }
        } else if (hasCheckOut && clockOutTime !== existing.clockOutTime) {
          // Same serialNo but time string differs — just keep display in sync
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data: { clockOutTime },
          });
        }
      }
    }

    // Return newest-first for the UI
    const newestFirst = validScans.sort((a, b) => Number(b.serialNo) - Number(a.serialNo));
    return new NextResponse(JSON.stringify(newestFirst, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scanner error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to connect to scanner', detail: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
                                                                       