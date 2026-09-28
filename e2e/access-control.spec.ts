import { expect, test } from '@playwright/test'
import { ACCOUNTS, createProfilelessAccount, readState } from './support/backend'
import { AUTH_FILE } from './support/session'

// Who can get where. These are the checks behind the auth hardening
// (migrations 0045/0048 and the route guard, sign-in and redirect fixes).

test.describe('a Technician', () => {
  test.use({ storageState: AUTH_FILE.tech })

  for (const path of ['/dashboard', '/admin/users', '/assets']) {
    test(`typing ${path} lands in the field app`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/mobile/)
    })
  }
})

test('an account with no staff profile is refused and left signed out', async ({ page }) => {
  const { password } = readState()
  const email = await createProfilelessAccount()

  await page.goto('/login')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In & Continue' }).click()
  await expect(page.getByText('No staff profile is registered for this account.')).toBeVisible()

  // The session must be gone: an Admin page sends them to sign in, not in.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('?redirect= cannot send someone to another site after signing in', async ({ page }) => {
  const { password } = readState()
  await page.goto('/login?redirect=' + encodeURIComponent('//evil.example.com/steal'))
  await page.getByPlaceholder('Enter your email').fill(ACCOUNTS.admin.email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In & Continue' }).click()
  await page.waitForURL(/localhost:3000\/dashboard/, { timeout: 60_000 })
  expect(new URL(page.url()).host).toBe('localhost:3000')
})

test.describe('email links (/auth/confirm)', () => {
  test('a token type the app never sends is refused', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=x&type=magiclink')
    await expect(page).toHaveURL(/\/auth\/auth-error/)
  })

  test('an invalid reset token still ends on the error page', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery&next=' + encodeURIComponent('/admin/users'))
    await expect(page).toHaveURL(/\/auth\/auth-error/)
  })
})
