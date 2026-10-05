// Sample records for the user-manual screenshots, and their removal.
//
//   npx tsx scripts/manual/demo.ts seed    # creates them, writes the manifest
//   npx tsx scripts/manual/demo.ts clean   # removes exactly what the manifest lists
//
// They look like real use (names, rooms, jobs) because they appear in a document
// for the client, so they can't be found by an "[E2E]" label: every id created
// here, and every sub-category changed, is recorded in data-loads/ (git-ignored)
// and the clean step removes those and only those. Uses the service-role key in
// .env.local; runs on our machine only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

loadEnvConfig(process.cwd())

const MANIFEST = 'data-loads/manual-demo-manifest.json'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

interface Manifest {
  password: string
  users: Record<string, { id: string; email: string; name: string; role: string }>
  vendors: string[]
  templates: string[]
  subCategories: { id: string; pm: string[]; inspection: string[] }[]
  assets: string[]
  serviceRequests: string[]
  workOrders: string[]
  inspections: string[]
  outsideRepairs: string[]
  reservations: string[]
  inventory: string[]
  rooms: string[]
}


const must = <T,>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  if (res.data == null) throw new Error(`${what}: no data`)
  return res.data as NonNullable<T>
}

// India time, as the app and the database use.
const istDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000)
  return d.toISOString().slice(0, 10)
}
const isoAt = (offsetDays: number, hour: number, minute = 0) =>
  new Date(`${istDate(offsetDays)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`).toISOString()

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return c
}

