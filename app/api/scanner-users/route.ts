import { NextResponse } from 'next/server';
import { request } from 'urllib';
import { requireRole } from '@/lib/auth';
import { ADMIN_ROLES } from '@/lib/roles';
import { SCANNERS } from '@/lib/scanners';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const scanner = SCANNERS[0];

  if (!scanner.ip || !scanner.user || !scanner.pass) {
    return NextResponse.json(
      { error: 'Scanner not configured — check SCANNER_1_IP, SCANNER_1_USER, SCANNER_1_PASS in .env' },
      { status: 500 }
    );
  }

  try {
    const url  = `http://${scanner.ip}/ISAPI/AccessControl/UserInfo/Search?format=json`;
    const auth = `${scanner.user}:${scanner.pass}`;
    const allUsers: { employeeNo: string; name: string }[] = [];
    const seen = new Set<string>();
    let position = 0;
    let fetching = true;

    while (fetching) {
      const { data, res } = await request(url, {
        method: 'POST',
        digestAuth: auth,
        content: JSON.stringify({
          UserInfoSearchCond: {
            searchID: Date.now().toString(),
            searchResultPosition: position,
            maxResults: 50,
          },
        }),
        contentType: 'application/json',
        dataType: 'json',
        timeout: 8000,
      });

      if (res.statusCode !== 200) break;

      const batch: { employeeNo?: string; name?: string }[] =
        (data as { UserInfoSearch?: { UserInfo?: { employeeNo?: string; name?: string }[] } })
          ?.UserInfoSearch?.UserInfo ?? [];

      for (const u of batch) {
        if (u.employeeNo && !seen.has(u.employeeNo)) {
          seen.add(u.employeeNo);
          allUsers.push({ employeeNo: u.employeeNo, name: (u.name ?? '').trim() });
        }
      }

      position += batch.length;
      const status = (data as { UserInfoSearch?: { responseStatusStrg?: string } })
        ?.UserInfoSearch?.responseStatusStrg;
      if (status !== 'MORE' || batch.length === 0) fetching = false;
    }

    return NextResponse.json(allUsers);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scanner-users] Error:', message);
    return NextResponse.json({ error: 'Failed to fetch scanner users' }, { status: 500 });
  }
}