// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { buildMasters, emptyMastersSnapshot, planCounts } from './buildMasters'
import { generateMastersWorkbook } from './generateMasters'
import { readWorkbook } from './readWorkbook'
import { MASTER_ORDER, MASTER_SPECS } from './spec'
import { counterIds, fillWorkbook, plainWorkbook, utcDate } from './testHelpers'
import { validateMasters } from './validateMasters'

// Generating and reading a whole workbook is slow when the full suite runs many files at once.
vi.setConfig({ testTimeout: 60_000 })

let template: Uint8Array

beforeAll(async () => {
  template = await generateMastersWorkbook()
}, 60_000)

const good = () => ({
  Campuses: [['Main Campus', '1 Marine Road']],
  Buildings: [['Block A', 'Main Campus', 3]],
  Rooms: [
    ['Lab 1', 'Main Campus / Block A', 'Laboratory', '1', 450, 'Yes'],
    ['Store', 'Main Campus / Block A'],
  ],
  Vendors: [['Cool Air Services', 'HVAC', 'Ravi', 'ravi@cool.test', '9999999999', 'Kochi', 'Yes', 'AMC-1', utcDate(2026, 1, 1), utcDate(2026, 12, 31)]],
  Categories: [['Electrical', 'Wiring and lighting'], ['Electronics', '']],
  'Sub-Categories': [
    ['Light', 'Electrical', '', 'Light quarterly', '', '', 'Light check'],
    ['Lamp', 'Electronics'],
  ],
  'Custom Fields': [['Electrical / Light', 'Wattage', 'Number', 'W', 'Yes', 1]],
  'Maintenance Templates': [['Light quarterly', 'Quarterly', '']],
  'Maintenance Steps': [
    ['Light quarterly', 2, 'Clean fixture'],
    ['Light quarterly', 1, 'Check switch', 'Isolate power first', 'Yes', 'Yes'],
  ],
  'Inspection Templates': [['Light check', 'Monthly']],
  'Inspection Steps': [['Light check', 1, 'Is it working?']],
})

const tabs = MASTER_ORDER.map(k => ({ name: MASTER_SPECS[k].name, headers: MASTER_SPECS[k].columns.map(c => c.header) }))

async function run(fills: Record<string, unknown[][]>, tamper?: Parameters<typeof plainWorkbook>[2]) {
  const file = await plainWorkbook(tabs, fills, tamper)
  return validateMasters(await readWorkbook(file))
}
const errors = (r: { issues: { severity: string; message: string }[] }) =>
  r.issues.filter(i => i.severity === 'error').map(i => i.message)

describe('the Masters template', () => {
  it('has every tab in fill order, then the hidden lists', async () => {
    const sheets = await readWorkbook(template)
    expect([...sheets.keys()]).toEqual(['Read Me', ...MASTER_ORDER.map(k => MASTER_SPECS[k].name), 'Lists', '_Meta'])
  })

  it('can be filled in and read back exactly as sent (the real template, not a stand-in)', async () => {
    const file = await fillWorkbook(template, good())
    const { data, issues } = validateMasters(await readWorkbook(file))
    expect(issues.filter(i => i.severity === 'error')).toEqual([])
    expect(data.rooms).toHaveLength(2)
    expect(data.pmTemplates[0].steps).toHaveLength(2)
  }, 60_000)

  it('has exactly the headings the loader expects, with required ones starred', async () => {
    const sheets = await readWorkbook(template)
    for (const k of MASTER_ORDER) {
      const spec = MASTER_SPECS[k]
      expect(sheets.get(spec.name)?.headers.slice(0, spec.columns.length)).toEqual(spec.columns.map(c => c.header))
    }
    expect(MASTER_SPECS.subCategories.columns.some(c => /sla/i.test(c.header))).toBe(false)
  })

  it('puts a dropdown on every list column and a Row check formula on every row', async () => {
    const wb = new (await import('exceljs')).default.Workbook()
    await wb.xlsx.load(template as unknown as import('exceljs').Buffer)
    const ws = wb.getWorksheet('Rooms')!
    const validations = (ws as unknown as { dataValidations: { model: Record<string, { type: string; formulae: unknown[] }> } }).dataValidations.model
    const building = validations['B2']
    expect(building.type).toBe('list')
    expect(String(building.formulae[0])).toContain('OFFSET(Lists!$B$2')
    const check = ws.getCell('G2').value as { formula: string }
    expect(check.formula).toContain('Building is required')
    expect(check.formula).toContain('appears twice')
  })
})

