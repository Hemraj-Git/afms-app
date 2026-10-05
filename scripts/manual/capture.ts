// Screenshots for the user manuals, taken from a running app with the sample
// records of demo.ts in place.
//
//   npx tsx scripts/manual/demo.ts seed
//   npm run build && npx next start -p 3100
//   npx tsx scripts/manual/capture.ts [desktop|phone|all] [only-these-names...]
//   npx tsx scripts/manual/demo.ts clean
//
// Images go to docs/manual/shots/ (desktop-*.jpg, phone-*.jpg).

import { chromium, devices, type Browser, type Locator, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.MANUAL_BASE_URL || 'http://localhost:3100'
const OUT = 'docs/manual/shots'
const manifest = JSON.parse(readFileSync('data-loads/manual-demo-manifest.json', 'utf8')) as {
  password: string
  users: Record<string, { email: string; name: string }>
}

type Step = (page: Page) => Promise<unknown>
interface Shot {
  name: string
  path: string
  steps?: Step[]
  // What to photograph: the whole window (default for the phone), the page
  // content without the sidebar and header ('main', the desktop default), an
  // open dialog, or any element.
  target?: 'window' | 'main' | 'dialog' | ((page: Page) => Locator)
  // A taller window, for pages whose content runs below the fold.
  height?: number
  // Grow the window until the scrolling content fits (long phone screens).
  fit?: boolean
}

const DESKTOP_SIZE = { width: 1440, height: 900 }

// The app's loading placeholders (not the bell's pulsing badge).
const settle = async (page: Page, ms = 1000) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.locator('span.block.rounded-md.animate-pulse').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(ms)
}
const click = (name: string | RegExp, role: 'button' | 'link' | 'tab' = 'button'): Step => async page => {
  await page.getByRole(role, { name }).first().click()
  await settle(page, 700)
}
const clickText = (text: string | RegExp): Step => async page => {
  await page.getByText(text).first().click()
  await settle(page, 700)
}
const inRow = (rowText: string | RegExp, button: string | RegExp): Step => async page => {
  await page.getByRole('row').filter({ hasText: rowText }).first().getByRole('button', { name: button }).first().click()
  await settle(page, 700)
}
const nthButton = (name: string | RegExp, n = 0): Step => async page => {
  await page.getByRole('button', { name }).nth(n).click()
  await settle(page, 900)
}
const press = (key: string): Step => async page => { await page.keyboard.press(key); await page.waitForTimeout(500) }
const type = (text: string): Step => async page => { await page.keyboard.type(text); await page.waitForTimeout(1200) }
const scrollTo = (text: string | RegExp): Step => async page => { await page.getByText(text).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(500) }

// The page behind is hidden so it doesn't show through the panel's rounded corners.
const hidePage: Step = async p => { await p.addStyleTag({ content: 'main { visibility: hidden !important; }' }); await p.waitForTimeout(300) }
const dropdown = (text: string) => (p: Page) => p.locator('header div.absolute').filter({ hasText: text }).first()

