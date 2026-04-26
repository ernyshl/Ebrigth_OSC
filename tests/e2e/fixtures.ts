import { test as base, expect, type Page } from '@playwright/test';

export type LoginRole = 'admin' | 'ampang' | 'klang';

const CREDENTIALS: Record<LoginRole, { email: string; password: string }> = {
  admin:  { email: 'test.admin@ebright.test',  password: 'pass1234' },
  ampang: { email: 'test.ampang@ebright.test', password: 'pass1234' },
  klang:  { email: 'test.klang@ebright.test',  password: 'pass1234' },
};

export async function login(page: Page, role: LoginRole) {
  const { email, password } = CREDENTIALS[role];
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/home/);
}

export const test = base;
export { expect };