describe('validateMasters', () => {
  it('accepts a complete, correct workbook and links everything by name', async () => {
    const { data, issues } = await run(good())
    expect(issues.filter(i => i.severity === 'error')).toEqual([])
    expect(data.campuses).toHaveLength(1)
    expect(data.rooms.map(r => r.label)).toEqual(['Main Campus / Block A / Lab 1', 'Main Campus / Block A / Store'])
    expect(data.rooms[1].reservable).toBe(true) // blank Yes/No falls back to the app's default
    expect(data.pmTemplates[0].steps.map(s => s.task)).toEqual(['Check switch', 'Clean fixture']) // by step no
    expect(data.subCategories[0].fields).toEqual([
      { key: 'field_wattage', label: 'Wattage', type: 'Number', unit: 'W', required: true, order: 1 },
    ])
    // A sub-category with no templates is allowed but flagged.
    expect(issues.some(i => i.severity === 'warning' && /no maintenance template/.test(i.message))).toBe(true)
  })

  it('reports a building whose campus does not exist', async () => {
    const f = good()
    f.Buildings = [['Block A', 'Nowhere Campus', 3]]
    expect(errors(await run(f)).join('|')).toMatch(/Campus "Nowhere Campus" is not on the Campuses tab/)
  })

  it('reports a name used twice, ignoring case and spacing', async () => {
    const f = good()
    f.Campuses = [['Main Campus', ''], ['  main   campus', '']]
    expect(errors(await run(f)).join('|')).toMatch(/This campus appears twice/)
  })

  it('reports a template with no steps and a step with an unknown template', async () => {
    const f = good()
    f['Maintenance Steps'] = [['Light quartely', 1, 'Clean']] // typo
    const e = errors(await run(f)).join('|')
    expect(e).toMatch(/Template "Light quartely" is not on the Maintenance Templates tab/)
    expect(e).toMatch(/Template "Light quarterly" has no steps/)
  })

  it('reports the same step number twice in a template', async () => {
    const f = good()
    f['Maintenance Steps'] = [['Light quarterly', 1, 'A'], ['Light quarterly', 1, 'B']]
    expect(errors(await run(f)).join('|')).toMatch(/Step no 1 is used twice/)
  })

  it('refuses bad numbers, dates and choices with the row and column named', async () => {
    const f = good()
    f.Rooms = [['Lab 1', 'Main Campus / Block A', 'Laboratory', '1', 'big', 'Maybe']]
    f.Vendors = [['Cool Air Services', '', '', '', '', '', 'Yes', '', 'soon', utcDate(2026, 12, 31)]]
    f['Maintenance Templates'] = [['Light quarterly', 'Fortnightly', '']]
    const r = await run(f)
    const e = errors(r).join('|')
    expect(e).toMatch(/Size \(sq ft\): "big" is not a valid number/)
    expect(e).toMatch(/Can be reserved \(Yes\/No\): "Maybe" must be Yes or No/)
    expect(e).toMatch(/AMC start date: "soon" is not a date/)
    expect(e).toMatch(/Frequency: "Fortnightly" is not one of/)
    expect(r.issues.every(i => i.row >= 2)).toBe(true)
  })

  it('warns, but does not stop, for a room type outside the usual list', async () => {
    const f = good()
    f.Rooms = [['Lab 1', 'Main Campus / Block A', 'Boat Deck']]
    const r = await run(f)
    expect(errors(r)).toEqual([])
    expect(r.issues.some(i => i.severity === 'warning' && /Boat Deck/.test(i.message))).toBe(true)
  })

  it('rejects a custom field on an unknown sub-category or added twice', async () => {
    const f = good()
    f['Custom Fields'] = [['Electrical / Fan', 'Speed', 'Number'], ['Electrical / Light', 'Wattage', 'Number'], ['Electrical / Light', 'wattage', 'Number']]
    const e = errors(await run(f)).join('|')
    expect(e).toMatch(/Sub-category "Electrical \/ Fan" is not on the Sub-Categories tab/)
    expect(e).toMatch(/The field "wattage" is added twice/)
  })

  it('stops when a heading was renamed, or a tab deleted', async () => {
    const renamed = await run(good(), wb => { wb.getWorksheet('Campuses')!.getCell('A1').value = 'Site' })
    expect(errors(renamed).join('|')).toMatch(/Column 1 should be "Campus name \*" but is "Site"/)
    const deleted = await run(good(), wb => { wb.removeWorksheet(wb.getWorksheet('Vendors')!.id) })
    expect(errors(deleted).join('|')).toMatch(/The tab "Vendors" is missing/)
  })

  it('says so when there is nothing in the workbook', async () => {
    expect(errors(await run({})).join('|')).toMatch(/no data rows/)
  })
})