const DESKTOP: Shot[] = [
  { name: 'login', path: '/login', target: 'window' },
  { name: 'layout', path: '/dashboard', target: 'window' },
  { name: 'dashboard', path: '/dashboard', height: 1900 },
  { name: 'search', path: '/dashboard', target: 'dialog', steps: [press('Control+k'), type('AST-0001')] },
  { name: 'help-menu', path: '/dashboard', target: dropdown('Contact support'), steps: [click('Help and support'), hidePage] },
  { name: 'account-menu', path: '/dashboard', target: dropdown('Sign Out'), steps: [click(/^Account:/), hidePage] },
  { name: 'notifications', path: '/dashboard', target: dropdown('Notifications'), steps: [async p => { await p.getByTitle('Notifications').click(); await p.waitForTimeout(800) }, hidePage] },
  { name: 'about', path: '/dashboard', target: 'dialog', steps: [click('Help and support'), click(/About AssetNXG/)] },
  { name: 'change-password', path: '/dashboard', target: 'dialog', steps: [click(/^Account:/), click('Change password')] },

  { name: 'campus', path: '/organization/campus' },
  { name: 'buildings', path: '/organization/building' },
  { name: 'rooms', path: '/organization/rooms' },
  { name: 'room-add', path: '/organization/rooms', target: 'dialog', steps: [click(/Add Room/)] },
  { name: 'room-types', path: '/organization/rooms', target: 'dialog', steps: [click(/Manage Room Types/)] },
  { name: 'room-hub', path: '/organization/rooms', steps: [async p => { await p.getByRole('row').filter({ hasText: 'ROM-0007' }).getByRole('link', { name: /Room Hub/ }).click(); await settle(p, 1500) }] },
  { name: 'categories', path: '/categories' },
  { name: 'sub-categories', path: '/sub-categories' },
  { name: 'sub-category-add', path: '/sub-categories', target: 'dialog', steps: [click(/Add Sub-Category/)] },
  { name: 'pm-templates', path: '/utility/maintenance-templates' },
  { name: 'pm-template-add', path: '/utility/maintenance-templates', target: 'dialog', steps: [click(/Create PM Template/)] },
  { name: 'inspection-templates', path: '/utility/inspection-templates' },
  { name: 'vendors', path: '/utility/vendors' },
  { name: 'users', path: '/admin/users' },
  { name: 'user-add', path: '/admin/users', target: 'dialog', steps: [click(/Add User/)] },
  { name: 'departments', path: '/admin/users', steps: [click(/^Departments/)] },

  { name: 'assets', path: '/assets' },
  { name: 'asset-create', path: '/assets/create', height: 1700 },
  { name: 'asset-detail', path: '/assets', height: 1500, steps: [clickText('Split AC 1.5 Ton')] },
  { name: 'asset-schedule-add', path: '/assets', target: 'dialog', steps: [clickText('Split AC 2 Ton'), click(/Add a schedule/)] },
  { name: 'asset-history', path: '/assets', steps: [clickText('Split AC 1.5 Ton'), click(/Activity Timeline/), scrollTo(/Activity Timeline/)] },
  { name: 'inventory', path: '/inventory' },
  { name: 'qr-codes', path: '/utility/qr-codes' },
  { name: 'documents', path: '/utility/documents' },

  { name: 'service-requests', path: '/service-requests' },
  { name: 'sr-create', path: '/service-requests', target: 'dialog', steps: [click(/Create Service Request/)] },
  { name: 'sr-action', path: '/service-requests', target: 'dialog', steps: [inRow('AC not cooling', /Action/)] },
  { name: 'sla-rules', path: '/maintenance/work-orders', target: 'dialog', steps: [click(/Configure SLA Rules/)] },
  { name: 'work-orders', path: '/maintenance/work-orders' },
  { name: 'wo-create', path: '/maintenance/work-orders', target: 'dialog', steps: [click(/Create Work Order/)] },
  { name: 'wo-details', path: '/maintenance/work-orders', target: 'dialog', steps: [inRow('WO-CR-2026-0004', /View Details/)] },
  { name: 'wo-details-done', path: '/maintenance/work-orders', target: 'dialog', steps: [inRow('WO-CR-2026-0005', /View Details/)] },
  { name: 'preventive', path: '/maintenance/preventive' },
  { name: 'corrective', path: '/maintenance/corrective' },
  { name: 'housekeeping', path: '/maintenance/housekeeping' },
  { name: 'outside-repairs', path: '/maintenance/outside-repairs' },
  { name: 'inspections', path: '/inspections' },
  { name: 'inspection-assign', path: '/inspections', target: 'dialog', steps: [inRow('INSP-2026-0019', /Assign Inspector/)] },
  { name: 'inspection-details', path: '/inspections', target: 'dialog', steps: [inRow('INSP-2026-0017', /View Details/)] },
  { name: 'reservations', path: '/reservations' },
  { name: 'reservation-book', path: '/reservations', target: 'dialog', steps: [click(/Book Reservation/)] },
  { name: 'reports', path: '/reports', steps: [click(/^All Records$/)] },
]

// Before signing in.
const PHONE_SIGNED_OUT: Shot[] = [
  { name: 'login', path: '/login' },
  { name: 'guest', path: '/login', steps: [clickText('Guest access')] },
]

const PHONE: Record<string, Shot[]> = {
  tech: [
    { name: 'tech-tasks', path: '/mobile' },
    { name: 'tech-job', path: '/mobile', steps: [nthButton(/^Continue$/)] },
    { name: 'tech-job-full', path: '/mobile', fit: true, steps: [nthButton(/^Continue$/)] },
    { name: 'tech-notifications', path: '/mobile', steps: [click(/notification/i)] },
    { name: 'tech-scan', path: '/mobile', steps: [click(/^Scan/)] },
    { name: 'tech-pick-room', path: '/mobile', steps: [click(/^Scan/), click(/Pick a room/)] },
    { name: 'tech-room', path: '/mobile', steps: [click(/^Scan/), click(/Pick a room/), clickText('Conference')] },
    { name: 'tech-requests', path: '/mobile', steps: [click(/^Requests/)] },
    { name: 'tech-new-request', path: '/mobile', steps: [click(/^Requests/), click(/New request/)] },
    { name: 'tech-profile', path: '/mobile', steps: [click(/^Profile/)] },
  ],
  tech2: [
    { name: 'tech2-breakdown', path: '/mobile', fit: true, steps: [nthButton(/^Continue$/)] },
  ],
  hk: [
    { name: 'hk-cleaning', path: '/mobile' },
    { name: 'hk-task', path: '/mobile', fit: true, steps: [nthButton(/^Start$/, 1)] },
    { name: 'hk-request-task', path: '/mobile', fit: true, steps: [nthButton(/^Start$/, 0)] },
  ],
  faculty: [
    { name: 'faculty-inspections', path: '/mobile' },
    { name: 'faculty-inspection', path: '/mobile', fit: true, steps: [nthButton(/^Start inspection$/)] },
    { name: 'faculty-requests', path: '/mobile', steps: [click(/^Requests/)] },
    { name: 'faculty-room-checked-in', path: '/mobile', steps: [click(/^Scan/)] },
  ],
}

