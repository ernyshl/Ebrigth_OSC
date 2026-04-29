import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/attendance-today?date=YYYY-MM-DD
// Returns attendance for the given date from BOTH scanner tables:
//   - AttendanceLog    (HQ + multi-scanner, carries scannerLocation natively)
//   - AttendanceLogST  (Subang Taipan scanner — tagged 'Subang Taipan' on read)
// If `date` is missing or invalid, defaults to today (Kuala Lumpur timezone).
// The dashboard filters client-side by scannerLocation, so ST rows surface under the ST tab.

export const dynamic = 'force-dynamic';

interface AttendanceTodayRow {
  date: string;
  empNo: string;
  empName: string;
  clockInTime: string;
  clockOutTime: string | null;
  clockInSerialNo: string;
  clockOutSerialNo: string | null;
  scannerLocation: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayKL(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
}

export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get('date');
    const date = requested && DATE_RE.test(requested) ? requested : todayKL();

    const mainLogs = await prisma.attendanceLog.findMany({
      where: { date },
      orderBy: { createdAt: 'desc' },
      select: {
        date: true,
        empNo: true,
        empName: true,
        clockInTime: true,
        clockOutTime: true,
        clockInSerialNo: true,
        clockOutSerialNo: true,
        scannerLocation: true,
      },
    });

    // AttendanceLogST is not yet in the generated Prisma client; query via raw SQL.
    const stRowsRaw = await prisma.$queryRawUnsafe<Array<{
      date: string;
      empNo: string;
      empName: string;
      clockInTime: string;
      clockOutTime: string | null;
      clockInSerialNo: string;
      clockOutSerialNo: string | null;
      createdAt: Date;
    }>>(
      `SELECT "date", "empNo", "empName", "clockInTime", "clockOutTime",
              "clockInSerialNo", "clockOutSerialNo", "createdAt"
       FROM "AttendanceLogST"
       WHERE "date" = $1
       ORDER BY "createdAt" DESC`,
      date,
    );

    const stLogs: AttendanceTodayRow[] = stRowsRaw.map(r => ({
      date:             r.date,
      empNo:            r.empNo,
      empName:          r.empName,
      clockInTime:      r.clockInTime,
      clockOutTime:     r.clockOutTime,
      clockInSerialNo:  r.clockInSerialNo,
      clockOutSerialNo: r.clockOutSerialNo,
      scannerLocation:  'Subang Taipan',
    }));

    return NextResponse.json([...mainLogs, ...stLogs]);
  } catch (err) {
    console.error('/api/attendance-today error:', err);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
