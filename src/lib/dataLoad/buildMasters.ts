import { nameKey, type Issue } from './coerce'
import { formatCategoryId, formatId, formatSubCategoryId, getNextSequence } from '@/lib/idGenerator'
import type { TableInsert } from '@/lib/supabase/typed'
import type { FieldDef, MastersData, TemplateData } from './validateMasters'
import { MASTER_SHEETS } from './spec'

// What is already in the database, so new codes continue the sequences and a name
// that already exists is reported instead of being created twice.
export interface MastersSnapshot {
  campuses: { id: string; name: string; code: string }[]
  buildings: { id: string; name: string; code: string; campus_id: string | null }[]
  rooms: { name: string; room_number: string; building_id: string | null }[]
  vendors: { name: string; code: string | null }[]
  categories: { id: string; name: string; code: string }[]
  subCategories: { name: string; code: string; category_id: string | null }[]
  templates: { title: string; type: string }[]
}

export const emptyMastersSnapshot = (): MastersSnapshot => ({
  campuses: [], buildings: [], rooms: [], vendors: [], categories: [], subCategories: [], templates: [],
})

// Insert order = dependency order (a row's parents come first).
export const MASTER_TABLE_ORDER = [
  'campuses', 'buildings', 'rooms', 'vendors', 'categories', 'checklist_templates', 'sub_categories',
] as const
export type MasterTable = (typeof MASTER_TABLE_ORDER)[number]

export interface MastersPlan {
  rows: {
    campuses: TableInsert<'campuses'>[]
    buildings: TableInsert<'buildings'>[]
    rooms: TableInsert<'rooms'>[]
    vendors: TableInsert<'vendors'>[]
    categories: TableInsert<'categories'>[]
    checklist_templates: TableInsert<'checklist_templates'>[]
    sub_categories: TableInsert<'sub_categories'>[]
  }
  conflicts: Issue[]
}

// `base`, or `base-2`, `base-3`... if that code is taken (same rule as the app).
function uniqueCode(base: string, taken: Set<string>): string {
  let code = base
  let n = 2
  while (taken.has(code)) code = `${base}-${n++}`
  taken.add(code)
  return code
}

