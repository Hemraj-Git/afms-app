// @vitest-environment node
import ExcelJS from 'exceljs'
import { HyperFormula, type RawCellContent } from 'hyperformula'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { generateAssetsWorkbook } from './generateAssets'
import { generateMastersWorkbook } from './generateMasters'
import { colLetter } from './sheetBuilder'
import { ASSET_FIXED_COLUMNS, MASTER_SPECS } from './spec'
import { utcDate } from './testHelpers'

// Generating and reading a whole workbook is slow when the full suite runs many files at once.
vi.setConfig({ testTimeout: 60_000 })

// The Row check column and the Read Me counters are formulas the client's Excel will
// calculate. Nobody can open Excel from here, so these tests recalculate the REAL
// generated workbooks with a spreadsheet engine and type data into them, cell by cell,
// the way a person would. (Dev-only engine; it is not part of the app.)

type Grid = RawCellContent[][]
type Book = Record<string, Grid>

const serial = (d: Date) => d.getTime() / 86_400_000 + 25_569

async function toBook(bytes: Uint8Array): Promise<Book> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer)
  const book: Book = {}
  wb.eachSheet(ws => {
    const grid: Grid = []
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const v = cell.value as unknown
        let out: RawCellContent = null
        if (v instanceof Date) out = serial(v)
        else if (v && typeof v === 'object' && 'formula' in v) out = `=${(v as { formula: string }).formula}`
        else if (v && typeof v === 'object' && 'text' in v) out = String((v as { text: string }).text)
        else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out = v
        if (out === null) return
        ;(grid[r - 1] ??= [])[c - 1] = out
      })
    })
    book[ws.name] = Array.from(grid, line => (line ? Array.from(line, x => x ?? null) : []))
  })
  return book
}

const put = (book: Book, sheet: string, row: number, values: unknown[]) => {
  const line = ((book[sheet][row - 1] ??= []) as RawCellContent[])
  values.forEach((v, c) => {
    if (v === '' || v === undefined || v === null) return
    line[c] = v instanceof Date ? serial(v) : (v as RawCellContent)
  })
}

const engine = (book: Book) =>
  HyperFormula.buildFromSheets(book as Record<string, RawCellContent[][]>, { licenseKey: 'gpl-v3', useArrayArithmetic: true })

const read = (hf: HyperFormula, sheet: string, cell: string) => {
  const m = /^([A-Z]+)(\d+)$/.exec(cell)!
  const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  return hf.getCellValue({ sheet: hf.getSheetId(sheet)!, row: Number(m[2]) - 1, col })
}

// The text in the Read Me row that starts with `label`, and the number beside it.
const readMeTotal = (hf: HyperFormula, book: Book, label: string, col: number) => {
  const grid = book['Read Me']
  const r = grid.findIndex(line => line?.[1] === label)
  return hf.getCellValue({ sheet: hf.getSheetId('Read Me')!, row: r, col })
}

