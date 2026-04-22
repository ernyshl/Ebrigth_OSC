import { test, expect } from '@playwright/test'

const EMAIL = 'admin@ebright.my'
const PASSWORD = 'password123'

test.describe('CRM Smoke Tests', () => {
  test('login and reach dashboard', async ({ page }) => {
    await page.goto('/crm/login')
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()

    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await page.waitForURL('**/crm/dashboard', { timeout: 10000 })
    await expect(page.getByText(/dashboard/i)).toBeVisible()
  })

  test('navigate to contacts and open create modal', async ({ page }) => {
    // Login first
    await page.goto('/crm/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/crm/dashboard')

    // Navigate to contacts
    await page.goto('/crm/contacts')
    await expect(page.getByText(/contacts/i).first()).toBeVisible()

    // Open new contact modal
    await page.getByRole('button', { name: /new contact/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel(/first name/i)).toBeVisible()
  })

  test('create a contact', async ({ page }) => {
    await page.goto('/crm/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/crm/dashboard')

    await page.goto('/crm/contacts')
    await page.getByRole('button', { name: /new contact/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/first name/i).fill('E2E Test')
    await dialog.getByLabel(/phone/i).fill('0112345678')

    await dialog.getByRole('button', { name: /save|create/i }).click()

    // Should appear in contacts list
    await expect(page.getByText('E2E Test')).toBeVisible({ timeout: 5000 })
  })

  test('navigate to opportunities Kanban', async ({ page }) => {
    await page.goto('/crm/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/crm/dashboard')

    await page.goto('/crm/opportunities')
    await expect(page.getByText(/new lead|pipeline/i)).toBeVisible()
    // At least one kanban column should be visible
    await expect(page.locator('[data-rbd-droppable-id]').first()).toBeVisible()
  })

  test('navigate to automations', async ({ page }) => {
    await page.goto('/crm/login')
    await page.getByLabel(/email/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/crm/dashboard')

    await page.goto('/crm/automations')
    await expect(page.getByText(/automations/i).first()).toBeVisible()
    // Pre-built automation should appear
    await expect(page.getByText(/welcome new lead/i)).toBeVisible()
  })
})
