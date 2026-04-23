import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireRole } from '@/lib/auth';
import { MANAGEMENT_ROLES } from '@/lib/roles';
import { z } from 'zod';

const SaveScheduleSchema = z.object({
  id:                 z.string().min(1),
  branch:             z.string().min(1),
  startDate:          z.string().min(1),
  endDate:            z.string().min(1),
  selections:         z.any(),
  notes:              z.any(),
  originalSelections: z.any(),
  originalNotes:      z.any(),
  status:             z.string().optional(),
  originalAuthor:     z.string().optional(),
});

// GET /api/schedules — return all schedules, newest first
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const schedules = await prisma.manpowerSchedule.findMany({
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json({ success: true, schedules });
  } catch (err) {
    console.error('GET /api/schedules error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

// POST /api/schedules — create or update a schedule
export async function POST(req: Request) {
  const { session, error } = await requireRole(MANAGEMENT_ROLES);
  if (error) return error;

  try {
    const parsed = SaveScheduleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const schedule = await prisma.manpowerSchedule.upsert({
      where:  { id: body.id },
      update: {
        selections: body.selections,
        notes:      body.notes,
        status:     'Finalized',
      },
      create: {
        id:                 body.id,
        branch:             body.branch,
        startDate:          body.startDate,
        endDate:            body.endDate,
        selections:         body.selections,
        notes:              body.notes,
        originalSelections: body.originalSelections,
        originalNotes:      body.originalNotes,
        status:             body.status ?? 'Finalized',
        // originalAuthor comes from the verified session, not the request body
        originalAuthor:     session.user?.name ?? session.user?.email ?? 'Unknown',
      },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (err) {
    console.error('POST /api/schedules error:', err);
    return NextResponse.json({ success: false, error: 'Failed to save schedule' }, { status: 500 });
  }
}
