import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, canSeeAllBranches } from '@/lib/auth';
import { isEmployee } from '@/lib/roles';
import { BRANCH_LIST, normalizeLocation } from '@/lib/constants';

// Scoping:
//   Admin / HOD            → any location.
//   Branch Manager         → only their own branch's location.
//   Part_Time / Full_Time  → only their own row.
//   Anyone else            → empty (fail closed).

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const location = req.nextUrl.searchParams.get('location');
    const sessionUser = session.user as { role?: unknown; email?: string | null; branchName?: string };

    if (!location) {
      return NextResponse.json({ locations: BRANCH_LIST });
    }

    if (!canSeeAllBranches(session)) {
      if (isEmployee(sessionUser?.role)) {
        if (!sessionUser.email) return NextResponse.json({ staff: [] });
        const self = await prisma.branchStaff.findFirst({
          where: {
            email:  { equals: sessionUser.email, mode: 'insensitive' },
            status: 'Active',
          },
          select: {
            id:         true,
            name:       true,
            nickname:   true,
            employeeId: true,
            department: true,
            role:       true,
            email:      true,
            status:     true,
            location:   true,
          },
        });
        if (!self || normalizeLocation(self.location) !== location) {
          return NextResponse.json({ staff: [] });
        }
        return NextResponse.json({ staff: [self] });
      }
      // BM and other non-admins: must match own branch.
      // We treat `branchName` and the `location` query as both running through
      // normalizeLocation so short codes (KLG) and full names (Klang) resolve
      // to the same canonical key. 'Unknown' fails closed.
      const userBranchKey = normalizeLocation(sessionUser?.branchName ?? null);
      if (userBranchKey === 'Unknown' || userBranchKey !== location) {
        return NextResponse.json({ staff: [] });
      }
    }

    const all = await prisma.branchStaff.findMany({
      select: {
        id:         true,
        name:       true,
        nickname:   true,
        employeeId: true,
        branch:     true,
        department: true,
        role:       true,
        email:      true,
        status:     true,
        location:   true,
      },
      where:   { status: 'Active' },
      orderBy: { name: 'asc' },
    });

    // `location=all` is the lookup-by-employeeId path used by the attendance
    // summary so it can resolve names + roles for staff who scanned at one
    // branch but are registered to another. Anything else filters by the
    // staff member's normalized location as before.
    if (location === 'all') {
      return NextResponse.json({ staff: all });
    }

    const filtered = all.filter(s => normalizeLocation(s.location) === location);
    return NextResponse.json({ staff: filtered });
  } catch (err) {
    console.error('/api/branch-locations error:', err);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
