// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it, vi } from 'vitest'
import { buildAssets, type TemplateForScheduling } from './buildAssets'
import { categoryColumns, generateAssetsWorkbook, groupByCategory, tabNames, writeAssetsMeta } from './generateAssets'
import { assetsContextFromMasters } from './assetsFromMasters'
import { readWorkbook } from './readWorkbook'
import { ASSET_FIXED_COLUMNS, META_SHEET } from './spec'
import { counterIds, fillWorkbook, plainWorkbook, utcDate } from './testHelpers'
import { validateAssets, type AssetsContext } from './validateAssets'
import type { FieldDef } from './validateMasters'

// Generating and reading a whole workbook is slow when the full suite runs many files at once.
vi.setConfig({ testTimeout: 60_000 })

const fields: FieldDef[] = [
  { key: 'field_wattage', label: 'Wattage', type: 'Number', unit: 'W', required: true, order: 1 },
  { key: 'field_installed_on', label: 'Installed on', type: 'Date', required: false, order: 2 },
  { key: 'field_finish', label: 'Finish', type: 'Text', required: false, order: 3 },
]

// Two sub-categories in one category, so the tab carries the union of their
// fields: Light has all three, Ceiling Fan only Finish.
const fanFields: FieldDef[] = [{ key: 'field_finish', label: 'Finish', type: 'Text', required: true, order: 1 }]

const ctx: AssetsContext = {
  subCategories: [
    { id: 'sub-1', code: 'ELEC-LIGH', name: 'Light', categoryName: 'Electrical', fields, pmTemplateIds: ['t-pm'], inspectionTemplateIds: ['t-in'] },
    { id: 'sub-2', code: 'ELEC-FAN', name: 'Ceiling Fan', categoryName: 'Electrical', fields: fanFields, pmTemplateIds: [], inspectionTemplateIds: [] },
  ],
  rooms: [{ id: 'r-1', label: 'Main Campus / Block A / Lab 1' }, { id: 'r-2', label: 'Main Campus / Block A / Store' }],
  vendors: [{ id: 'v-1', name: 'Cool Air Services' }],
  existingSerials: [{ subCategoryId: 'sub-1', serial: 'OLD-1' }],
}

const templates: TemplateForScheduling[] = [
  { id: 't-pm', title: 'Light quarterly', interval: 'Quarterly', items: [{ id: 'ci-1', order: 1, itemText: 'Clean', responseType: 'Checkbox', mandatory: true, photoRequired: false }] },
  { id: 't-in', title: 'Light check', interval: 'Monthly', items: [{ id: 'ci-1', order: 1, itemText: 'Working?', responseType: 'Pass-Fail', mandatory: true, photoRequired: false }] },
]

const templateContext = {
  subCategories: ctx.subCategories.map(s => ({ id: s.id, code: s.code, name: s.name, categoryName: s.categoryName, fields: s.fields })),
  rooms: ctx.rooms.map(r => r.label),
  vendors: ctx.vendors.map(v => v.name),
  rowsPerTab: 40,
}

// Columns, in order: sub-category, name, room, SLA, manufacturer, model, serial, cost,
// purchase, install, warranty, last serviced, status, maintained by, maintenance vendor,
// purchased from, AMC start, AMC end, notes, then the category's custom fields.
const SUB = 0, NAME = 1, ROOM = 2, SLA = 3, SERIAL = 6, COST = 7, LAST_SERVICED = 11, MAINT_VENDOR = 14
const CUSTOM = 1 + ASSET_FIXED_COLUMNS.length // Wattage, Installed on, Finish

const lightRow = (over: Record<number, unknown> = {}) => {
  const row: unknown[] = [
    'Light', 'Tube light 1', 'Main Campus / Block A / Lab 1', 'High', 'Philips', 'TL-1', 'SN-1', 1200,
    utcDate(2024, 1, 10), utcDate(2024, 1, 20), utcDate(2027, 1, 20), utcDate(2026, 6, 15),
    'Operational', 'Vendor', 'Cool Air Services', '', '', '', 'Near window',
    36, utcDate(2024, 2, 1), 'White',
  ]
  Object.entries(over).forEach(([i, v]) => { row[Number(i)] = v })
  return row
}