async function newPage(browser: Browser, phone: boolean) {
  const ctx = await browser.newContext(phone ? { ...devices['Pixel 7'] } : { viewport: DESKTOP_SIZE, deviceScaleFactor: 2, permissions: ['notifications'] })
  return ctx.newPage()
}

async function signIn(page: Page, who: string, phone: boolean) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Enter your email').fill(manifest.users[who].email)
  await page.getByPlaceholder('Enter your password').fill(manifest.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(phone ? /\/mobile/ : /\/dashboard/, { timeout: 120000 })
  await settle(page)
}

async function take(page: Page, prefix: string, shot: Shot, phone: boolean) {
  try {
    const base = phone ? devices['Pixel 7'].viewport : DESKTOP_SIZE
    await page.setViewportSize({ width: base.width, height: shot.height ?? base.height })
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' })
    await settle(page)
    for (const step of shot.steps ?? []) await step(page)
    if (shot.fit) {
      const extra = await page.evaluate(() => {
        const m = [...document.querySelectorAll('main')].find(el => el.scrollHeight > el.clientHeight)
        return m ? m.scrollHeight - m.clientHeight : 0
      })
      const size = page.viewportSize()!
      if (extra > 0) await page.setViewportSize({ width: size.width, height: size.height + extra })
      await page.waitForTimeout(800)
    }
    const file = `${OUT}/${prefix}-${shot.name}.jpg`
    const target = shot.target ?? (phone ? 'window' : 'main')
    const opts = { path: file, type: 'jpeg' as const, quality: 88 }
    if (target === 'window') {
      await page.screenshot(opts)
      // A long phone screen also as two halves, to print side by side.
      if (shot.fit) {
        const { width, height } = page.viewportSize()!
        const half = Math.ceil(height / 2)
        await page.screenshot({ ...opts, path: file.replace('.jpg', '-a.jpg'), clip: { x: 0, y: 0, width, height: half } })
        await page.screenshot({ ...opts, path: file.replace('.jpg', '-b.jpg'), clip: { x: 0, y: half, width, height: height - half } })
      }
    } else if (target === 'main') {
      const panel = (await page.locator('main').first().boundingBox())!
      const content = (await page.locator('main > *').first().boundingBox())!
      const bottom = Math.min(panel.y + panel.height, content.y + content.height + 24)
      await page.screenshot({ ...opts, clip: { x: panel.x, y: panel.y, width: panel.width, height: bottom - panel.y } })
    }
    else if (target === 'dialog') await page.getByRole('dialog').last().screenshot(opts)
    else await target(page).first().screenshot(opts)
    console.log('ok  ', file)
  } catch (e) {
    console.log('FAIL', `${prefix}-${shot.name}:`, (e as Error).message.split('\n')[0])
  } finally {
    await page.keyboard.press('Escape').catch(() => {})
  }
}

async function main() {
  const [what = 'all', ...only] = process.argv.slice(2)
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  const want = (s: Shot) => !only.length || only.includes(s.name)
  const browser = await chromium.launch()
  try {
    if (what === 'all' || what === 'desktop') {
      const list = DESKTOP.filter(want)
      if (list.some(s => s.name === 'login')) await take(await newPage(browser, false), 'desktop', DESKTOP[0], false)
      const rest = list.filter(s => s.name !== 'login')
      if (rest.length) {
        const page = await newPage(browser, false)
        await signIn(page, 'admin', false)
        for (const s of rest) await take(page, 'desktop', s, false)
      }
    }
    if (what === 'all' || what === 'phone') {
      const signedOut = PHONE_SIGNED_OUT.filter(want)
      if (signedOut.length) {
        const page = await newPage(browser, true)
        for (const s of signedOut) await take(page, 'phone', s, true)
      }
      for (const [who, shots] of Object.entries(PHONE)) {
        const list = shots.filter(want)
        if (!list.length) continue
        const page = await newPage(browser, true)
        await signIn(page, who, true)
        for (const s of list) await take(page, 'phone', s, true)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