describe('Masters: Row check and counters, recalculated', () => {
  let base: Book
  beforeAll(async () => { base = await toBook(await generateMastersWorkbook({ maxRows: 30 })) }, 60_000)
  const fresh = (): Book => structuredClone(base)

  const S = MASTER_SPECS
  const checkOf = (sheet: keyof typeof S, row: number, hf: HyperFormula) =>
    read(hf, S[sheet].name, `${colLetter(S[sheet].columns.length + 1)}${row}`)

  it('is empty for an empty row and OK for a complete one', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus', '1 Marine Road'])
    const hf = engine(b)
    expect(checkOf('campuses', 2, hf)).toBe('OK')
    expect(checkOf('campuses', 3, hf)).toBe('')
  })

  it('says what is missing, naming the column', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Buildings', 2, ['', 'Main Campus', 3])
    put(b, 'Buildings', 3, ['Block A', '', 3])
    const hf = engine(b)
    expect(checkOf('buildings', 2, hf)).toBe('Building name is required')
    expect(checkOf('buildings', 3, hf)).toBe('Campus is required')
  })

  it('checks a dropdown value against the list the person can actually pick from', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Buildings', 2, ['Block A', 'Main Campus', 3]) // fine
    put(b, 'Buildings', 3, ['Block B', 'Main Campuss', 2]) // typo in the campus
    put(b, 'Rooms', 2, ['Lab 1', 'Main Campus / Block A']) // "Campus / Building" comes from the Buildings tab
    put(b, 'Rooms', 3, ['Lab 2', 'Block A']) // not the full label
    const hf = engine(b)
    expect(checkOf('buildings', 2, hf)).toBe('OK')
    expect(checkOf('buildings', 3, hf)).toBe('Pick Campus from the list')
    expect(checkOf('rooms', 2, hf)).toBe('OK')
    expect(checkOf('rooms', 3, hf)).toBe('Pick Building from the list')
    // The hidden Lists tab is what the dropdowns read.
    expect(read(hf, 'Lists', 'A2')).toBe('Main Campus')
    expect(read(hf, 'Lists', 'B2')).toBe('Main Campus / Block A')
    expect(read(hf, 'Lists', 'C2')).toBe('Main Campus / Block A / Lab 1')
  })

  it('flags the same row typed twice, on both rows, ignoring case', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Campuses', 3, ['main campus'])
    put(b, 'Campuses', 4, ['Other Campus'])
    const hf = engine(b)
    expect(checkOf('campuses', 2, hf)).toBe('This row appears twice')
    expect(checkOf('campuses', 3, hf)).toBe('This row appears twice')
    expect(checkOf('campuses', 4, hf)).toBe('OK')
  })

  it('catches numbers, Yes/No and choices typed wrongly', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Buildings', 2, ['Block A', 'Main Campus', 3])
    put(b, 'Rooms', 2, ['Lab 1', 'Main Campus / Block A', 'Laboratory', '1', 'big', 'Yes'])
    put(b, 'Rooms', 3, ['Lab 2', 'Main Campus / Block A', 'Laboratory', '1', 450, 'Maybe'])
    put(b, 'Maintenance Templates', 2, ['Quarterly service', 'Fortnightly'])
    const hf = engine(b)
    expect(checkOf('rooms', 2, hf)).toBe('Size (sq ft) must be a number')
    expect(checkOf('rooms', 3, hf)).toBe('Can be reserved (Yes/No) must be Yes or No')
    expect(checkOf('pmTemplates', 2, hf)).toBe('Pick Frequency from the list')
  })

  it('accepts a room type outside the usual list (only the dropdown warns)', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Buildings', 2, ['Block A', 'Main Campus', 3])
    put(b, 'Rooms', 2, ['Deck', 'Main Campus / Block A', 'Boat Deck'])
    expect(checkOf('rooms', 2, engine(b))).toBe('OK')
  })

  it('links steps and sub-categories to the templates and categories actually entered', () => {
    const b = fresh()
    put(b, 'Categories', 2, ['Electrical'])
    put(b, 'Maintenance Templates', 2, ['Light quarterly', 'Quarterly'])
    put(b, 'Maintenance Steps', 2, ['Light quarterly', 1, 'Clean'])
    put(b, 'Maintenance Steps', 3, ['Light quartely', 2, 'Test'])
    put(b, 'Sub-Categories', 2, ['Light', 'Electrical', '', 'Light quarterly'])
    put(b, 'Sub-Categories', 3, ['Fan', 'Electrical', '', 'No such template'])
    put(b, 'Custom Fields', 2, ['Electrical / Light', 'Wattage', 'Number', 'W', 'Yes', 1])
    const hf = engine(b)
    expect(checkOf('pmSteps', 2, hf)).toBe('OK')
    expect(checkOf('pmSteps', 3, hf)).toBe('Pick Template title from the list')
    expect(checkOf('subCategories', 2, hf)).toBe('OK')
    expect(checkOf('subCategories', 3, hf)).toBe('Pick Maintenance template 1 from the list')
    expect(checkOf('customFields', 2, hf)).toBe('OK')
  })

  it('counts the rows that still need attention on the Read Me', () => {
    const b = fresh()
    put(b, 'Campuses', 2, ['Main Campus'])
    put(b, 'Campuses', 3, ['Main Campus']) // duplicate: 2 rows to fix
    put(b, 'Buildings', 2, ['Block A', 'Nowhere', 3]) // 1 row to fix
    put(b, 'Categories', 2, ['Electrical']) // fine
    const hf = engine(b)
    expect(readMeTotal(hf, b, 'Rows still needing attention', 3)).toBe(3)
    // A fully correct workbook reads 0.
    const ok = fresh()
    put(ok, 'Campuses', 2, ['Main Campus'])
    put(ok, 'Categories', 2, ['Electrical'])
    expect(readMeTotal(engine(ok), ok, 'Rows still needing attention', 3)).toBe(0)
  })
})

