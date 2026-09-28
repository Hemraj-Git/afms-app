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

  await guest.page.getByPlaceholder('e.g. Class session, Inspection, Equipment check...').fill(`${E2E} lab session`)
  await guest.page.getByRole('button', { name: 'Confirm Check-In to Room' }).click()
  await expect(guest.page.getByText(`Active in: ${roomName}`)).toBeVisible()

  await findRoomCard(admin.page, roomName)
  await expect(admin.page.getByText(`In use by: ${GUEST.name}`)).toBeVisible()

  await guest.page.getByRole('button', { name: 'Check Out' }).first().click()
  await expect(guest.page.getByText(`Active in: ${roomName}`)).toHaveCount(0)

  await findRoomCard(admin.page, roomName)
  await expect(admin.page.getByText(`In use by: ${GUEST.name}`)).toHaveCount(0)

  await guest.context.close()
  await admin.context.close()
})

test('guest raises a housekeeping request; the Admin finds it on the Service Request Desk', async ({ browser }) => {
  const title = `${E2E} Spill near door ${stamp()}`
  const guest = await guestAtTestRoom(browser)

  await guest.page.getByRole('button', { name: 'Housekeeping' }).click()
  await guest.page.getByPlaceholder('e.g. Broken knob, Spilled water...').fill(title)
  await guest.page
    .getByPlaceholder('Describe what is malfunctioning, leaking, unhygienic, or needs immediate attention...')
    .fill('Water on the floor by the entrance (automated test).')
  await guest.page.getByRole('button', { name: 'Submit Service Request' }).click()
  await expect(guest.page.getByText('Service Request Logged Successfully!')).toBeVisible()
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
  await expect(admin.page.getByRole('row').filter({ hasText: title })).toContainText('Scheduled')

  // Technician: field app → Tasks → Execute Task
  const tech = await techPhone(browser)
  await tech.page.goto('/mobile')
  await tech.page.getByRole('button', { name: 'Tasks' }).click()
  await expect(tech.page.getByText(title)).toBeVisible()
  await tech.page.getByRole('button', { name: 'Execute Task' }).first().click()
  const job = tech.page.getByRole('dialog', { name: 'Work order' })
  await expect(job.getByText(title)).toBeVisible()

  // Completing without photos is refused (proof of presence).
  await job.getByRole('button', { name: 'Complete & Close' }).click()
  await expect(tech.page.getByText(/capture a photo at job start/i)).toBeVisible()

  // A part goes to an outside workshop: completing is refused until it is back.
  await job.getByRole('button', { name: '+ Send outside for repair' }).click()
  await job.getByRole('button', { name: 'A part / component' }).click()
  await job.getByLabel(/Part name/).fill(`${E2E} Control board`)
  await job.getByLabel(/Repair vendor/).selectOption({ index: 1 })
  const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  await job.getByLabel(/Expected return/).fill(inAWeek)
  await job.getByRole('button', { name: 'Send out' }).click()
  await expect(job.getByText(/OSR-\d{4}-\d{4}/).first()).toBeVisible()

  // Start photo, then the completion photo, then complete.
  await attachPhoto(tech.page, job.getByRole('button', { name: 'Snap' }).first())
  await expect(job.getByRole('button', { name: 'Retake Photo' }).first()).toBeVisible()
  await attachPhoto(tech.page, job.getByRole('button', { name: 'Snap' }).first())
  await expect(job.getByRole('button', { name: 'Retake Photo' })).toHaveCount(2)
  await job.getByRole('button', { name: 'Complete & Close' }).click()
  await expect(tech.page.getByText(/still out for repair/i).first()).toBeVisible()

  await job.getByRole('button', { name: 'Record return' }).first().click()
  await job.getByLabel(/Outcome/).selectOption('Repaired')
  await job.getByRole('button', { name: 'Save return' }).click()
  await expect(job.getByRole('button', { name: 'Record return' })).toHaveCount(0)
  await job.getByRole('button', { name: 'Complete & Close' }).click()
  await expect(tech.page.getByText(/marked as Completed/)).toBeVisible()
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
  await tech.page.getByRole('button', { name: 'Inspections' }).click()
  await expect(tech.page.getByText(assetName).first()).toBeVisible()
  const inspectionNumber = await currentInspectionNumber(tech.page)
  await tech.page.getByRole('button', { name: 'Conduct Inspection' }).first().click()
  const form = tech.page.getByRole('dialog', { name: 'Perform inspection' })

  for (const pass of await form.getByRole('button', { name: 'PASS', exact: true }).all()) await pass.click()
  // Checkpoints that require a photo.
  while ((await form.getByRole('button', { name: 'Attach Photo for this Checkpoint' }).count()) > 0) {
    await attachPhoto(tech.page, form.getByRole('button', { name: 'Attach Photo for this Checkpoint' }).first())
    await tech.page.waitForTimeout(300)
  }
  await form.getByPlaceholder('Record what you observed during the inspection...').fill(`${E2E} all good`)
  await form.getByRole('button', { name: 'Submit & Complete Inspection' }).click()
  await expect(tech.page.getByText('Inspection recorded successfully!')).toBeVisible()
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