describe('buildMasters', () => {
  it('creates rows with the app\'s own codes, numbers and links', async () => {
    const { data } = await run(good())
    const { rows, conflicts } = buildMasters(data, emptyMastersSnapshot(), counterIds(), new Date('2026-09-25T10:00:00Z'))
    expect(conflicts).toEqual([])
    expect(planCounts({ rows, conflicts })).toEqual({
      campuses: 1, buildings: 1, rooms: 2, vendors: 1, categories: 2, checklist_templates: 2, sub_categories: 2,
    })
    expect(rows.campuses[0]).toMatchObject({ name: 'Main Campus', code: 'CAM-0001', address: '1 Marine Road' })
    expect(rows.buildings[0]).toMatchObject({ code: 'BLD-0001', campus_id: rows.campuses[0].id, total_floors: 3 })
    expect(rows.rooms.map(r => r.room_number)).toEqual(['ROM-0001', 'ROM-0002'])
    expect(rows.rooms[0]).toMatchObject({ qr_code_key: 'ROM-0001', type: 'Laboratory', room_size_sqft: 450, is_reservable: true, status: 'Available' })
    expect(rows.rooms[1]).toMatchObject({ type: 'General', floor: null, room_size_sqft: null })
    expect(rows.vendors[0]).toMatchObject({ code: 'VND-0001', has_amc: true, amc_start_date: '2026-01-01', amc_end_date: '2026-12-31' })
    // "Electrical" and "Electronics" both start ELEC: the second one gets a suffix, as in the app.
    expect(rows.categories.map(c => c.code)).toEqual(['ELEC', 'ELEC-2'])
    expect(rows.sub_categories.map(s => s.code)).toEqual(['ELEC-LIGH', 'ELEC-LAMP'])
  })

  it('makes template steps: tick-boxes for maintenance, Pass/Fail for inspections, in step order', async () => {
    const { data } = await run(good())
    const { rows } = buildMasters(data, emptyMastersSnapshot(), counterIds())
    const pm = rows.checklist_templates.find(t => t.type === 'Preventive Maintenance')!
    const insp = rows.checklist_templates.find(t => t.type === 'Inspection')!
    expect(pm.interval).toBe('Quarterly')
    expect(pm.items).toEqual([
      { id: 'ci-1', order: 1, itemText: 'Check switch', instructions: 'Isolate power first', responseType: 'Checkbox', mandatory: true, photoRequired: true },
      { id: 'ci-2', order: 2, itemText: 'Clean fixture', responseType: 'Checkbox', mandatory: true, photoRequired: false },
    ])
    expect((insp.items as { responseType: string }[])[0].responseType).toBe('Pass-Fail')
    const light = rows.sub_categories[0]
    expect(light.pm_template_ids).toEqual([pm.id])
    expect(light.inspection_template_ids).toEqual([insp.id])
    expect(light.sla_priority).toBe('Medium')
    expect(light.metadata_fields).toEqual([{ key: 'field_wattage', label: 'Wattage', type: 'Number', unit: 'W', required: true, order: 1 }])
  })

  it('continues numbering after what is already in the database and reports names that exist', async () => {
    const { data } = await run(good())
    const snapshot = emptyMastersSnapshot()
    snapshot.campuses = [{ id: 'c0', name: 'Old Campus', code: 'CAM-0007' }]
    snapshot.vendors = [{ name: 'COOL AIR SERVICES', code: 'VND-0004' }]
    snapshot.categories = [{ id: 'k0', name: 'electrical', code: 'ELEC' }]
    const { rows, conflicts } = buildMasters(data, snapshot, counterIds())
    expect(rows.campuses[0].code).toBe('CAM-0008')
    expect(conflicts.map(c => c.message).join('|')).toMatch(/Vendor "Cool Air Services" already exists/)
    expect(conflicts.map(c => c.message).join('|')).toMatch(/Category "Electrical" already exists/)
    expect(rows.vendors).toHaveLength(0)
    // The other category still gets a code that does not clash with the existing ELEC.
    expect(rows.categories.map(c => c.code)).toEqual(['ELEC-2'])
  })
})
