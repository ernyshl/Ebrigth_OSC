import { test, expect, login } from './fixtures';

test.describe('API auth boundary', () => {
  // GET routes that should return 401 to an unauthenticated request.
  const protectedGetRoutes = [
    '/api/attendance-today',
    '/api/hr-dashboard',
    '/api/manpower-cost',
    '/api/test-scanner',
    '/api/employees',
  ];

  for (const path of protectedGetRoutes) {
    test(`GET ${path} returns 401 without a session`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }

  // POST-only routes — verify auth on the actual exported method.
  test('POST /api/sync-medical-leave returns 401 without a session', async ({ request }) => {
    const res = await request.post('/api/sync-medical-leave');
    expect(res.status()).toBe(401);
  });
});

test.describe('Users endpoint role gate', () => {
  test('BRANCH_MANAGER cannot POST to /api/users (403)', async ({ page, request }) => {
    await login(page, 'ampang');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await request.post('/api/users', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { email: 'noop@ebright.test', password: 'whatever1', role: 'BRANCH_MANAGER', branchName: 'Klang' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Branch-staff branch scoping', () => {
  test('BRANCH_MANAGER (Ampang) does not see Klang staff', async ({ page, request }) => {
    await login(page, 'ampang');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/branch-staff', { headers: { cookie: cookieHeader } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.staff ?? data.data ?? []);
    expect(list.every((s: { branch?: string }) => s.branch === 'Ampang')).toBeTruthy();
  });
});
