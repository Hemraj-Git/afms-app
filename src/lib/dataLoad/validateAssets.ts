import { nameKey, type Issue } from './coerce'
import { parseSheetRows } from './parseRows'
import { checkHeaders, type RawSheet } from './readWorkbook'
import { assetColumns, subCategoryKey } from './generateAssets'
import { META_SHEET, normalizeHeader, type SLA_PRIORITIES, type ASSET_STATUSES } from './spec'
import type { FieldDef } from './validateMasters'

// What the app already holds, so every reference in the workbook can be checked
// against it exactly.
export interface AssetsContext {
  subCategories: {
    id: string; code: string; name: string; categoryName: string; fields: FieldDef[]
    pmTemplateIds: string[]; inspectionTemplateIds: string[]
  }[]
  rooms: { id: string; label: string }[]
  vendors: { id: string; name: string }[]
  // For catching an asset that is already there.
  existingSerials: { subCategoryId: string; serial: string }[]
}

export interface AssetInput {
  sheet: string
  row: number
  subCategoryId: string
  name: string
  roomId: string
  slaPriority: (typeof SLA_PRIORITIES)[number]
  manufacturer?: string
  model?: string
  serial?: string
  price?: number
  purchaseDate?: string
  installDate?: string
  warrantyTill?: string
  lastServiced?: string
  status: (typeof ASSET_STATUSES)[number]
  maintainedBy: 'In House' | 'Vendor'
  maintenanceVendorId?: string
  purchaseVendorId?: string
  amcStart?: string
  amcEnd?: string
  notes?: string
  // The app stores every custom value as text, whatever the field's type.
  specs: Record<string, string>
}

const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined)

interface MetaTab {
  sheet: string
  subCategoryId: string
  subCategoryCode: string
  // "Category / Sub-category". Empty in workbooks issued before this existed.
  subCategoryKey: string
  columns: { key: string; header: string }[]
}

export function readMeta(sheets: Map<string, RawSheet>): { kind: string; tabs: MetaTab[] } | null {
  const meta = sheets.get(META_SHEET)
  if (!meta) return null
  const kind = String(meta.headers[1] ?? '')
  const tabs: MetaTab[] = []
  let inTabs = false
  for (const r of meta.rows) {
    const first = String(r.cells[0] ?? '')
    if (first === 'sheet') { inTabs = true; continue }
    if (!inTabs) continue
    try {
      tabs.push({
        sheet: first,
        subCategoryId: String(r.cells[1] ?? ''),
        subCategoryCode: String(r.cells[2] ?? ''),
        columns: JSON.parse(String(r.cells[3] ?? '[]')),
        subCategoryKey: String(r.cells[4] ?? ''),
      })
    } catch {
      /* an unreadable row is reported below as a missing tab */
    }
  }
  return { kind, tabs }
}