const fanRow = (over: Record<number, unknown> = {}) => {
  const row: unknown[] = ['Ceiling Fan', 'Fan 1', 'Main Campus / Block A / Store', 'Low']
  row[CUSTOM + 2] = 'Brown' // Finish, the one field a fan has
  Object.entries(over).forEach(([i, v]) => { row[Number(i)] = v })
  return row
}

const groups = () => groupByCategory(ctx.subCategories)
const tabDefs = () => {
  const names = tabNames(groups().map(g => g.name))
  return groups().map((g, i) => ({ name: names[i], group: g, columns: categoryColumns(g) }))
}
const metaTabs = () => tabDefs().map(t => ({ name: t.name, category: t.group.name, columns: t.columns }))

async function plainAssets(fills: Record<string, unknown[][]>, tamper?: (wb: ExcelJS.Workbook) => void) {
  return plainWorkbook(
    [{ name: 'Read Me', headers: [] }, ...tabDefs().map(t => ({ name: t.name, headers: t.columns.map(c => c.header) })), { name: META_SHEET, headers: [] }],
    fills,
    wb => {
      const meta = wb.getWorksheet(META_SHEET)!
      writeAssetsMeta(meta, metaTabs())
      tamper?.(wb)
    }
  )
}

const validate = async (file: Uint8Array) => validateAssets(await readWorkbook(file, {}, 120), ctx)
const errors = (r: { issues: { severity: string; message: string }[] }) =>
  r.issues.filter(i => i.severity === 'error').map(i => i.message)

describe('tabNames', () => {
  it('keeps names Excel accepts: 31 characters, no forbidden characters, unique', () => {
    const names = tabNames(['Split AC / Wall', 'Split AC / Wall', 'A'.repeat(40), 'Read Me', 'Lists'])
    expect(names[0]).toBe('Split AC Wall')
    expect(names[1]).toBe('Split AC Wall (2)')
    expect(names[2]).toHaveLength(31)
    expect(names.every(n => n.length <= 31 && !/[[\]:*?/\\]/.test(n))).toBe(true)
    expect(new Set(names.map(n => n.toLowerCase())).size).toBe(names.length)
    expect(names[3]).not.toBe('Read Me')
    expect(names[4]).not.toBe('Lists')
  })
})

describe('groupByCategory', () => {
  it('puts one tab per category, holding every custom field used in it, once', () => {
    const [electrical] = groups()
    expect(electrical.name).toBe('Electrical')
    expect(electrical.subCategories.map(s => s.name)).toEqual(['Light', 'Ceiling Fan'])
    // Finish is on both sub-categories but is one column.
    expect(electrical.fields.map(f => f.label)).toEqual(['Wattage', 'Installed on', 'Finish'])
  })
})

