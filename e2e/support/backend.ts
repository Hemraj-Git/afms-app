// Server-side helpers for the end-to-end tests: create the test accounts and
// test room/asset before a run, and delete everything the run made afterwards.
// Uses the service-role key from .env.local (never logged). Everything created
// here or by the tests is marked "[E2E]" (or belongs to the E2E accounts) so the
// cleanup can find it, and so it is easy to spot if a run is interrupted.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

loadEnvConfig(process.cwd())

export const E2E = '[E2E]'
export const ACCOUNTS = {
  admin: { email: 'e2e-admin@afms-e2e.test', name: `${E2E} Admin`, role: 'Admin' },
  tech: { email: 'e2e-tech@afms-e2e.test', name: `${E2E} Technician`, role: 'Technician' },
} as const
export const GUEST = { email: 'e2e-guest@afms-e2e.test', name: `${E2E} Guest`, phone: '+91 90000 00000' }

// Written by setup, read by the tests (gitignored: .env*).
const STATE_FILE = '.env.e2e.local'

export interface E2EState {
  password: string
  adminId: string
  techId: string
  roomId: string
  roomName: string
  assetId: string
  assetTag: string
  assetName: string
  inspectionId: string
  inspectionNumber: string
}

export function readState(): E2EState {
  if (!existsSync(STATE_FILE)) throw new Error('Run the setup project first (npx playwright test runs it automatically).')
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState
}

export function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const must = <R extends { data: unknown; error: { message: string } | null }>(res: R, what: string): NonNullable<R['data']> => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (res.data == null) throw new Error(`${what}: no data`)
  return res.data as NonNullable<R['data']>
}

async function findUserId(db: SupabaseClient, email: string): Promise<string | undefined> {
  const { data } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  return data?.id
}

async function ensureAccount(db: SupabaseClient, a: { email: string; name: string; role: string }, password: string) {
  const existing = await findUserId(db, a.email)
  if (existing) await db.auth.admin.deleteUser(existing)
  const created = must(
    await db.auth.admin.createUser({
      email: a.email,
      password,
      email_confirm: true,
      // Informational only: nothing reads app_metadata.role (see migration 0048).
      app_metadata: { role: a.role },
      user_metadata: { full_name: a.name, department: 'E2E Testing' },
    }),
    `create ${a.email}`
  )
  const id = created.user!.id
  // Supabase writes app_metadata after the insert, so the new-user trigger
  // made a default profile; set the role on it directly (as the invite action does).
  must(await db.from('profiles').update({ role: a.role, full_name: a.name }).eq('id', id).select('id'), `set role for ${a.email}`)
  return id
}

