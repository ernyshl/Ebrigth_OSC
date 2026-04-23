import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// GET /api/attendance-today
// Returns today's AttendanceLog rows — used by Summary dashboard
// The office scanner-sync script writes these rows every 5s

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); // YYYY-MM-DD

    const logs = await prisma.attendanceLog.findMany({
      where: { date: today },
      orderBy: { createdAt: 'desc' },
      select: {
        empNo: true,
        empName: true,
        clockInTime: true,
        clockOutTime: true,
        clockInSerialNo: true,
        clockOutSerialNo: true,
      },
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error('/api/attendance-today error:', err);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
