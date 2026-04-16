import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { BRANCH_LIST, normalizeLocation } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const location = req.nextUrl.searchParams.get('location');

    if (!location) {
      return NextResponse.json({ locations: BRANCH_LIST });
    }

    const all = await prisma.branchStaff.findMany({
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
      where:   { status: 'Active' },
      orderBy: { name: 'asc' },
    });

    const filtered = all.filter(s => normalizeLocation(s.location) === location);
    return NextResponse.json({ staff: filtered });
  } catch (err) {
    console.error('/api/branch-locations error:', err);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