async function seed() {
  if (existsSync(MANIFEST)) throw new Error(`${MANIFEST} exists: run "clean" first.`)
  const m: Manifest = {
    password: `Demo#${randomBytes(9).toString('base64url')}9a`,
    users: {}, vendors: [], templates: [], subCategories: [], assets: [], serviceRequests: [], workOrders: [],
    inspections: [], outsideRepairs: [], reservations: [], inventory: [], rooms: [],
  }
  const save = () => writeFileSync(MANIFEST, JSON.stringify(m, null, 2))
  save()

  // ---- people
  const people = {
    admin: { email: 'anita.mohanty@example.com', name: 'Anita Mohanty', role: 'Admin', department: 'Administration' },
    tech: { email: 'rakesh.behera@example.com', name: 'Rakesh Behera', role: 'Technician', department: 'Maintenance' },
    tech2: { email: 'manoj.sahu@example.com', name: 'Manoj Sahu', role: 'Technician', department: 'Maintenance' },
    hk: { email: 'sunita.das@example.com', name: 'Sunita Das', role: 'Housekeeping', department: 'Housekeeping' },
    faculty: { email: 'suresh.mishra@example.com', name: 'Capt. Suresh Mishra', role: 'Faculty', department: 'Nautical Science' },
  }
  for (const [key, p] of Object.entries(people)) {
    const created = await db.auth.admin.createUser({ email: p.email, password: m.password, email_confirm: true, user_metadata: { full_name: p.name, department: p.department } })
    if (created.error || !created.data.user) throw new Error(`create ${p.email}: ${created.error?.message}`)
    const id = created.data.user.id
    m.users[key] = { id, email: p.email, name: p.name, role: p.role }
    save()
    must(await db.from('profiles').update({ role: p.role, full_name: p.name, department: p.department, phone: '+91 98610 0000' + Object.keys(m.users).length }).eq('id', id).select('id'), `profile ${p.email}`)
  }
  const U = m.users
  const asAdmin = await signedIn(U.admin.email, m.password)

  // ---- vendor, templates, sub-category links
  const vendor = must(
    await db.from('vendors').insert({
      name: 'CoolAir HVAC Services', code: 'VEN-DEMO', contact_person: 'Bikash Rout', phone: '+91 94370 12345', email: 'service@coolair.example.com',
      address: 'Bhubaneswar, Odisha', category_supplied: 'Air conditioning', has_amc: true, amc_contract_no: 'AMC/2026/118',
      amc_start_date: istDate(-180), amc_end_date: istDate(185),
    }).select('id').single(),
    'vendor',
  ) as { id: string }
  m.vendors.push(vendor.id); save()
  const itGlobal = (await db.from('vendors').select('id').eq('name', 'IT Global').maybeSingle()).data as { id: string } | null

  const item = (order: number, itemText: string, responseType: string, photoRequired = false, instructions?: string) =>
    ({ id: randomUUID(), order, itemText, responseType, mandatory: true, photoRequired, ...(instructions ? { instructions } : {}) })
  const acPm = must(await db.from('checklist_templates').insert({
    title: 'Split AC - Monthly PM', type: 'Preventive Maintenance', interval: 'Monthly',
    description: 'Monthly preventive maintenance for split and cassette air conditioners.',
    items: [
      item(1, 'Switch off the unit and isolate the power supply', 'Checkbox'),
      item(2, 'Clean the air filters', 'Checkbox', true, 'Wash with water, dry fully before refitting.'),
      item(3, 'Clean the evaporator and condenser coils', 'Checkbox'),
      item(4, 'Check the drain pipe for blockage or leaks', 'Checkbox'),
      item(5, 'Check electrical connections and the capacitor', 'Checkbox'),
      item(6, 'Run the unit and confirm cooling (air outlet temperature)', 'Checkbox', true),
    ],
  }).select('id, items').single(), 'AC PM template') as { id: string; items: unknown[] }
  const fireInsp = must(await db.from('checklist_templates').insert({
    title: 'Fire Extinguisher - Monthly Inspection', type: 'Inspection', interval: 'Monthly',
    description: 'Monthly visual inspection of portable fire extinguishers.',
    items: [
      item(1, 'Extinguisher is in its marked place and not blocked', 'Pass-Fail'),
      item(2, 'Pressure gauge needle is in the green zone', 'Pass-Fail', true),
      item(3, 'Safety pin and tamper seal are intact', 'Pass-Fail'),
      item(4, 'No dents, rust or leaks on the cylinder; hose is not cracked', 'Pass-Fail'),
      item(5, 'Service tag is filled in and within date', 'Pass-Fail'),
    ],
  }).select('id, items').single(), 'fire inspection template') as { id: string; items: unknown[] }
  m.templates.push(acPm.id, fireInsp.id); save()

  const subByCode = async (code: string) => must(await db.from('sub_categories').select('id, pm_template_ids, inspection_template_ids').eq('code', code).single(), code) as { id: string; pm_template_ids: string[] | null; inspection_template_ids: string[] | null }
  const acSub = await subByCode('ELEC-AC00')
  const fireSub = await subByCode('SAFE-FIRE-2')
  const projSub = await subByCode('ITXX-PROJ')
  const compSub = await subByCode('ITXX-COMP')
  const cctvSub = await subByCode('ITXX-CCTV')
  for (const s of [acSub, fireSub]) m.subCategories.push({ id: s.id, pm: s.pm_template_ids ?? [], inspection: s.inspection_template_ids ?? [] })
  save()
  must(await db.from('sub_categories').update({ pm_template_ids: [...(acSub.pm_template_ids ?? []), acPm.id] }).eq('id', acSub.id).select('id'), 'link AC PM')
  must(await db.from('sub_categories').update({ inspection_template_ids: [...(fireSub.inspection_template_ids ?? []), fireInsp.id] }).eq('id', fireSub.id).select('id'), 'link fire inspection')

  // ---- assets
  const room = async (number: string) => must(await db.from('rooms').select('id, name').eq('room_number', number).single(), number) as { id: string; name: string }
  const { data: existingCodes } = await db.from('assets').select('asset_id')
  let seq = 1 + Math.max(0, ...(existingCodes ?? []).map(r => Number(/^AST-(\d+)$/.exec(r.asset_id as string)?.[1] ?? 0)))
  const newAsset = async (a: Record<string, unknown>, roomNo: string) => {
    const r = await room(roomNo)
    const assetId = `AST-${String(seq++).padStart(4, '0')}`
    const row = must(await db.from('assets').insert({
      asset_id: assetId, room_id: r.id, status: 'Operational', image_url: '/images/asset-placeholder.png',
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${assetId}`,
      created_at: isoAt(-20, 11), ...a,
    }).select('id, asset_id, name').single(), `asset ${a.name}`) as { id: string; asset_id: string; name: string }
    m.assets.push(row.id); save()
    await db.from('asset_activity_logs').insert({
      id: randomUUID(), asset_id: row.id, action: 'Asset Created', by_user: U.admin.name, source: 'Manual', remarks: `Asset ${row.name} registered under ID ${assetId}.`,
      timestamp: isoAt(-20, 11), timestamp_epoch: Date.parse(isoAt(-20, 11)),
    })
    return { ...row, roomId: r.id, roomName: r.name }
  }
  const acBase = { sub_category_id: acSub.id, manufacturer: 'Daikin', maintenance_by: 'Vendor', maintenance_vendor_id: vendor.id, purchase_vendor_id: vendor.id, amc_start_date: istDate(-180), amc_end_date: istDate(185), sla_priority: 'High' }
  const ac1 = await newAsset({ ...acBase, name: 'Split AC 1.5 Ton', model_number: 'FTKF50', serial_number: 'DK50-24-1187', purchase_date: '2025-04-10', installation_date: '2025-04-15', warranty_till: '2027-04-14', price: 48500, dynamic_specifications: { field_cooling_capacity: 1.5, field_ac_type__split_cassette_window_: 'Split' } }, 'ROM-0029')
  const ac2 = await newAsset({ ...acBase, name: 'Split AC 2 Ton', model_number: 'FTKF60', serial_number: 'DK60-24-0412', purchase_date: '2025-04-10', installation_date: '2025-04-16', warranty_till: '2027-04-15', price: 56200, dynamic_specifications: { field_cooling_capacity: 2, field_ac_type__split_cassette_window_: 'Split' } }, 'ROM-0048')
  const ac3 = await newAsset({ ...acBase, name: 'Cassette AC 3 Ton', model_number: 'FCQF100', serial_number: 'DK100-23-0077', purchase_date: '2024-11-02', installation_date: '2024-11-10', warranty_till: '2026-11-09', price: 98000, dynamic_specifications: { field_cooling_capacity: 3, field_ac_type__split_cassette_window_: 'Cassette' } }, 'ROM-0002')
  const fireBase = { sub_category_id: fireSub.id, manufacturer: 'Ceasefire', maintenance_by: 'In House', sla_priority: 'Critical', purchase_date: '2025-06-01', installation_date: '2025-06-05', warranty_till: '2028-05-31', price: 3200 }
  const fe1 = await newAsset({ ...fireBase, name: 'Fire Extinguisher ABC 9 kg', model_number: 'CF-ABC9', serial_number: 'CF9-25-3301', dynamic_specifications: { field_capacity: 9 } }, 'ROM-0062')
  const fe2 = await newAsset({ ...fireBase, name: 'Fire Extinguisher CO2 4.5 kg', model_number: 'CF-CO2-45', serial_number: 'CF45-25-1209', dynamic_specifications: { field_capacity: 4.5 } }, 'ROM-0007')
  const fe3 = await newAsset({ ...fireBase, name: 'Fire Extinguisher ABC 6 kg', model_number: 'CF-ABC6', serial_number: 'CF6-25-2210', dynamic_specifications: { field_capacity: 6 } }, 'ROM-0061')
  const proj = await newAsset({ sub_category_id: projSub.id, name: 'Epson Projector EB-X51', manufacturer: 'Epson', model_number: 'EB-X51', serial_number: 'X51-EP-88231', purchase_date: '2025-01-20', installation_date: '2025-01-25', warranty_till: '2027-01-19', price: 42000, maintenance_by: 'In House', sla_priority: 'Medium', dynamic_specifications: {} }, 'ROM-0018')
  const pc = await newAsset({ sub_category_id: compSub.id, name: 'Dell OptiPlex 7010 Desktop', manufacturer: 'Dell', model_number: 'OptiPlex 7010', serial_number: 'DL7010-9KQ2', purchase_date: '2025-02-14', installation_date: '2025-02-18', warranty_till: '2028-02-13', price: 61500, maintenance_by: 'In House', sla_priority: 'Medium', dynamic_specifications: { field_processor_type: 'Intel Core i5-13500', field_ram_capacity: 16, field_storage_capacity: '512 GB SSD', field_screen_size: 24 } }, 'ROM-0028')
  await newAsset({ sub_category_id: cctvSub.id, name: 'CCTV Dome Camera', manufacturer: 'Hikvision', model_number: 'DS-2CD1123G0E', serial_number: 'HK-1123-55120', purchase_date: '2025-03-01', installation_date: '2025-03-04', warranty_till: '2027-02-28', price: 4800, maintenance_by: 'In House', sla_priority: 'Low', dynamic_specifications: { field_camera_resolution: 2, field_night_vision_range: 30 } }, 'ROM-0005')

  // ---- schedules, through the real Admin function
  const schedule = async (assetIds: string[], templateId: string, firstDue: string) => {
    const { data, error } = await asAdmin.rpc('schedule_asset_maintenance', { p_asset_ids: assetIds, p_template_id: templateId, p_mode: 'date', p_first_due: firstDue })
    if (error) throw new Error(`schedule: ${error.message}`)
    for (const r of data as { status: string; reason?: string }[]) if (r.status !== 'scheduled') throw new Error(`schedule skipped: ${r.reason}`)
  }
  await schedule([ac1.id, ac3.id], acPm.id, istDate(0))
  await schedule([ac2.id], acPm.id, istDate(4))
  await schedule([fe1.id, fe2.id, fe3.id], fireInsp.id, istDate(0))
  const wosOf = async (assetId: string) => must(await db.from('work_orders').select('id, wo_number, checklist_snapshot').eq('asset_id', assetId), 'wos') as { id: string; wo_number: string; checklist_snapshot: { id: string }[] }[]
  const inspOf = async (assetId: string) => must(await db.from('inspections').select('id, inspection_number, checklist_snapshot').eq('asset_id', assetId), 'insp') as { id: string; inspection_number: string; checklist_snapshot: { id: string }[] }[]

  const assignWo = async (id: string, who: keyof typeof people, extra: Record<string, unknown> = {}) =>
    must(await db.from('work_orders').update({ assigned_technician_id: U[who].id, assigned_technician_name: U[who].name, ...extra }).eq('id', id).select('id, wo_number').single(), 'assign wo') as { id: string; wo_number: string }

  // AC 1: done this morning (its next one is scheduled by the database).
  const [pm1] = await wosOf(ac1.id)
  await assignWo(pm1.id, 'tech')
  const done = Object.fromEntries(pm1.checklist_snapshot.map(i => [i.id, { value: true }]))
  await db.from('work_orders').update({ status: 'In Progress', start_photo_url: null }).eq('id', pm1.id)
  must(await db.from('work_orders').update({
    status: 'Completed', checklist_responses: done, completed_at: isoAt(0, 10, 40), executed_by: 'In House',
    technician_remarks: 'Filters were very dusty; cleaned. Cooling normal at 12 °C outlet.',
  }).eq('id', pm1.id).select('id'), 'complete PM')
  // AC 3: started today by Rakesh. AC 2: assigned, due in 4 days.
  const [pm3] = await wosOf(ac3.id)
  await assignWo(pm3.id, 'tech', { instructions: 'Auditorium is booked from 2 PM; please finish before that.' })
  await db.from('work_orders').update({ status: 'In Progress' }).eq('id', pm3.id)
  const [pm2] = await wosOf(ac2.id)
  await assignWo(pm2.id, 'tech')

  const assignInsp = async (id: string, who: keyof typeof people) =>
    must(await db.from('inspections').update({ conducted_by_user_id: U[who].id, conducted_by: U[who].name }).eq('id', id).select('id').single(), 'assign insp')
  // Extinguisher 1 passed, 2 failed (the database raises a corrective job), 3 is due today for the faculty.
  const [i1] = await inspOf(fe1.id)
  await assignInsp(i1.id, 'faculty')
  must(await db.from('inspections').update({
    status: 'Completed', result: 'Pass', conducted_at: isoAt(0, 9, 15), remarks: 'All in order.',
    checklist_responses: Object.fromEntries(i1.checklist_snapshot.map(i => [i.id, 'Pass'])),
  }).eq('id', i1.id).select('id'), 'pass inspection')
  const [i2] = await inspOf(fe2.id)
  await assignInsp(i2.id, 'faculty')
  must(await db.from('inspections').update({
    status: 'Completed', result: 'Fail', conducted_at: isoAt(0, 9, 40), remarks: 'Pressure low - needs refilling.',
    checklist_responses: Object.fromEntries(i2.checklist_snapshot.map((i, n) => [i.id, n === 1 ? 'Fail' : 'Pass'])),
  }).eq('id', i2.id).select('id'), 'fail inspection')
  const [i3] = await inspOf(fe3.id)
  await assignInsp(i3.id, 'faculty')

  // ---- service requests (ticket number and SLA due time come from the database)
  const newSr = async (sr: Record<string, unknown>) => {
    const row = must(await db.from('service_requests').insert({ ticket_id: 'PENDING', status: 'Open', created_at: isoAt(0, 9, 20), ...sr }).select('id, ticket_id').single(), `SR ${sr.title}`) as { id: string; ticket_id: string }
    m.serviceRequests.push(row.id); save()
    return row
  }
  const fac = { requested_by_user_id: U.faculty.id, requested_by_name: U.faculty.name, requested_by_email: U.faculty.email, requested_by_role: 'Faculty', requested_by_phone: '+91 98610 00005' }
  await newSr({ ...fac, type: 'Maintenance', title: 'AC not cooling', description: 'The AC in the conference room runs but blows warm air. Meeting at 3 PM today.', asset_id: ac2.id, room_id: ac2.roomId, priority: 'High' })
  const guestSr = await newSr({ type: 'Housekeeping', created_at: isoAt(0, 8, 45), title: 'Washroom needs cleaning', description: 'Floor is wet and the dustbin is full.', room_id: (await room('ROM-0055')).id, priority: 'Medium', requested_by_name: 'Rahul Verma', requested_by_email: 'rahul.verma@example.com', requested_by_role: 'Guest', requested_by_phone: '+91 90400 11223' })
  const projSr = await newSr({ ...fac, type: 'Maintenance', created_at: isoAt(0, 8, 10), title: 'Projector not turning on', description: 'Power light blinks orange and the lamp does not start.', asset_id: proj.id, room_id: proj.roomId, priority: 'Medium' })
  const pcSr = await newSr({ ...fac, type: 'Maintenance', created_at: isoAt(-1, 9, 30), title: 'Desktop running very slow', description: 'Takes 10 minutes to start and freezes when opening files.', asset_id: pc.id, room_id: pc.roomId, priority: 'Medium' })

  // Jobs made from requests
  // Cleaning jobs are numbered by the app when created (WO-HK-YYYY-####), not on assignment.
  let hkSeq = 0
  const newWo = async (wo: Record<string, unknown>) => {
    const id = randomUUID()
    const woNumber = wo.type === 'Housekeeping' ? `WO-HK-${istDate(0).slice(0, 4)}-${String(++hkSeq).padStart(4, '0')}` : `PENDING-${id}`
    const row = must(await db.from('work_orders').insert({ id, wo_number: woNumber, status: 'Scheduled', created_at: isoAt(0, 9), ...wo }).select('id, wo_number').single(), `WO ${wo.title}`) as { id: string; wo_number: string }
    m.workOrders.push(row.id); save()
    return row
  }
  const linkSr = async (srId: string, woId: string, type: string, status: string, extra: Record<string, unknown> = {}) => {
    const wo = must(await db.from('work_orders').select('wo_number').eq('id', woId).single(), 'wo number') as { wo_number: string }
    must(await db.from('service_requests').update({ work_order_id: woId, work_order_number: wo.wo_number, work_order_type: type, status, ...extra }).eq('id', srId).select('id'), 'link SR')
  }
  // Projector: Manoj found a dead lamp and sent it out for repair.
  const projWo = await newWo({ type: 'Corrective', title: 'Projector not turning on', asset_id: proj.id, room_id: proj.roomId, priority: 'Medium', source: 'Service Request', source_ref_id: projSr.ticket_id, due_date: istDate(1), issue_logged: 'Power light blinks orange and the lamp does not start.' })
  await assignWo(projWo.id, 'tech2')
  await db.from('work_orders').update({ status: 'In Progress', executed_by: 'In House', diagnosis: 'Lamp has blown; ballast board also suspected.' }).eq('id', projWo.id)
  await linkSr(projSr.id, projWo.id, 'Corrective', 'In Progress')
  if (itGlobal) {
    const osr = must(await db.from('outside_repairs').insert({
      repair_number: 'PENDING', work_order_id: projWo.id, asset_id: proj.id, scope: 'Component', component_name: 'Lamp and ballast board',
      vendor_id: itGlobal.id, sent_by: 'Technician', sent_date: istDate(0), expected_return_date: istDate(5), status: 'Out for Repair',
      fault_description: 'Lamp blown; ballast board to be checked.', dispatch_ref: 'GP-1042', estimated_cost: 6500, recorded_by: U.tech2.name,
    }).select('id').single(), 'outside repair') as { id: string }
    m.outsideRepairs.push(osr.id); save()
  }
  // Desktop: fixed and closed by Rakesh yesterday.
  const pcWo = await newWo({ type: 'Corrective', title: 'Desktop running very slow', asset_id: pc.id, room_id: pc.roomId, priority: 'Medium', source: 'Service Request', source_ref_id: pcSr.ticket_id, due_date: istDate(0), issue_logged: 'Takes 10 minutes to start and freezes when opening files.', created_at: isoAt(-1, 10) })
  await assignWo(pcWo.id, 'tech')
  await db.from('work_orders').update({ status: 'In Progress', executed_by: 'In House' }).eq('id', pcWo.id)
  await db.from('work_orders').update({
    status: 'Completed', completed_at: isoAt(-1, 16, 20), diagnosis: 'Hard disk nearly full; 2 startup programs hanging.',
    solution_taken: 'Removed temporary files, disabled the startup programs, ran Windows updates.', technician_remarks: 'Starts in under a minute now.',
  }).eq('id', pcWo.id)
  await linkSr(pcSr.id, pcWo.id, 'Corrective', 'Resolved', { resolution_notes: 'Cleaned up the disk and startup programs; working normally.' })
  // Washroom: cleaning job for Sunita from the guest's request.
  const hkWo = await newWo({ type: 'Housekeeping', title: 'Washroom needs cleaning', room_id: (await room('ROM-0055')).id, priority: 'Medium', source: 'Service Request', source_ref_id: guestSr.ticket_id, due_date: istDate(0), issue_logged: 'Floor is wet and the dustbin is full.' })
  await assignWo(hkWo.id, 'hk')
  await linkSr(guestSr.id, hkWo.id, 'Housekeeping', 'In Progress')
  // Routine cleaning
  const routine = await newWo({ type: 'Housekeeping', title: 'Daily classroom cleaning', room_id: (await room('ROM-0024')).id, priority: 'Low', source: 'Routine', due_date: istDate(0) })
  await assignWo(routine.id, 'hk')
  const routine2 = await newWo({ type: 'Housekeeping', title: 'Daily classroom cleaning', room_id: (await room('ROM-0018')).id, priority: 'Low', source: 'Routine', due_date: istDate(0) })
  await assignWo(routine2.id, 'hk')
  await db.from('work_orders').update({ status: 'In Progress' }).eq('id', routine2.id)
  await db.from('work_orders').update({ status: 'Completed', completed_at: isoAt(0, 8, 50) }).eq('id', routine2.id)

  // ---- reservation, check-in, spares
  const aud = await room('ROM-0002')
  const group = randomUUID()
  for (const hour of [10, 11]) {
    const label = hour === 10 ? '10:00 AM - 11:00 AM' : '11:00 AM - 12:00 PM'
    const r = must(await db.from('reservations').insert({
      id: randomUUID(), created_at: isoAt(-2, 15), reservation_number: `RSV-${istDate(0).slice(0, 4)}-${String(hour - 9).padStart(4, '0')}`, room_id: aud.id, room_name: aud.name, date: istDate(1), slot_hour: hour, time_slot: label,
      purpose: 'Guest lecture - Marine Safety', user_id: U.faculty.id, user_name: U.faculty.name, user_role: 'Faculty', department_name: 'Nautical Science', status: 'Confirmed', group_booking_id: group,
    }).select('id').single(), 'reservation') as { id: string }
    m.reservations.push(r.id); save()
  }
  const sim = await room('ROM-0007')
  m.rooms.push(sim.id); save()
  const asFaculty = await signedIn(U.faculty.email, m.password)
  const now = new Date()
  const { error: ciErr } = await asFaculty.rpc('room_check_in', {
    p_id: randomUUID(), p_room_id: sim.id, p_activity_number: '', p_purpose: 'Engine room simulator practical', p_user_name: U.faculty.name, p_user_role: 'Faculty',
    p_check_in_time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }), p_check_in_date: istDate(0), p_check_in_timestamp: now.getTime(),
  })
  if (ciErr) throw new Error(`check-in: ${ciErr.message}`)
  const store = await room('ROM-0033')
  for (const [n, it] of [
    { name: 'AC Run Capacitor 45 uF', sub_category_id: acSub.id, manufacturer: 'EPCOS', part_number: 'B32335-45', quantity: 6, min_stock_level: 2, unit_cost: 450 },
    { name: 'Projector Lamp ELPLP96', sub_category_id: projSub.id, manufacturer: 'Epson', part_number: 'V13H010L96', quantity: 1, min_stock_level: 2, unit_cost: 5200 },
  ].entries()) {
    const r = must(await db.from('inventory_items').insert({ id: randomUUID(), created_at: isoAt(-30, 12), inventory_number: `INV-${String(n + 1).padStart(4, '0')}`, room_id: store.id, storage_location: 'Store Rooms - 1, Rack B', vendor_id: n === 0 ? vendor.id : itGlobal?.id ?? null, purchase_date: istDate(-30), ...it }).select('id').single(), `spare ${it.name}`) as { id: string }
    m.inventory.push(r.id); save()
  }

  // Everything the database made on its own for these assets (next PMs, inspections, the defect job).
  const { data: extraWos } = await db.from('work_orders').select('id').in('asset_id', m.assets)
  m.workOrders = [...new Set([...m.workOrders, ...(extraWos ?? []).map(w => w.id as string)])]
  const { data: extraInsp } = await db.from('inspections').select('id').in('asset_id', m.assets)
  m.inspections = [...new Set([...m.inspections, ...(extraInsp ?? []).map(i => i.id as string)])]
  save()
  console.log(`Seeded: ${Object.keys(m.users).length} people, ${m.assets.length} assets, ${m.workOrders.length} work orders, ${m.inspections.length} inspections, ${m.serviceRequests.length} requests.`)
  console.log(`Manifest: ${MANIFEST}`)
}

async function clean() {
  if (!existsSync(MANIFEST)) { console.log('Nothing to clean (no manifest).'); return }
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
  const userIds = Object.values(m.users).map(u => u.id)
  const warn = (what: string, error: { message: string } | null) => { if (error) console.warn(`  ${what}: ${error.message}`) }
  // Pick up anything made later for these assets or by these people (e.g. while taking screenshots).
  const more = async (table: string, col: string, ids: string[]) => ids.length ? ((await db.from(table).select('id').in(col, ids)).data ?? []).map(r => r.id as string) : []
  const woIds = [...new Set([...m.workOrders, ...(await more('work_orders', 'asset_id', m.assets)), ...(await more('work_orders', 'assigned_technician_id', userIds))])]
  const srIds = [...new Set([...m.serviceRequests, ...(await more('service_requests', 'asset_id', m.assets)), ...(await more('service_requests', 'requested_by_user_id', userIds))])]
  const inspIds = [...new Set([...m.inspections, ...(await more('inspections', 'asset_id', m.assets))])]
  const resIds = [...new Set([...m.reservations, ...(await more('reservations', 'user_id', userIds))])]
  const osrIds = [...new Set([...m.outsideRepairs, ...(await more('outside_repairs', 'work_order_id', woIds))])]

  const refIds = [...woIds, ...srIds, ...inspIds, ...osrIds]
  if (refIds.length) warn('notifications', (await db.from('notifications').delete().in('ref_id', refIds)).error)
  if (osrIds.length) warn('outside repairs', (await db.from('outside_repairs').delete().in('id', osrIds)).error)
  if (srIds.length) warn('service requests', (await db.from('service_requests').delete().in('id', srIds)).error)
  if (woIds.length) warn('work orders', (await db.from('work_orders').delete().in('id', woIds)).error)
  if (inspIds.length) warn('inspections', (await db.from('inspections').delete().in('id', inspIds)).error)
  if (resIds.length) warn('reservations', (await db.from('reservations').delete().in('id', resIds)).error)
  if (m.inventory.length) warn('spares', (await db.from('inventory_items').delete().in('id', m.inventory)).error)
  if (m.assets.length) {
    warn('documents', (await db.from('documents').delete().in('asset_id', m.assets)).error)
    warn('asset history', (await db.from('asset_activity_logs').delete().in('asset_id', m.assets)).error)
    warn('assets', (await db.from('assets').delete().in('id', m.assets)).error)
  }
  // Check-ins by these people, and the rooms they left occupied.
  if (userIds.length) {
    const { data: logs } = await db.from('room_access_logs').select('room_id').in('user_id', userIds)
    const rooms = [...new Set([...m.rooms, ...(logs ?? []).map(l => l.room_id as string).filter(Boolean)])]
    warn('check-ins', (await db.from('room_access_logs').delete().in('user_id', userIds)).error)
    for (const id of rooms) {
      const { count } = await db.from('room_access_logs').select('id', { count: 'exact', head: true }).eq('room_id', id).is('check_out_time', null)
      if (!count) warn('room status', (await db.from('rooms').update({ status: 'Available', current_occupant: null }).eq('id', id)).error)
    }
  }
  for (const s of m.subCategories) warn('sub-category', (await db.from('sub_categories').update({ pm_template_ids: s.pm, inspection_template_ids: s.inspection }).eq('id', s.id)).error)
  if (m.templates.length) warn('templates', (await db.from('checklist_templates').delete().in('id', m.templates)).error)
  if (m.vendors.length) warn('vendors', (await db.from('vendors').delete().in('id', m.vendors)).error)
  for (const id of userIds) {
    await db.from('notifications').delete().eq('user_id', id)
    warn('account', (await db.auth.admin.deleteUser(id)).error)
  }
  writeFileSync(MANIFEST.replace('.json', `-removed-${Date.now()}.json`), JSON.stringify(m, null, 2))
  const { unlinkSync } = await import('node:fs')
  unlinkSync(MANIFEST)
  console.log(`Removed: ${userIds.length} people, ${m.assets.length} assets, ${woIds.length} work orders, ${inspIds.length} inspections, ${srIds.length} requests, ${resIds.length} reservations, ${m.inventory.length} spares.`)
  console.log('Number counters (WO, SR, INSP, OSR, check-ins) still need resetting: see docs/manual/README.md.')
}

const cmd = process.argv[2]
;(cmd === 'seed' ? seed() : cmd === 'clean' ? clean() : Promise.reject(new Error('Use: seed | clean'))).catch(e => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
