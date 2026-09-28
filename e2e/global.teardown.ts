import { test as teardown } from '@playwright/test'
import { rmSync } from 'node:fs'
import { cleanUp } from './support/backend'

// After every run (also after failures): remove everything the run created.
teardown('delete the [E2E] data and accounts', async () => {
  teardown.setTimeout(120_000)
  await cleanUp()
  rmSync('e2e/.auth', { recursive: true, force: true })
  rmSync('.env.e2e.local', { force: true })
})
