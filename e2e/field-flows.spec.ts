import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, E2E, GUEST, readState } from './support/backend'
import { adminPage, attachPhoto, guestAtTestRoom, pageErrors, techPhone } from './support/session'

// Whole journeys across people: a guest on a phone, a technician on a phone,
// and the Admin on the desktop, all on the same test room / asset.

test.describe.configure({ mode: 'serial' })

// No uncaught error on any screen these journeys went through.
test.afterEach(() => {
  expect(pageErrors.splice(0), 'uncaught errors in the pages').toEqual([])
})

const stamp = () => Date.now().toString(36).toUpperCase()

async function findRoomCard(admin: Page, roomName: string) {
  await admin.goto('/organization/rooms')
  await admin.getByPlaceholder('Search ROM-####, room name, building...').fill(roomName)
  await expect(admin.getByText(roomName).first()).toBeVisible()
}

test('guest checks in and out; the Admin sees the room occupied, then free', async ({ browser }) => {
  const { roomName } = readState()
  const guest = await guestAtTestRoom(browser)
  const admin = await adminPage(browser)

  // The QR link opened the room: check in with a purpose.
  await guest.page.getByRole('button', { name: 'Lab session' }).click()
  await guest.page.getByLabel('Details (optional)').fill(`${E2E} lab session`)
  await guest.page.getByRole('button', { name: 'Confirm check-in' }).click()
  await expect(guest.page.getByText('You’re checked in', { exact: true })).toBeVisible()

  await findRoomCard(admin.page, roomName)
  await expect(admin.page.getByText(`In use by: ${GUEST.name}`)).toBeVisible()

  await guest.page.getByRole('button', { name: 'Check out' }).first().click()
  await guest.page.getByRole('dialog').getByRole('button', { name: 'Check out' }).click()
  await expect(guest.page.getByText('You’re checked in', { exact: true })).toHaveCount(0)

  await findRoomCard(admin.page, roomName)
  await expect(admin.page.getByText(`In use by: ${GUEST.name}`)).toHaveCount(0)

  await guest.context.close()
  await admin.context.close()
})

test('guest raises a housekeeping request; the Admin finds it on the Service Request Desk', async ({ browser }) => {
  const title = `${E2E} Spill near door ${stamp()}`
  const guest = await guestAtTestRoom(browser)

  await guest.page.getByRole('button', { name: 'Report a problem here' }).click()
  await expect(guest.page.getByText('Filled in from your scan.')).toBeVisible()
  await guest.page.getByRole('radio', { name: 'Housekeeping' }).click()
  await guest.page.getByLabel('Title').fill(title)
  await guest.page.getByLabel(/^Description/).fill('Water on the floor by the entrance (automated test).')
  await guest.page.getByRole('button', { name: 'Submit request' }).click()
  await expect(guest.page.getByRole('heading', { name: 'Request submitted' })).toBeVisible()
  await guest.context.close()

  const admin = await adminPage(browser)
  await admin.page.goto(`/service-requests?q=${encodeURIComponent(title)}`)
  const row = admin.page.getByRole('row').filter({ hasText: title })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Open')
  await admin.context.close()
})

