import { test as setup } from '@playwright/test'
import { setUp } from './support/backend'
import { AUTH_FILE, signIn } from './support/session'

// Before every run: fresh [E2E] accounts, room, asset and inspection, then sign
// the Admin and the Technician in once and keep their sessions.
setup('test accounts, test data and sign-ins', async ({ browser }) => {
  setup.setTimeout(180_000)
  await setUp()
  for (const who of ['admin', 'tech'] as const) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await signIn(page, who)
    await context.storageState({ path: AUTH_FILE[who] })
    await context.close()
  }
})
