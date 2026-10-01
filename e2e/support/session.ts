import { devices, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ACCOUNTS, GUEST, readState } from './backend'

export const AUTH_FILE = { admin: 'e2e/.auth/admin.json', tech: 'e2e/.auth/tech.json' } as const

// Staff sign-in through the real login form; saves the session for the tests.
export async function signIn(page: Page, who: keyof typeof ACCOUNTS) {
  const { password } = readState()
  await page.goto('/login')
  await page.getByPlaceholder('Enter your email').fill(ACCOUNTS[who].email)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(who === 'admin' ? /\/dashboard/ : /\/mobile/, { timeout: 60_000 })
}

// Uncaught errors from any page these helpers open; field-flows.spec.ts checks
// it is empty after each test.
export const pageErrors: string[] = []
function collectErrors(page: Page) {
  page.on('pageerror', e => pageErrors.push(`${page.url()}: ${e.message}`))
  return page
}

// Next's dev-only issue badge sits over the field app's bottom navigation and
// takes the taps; hide it (real errors are caught by watchForCrashes instead).
async function hideDevOverlay(context: BrowserContext) {
  await context.addInitScript(() => {
    const add = () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    }
    if (document.head) add()
    else document.addEventListener('DOMContentLoaded', add)
  })
}

// A signed-in Admin on the desktop.
export async function adminPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: AUTH_FILE.admin, viewport: { width: 1440, height: 900 } })
  await hideDevOverlay(context)
  return { context, page: collectErrors(await context.newPage()) }
}

// A signed-in Technician on a phone-sized screen.
export async function techPhone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...devices['Pixel 7'], storageState: AUTH_FILE.tech })
  await hideDevOverlay(context)
  return { context, page: collectErrors(await context.newPage()) }
}

// A guest who scanned the test room's QR code, on a phone: the QR link sends
// them to login, they continue as a guest and land on the room in the field app.
export async function guestAtTestRoom(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const { roomId, roomName } = readState()
  const context = await browser.newContext({ ...devices['Pixel 7'] })
  await hideDevOverlay(context)
  const page = collectErrors(await context.newPage())
  await page.goto(`/qr?type=room&id=${encodeURIComponent(roomId)}`)
  await page.waitForURL(/\/login/)
  await page.getByRole('radio', { name: 'Guest access' }).click()
  await page.getByPlaceholder('e.g. Anita Desai').fill(GUEST.name)
  await page.getByPlaceholder('name@example.com').fill(GUEST.email)
  await page.getByPlaceholder('10-digit mobile number').fill(GUEST.phone)
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await page.waitForURL(/\/mobile/, { timeout: 60_000 })
  await expect(page.getByText(roomName).first()).toBeVisible()
  return { context, page }
}

// Answers a photo button's file picker with a tiny PNG.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
export async function attachPhoto(page: Page, button: ReturnType<Page['getByRole']>) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()])
  await chooser.setFiles({ name: 'e2e-photo.png', mimeType: 'image/png', buffer: PNG_1PX })
}

// Fails the test on any uncaught error in the page.
export function watchForCrashes(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  return () => expect(errors, 'uncaught errors in the page').toEqual([])
}
