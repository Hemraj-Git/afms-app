import ExcelJS from 'exceljs'
import {
  addDataSheet, addListsSheet, colLetter, COLORS, LIST_ORDER, type ListSource,
} from './sheetBuilder'
import { MASTER_ORDER, MASTER_SPECS, META_SHEET, type ListName } from './spec'

// Workbook 1 of 2: the master data the client fills in (locations, vendors, categories,
// sub-categories with their custom fields, and the two kinds of templates).

const key = (sheet: keyof typeof MASTER_SPECS, col: string): string => {
  const spec = MASTER_SPECS[sheet]
  return colLetter(spec.columns.findIndex(c => c.key === col) + 1)
}
const q = (name: string) => `'${name}'`

// How many input rows a tab has: the spec's, or fewer when a test asks for a smaller copy
// (same formulas, shorter ranges).
type Options = { maxRows?: number }
const rowsOf = (spec: { maxRows: number }, opts: Options) => Math.min(spec.maxRows, opts.maxRows ?? Infinity)

// Where each dropdown list comes from: a formula per row, reading the tab it lists.
function listSources(opts: Options): Partial<Record<ListName, ListSource>> {
  const S = MASTER_SPECS
  const one = (sheet: keyof typeof MASTER_SPECS, col: string, header: string): ListSource => ({
    header,
    rows: rowsOf(S[sheet], opts),
    formula: r => `IF(${q(S[sheet].name)}!${key(sheet, col)}${r}="","",${q(S[sheet].name)}!${key(sheet, col)}${r})`,
  })
  const labelled = (sheet: keyof typeof MASTER_SPECS, parent: string, child: string, header: string): ListSource => ({
    header,
    rows: rowsOf(S[sheet], opts),
    formula: r => {
      const n = q(S[sheet].name)
      return `IF(${n}!${key(sheet, child)}${r}="","",${n}!${key(sheet, parent)}${r}&" / "&${n}!${key(sheet, child)}${r})`
    },
  })
  return {
    campuses: one('campuses', 'name', 'Campuses'),
    buildings: labelled('buildings', 'campus', 'name', 'Buildings (Campus / Building)'),
    rooms: labelled('rooms', 'building', 'name', 'Rooms'),
    vendors: one('vendors', 'name', 'Vendors'),
    categories: one('categories', 'name', 'Categories'),
    subCategories: labelled('subCategories', 'category', 'name', 'Sub-categories (Category / Sub-category)'),
    pmTemplates: one('pmTemplates', 'title', 'Maintenance templates'),
    inspTemplates: one('inspTemplates', 'title', 'Inspection templates'),
  }
}

export const MASTERS_TAB_COLORS: Record<string, string> = {
  campuses: 'FF0F766E', buildings: 'FF0F766E', rooms: 'FF0F766E', vendors: 'FF7C3AED',
  categories: 'FF2563EB', subCategories: 'FF2563EB', customFields: 'FF2563EB',
  pmTemplates: 'FFB45309', pmSteps: 'FFB45309', inspTemplates: 'FFBE185D', inspSteps: 'FFBE185D',
}

const READ_ME = 'Read Me'

