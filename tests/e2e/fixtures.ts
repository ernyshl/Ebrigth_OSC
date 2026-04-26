import { test as base, expect, type Page } from '@playwright/test';

export type LoginRole = 'admin' | 'ampang' | 'klang';

const CREDENTIALS: Record<LoginRole, { email: string; password: string }> = {
  admin:  { email: 'test.admin@example.test',  password: 'pass1234' },
  ampang: { email: 'test.ampang@ebright.test', password: 'pass1234' },
  klang:  { email: 'test.klang@ebright.test',  password: 'pass1234' },
};

export async function login(page: Page, role: LoginRole) {
  const { email, password } = CREDENTIALS[role];
  await page.goto('/login');
  // The login form labels the field "Username" but accepts an email value.
  // DashboardHome treats ANY email containing "ebright" as a branch manager
  // — that's why the admin test user uses @example.test instead.
  await page.locator('input[name="username"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/home/);
}

export const test = base;
export { expect };