describe('the Assets template', () => {
  it('has one tab per category, starting with the sub-category to choose', async () => {
    const sheets = await readWorkbook(await generateAssetsWorkbook(templateContext), {}, 40)
    expect([...sheets.keys()]).toEqual(['Read Me', 'Electrical', 'Lists', '_Fields', '_Meta'])
    const headers = sheets.get('Electrical')!.headers
    expect(headers.slice(0, 4)).toEqual(['Sub-category *', 'Asset name *', 'Room / area *', 'SLA priority *'])
    // No star on a custom field: whether it is required depends on the row's sub-category.
    expect(headers.slice(CUSTOM, CUSTOM + 3)).toEqual(['Wattage (W)', 'Installed on', 'Finish'])
    expect(headers[CUSTOM + 3]).toBe('Row check')
  })

  it('offers only that category\'s sub-categories to choose from', async () => {
    const sheets = await readWorkbook(await generateAssetsWorkbook(templateContext), {}, 40)
    const lists = sheets.get('Lists')!
    const col = lists.headers.indexOf('Electrical sub-categories')
    expect(col).toBeGreaterThan(-1)
    expect(lists.rows.map(r => r.cells[col]).filter(Boolean)).toEqual(['Light', 'Ceiling Fan'])
  })

  it('asks for the SLA priority and the last serviced date, and never for an asset number', () => {
    const headers = ASSET_FIXED_COLUMNS.map(c => c.header)
    expect(headers).toContain('SLA priority *')
    expect(headers).toContain('Last serviced date')
    expect(headers.some(h => /asset (no|number|id|tag)/i.test(h))).toBe(false)
    expect(headers.some(h => /usd/i.test(h))).toBe(false)
  })

  it('refuses to make a workbook before there are sub-categories', async () => {
    await expect(generateAssetsWorkbook({ subCategories: [], rooms: [], vendors: [] })).rejects.toThrow(/Load the Masters workbook first/)
  })

  it('can be filled in and read back exactly as sent (the real template)', async () => {
    const file = await fillWorkbook(await generateAssetsWorkbook(templateContext), { Electrical: [lightRow()] })
    const r = await validate(file)
    expect(errors(r)).toEqual([])
    expect(r.assets).toHaveLength(1)
    expect(r.assets[0]).toMatchObject({ name: 'Tube light 1', roomId: 'r-1', slaPriority: 'High', maintenanceVendorId: 'v-1', maintainedBy: 'Vendor' })
  }, 60_000)
})

