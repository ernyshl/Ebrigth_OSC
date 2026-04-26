import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireRole } from '@/lib/auth';
import { MANAGEMENT_ROLES } from '@/lib/roles';

type ScheduleBody = {
  id: string;
  branch: string;
  startDate: string;
  endDate: string;
  selections: unknown;
  notes: unknown;
  originalSelections: unknown;
  originalNotes: unknown;
  status?: string;
  originalAuthor?: string;
};

function parseSchedule(raw: unknown): { ok: true; data: ScheduleBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Invalid JSON body' };
  const b = raw as Record<string, unknown>;
  if (typeof b.id !== 'string' || b.id.length === 0) return { ok: false, error: 'id is required' };
  if (typeof b.branch !== 'string' || b.branch.length === 0) return { ok: false, error: 'branch is required' };
  if (typeof b.startDate !== 'string' || b.startDate.length === 0) return { ok: false, error: 'startDate is required' };
  if (typeof b.endDate !== 'string' || b.endDate.length === 0) return { ok: false, error: 'endDate is required' };
  if (b.status !== undefined && typeof b.status !== 'string') return { ok: false, error: 'status must be a string' };
  if (b.originalAuthor !== undefined && typeof b.originalAuthor !== 'string') return { ok: false, error: 'originalAuthor must be a string' };
  return {
    ok: true,
    data: {
      id:                 b.id,
      branch:             b.branch,
      startDate:          b.startDate,
      endDate:            b.endDate,
      selections:         b.selections,
      notes:              b.notes,
      originalSelections: b.originalSelections,
      originalNotes:      b.originalNotes,
      status:             b.status         as string | undefined,
      originalAuthor:     b.originalAuthor as string | undefined,
    },
  };
}

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
    const parsed = parseSchedule(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const schedule = await prisma.manpowerSchedule.upsert({
      where:  { id: body.id },
      update: {
        selections: body.selections as any,
        notes:      body.notes as any,
        status:     'Finalized',
      },
      create: {
        id:                 body.id,
        branch:             body.branch,
        startDate:          body.startDate,
        endDate:            body.endDate,
        selections:         body.selections as any,
        notes:              body.notes as any,
        originalSelections: body.originalSelections as any,
        originalNotes:      body.originalNotes as any,
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
