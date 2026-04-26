import { test, expect, login } from './fixtures';

test.describe('Claims smoke', () => {
  test('ADMIN can open the claims page and see the claim-type picker', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/claim');
    await expect(page).toHaveURL(/\/claim/);

    // The default view is a "Select Claim Type" picker (cards, not buttons).
    // Assert the heading renders — proves the page loaded for ADMIN.
    await expect(
      page.getByRole('heading', { name: /select claim type/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