describe('validateAssets', () => {
  it('reads a correct row, keeping custom values as text like the app does', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow()] }))
    expect(errors(r)).toEqual([])
    expect(r.assets[0]).toMatchObject({
      subCategoryId: 'sub-1', price: 1200, purchaseDate: '2024-01-10', installDate: '2024-01-20',
      warrantyTill: '2027-01-20', lastServiced: '2026-06-15', status: 'Operational', serial: 'SN-1',
    })
    expect(r.assets[0].specs).toEqual({ field_wattage: '36', field_installed_on: '2024-02-01', field_finish: 'White' })
  })

  it('sends each row to the sub-category it names, on the same tab', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow(), fanRow()] }))
    expect(errors(r)).toEqual([])
    expect(r.assets.map(a => a.subCategoryId)).toEqual(['sub-1', 'sub-2'])
    expect(r.assets[1].specs).toEqual({ field_finish: 'Brown' })
  })

  it('refuses a sub-category that does not belong to the tab\'s category', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [SUB]: 'Split AC' })] }))
    expect(errors(r).join('|')).toMatch(/Sub-category "Split AC" is not one of the "Electrical" sub-categories/)
  })

  it('needs the sub-category before anything else on the row', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [SUB]: '' })] }))
    expect(errors(r)).toContain('Sub-category: is required')
  })

  it('defaults status and maintained-by, and leaves optional cells absent', async () => {
    const r = await validate(await plainAssets({ Electrical: [fanRow()] }))
    expect(errors(r)).toEqual([])
    expect(r.assets[0]).toMatchObject({ status: 'Operational', maintainedBy: 'In House', slaPriority: 'Low' })
    expect(r.assets[0].serial).toBeUndefined()
  })

  it('needs a name, a room and an SLA priority', async () => {
    const r = await validate(await plainAssets({ Electrical: [['Light', '', '', '', 'Philips']] }))
    const e = errors(r)
    expect(e).toContain('Asset name: is required')
    expect(e).toContain('Room / area: is required')
    expect(e).toContain('SLA priority: is required')
  })

  // The point of one tab per category: which extra details apply is decided by
  // the sub-category on the row, not by the tab.
  it('asks for a custom field that the chosen sub-category requires', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [CUSTOM]: '' })] }))
    expect(errors(r).join('|')).toMatch(/"Wattage" is required for "Light"/)
  })

  it('refuses a custom field that belongs to another sub-category', async () => {
    const r = await validate(await plainAssets({ Electrical: [fanRow({ [CUSTOM]: 40 })] }))
    expect(errors(r).join('|')).toMatch(/"Wattage" is not a detail of "Ceiling Fan"/)
  })

  it('keeps a field that two sub-categories share', async () => {
    const r = await validate(await plainAssets({ Electrical: [fanRow()] }))
    expect(errors(r)).toEqual([])
    expect(r.assets[0].specs).toEqual({ field_finish: 'Brown' })
  })

  it('refuses a room or vendor that is not in the app instead of guessing the nearest one', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [ROOM]: 'Main Campus / Block A / Lab', [MAINT_VENDOR]: 'Cool Air' })] }))
    const e = errors(r).join('|')
    expect(e).toMatch(/Room "Main Campus \/ Block A \/ Lab" is not in the app/)
    expect(e).toMatch(/Maintenance vendor "Cool Air" is not in the app/)
  })

  it('reports a bad SLA priority, cost and date with the row', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [SLA]: 'Urgent', [COST]: 'lots', [LAST_SERVICED]: 'sometime' })] }))
    const e = errors(r).join('|')
    expect(e).toMatch(/SLA priority: "Urgent" is not one of: Critical, High, Medium, Low/)
    expect(e).toMatch(/Cost \(INR\): "lots" is not a valid number/)
    expect(e).toMatch(/Last serviced date: "sometime" is not a date/)
    expect(r.issues.every(i => i.sheet === 'Electrical' && i.row === 2)).toBe(true)
  })

  it('reports the same serial twice, and one that already exists in the app', async () => {
    const r = await validate(await plainAssets({
      Electrical: [lightRow(), lightRow({ [NAME]: 'Tube light 2' }), lightRow({ [NAME]: 'Old one', [SERIAL]: 'old-1' })],
    }))
    const e = errors(r).join('|')
    expect(e).toMatch(/Serial number "SN-1" is also on Electrical row 2/)
    expect(e).toMatch(/An asset with serial number "old-1" already exists/)
  })

  it('allows several identical assets with no serial number', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [SERIAL]: '' }), lightRow({ [SERIAL]: '' })] }))
    expect(errors(r)).toEqual([])
    expect(r.assets).toHaveLength(2)
  })

  it('warns about a vendor-maintained asset with no vendor, and a last-serviced date in the future', async () => {
    const r = await validate(await plainAssets({ Electrical: [lightRow({ [MAINT_VENDOR]: '', [LAST_SERVICED]: utcDate(2100, 1, 1) })] }))
    expect(errors(r)).toEqual([])
    const w = r.issues.filter(i => i.severity === 'warning').map(i => i.message).join('|')
    expect(w).toMatch(/no maintenance vendor is named/)
    expect(w).toMatch(/in the future/)
  })

  it('stops when a tab was renamed, a heading changed, or the fields changed since it was sent', async () => {
    const renamed = await validate(await plainAssets({ Electrical: [lightRow()] }, wb => { wb.getWorksheet('Electrical')!.name = 'Electric' }))
    expect(errors(renamed).join('|')).toMatch(/The tab "Electric" is not part of the template/)
    expect(errors(renamed).join('|')).toMatch(/The tab "Electrical" is missing/)

    const heading = await validate(await plainAssets({ Electrical: [lightRow()] }, wb => { wb.getWorksheet('Electrical')!.getCell('D1').value = 'Priority' }))
    expect(errors(heading).join('|')).toMatch(/Column 4 should be "SLA priority \*" but is "Priority"/)

    const stale = await validate(await plainAssets({ Electrical: [lightRow()] }, wb => {
      writeAssetsMeta(wb.getWorksheet(META_SHEET)!, [{ ...metaTabs()[0], columns: metaTabs()[0].columns.slice(0, -1) }])
    }))
    expect(errors(stale).join('|')).toMatch(/sub-categories or custom fields of "Electrical" changed/)
  })

  it('refuses a workbook that is not an Assets workbook', async () => {
    const file = await plainWorkbook([{ name: 'Sheet1', headers: ['x'] }], {})
    expect(errors(await validate(file)).join('|')).toMatch(/not an Assets workbook/)
  })
})