test('Admin creates and assigns a corrective work order; the technician sends a part out, gets it back and completes it', async ({ browser }) => {
  const { assetTag, roomName } = readState()
  const title = `${E2E} Pump noise ${stamp()}`

  // Admin: Work Orders → Create Work Order
  const admin = await adminPage(browser)
  await admin.page.goto('/maintenance/work-orders')
  await admin.page.getByRole('button', { name: 'Create Work Order' }).first().click()
  const form = admin.page.getByRole('dialog', { name: 'Create Work Order' })
  await form.getByRole('button', { name: 'Corrective' }).click()
  await form.getByLabel('Work Order Title *').fill(title)
  await form.getByLabel('Select Target Asset *').selectOption({ label: await optionLabel(form, 'Select Target Asset *', assetTag) })
  await form.getByLabel('Target Room / Area *').selectOption({ label: await optionLabel(form, 'Target Room / Area *', roomName) })
  await form.getByLabel('Assign Technician/Staff *').selectOption({ label: `${ACCOUNTS.tech.name} (Technician)` })
  await form.getByRole('button', { name: 'Create Work Order' }).click()
  await expect(form).toHaveCount(0)
  await admin.page.getByPlaceholder('Search WO#, asset, room, tech...').fill(title)
  const adminRow = admin.page.getByRole('row').filter({ hasText: title })
  await expect(adminRow).toContainText('Scheduled')
  const woNumber = (await adminRow.textContent())?.match(/WO-CR-\d{4}-\d{4}/)?.[0]
  if (!woNumber) throw new Error('no work order number in the Admin list')

  // Technician: field app → Tasks (their home) → the job's card → Start
  const tech = await techPhone(browser)
  await tech.page.goto('/mobile')
  await tech.page.locator('article', { hasText: woNumber }).getByRole('button', { name: 'Start' }).click()
  await expect(tech.page.getByRole('heading', { name: title })).toBeVisible()

  // Completing without photos is refused (proof of presence).
  await tech.page.getByRole('button', { name: /Complete & close/ }).click()
  await expect(tech.page.getByText('Take the photo with the asset on site.').first()).toBeVisible()

  // A part goes to an outside workshop: completing is refused until it is back.
  await tech.page.getByRole('button', { name: 'Send a part or the asset out' }).click()
  const send = tech.page.getByRole('dialog')
  await send.getByLabel(/Part name/).fill(`${E2E} Control board`)
  await send.getByLabel(/Repair vendor/).selectOption({ index: 1 })
  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  await send.getByLabel(/Expected back/).fill(inAWeek)
  await send.getByRole('button', { name: 'Record as sent' }).click()
  await expect(tech.page.getByText(/OSR-\d{4}-\d{4}/).first()).toBeVisible()

  // The on-site photo, then the after-repair photo, then complete.
  await attachPhoto(tech.page, tech.page.getByRole('button', { name: /Photo with the asset on site/ }))
  await expect(tech.page.getByText(/Uploaded · /)).toHaveCount(1)
  await attachPhoto(tech.page, tech.page.getByRole('button', { name: /After repair/ }))
  await expect(tech.page.getByText(/Uploaded · /)).toHaveCount(2)
  await tech.page.getByRole('button', { name: /Complete & close/ }).click()
  await expect(tech.page.getByText(/still out for repair/i).first()).toBeVisible()

  await tech.page.getByRole('button', { name: 'Mark received back' }).click()
  const back = tech.page.getByRole('dialog')
  await back.getByLabel(/Outcome/).selectOption('Repaired')
  await back.getByRole('button', { name: 'Save' }).click()
  await expect(tech.page.getByRole('button', { name: 'Mark received back' })).toHaveCount(0)
  await tech.page.getByRole('button', { name: /Complete & close/ }).click()
  await tech.page.getByRole('dialog').getByRole('button', { name: /Complete & close/ }).click()
  await expect(tech.page.getByText(`${woNumber} completed`)).toBeVisible()
  await tech.context.close()

  // Admin: the order is completed.
  await admin.page.reload()
  await admin.page.getByPlaceholder('Search WO#, asset, room, tech...').fill(title)
  await expect(admin.page.getByRole('row').filter({ hasText: title })).toContainText('Completed')
  await admin.context.close()
})

test('technician passes the scheduled inspection; the Admin sees PASS', async ({ browser }) => {
  const { assetName } = readState()
  const tech = await techPhone(browser)
  await tech.page.goto('/mobile')
  await tech.page.getByRole('button', { name: /Inspections/ }).click()
  await expect(tech.page.getByText(assetName).first()).toBeVisible()
  const inspectionNumber = await currentInspectionNumber(tech.page)
  await tech.page.locator('article', { hasText: inspectionNumber }).getByRole('button', { name: 'Start inspection' }).click()

  for (const pass of await tech.page.getByRole('button', { name: 'PASS', exact: true }).all()) await pass.click()
  // Checkpoints that require a photo.
  for (let left = await photoSlots(tech.page); left > 0; left--) {
    await attachPhoto(tech.page, tech.page.getByRole('button', { name: /Photo of this checkpoint/ }).first())
    await expect.poll(() => photoSlots(tech.page)).toBe(left - 1)
  }
  await tech.page.getByLabel('Observations').fill(`${E2E} all good`)
  await tech.page.getByRole('button', { name: /Submit & complete/ }).click()
  await tech.page.getByRole('dialog').getByRole('button', { name: /Submit & complete/ }).click()
  await expect(tech.page.getByRole('heading', { name: 'PASSED' })).toBeVisible()
  await tech.context.close()

  const admin = await adminPage(browser)
  await admin.page.goto(`/inspections?q=${encodeURIComponent(inspectionNumber)}`)
  await expect(admin.page.getByRole('row').filter({ hasText: inspectionNumber })).toContainText('PASS')
  await admin.context.close()
})

// The visible label of the first option in a select whose text contains `part`.
async function optionLabel(scope: ReturnType<Page['getByRole']>, label: string, part: string) {
  const text = await scope.getByLabel(label).locator('option', { hasText: part }).first().textContent()
  if (!text) throw new Error(`no option containing ${part}`)
  return text.trim()
}

// The test inspection's number, read from the technician's list.
async function currentInspectionNumber(page: Page) {
  const text = await page.getByText(/INSP-\d{4}-\d{4}/).first().textContent()
  const m = text?.match(/INSP-\d{4}-\d{4}/)
  if (!m) throw new Error('no inspection number on screen')
  return m[0]
}

// How many checkpoint photos are still to take.
const photoSlots = (page: Page) => page.getByRole('button', { name: /Photo of this checkpoint/ }).count()
