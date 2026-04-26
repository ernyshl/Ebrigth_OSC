import { test, expect } from './fixtures';

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