export async function setUp(): Promise<E2EState> {
  const db = adminDb()
  await cleanUp({ keepAccounts: false }).catch(() => {})
  const password = `E2e-${randomBytes(12).toString('base64url')}!`
  const adminId = await ensureAccount(db, ACCOUNTS.admin, password)
  const techId = await ensureAccount(db, ACCOUNTS.tech, password)

  const building = must(await db.from('buildings').select('id').limit(1).single(), 'find a building') as { id: string }
  const sub = must(await db.from('sub_categories').select('id').limit(1).single(), 'find a sub-category') as { id: string }
  const template = must(
    await db.from('checklist_templates').select('id, items').eq('type', 'Inspection').limit(1).single(),
    'find an inspection template'
  ) as { id: string; items: unknown[] }

  const stamp = Date.now().toString(36).toUpperCase()
  const roomName = `${E2E} Test Lab ${stamp}`
  const room = must(
    await db
      .from('rooms')
      .insert({ building_id: building.id, name: roomName, room_number: `E2E-${stamp}`, type: 'Laboratory', qr_code_key: `e2e-${stamp}`, is_reservable: false })
      .select('id')
      .single(),
    'create room'
  ) as { id: string }

  const today = new Date().toISOString().slice(0, 10)
  const assetTag = `E2E-${stamp}`
  const assetName = `${E2E} Test Pump ${stamp}`
  const asset = must(
    await db
      .from('assets')
      .insert({
        asset_id: assetTag,
        name: assetName,
        sub_category_id: sub.id,
        room_id: room.id,
        status: 'Operational',
        manufacturer: 'E2E Motors',
        model_number: 'E2E-1',
        installation_date: today,
        purchase_date: today,
        warranty_till: today,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single(),
    'create asset'
  ) as { id: string }

  const inspection = must(
    await db
      .from('inspections')
      .insert({
        // Replaced by the next INSP-YYYY-#### number (a database trigger).
        inspection_number: 'PENDING',
        asset_id: asset.id,
        template_id: template.id,
        template_version: 1,
        // The assignee lives in conducted_by / conducted_by_user_id (see queries/inspections.ts).
        conducted_by_user_id: techId,
        conducted_by: ACCOUNTS.tech.name,
        due_date: today,
        status: 'Scheduled',
        checklist_snapshot: template.items,
        created_at: new Date().toISOString(),
      })
      .select('id, inspection_number')
      .single(),
    'create inspection'
  ) as { id: string; inspection_number: string }

  const state: E2EState = {
    password,
    adminId,
    techId,
    roomId: room.id,
    roomName,
    assetId: asset.id,
    assetTag,
    assetName,
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspection_number,
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  return state
}

// Deletes every record the tests made (and, by default, the test accounts).
export async function cleanUp({ keepAccounts = false } = {}) {
  const db = adminDb()
  const staffIds = (await Promise.all(Object.values(ACCOUNTS).map(a => findUserId(db, a.email)))).filter(Boolean) as string[]
  const { data: guests } = await db.from('profiles').select('id').eq('email', GUEST.email)
  const guestIds = (guests ?? []).map(g => g.id as string)
  const e2eUsers = [...staffIds, ...guestIds]

  const { data: rooms } = await db.from('rooms').select('id').like('name', `${E2E}%`)
  const roomIds = (rooms ?? []).map(r => r.id as string)
  const { data: assets } = await db.from('assets').select('id').like('name', `${E2E}%`)
  const assetIds = (assets ?? []).map(a => a.id as string)

  const woQuery = db.from('work_orders').select('id')
  const { data: wos } = await woQuery.or(
    [`title.like.${E2E}*`, assetIds.length ? `asset_id.in.(${assetIds.join(',')})` : '', roomIds.length ? `room_id.in.(${roomIds.join(',')})` : '']
      .filter(Boolean)
      .join(',')
  )
  const woIds = (wos ?? []).map(w => w.id as string)

  const del = async (table: string, build: (q: ReturnType<SupabaseClient['from']>) => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await build(db.from(table))
    if (error && !/does not exist/.test(error.message)) console.warn(`cleanup ${table}: ${error.message}`)
  }

  if (woIds.length) await del('outside_repairs', q => q.delete().in('work_order_id', woIds))
  await del('service_requests', q => q.delete().like('title', `${E2E}%`))
  if (roomIds.length) await del('service_requests', q => q.delete().in('room_id', roomIds))
  if (e2eUsers.length) await del('service_requests', q => q.delete().in('requested_by_user_id', e2eUsers))
  if (woIds.length) await del('work_orders', q => q.delete().in('id', woIds))
  if (assetIds.length) {
    await del('inspections', q => q.delete().in('asset_id', assetIds))
    await del('asset_activity_logs', q => q.delete().in('asset_id', assetIds))
  }
  if (roomIds.length) await del('room_access_logs', q => q.delete().in('room_id', roomIds))
  if (e2eUsers.length) {
    await del('notifications', q => q.delete().in('user_id', e2eUsers))
    await del('push_subscriptions', q => q.delete().in('user_id', e2eUsers))
  }
  if (assetIds.length) await del('assets', q => q.delete().in('id', assetIds))
  if (roomIds.length) await del('rooms', q => q.delete().in('id', roomIds))

  // Test photos (uploaded as "<timestamp>_e2e-photo.png").
  // Listed page by page (the bucket's name search doesn't match these).
  const bucket = db.storage.from('work-order-evidence')
  const names: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data: files, error } = await bucket.list('', { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error || !files?.length) break
    names.push(...files.map(f => f.name).filter(n => n.endsWith('_e2e-photo.png')))
    if (files.length < 1000) break
  }
  if (names.length) await bucket.remove(names)

  // Guest visits make a fresh anonymous account each time.
  for (const id of guestIds) await db.auth.admin.deleteUser(id)
  if (!keepAccounts) for (const id of staffIds) await db.auth.admin.deleteUser(id)

  // Test accounts without a profile row (see createProfilelessAccount) can't be
  // found through `profiles`, so sweep the auth users by their test domain too.
  if (!keepAccounts) {
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data.users.length) break
      for (const u of data.users) {
        if (u.email?.endsWith('@afms-e2e.test') && !staffIds.includes(u.id)) await db.auth.admin.deleteUser(u.id)
      }
      if (data.users.length < 1000) break
    }
  }
}

// A real, confirmed account whose `profiles` row has been removed -- the state
// in which a sign-in used to leave a live session behind and the route guard
// used to wave the session through onto the Admin desktop.
export async function createProfilelessAccount(): Promise<string> {
  const db = adminDb()
  const { password } = readState()
  const email = `e2e-noprofile-${Date.now().toString(36)}@afms-e2e.test`
  const created = must(
    await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${E2E} No profile` } }),
    `create ${email}`
  )
  must(await db.from('profiles').delete().eq('id', created.user!.id).select('id'), `remove profile of ${email}`)
  return email
}