export function buildMasters(
  data: MastersData,
  snapshot: MastersSnapshot,
  newId: () => string,
  now: Date = new Date()
): MastersPlan {
  const conflicts: Issue[] = []
  const conflict = (sheet: string, row: number, what: string) =>
    conflicts.push({ severity: 'error', sheet, row, message: `${what} already exists in the app. Remove it from the workbook or rename it.` })

  // ---- existing lookups (by readable name) ----
  const campusNameById = new Map(snapshot.campuses.map(c => [c.id, c.name]))
  const buildingLabelById = new Map(
    snapshot.buildings.map(b => [b.id, `${campusNameById.get(b.campus_id ?? '') ?? ''} / ${b.name}`])
  )
  const existingCampus = new Set(snapshot.campuses.map(c => nameKey(c.name)))
  const existingBuilding = new Set([...buildingLabelById.values()].map(nameKey))
  const existingRoom = new Set(
    snapshot.rooms.map(r => nameKey(`${buildingLabelById.get(r.building_id ?? '') ?? ''} / ${r.name}`))
  )
  const existingVendor = new Set(snapshot.vendors.map(v => nameKey(v.name)))
  const existingCategory = new Set(snapshot.categories.map(c => nameKey(c.name)))
  const categoryNameById = new Map(snapshot.categories.map(c => [c.id, c.name]))
  const existingSub = new Set(
    snapshot.subCategories.map(s => nameKey(`${categoryNameById.get(s.category_id ?? '') ?? ''} / ${s.name}`))
  )
  const existingTemplate = new Set(snapshot.templates.map(t => `${t.type}|${nameKey(t.title)}`))

  const rows: MastersPlan['rows'] = {
    campuses: [], buildings: [], rooms: [], vendors: [], categories: [], checklist_templates: [], sub_categories: [],
  }

  // ---- campuses ----
  let camSeq = getNextSequence(snapshot.campuses.map(c => c.code), 'CAM')
  const campusId = new Map<string, string>()
  for (const c of data.campuses) {
    if (existingCampus.has(nameKey(c.name))) { conflict(MASTER_SHEETS.campuses, c.row, `Campus "${c.name}"`); continue }
    const id = newId()
    campusId.set(nameKey(c.name), id)
    rows.campuses.push({ id, name: c.name, code: formatId('CAM', camSeq++), address: c.address || '' })
  }

  // ---- buildings ----
  let bldSeq = getNextSequence(snapshot.buildings.map(b => b.code), 'BLD')
  const buildingId = new Map<string, string>()
  for (const b of data.buildings) {
    if (existingBuilding.has(nameKey(b.label))) { conflict(MASTER_SHEETS.buildings, b.row, `Building "${b.label}"`); continue }
    const cid = campusId.get(nameKey(b.campus))
    if (!cid) continue // its campus was a conflict, already reported
    const id = newId()
    buildingId.set(nameKey(b.label), id)
    rows.buildings.push({ id, campus_id: cid, name: b.name, code: formatId('BLD', bldSeq++), total_floors: b.totalFloors || 1 })
  }

  // ---- rooms ----
  let romSeq = getNextSequence(snapshot.rooms.map(r => r.room_number), 'ROM')
  for (const r of data.rooms) {
    if (existingRoom.has(nameKey(r.label))) { conflict(MASTER_SHEETS.rooms, r.row, `Room "${r.label}"`); continue }
    const bid = buildingId.get(nameKey(r.building))
    if (!bid) continue
    const roomNumber = formatId('ROM', romSeq++)
    rows.rooms.push({
      id: newId(), building_id: bid, name: r.name, room_number: roomNumber, type: r.type || 'General',
      floor: r.floor || null, room_size_sqft: r.sizeSqft ?? null, is_reservable: r.reservable,
      qr_code_key: roomNumber, status: 'Available',
    })
  }

  // ---- vendors ----
  let vndSeq = getNextSequence(snapshot.vendors.map(v => v.code ?? ''), 'VND')
  for (const v of data.vendors) {
    if (existingVendor.has(nameKey(v.name))) { conflict(MASTER_SHEETS.vendors, v.row, `Vendor "${v.name}"`); continue }
    rows.vendors.push({
      id: newId(), code: formatId('VND', vndSeq++), name: v.name,
      category_supplied: v.categorySupplied, contact_person: v.contactPerson, email: v.email,
      phone: v.phone, address: v.address, has_amc: v.hasAmc,
      amc_contract_no: v.amcContractNo || null, amc_start_date: v.amcStart || null, amc_end_date: v.amcEnd || null,
    })
  }

  // ---- categories ----
  const takenCategoryCodes = new Set(snapshot.categories.map(c => c.code))
  const categoryRow = new Map<string, { id: string; code: string }>()
  for (const c of data.categories) {
    if (existingCategory.has(nameKey(c.name))) { conflict(MASTER_SHEETS.categories, c.row, `Category "${c.name}"`); continue }
    const id = newId()
    const code = uniqueCode(formatCategoryId(c.name), takenCategoryCodes)
    categoryRow.set(nameKey(c.name), { id, code })
    rows.categories.push({ id, name: c.name, code, description: c.description || '' })
  }

  // ---- templates ----
  const templateId = new Map<string, string>()
  const addTemplates = (list: TemplateData[], type: 'Preventive Maintenance' | 'Inspection', sheet: string) => {
    for (const t of list) {
      if (existingTemplate.has(`${type}|${nameKey(t.title)}`)) { conflict(sheet, t.row, `Template "${t.title}"`); continue }
      const id = newId()
      templateId.set(`${type}|${nameKey(t.title)}`, id)
      rows.checklist_templates.push({
        id, title: t.title, type, description: t.description || '', interval: t.frequency,
        // The app fixes these: maintenance steps are tick-boxes, inspection steps are Pass/Fail.
        items: t.steps.map((s, i) => ({
          id: `ci-${i + 1}`,
          order: i + 1,
          itemText: s.task,
          ...(s.instructions ? { instructions: s.instructions } : {}),
          responseType: type === 'Inspection' ? 'Pass-Fail' : 'Checkbox',
          mandatory: s.mandatory,
          photoRequired: s.photoRequired,
        })) as unknown as TableInsert<'checklist_templates'>['items'],
        updated_at: now.toISOString(),
      })
    }
  }
  addTemplates(data.pmTemplates, 'Preventive Maintenance', MASTER_SHEETS.pmTemplates)
  addTemplates(data.inspTemplates, 'Inspection', MASTER_SHEETS.inspTemplates)

  // ---- sub-categories ----
  const takenSubCodes = new Set(snapshot.subCategories.map(s => s.code))
  for (const s of data.subCategories) {
    if (existingSub.has(nameKey(s.label))) { conflict(MASTER_SHEETS.subCategories, s.row, `Sub-category "${s.label}"`); continue }
    const cat = categoryRow.get(nameKey(s.category))
    if (!cat) continue
    const ids = (titles: string[], type: string) =>
      titles.map(t => templateId.get(`${type}|${nameKey(t)}`)).filter((x): x is string => Boolean(x))
    const fields: FieldDef[] = s.fields
    rows.sub_categories.push({
      id: newId(),
      category_id: cat.id,
      name: s.name,
      code: uniqueCode(formatSubCategoryId(cat.code, s.name), takenSubCodes),
      description: s.description || '',
      // Priority now belongs to each asset; sub-categories keep the app's default until
      // the app stops using this one.
      sla_priority: 'Medium',
      metadata_fields: fields.map(f => ({
        key: f.key, label: f.label, type: f.type, ...(f.unit ? { unit: f.unit } : {}), required: f.required, order: f.order,
      })) as unknown as TableInsert<'sub_categories'>['metadata_fields'],
      pm_template_ids: ids(s.pmTemplates, 'Preventive Maintenance'),
      inspection_template_ids: ids(s.inspTemplates, 'Inspection'),
    })
  }

  return { rows, conflicts }
}

export function planCounts(plan: MastersPlan): Record<MasterTable, number> {
  return Object.fromEntries(MASTER_TABLE_ORDER.map(t => [t, plan.rows[t].length])) as Record<MasterTable, number>
}
