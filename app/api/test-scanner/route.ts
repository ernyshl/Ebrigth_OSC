import { NextResponse } from 'next/server';
import { request } from 'urllib';
import { sendClockInEmail, sendClockOutEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { SCANNERS } from '@/lib/scanners';
import { requireRole } from '@/lib/auth';
import { ADMIN_ROLES } from '@/lib/roles';

export const dynamic = 'force-dynamic';

// ─── Hikvision helpers ────────────────────────────────────────────────────────

function formatHikvisionDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}+08:00`;
}

function formatDisplayTime(isoTime: string): string {
  return new Date(isoTime).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Hikvision event type ─────────────────────────────────────────────────────

interface HikvisionEvent {
  employeeNoString: string;
  serialNo: number;
  time: string;
  major?: number;
  minor?: number;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const scanner = SCANNERS[0];
    const url = `http://${scanner.ip}/ISAPI/AccessControl/AcsEvent?format=json`;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const allEvents: HikvisionEvent[] = [];
    let currentPosition = 0;
    let isFetching = true;
    let safetyCounter = 0;

    while (isFetching && safetyCounter < 50) {
      safetyCounter++;

      const { data, res } = await request(url, {
        method: 'POST',
        digestAuth: `${scanner.user}:${scanner.pass}`,
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

      const eventList: HikvisionEvent[] = (data as { AcsEvent?: { InfoList?: HikvisionEvent[]; numOfMatches?: number } }).AcsEvent?.InfoList || [];
      if (eventList.length > 0) {
        allEvents.push(...eventList);
        currentPosition += eventList.length;
      }
      if (eventList.length === 0 || (data as { AcsEvent?: { numOfMatches?: number } }).AcsEvent?.numOfMatches === 0) isFetching = false;
    }

    const validScans = allEvents.filter(e =>
      e.employeeNoString && e.employeeNoString !== '0' && e.employeeNoString !== ''
    );

    const chronological = [...validScans].sort((a, b) => Number(a.serialNo) - Number(b.serialNo));

    const today = todayStr();

    const allStaff = await prisma.branchStaff.findMany({
      select: { employeeId: true, name: true, email: true },
    });
    const staffByEmpNo = new Map(allStaff.map(s => [s.employeeId, s]));

    const groups = new Map<string, { time: string; serialNo: string }[]>();
    for (const event of chronological) {
      const empNo = event.employeeNoString;
      if (!groups.has(empNo)) groups.set(empNo, []);
      groups.get(empNo)!.push({ time: event.time, serialNo: String(event.serialNo) });
    }

    for (const [empNo, scans] of groups) {
      const staff    = staffByEmpNo.get(empNo);
      const empName  = staff?.name  ?? empNo;
      const empEmail = staff?.email ?? '';

      const first = scans[0];
      const last  = scans[scans.length - 1];
      const hasCheckOut = scans.length > 1;

      const clockInTime  = formatDisplayTime(first.time);
      const clockOutTime = hasCheckOut ? formatDisplayTime(last.time) : null;

      const existing = await prisma.attendanceLog.findUnique({
        where: { date_empNo: { date: today, empNo } },
      });

      if (!existing) {
        await prisma.attendanceLog.create({
          data: {
            date: today,
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

        if (empEmail) {
          try {
            await sendClockInEmail(empEmail, empName, clockInTime);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockInEmailSent: true },
            });
            console.log(`✅ Clock-in email → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-in email failed for ${empName}:`, e);
          }
        } else {
          console.warn(`⚠ No email for ${empName} (empNo: ${empNo}) — clock-in email skipped. Add email to BranchStaff.`);
        }

        if (hasCheckOut && empEmail) {
          try {
            await sendClockOutEmail(empEmail, empName, clockOutTime!);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
            });
            console.log(`🔴 Clock-out email → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-out email failed for ${empName}:`, e);
          }
        }

      } else {

        if (!existing.clockInEmailSent && empEmail) {
          try {
            await sendClockInEmail(empEmail, empName, existing.clockInTime);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockInEmailSent: true },
            });
            console.log(`✅ Clock-in email (retry) → ${empName} <${empEmail}>`);
          } catch (e) {
            console.error(`Clock-in email failed for ${empName}:`, e);
          }
        }

        if (hasCheckOut && last.serialNo !== existing.clockOutSerialNo) {
          if (empEmail) {
            try {
              await sendClockOutEmail(empEmail, empName, clockOutTime!);
              console.log(`🔴 Clock-out email → ${empName} <${empEmail}> (serial ${last.serialNo})`);
              await prisma.attendanceLog.update({
                where: { date_empNo: { date: today, empNo } },
                data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: true },
              });
            } catch (e) {
              console.error(`Clock-out email failed for ${empName}:`, e);
              await prisma.attendanceLog.update({
                where: { date_empNo: { date: today, empNo } },
                data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
              });
            }
          } else {
            console.warn(`⚠ No email for ${empName} (empNo: ${empNo}) — clock-out email skipped. Add email to BranchStaff.`);
            await prisma.attendanceLog.update({
              where: { date_empNo: { date: today, empNo } },
              data:  { clockOutTime, clockOutSerialNo: last.serialNo, clockOutEmailSent: false },
            });
          }
        } else if (hasCheckOut && clockOutTime !== existing.clockOutTime) {
          await prisma.attendanceLog.update({
            where: { date_empNo: { date: today, empNo } },
            data:  { clockOutTime },
          });
        }
      }
    }

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