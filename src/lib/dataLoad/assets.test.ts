// @vitest-environment node
import ExcelJS from 'exceljs'
import { describe, expect, it, vi } from 'vitest'
import { buildAssets, type TemplateForScheduling } from './buildAssets'
import { assetColumns, generateAssetsWorkbook, tabNames, writeAssetsMeta } from './generateAssets'
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

const ctx: AssetsContext = {
  subCategories: [
    { id: 'sub-1', code: 'ELEC-LIGH', name: 'Light', categoryName: 'Electrical', fields, pmTemplateIds: ['t-pm'], inspectionTemplateIds: ['t-in'] },
    { id: 'sub-2', code: 'ELEC-FAN', name: 'Ceiling Fan', categoryName: 'Electrical', fields: [], pmTemplateIds: [], inspectionTemplateIds: [] },
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

// Columns, in order: name, room, SLA, manufacturer, model, serial, cost, purchase, install,
// warranty, last serviced, status, maintained by, maintenance vendor, purchased from,
// AMC start, AMC end, notes, then the custom fields.
const lightRow = (over: Record<number, unknown> = {}) => {
  const row: unknown[] = [
    'Tube light 1', 'Main Campus / Block A / Lab 1', 'High', 'Philips', 'TL-1', 'SN-1', 1200,
    utcDate(2024, 1, 10), utcDate(2024, 1, 20), utcDate(2027, 1, 20), utcDate(2026, 6, 15),
    'Operational', 'Vendor', 'Cool Air Services', '', '', '', 'Near window',
    36, utcDate(2024, 2, 1), 'White',
  ]
  Object.entries(over).forEach(([i, v]) => { row[Number(i)] = v })
  return row
}

const tabDefs = () => {
  const names = tabNames(ctx.subCategories.map(s => s.name))
  return ctx.subCategories.map((s, i) => ({ name: names[i], sub: s, columns: assetColumns(s.fields) }))
}
const metaTabs = () => tabDefs().map(t => ({ name: t.name, subCategoryId: t.sub.id, subCategoryCode: t.sub.code, columns: t.columns }))

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

describe('the Assets template', () => {
  it('has one tab per sub-category with that sub-category\'s custom fields as columns', async () => {
    const sheets = await readWorkbook(await generateAssetsWorkbook(templateContext), {}, 40)
    expect([...sheets.keys()]).toEqual(['Read Me', 'Light', 'Ceiling Fan', 'Lists', '_Meta'])
    const light = sheets.get('Light')!.headers.slice(0, ASSET_FIXED_COLUMNS.length + 3)
    expect(light.slice(0, 3)).toEqual(['Asset name *', 'Room / area *', 'SLA priority *'])
    expect(light.slice(ASSET_FIXED_COLUMNS.length)).toEqual(['Wattage (W) *', 'Installed on', 'Finish'])
    expect(sheets.get('Ceiling Fan')!.headers[ASSET_FIXED_COLUMNS.length]).toBe('Row check')
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
    const file = await fillWorkbook(await generateAssetsWorkbook(templateContext), { Light: [lightRow()] })
    const r = await validate(file)
    expect(errors(r)).toEqual([])
    expect(r.assets).toHaveLength(1)
    expect(r.assets[0]).toMatchObject({ name: 'Tube light 1', roomId: 'r-1', slaPriority: 'High', maintenanceVendorId: 'v-1', maintainedBy: 'Vendor' })
  }, 60_000)
})

describe('validateAssets', () => {
  it('reads a correct row, keeping custom values as text like the app does', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow()] }))
    expect(errors(r)).toEqual([])
    expect(r.assets[0]).toMatchObject({
      subCategoryId: 'sub-1', price: 1200, purchaseDate: '2024-01-10', installDate: '2024-01-20',
      warrantyTill: '2027-01-20', lastServiced: '2026-06-15', status: 'Operational', serial: 'SN-1',
    })
    expect(r.assets[0].specs).toEqual({ field_wattage: '36', field_installed_on: '2024-02-01', field_finish: 'White' })
  })

  it('defaults status, maintained-by and leaves optional cells absent', async () => {
    const r = await validate(await plainAssets({ 'Ceiling Fan': [['Fan 1', 'Main Campus / Block A / Store', 'Low']] }))
    expect(errors(r)).toEqual([])
    expect(r.assets[0]).toMatchObject({ status: 'Operational', maintainedBy: 'In House', slaPriority: 'Low', specs: {} })
    expect(r.assets[0].serial).toBeUndefined()
  })

  it('needs a name, a room, an SLA priority and every required custom field', async () => {
    // A row with only a manufacturer typed in (a completely blank row is simply ignored).
    const r = await validate(await plainAssets({ Light: [['', '', '', 'Philips']], 'Ceiling Fan': [['Fan', 'Main Campus / Block A / Store', '']] }))
    const e = errors(r)
    expect(e).toContain('Asset name: is required')
    expect(e).toContain('Room / area: is required')
    expect(e).toContain('Wattage (W): is required')
    expect(r.issues.filter(i => i.sheet === 'Light' && /SLA priority/.test(i.message))).toHaveLength(1)
    expect(r.issues.filter(i => i.sheet === 'Ceiling Fan' && /SLA priority: is required/.test(i.message))).toHaveLength(1)
  })

  it('refuses a room or vendor that is not in the app instead of guessing the nearest one', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow({ 1: 'Main Campus / Block A / Lab', 13: 'Cool Air' })] }))
    const e = errors(r).join('|')
    expect(e).toMatch(/Room "Main Campus \/ Block A \/ Lab" is not in the app/)
    expect(e).toMatch(/Maintenance vendor "Cool Air" is not in the app/)
  })

  it('reports a bad SLA priority, cost and date with the row', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow({ 2: 'Urgent', 6: 'lots', 10: 'sometime' })] }))
    const e = errors(r).join('|')
    expect(e).toMatch(/SLA priority: "Urgent" is not one of: Critical, High, Medium, Low/)
    expect(e).toMatch(/Cost \(INR\): "lots" is not a valid number/)
    expect(e).toMatch(/Last serviced date: "sometime" is not a date/)
    expect(r.issues.every(i => i.sheet === 'Light' && i.row === 2)).toBe(true)
  })

  it('reports the same serial twice, and one that already exists in the app', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow(), lightRow({ 0: 'Tube light 2' }), lightRow({ 0: 'Old one', 5: 'old-1' })] }))
    const e = errors(r).join('|')
    expect(e).toMatch(/Serial number "SN-1" is also on Light row 2/)
    expect(e).toMatch(/An asset with serial number "old-1" already exists/)
  })

  it('allows several identical assets with no serial number', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow({ 5: '' }), lightRow({ 5: '' })] }))
    expect(errors(r)).toEqual([])
    expect(r.assets).toHaveLength(2)
  })

  it('warns about a vendor-maintained asset with no vendor, and a last-serviced date in the future', async () => {
    const r = await validate(await plainAssets({ Light: [lightRow({ 13: '', 10: utcDate(2100, 1, 1) })] }))
    expect(errors(r)).toEqual([])
    const w = r.issues.filter(i => i.severity === 'warning').map(i => i.message).join('|')
    expect(w).toMatch(/no maintenance vendor is named/)
    expect(w).toMatch(/in the future/)
  })

  it('stops when a tab was renamed, a heading changed, or the custom fields changed since it was sent', async () => {
    const renamed = await validate(await plainAssets({ Light: [lightRow()] }, wb => { wb.getWorksheet('Light')!.name = 'Lights' }))
    expect(errors(renamed).join('|')).toMatch(/The tab "Lights" is not part of the template/)
    expect(errors(renamed).join('|')).toMatch(/The tab "Light" is missing/)

    const heading = await validate(await plainAssets({ Light: [lightRow()] }, wb => { wb.getWorksheet('Light')!.getCell('C1').value = 'Priority' }))
    expect(errors(heading).join('|')).toMatch(/Column 3 should be "SLA priority \*" but is "Priority"/)

    const stale = await validate(await plainAssets({ Light: [lightRow()] }, wb => {
      writeAssetsMeta(wb.getWorksheet(META_SHEET)!, [{ ...metaTabs()[0], columns: metaTabs()[0].columns.slice(0, -1) }, metaTabs()[1]])
    }))
    expect(errors(stale).join('|')).toMatch(/custom fields for "Light" changed after this workbook was made/)
  })

  it('refuses a workbook that is not an Assets workbook', async () => {
    const file = await plainWorkbook([{ name: 'Sheet1', headers: ['x'] }], {})
    expect(errors(await validate(file)).join('|')).toMatch(/not an Assets workbook/)
  })

  it('says so when no asset was entered', async () => {
    expect(errors(await validate(await plainAssets({}))).join('|')).toMatch(/no assets on any tab/)
  })
})

