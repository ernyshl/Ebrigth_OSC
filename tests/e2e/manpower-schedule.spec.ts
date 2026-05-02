import { test, expect, login } from './fixtures';

test.describe('Manpower schedule smoke', () => {
  test('BRANCH_MANAGER (Ampang) can open the schedule page', async ({ page }) => {
    await login(page, 'ampang');
    await page.goto('/manpower-schedule');
    await expect(page).toHaveURL(/\/manpower-schedule/);

    // Page should render without auth redirect.
    await expect(page).not.toHaveURL(/\/login/);
  });
});
