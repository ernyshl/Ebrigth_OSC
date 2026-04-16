import { NextResponse } from 'next/server';
import { request } from 'urllib';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const ip   = process.env.SCANNER_IP;
  const user = process.env.SCANNER_USER;
  const pass = process.env.SCANNER_PASS;

  if (!ip || !user || !pass) {
    return NextResponse.json(
      { error: 'Scanner not configured — set SCANNER_IP, SCANNER_USER, SCANNER_PASS in .env' },
      { status: 500 }
    );
  }

  try {
    const url  = `http://${ip}/ISAPI/AccessControl/UserInfo/Search?format=json`;
    const auth = `${user}:${pass}`;
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