describe('buildAssets', () => {
  const now = new Date(2026, 8, 25, 10, 0, 0) // 25 Sep 2026, local time

  async function inputs(fills: Record<string, unknown[][]>) {
    const r = await validate(await plainAssets(fills))
    expect(errors(r)).toEqual([])
    return r.assets
  }

  it('numbers assets after the highest existing AST number and builds the QR link', async () => {
    const plan = buildAssets(await inputs({ Light: [lightRow(), lightRow({ 0: 'Tube light 2', 5: 'SN-2' })] }), ctx, templates, { assetIds: ['AST-0007', 'AST-0003'], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.assets.map(a => a.asset_id)).toEqual(['AST-0008', 'AST-0009'])
    expect(plan.assets[0]).toMatchObject({
      sub_category_id: 'sub-1', room_id: 'r-1', sla_priority: 'High', price: 1200, maintenance_by: 'Vendor',
      maintenance_vendor_id: 'v-1', installation_date: '2024-01-20', last_serviced_date: '2026-06-15',
      image_url: '/images/asset-placeholder.png', assigned_to_user_id: null,
      qr_code_url: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-AST-0008',
      dynamic_specifications: { field_wattage: '36', field_installed_on: '2024-02-01', field_finish: 'White' },
    })
  })

  it('schedules the first maintenance and inspection one interval after the last serviced date', async () => {
    const plan = buildAssets(await inputs({ Light: [lightRow()] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.work_orders).toHaveLength(1)
    expect(plan.work_orders[0]).toMatchObject({
      type: 'Preventive', asset_id: plan.assets[0].id, title: 'Light quarterly (Quarterly)', frequency: 'Quarterly',
      due_date: '2026-09-15', status: 'Scheduled', source: 'Scheduled', priority: 'Medium', checklist_template_id: 't-pm',
    })
    expect(plan.work_orders[0].wo_number).toBe(`PENDING-${plan.work_orders[0].id}`)
    expect(plan.inspections).toHaveLength(1)
    expect(plan.inspections[0]).toMatchObject({ asset_id: plan.assets[0].id, template_id: 't-in', due_date: '2026-07-15', status: 'Scheduled' })
  })

  it('counts from today when there is no last serviced date, never from the install date', async () => {
    const plan = buildAssets(await inputs({ Light: [lightRow({ 10: '', 5: 'SN-9' })] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.work_orders[0].due_date).toBe('2026-12-25')
    expect(plan.inspections[0].due_date).toBe('2026-10-25')
  })

  it('schedules nothing for a sub-category with no templates, but still records the asset', async () => {
    const plan = buildAssets(await inputs({ 'Ceiling Fan': [['Fan 1', 'Main Campus / Block A / Store', 'Low']] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.assets).toHaveLength(1)
    expect(plan.work_orders).toHaveLength(0)
    expect(plan.inspections).toHaveLength(0)
    expect(plan.asset_activity_logs).toHaveLength(1)
  })

  it('writes an "Asset Created" history entry per asset, like a bulk import', async () => {
    const plan = buildAssets(await inputs({ Light: [lightRow()] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(plan.asset_activity_logs[0]).toMatchObject({
      asset_id: plan.assets[0].id, action: 'Asset Created', source: 'Bulk Import', by_user: 'Data load', reference_id: null,
    })
    expect(plan.asset_activity_logs[0].remarks).toContain('AST-0001')
  })

  it('uses the same installation-date fallback as the app: purchase date, then today', async () => {
    const a = buildAssets(await inputs({ Light: [lightRow({ 8: '' })] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(a.assets[0].installation_date).toBe('2024-01-10')
    const b = buildAssets(await inputs({ Light: [lightRow({ 7: '', 8: '' })] }), ctx, templates, { assetIds: [], inspectionNumbers: [] }, counterIds(), now)
    expect(b.assets[0].installation_date).toBe('2026-09-25')
  })
})
