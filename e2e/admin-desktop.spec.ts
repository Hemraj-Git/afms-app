import { expect, test } from '@playwright/test'
import { readState } from './support/backend'
import { AUTH_FILE, watchForCrashes } from './support/session'

// The Admin desktop: every main screen opens, and the shared pieces added in
// this release work (sortable/paged lists, Ctrl+K search, modals, inline errors).

test.use({ storageState: AUTH_FILE.admin })

const SCREENS: [string, RegExp][] = [
  ['/dashboard', /Facility Intelligence Dashboard/],
  ['/assets', /Physical Assets Directory/],
  ['/service-requests', /Service Request Desk/],
  ['/maintenance/work-orders', /Work Orders Central Hub/],
  ['/maintenance/corrective', /Corrective Maintenance/],
  ['/maintenance/preventive', /Preventive Maintenance/],
  ['/maintenance/housekeeping', /Housekeeping/],
  ['/maintenance/outside-repairs', /Outside Repairs/],
  ['/inspections', /Statutory & Quality Inspections/],
  ['/inventory', /Inventory Hub/],
  ['/reservations', /Room & Space Reservations/],
  ['/admin/users', /Personnel & Departments/],
  ['/organization/rooms', /Rooms & Operational Areas/],
  ['/reports', /./],
]

test('every main screen opens without errors', async ({ page }) => {
  const noCrashes = watchForCrashes(page)
  for (const [path, heading] of SCREENS) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first(), path).toHaveText(heading)
    await expect(page.getByText('Application error'), path).toHaveCount(0)
  }
  noCrashes()
})

test('the assets list searches, sorts and pages', async ({ page }) => {
  const { assetName, assetTag } = readState()
  await page.goto('/assets')
  await page.getByPlaceholder('Search Asset ID, name, manufacturer, model, serial no...').fill(assetTag)
  await expect(page.getByRole('row').filter({ hasText: assetName })).toHaveCount(1)
  await expect(page.getByText(/Showing 1–1 of 1/)).toBeVisible()

  await page.getByPlaceholder('Search Asset ID, name, manufacturer, model, serial no...').fill('')
  const nameHeading = page.getByRole('columnheader', { name: /Asset Item/ })
  await nameHeading.getByRole('button').click()
  await expect(nameHeading).toHaveAttribute('aria-sort', 'ascending')
  await nameHeading.getByRole('button').click()
  await expect(nameHeading).toHaveAttribute('aria-sort', 'descending')
  await expect(page.getByLabel('Rows per page')).toBeVisible()
})

test('Ctrl+K finds the test asset and opens it', async ({ page }) => {
  const { assetName, assetTag } = readState()
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.keyboard.press('Control+k')
  const box = page.getByRole('combobox')
  await expect(box).toBeFocused()
  await box.fill(assetTag)
  // The asset's inspection also mentions its name; look in the Assets group.
  await expect(page.getByRole('group', { name: 'Assets' }).getByRole('option').filter({ hasText: assetName })).toBeVisible()
  await box.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/assets/${assetTag}`))
})

test('Create Service Request: errors under the fields, Escape closes', async ({ page }) => {
  await page.goto('/service-requests')
  await page.getByRole('button', { name: /New Request|Create Service Request|Raise/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create Service Request' })
  await expect(dialog).toBeVisible()

  // The same rules as the phone: the room and a description; the title is optional.
  await dialog.getByRole('button', { name: 'Submit Service Request' }).click()
  const room = dialog.getByLabel('Room / Operational Area *')
  await expect(dialog.getByText('Choose the room or area.')).toBeVisible()
  await expect(room).toHaveAttribute('aria-invalid', 'true')
  await expect(room).toBeFocused()
  const description = dialog.getByLabel('Description *')
  await expect(dialog.getByText('Describe the problem.')).toBeVisible()

  await description.fill('Only checking the form')
  await expect(dialog.getByText('Describe the problem.')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