describe('Assets: Row check and counters, recalculated', () => {
  let base: Book
  // Wattage belongs to Light only; Finish to both. So on the one Electrical tab,
  // which columns a row must fill depends on the sub-category it names.
  const fields = [
    { key: 'field_wattage', label: 'Wattage', type: 'Number' as const, unit: 'W', required: true, order: 1 },
    { key: 'field_installed_on', label: 'Installed on', type: 'Date' as const, required: false, order: 2 },
  ]
  const fanFields = [{ key: 'field_installed_on', label: 'Installed on', type: 'Date' as const, required: true, order: 1 }]
  beforeAll(async () => {
    base = await toBook(await generateAssetsWorkbook({
      subCategories: [
        { id: 's1', code: 'ELEC-LIGH', name: 'Light', categoryName: 'Electrical', fields },
        { id: 's2', code: 'ELEC-FAN', name: 'Ceiling Fan', categoryName: 'Electrical', fields: fanFields },
      ],
      rooms: ['Main Campus / Block A / Lab 1'],
      vendors: ['Cool Air Services'],
      rowsPerTab: 30,
    }))
  }, 60_000)
  const fresh = (): Book => structuredClone(base)
  const WATTAGE = 1 + ASSET_FIXED_COLUMNS.length
  const checkCol = colLetter(WATTAGE + fields.length + 1)
  const row = (over: Record<number, unknown> = {}) => {
    const r: unknown[] = [
      'Light', 'Tube light 1', 'Main Campus / Block A / Lab 1', 'High', 'Philips', 'TL-1', 'SN-1', 1200,
      utcDate(2024, 1, 10), utcDate(2024, 1, 20), utcDate(2027, 1, 20), utcDate(2026, 6, 15),
      'Operational', 'Vendor', 'Cool Air Services', '', '', '', 'note', 36,
    ]
    Object.entries(over).forEach(([i, v]) => { r[Number(i)] = v })
    return r
  }

  it('is OK for a complete asset and empty for an empty row', () => {
    const b = fresh()
    put(b, 'Electrical', 2, row())
    const hf = engine(b)
    expect(read(hf, 'Electrical', `${checkCol}2`)).toBe('OK')
    expect(read(hf, 'Electrical', `${checkCol}3`)).toBe('')
  })

  it('says what is wrong with an asset row', () => {
    const b = fresh()
    put(b, 'Electrical', 2, row({ 3: '' })) // no SLA priority
    put(b, 'Electrical', 3, row({ 2: 'Lab 1' })) // room not in the list
    put(b, 'Electrical', 4, row({ 7: 'lots' })) // cost is text
    put(b, 'Electrical', 5, row({ 11: 'June' })) // last serviced is text, not a date
    put(b, 'Electrical', 6, row({ 12: 'Broken' })) // not a status
    put(b, 'Electrical', 7, row({ 14: 'Cool Air' })) // vendor not in the list
    put(b, 'Electrical', 8, row({ 0: '' })) // no sub-category
    put(b, 'Electrical', 9, row({ 0: 'Split AC' })) // a sub-category of another category
    const hf = engine(b)
    const msg = (r: number) => read(hf, 'Electrical', `${checkCol}${r}`)
    expect(msg(2)).toBe('SLA priority is required')
    expect(msg(3)).toBe('Pick Room / area from the list')
    expect(msg(4)).toBe('Cost (INR) must be a number')
    expect(msg(5)).toBe('Last serviced date must be a date')
    expect(msg(6)).toBe('Pick Status from the list')
    expect(msg(7)).toBe('Pick Maintenance vendor from the list')
    expect(msg(8)).toBe('Sub-category is required')
    expect(msg(9)).toBe('Pick Sub-category from the list')
  })

  // The heart of the by-category format: the same column is required on one
  // row, and not allowed on the next, depending on the sub-category chosen.
  it('judges the extra detail columns by the sub-category on the row', () => {
    const b = fresh()
    put(b, 'Electrical', 2, row({ [WATTAGE]: '' })) // Light needs Wattage
    put(b, 'Electrical', 3, row({ 0: 'Ceiling Fan', [WATTAGE + 1]: utcDate(2024, 2, 1) })) // fan: no Wattage, needs Installed on
    put(b, 'Electrical', 4, row({ 0: 'Ceiling Fan', [WATTAGE + 1]: utcDate(2024, 2, 1) })) // same, but Wattage filled below
    put(b, 'Electrical', 5, row({ 0: 'Ceiling Fan', [WATTAGE]: '', [WATTAGE + 1]: '' })) // fan missing Installed on
    const hf = engine(b)
    const msg = (r: number) => read(hf, 'Electrical', `${checkCol}${r}`)
    expect(msg(2)).toBe('Wattage (W) is required for this sub-category')
    expect(msg(3)).toBe('Wattage (W) does not apply to this sub-category')
    expect(msg(4)).toBe('Wattage (W) does not apply to this sub-category')
    expect(msg(5)).toBe('Installed on is required for this sub-category')
  })

  it('totals the problems across every tab on the Read Me', () => {
    const b = fresh()
    put(b, 'Electrical', 2, row())
    put(b, 'Electrical', 3, row({ 3: '' }))
    put(b, 'Electrical', 4, row({ 2: 'Nowhere' }))
    const hf = engine(b)
    expect(readMeTotal(hf, b, 'Rows still needing attention', 4)).toBe(2)
  })
})