const now = new Date('2026-09-25T00:00:00Z')
const inputs = async (fills: Record<string, unknown[][]>) => (await validate(await plainAssets(fills))).assets

describe('buildAssets', () => {
  it('schedules one preventive order and one inspection per template of the sub-category', async () => {
    const plan = buildAssets(await inputs({ Electrical: [lightRow()] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.assets).toHaveLength(1)
    expect(plan.work_orders).toHaveLength(1)
    expect(plan.inspections).toHaveLength(1)
  })

  it('schedules nothing for a sub-category with no templates', async () => {
    const plan = buildAssets(await inputs({ Electrical: [fanRow()] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.assets).toHaveLength(1)
    expect(plan.work_orders).toHaveLength(0)
    expect(plan.inspections).toHaveLength(0)
    expect(plan.asset_activity_logs).toHaveLength(1)
  })

  it('writes an "Asset Created" history entry per asset, like a bulk import', async () => {
    const plan = buildAssets(await inputs({ Electrical: [lightRow()] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.asset_activity_logs[0]).toMatchObject({
      asset_id: plan.assets[0].id, action: 'Asset Created', source: 'Bulk Import', by_user: 'Data load', reference_id: null,
    })
    expect(plan.asset_activity_logs[0].remarks).toContain('AST-0001')
  })

  it('uses the same installation-date fallback as the app: purchase date, then today', async () => {
    const a = buildAssets(await inputs({ Electrical: [lightRow({ 9: '' })] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(a.assets[0].installation_date).toBe('2024-01-10')
    const b = buildAssets(await inputs({ Electrical: [lightRow({ 8: '', 9: '' })] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(b.assets[0].installation_date).toBe('2026-09-25')
  })
})

// Built straight from a filled Masters workbook, before anything is loaded, so
// the client can start on the equipment list while the masters wait for
// deployment day. Nothing here needs a database: a tab is a category by name,
// and each row names its own sub-category.
describe('an Assets workbook built from the Masters file (no database)', () => {
  const masters = {
    rooms: [{ label: 'Main Campus / Block A / Lab 1' }, { label: 'Main Campus / Block A / Store' }],
    vendors: [{ name: 'Cool Air Services' }],
    subCategories: [
      { name: 'Light', category: 'Electrical', fields },
      { name: 'Ceiling Fan', category: 'Electrical', fields: fanFields },
    ],
  } as unknown as Parameters<typeof assetsContextFromMasters>[0]

  it('offers the rooms, vendors and sub-categories from the workbook, with no ids yet', () => {
    const c = assetsContextFromMasters(masters)
    expect(c.rooms).toEqual(['Main Campus / Block A / Lab 1', 'Main Campus / Block A / Store'])
    expect(c.vendors).toEqual(['Cool Air Services'])
    expect(c.subCategories.map(s => `${s.categoryName} / ${s.name}`)).toEqual(['Electrical / Light', 'Electrical / Ceiling Fan'])
    expect(c.subCategories.every(s => s.id === '' && s.code === '')).toBe(true)
  })

  it('makes the same tabs as the database would, and loads once the masters are in', async () => {
    const file = await generateAssetsWorkbook({ ...assetsContextFromMasters(masters), rowsPerTab: 40 })
    const sheets = await readWorkbook(file, {}, 120)
    expect([...sheets.keys()]).toEqual(['Read Me', 'Electrical', 'Lists', '_Fields', '_Meta'])

    const filled = await fillWorkbook(file, { Electrical: [lightRow()] })
    const { assets, issues } = validateAssets(await readWorkbook(filled, {}, 120), ctx)
    expect(issues.filter(i => i.severity === 'error')).toEqual([])
    expect(assets[0].subCategoryId).toBe('sub-1')
  }, 60_000)
})