export function validateAssets(
  sheets: Map<string, RawSheet>,
  ctx: AssetsContext
): { assets: AssetInput[]; issues: Issue[] } {
  const issues: Issue[] = []
  const err = (sheet: string, row: number, message: string) => issues.push({ severity: 'error', sheet, row, message })
  const warn = (sheet: string, row: number, message: string) => issues.push({ severity: 'warning', sheet, row, message })
  const assets: AssetInput[] = []

  const meta = readMeta(sheets)
  if (!meta || meta.kind !== 'assets') {
    err('Read Me', 0, 'This is not an Assets workbook made by AFMS (its hidden information tab is missing). Use the file we sent you.')
    return { assets, issues }
  }

  const subById = new Map(ctx.subCategories.map(s => [s.id, s]))
  // A workbook built from the Masters file carries no database ids (nothing was
  // loaded when it was made), so fall back to "Category / Sub-category".
  const subByKey = new Map(ctx.subCategories.map(s => [nameKey(subCategoryKey(s)), s]))
  const findSub = (tab: MetaTab) =>
    (tab.subCategoryId ? subById.get(tab.subCategoryId) : undefined) ??
    (tab.subCategoryKey ? subByKey.get(nameKey(tab.subCategoryKey)) : undefined)
  const roomByKey = new Map(ctx.rooms.map(r => [nameKey(r.label), r]))
  const vendorByKey = new Map(ctx.vendors.map(v => [nameKey(v.name), v]))

  // Tabs that are not part of the template would be silently ignored otherwise.
  const known = new Set([...meta.tabs.map(t => t.sheet), 'Read Me', 'Lists', META_SHEET])
  for (const name of sheets.keys()) {
    if (!known.has(name)) err(name, 0, `The tab "${name}" is not part of the template. Rows on it were not read; move them to the right tab.`)
  }

  const serialSeen = new Map<string, { sheet: string; row: number }>()
  const existingSerials = new Set(ctx.existingSerials.map(s => `${s.subCategoryId}|${nameKey(s.serial)}`))

  for (const tab of meta.tabs) {
    const sheet = sheets.get(tab.sheet)
    if (!sheet) {
      err(tab.sheet, 0, `The tab "${tab.sheet}" is missing (deleted or renamed). Use the file as we sent it.`)
      continue
    }
    const sub = findSub(tab)
    if (!sub) {
      err(tab.sheet, 0, `The sub-category for the tab "${tab.sheet}" no longer exists in the app. Ask us for a fresh workbook.`)
      continue
    }
    const columns = assetColumns(sub.fields)
    // The template must still match the app's custom fields for this sub-category.
    const same =
      columns.length === tab.columns.length &&
      columns.every((c, i) => c.key === tab.columns[i].key && normalizeHeader(c.header) === normalizeHeader(tab.columns[i].header))
    if (!same) {
      err(tab.sheet, 1, `The custom fields for "${sub.name}" changed after this workbook was made. Ask us for a fresh workbook.`)
      continue
    }
    const headerIssues = checkHeaders(sheet, { columns }, tab.sheet)
    issues.push(...headerIssues)
    if (headerIssues.length) continue

    for (const rec of parseSheetRows(sheet, { columns }, tab.sheet, issues)) {
      const v = rec.v
      const at = (message: string) => err(tab.sheet, rec.row, message)

      const room = roomByKey.get(nameKey(v.room))
      if (str(v.room) && !room) at(`Room "${str(v.room)}" is not in the app (pick it from the list).`)

      const lookupVendor = (value: unknown, what: string) => {
        if (!str(value)) return undefined
        const hit = vendorByKey.get(nameKey(value))
        if (!hit) at(`${what} "${str(value)}" is not in the app (pick it from the list).`)
        return hit?.id
      }
      const maintenanceVendorId = lookupVendor(v.maintenanceVendor, 'Maintenance vendor')
      const purchaseVendorId = lookupVendor(v.purchaseVendor, 'Purchased-from vendor')

      const maintainedBy = (str(v.maintainedBy) as AssetInput['maintainedBy'] | undefined) ?? (maintenanceVendorId ? 'Vendor' : 'In House')
      if (maintainedBy === 'Vendor' && !str(v.maintenanceVendor)) warn(tab.sheet, rec.row, 'Maintained by Vendor, but no maintenance vendor is named.')

      const amcStart = str(v.amcStart)
      const amcEnd = str(v.amcEnd)
      if (amcStart && amcEnd && amcEnd < amcStart) at('AMC end date is before the AMC start date.')
      const purchaseDate = str(v.purchaseDate)
      const warrantyTill = str(v.warrantyTill)
      if (purchaseDate && warrantyTill && warrantyTill < purchaseDate) warn(tab.sheet, rec.row, 'Warranty ends before the purchase date.')
      const lastServiced = str(v.lastServiced)
      if (lastServiced && lastServiced > new Date().toISOString().slice(0, 10)) {
        warn(tab.sheet, rec.row, 'Last serviced date is in the future.')
      }

      // Serial numbers identify one physical item: the same one twice is a mistake.
      const serial = str(v.serial)
      if (serial) {
        const k = `${sub.id}|${nameKey(serial)}`
        const prior = serialSeen.get(k)
        if (prior) at(`Serial number "${serial}" is also on ${prior.sheet} row ${prior.row}.`)
        else serialSeen.set(k, { sheet: tab.sheet, row: rec.row })
        if (existingSerials.has(k)) at(`An asset with serial number "${serial}" already exists in this sub-category in the app.`)
      }

      const specs: Record<string, string> = {}
      for (const f of sub.fields) {
        const raw = v[`cf:${f.key}`]
        if (raw === undefined || raw === '') continue
        specs[f.key] = String(raw)
      }

      assets.push({
        sheet: tab.sheet,
        row: rec.row,
        subCategoryId: sub.id,
        name: String(v.name ?? ''),
        roomId: room?.id ?? '',
        slaPriority: v.slaPriority as AssetInput['slaPriority'],
        manufacturer: str(v.manufacturer),
        model: str(v.model),
        serial,
        price: typeof v.price === 'number' ? v.price : undefined,
        purchaseDate,
        installDate: str(v.installDate),
        warrantyTill,
        lastServiced,
        status: (str(v.status) as AssetInput['status'] | undefined) ?? 'Operational',
        maintainedBy,
        maintenanceVendorId,
        purchaseVendorId,
        amcStart,
        amcEnd,
        notes: str(v.notes),
        specs,
      })
    }
  }

  if (assets.length === 0 && !issues.some(i => i.severity === 'error')) {
    err('Read Me', 0, 'The workbook has no assets on any tab.')
  }
  return { assets, issues }
}