function addReadMe(wb: ExcelJS.Workbook, opts: Options): void {
  const ws = wb.addWorksheet(READ_ME, { properties: { tabColor: { argb: 'FF0F2129' } }, views: [{ showGridLines: false }] })
  ws.getColumn(1).width = 3
  ws.getColumn(2).width = 30
  ws.getColumn(3).width = 16
  ws.getColumn(4).width = 16
  ws.getColumn(5).width = 70

  let r = 2
  const title = (text: string) => {
    const c = ws.getCell(r, 2)
    c.value = text
    c.font = { bold: true, size: 20, color: { argb: COLORS.ink } }
    r += 1
  }
  const heading = (text: string) => {
    r += 1
    const c = ws.getCell(r, 2)
    c.value = text
    c.font = { bold: true, size: 13, color: { argb: 'FF0F766E' } }
    r += 1
  }
  const line = (text: string, opts: { bold?: boolean } = {}) => {
    ws.mergeCells(r, 2, r, 5)
    const c = ws.getCell(r, 2)
    c.value = text
    c.alignment = { wrapText: true, vertical: 'top' }
    c.font = { size: 11, bold: opts.bold }
    ws.getRow(r).height = Math.max(18, Math.ceil(text.length / 105) * 16)
    r += 1
  }

  title('AssetNXG - Master Data Workbook')
  line('Step 1 of 2. Fill in the tabs listed below, then send this file back. We load it into the system and then send you a second workbook (equipment list), already set up with your categories, rooms and custom fields.')

  heading('How to fill it in')
  ;[
    '1. Work through the tabs from left to right, in the order shown in the table below. Each tab uses the ones before it for its dropdown lists.',
    '2. One row is one item. Start on row 2. Leave no blank rows in the middle. Do not merge cells, and do not rename, move, add or delete columns or tabs.',
    '3. Column headings ending in * (dark green) must be filled. Grey headings are optional.',
    '4. Where a cell shows a dropdown arrow, choose from the list. If the value you need is not in the list, add it on its own tab first.',
    '5. Dates: type them as 25-09-2026 (a real Excel date). Numbers: type just the number (no "Rs", no "sq ft").',
    '6. Copying from another file? Use Paste Special > Values, otherwise the dropdowns are overwritten.',
    '7. Do not type any codes or IDs (room numbers, category codes...). The system creates them.',
    '8. The last column of every tab is "Row check". It must say OK (green) on every row before you send the file. Red tells you what to fix.',
  ].forEach(t => line(t))

  heading('Progress')

  ;['Tab', 'Rows filled', 'Rows to fix', 'What goes here'].forEach((t, i) => {
    const c = ws.getCell(r, 2 + i)
    c.value = t
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.checkHeader } }
  })
  r += 1
  const firstTab = r
  for (const k of MASTER_ORDER) {
    const spec = MASTER_SPECS[k]
    const checkCol = colLetter(spec.columns.length + 1)
    const chk = `${q(spec.name)}!$${checkCol}$2:$${checkCol}$${rowsOf(spec, opts) + 1}`
    const c = ws.getCell(r, 2)
    c.value = { text: spec.name, hyperlink: `#${q(spec.name)}!A1` } as ExcelJS.CellHyperlinkValue
    c.font = { color: { argb: 'FF1D4ED8' }, underline: true }
    ws.getCell(r, 3).value = { formula: `SUMPRODUCT(--(${chk}<>""))` } as ExcelJS.CellFormulaValue
    ws.getCell(r, 4).value = { formula: `SUMPRODUCT((${chk}<>"")*(${chk}<>"OK"))` } as ExcelJS.CellFormulaValue
    const w = ws.getCell(r, 5)
    w.value = spec.intro
    w.alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = Math.max(18, Math.ceil(spec.intro.length / 70) * 16)
    r += 1
  }
  const lastTab = r - 1
  ws.getCell(r, 2).value = 'Rows still needing attention'
  ws.getCell(r, 2).font = { bold: true }
  const total = ws.getCell(r, 4)
  total.value = { formula: `SUM(D${firstTab}:D${lastTab})` } as ExcelJS.CellFormulaValue
  total.font = { bold: true, size: 13 }
  ws.addConditionalFormatting({
    ref: `D${firstTab}:D${r}`,
    rules: [
      { type: 'expression', priority: 1, formulae: [`D${firstTab}>0`], style: { font: { color: { argb: COLORS.badFont }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`D${firstTab}=0`], style: { font: { color: { argb: COLORS.okFont }, bold: true } } },
    ],
  })
  r += 1
  line('Send the file back when "Rows still needing attention" is 0.', { bold: true })

  heading('A small example')
  ;[
    'Campuses: Main Campus.   Buildings: Block A (campus: Main Campus, 3 floors).   Rooms: Lab 1 (building: Main Campus / Block A, type: Laboratory, floor: 1).',
    'Categories: Air Conditioning.   Sub-Categories: Split AC (category: Air Conditioning, maintenance template 1: Split AC quarterly service).',
    'Custom Fields: Split AC / Capacity, type Number, unit TR, must be filled Yes.   (Every Split AC asset will then have a "Capacity (TR)" column to fill in the next workbook.)',
    'Maintenance Templates: Split AC quarterly service, frequency Quarterly.   Maintenance Steps: step 1 "Clean filters", step 2 "Check gas pressure", step 3 "Check drain line".',
    'Inspection Templates work the same way (their steps are Pass / Fail checks).',
  ].forEach(t => line(t))

  heading('Legend')
  const legend: [string, string][] = [
    [COLORS.requiredHeader, 'Required column'],
    [COLORS.optionalHeader, 'Optional column'],
    [COLORS.checkHeader, 'Row check (do not type here)'],
  ]
  for (const [color, text] of legend) {
    ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
    ws.getCell(r, 3).value = text
    r += 1
  }
}

export async function generateMastersWorkbook(opts: Options = {}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AssetNXG'
  wb.created = new Date()

  addReadMe(wb, opts)

  const listRows = Object.fromEntries(
    LIST_ORDER.map(l => [l, 0])
  ) as Record<ListName, number>
  const src = listSources(opts)
  for (const l of LIST_ORDER) listRows[l] = src[l]?.rows ?? 0

  for (const k of MASTER_ORDER) {
    const spec = MASTER_SPECS[k]
    addDataSheet(wb, {
      name: spec.name, columns: spec.columns, keyColumns: spec.keyColumns, maxRows: rowsOf(spec, opts),
      intro: spec.intro, tabColor: MASTERS_TAB_COLORS[k], listRows,
    })
  }
  addListsSheet(wb, src)

  const meta = wb.addWorksheet(META_SHEET, { state: 'veryHidden' })
  meta.getCell('A1').value = 'kind'
  meta.getCell('B1').value = 'masters'
  meta.getCell('A2').value = 'generatedAt'
  meta.getCell('B2').value = new Date().toISOString()

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}
