import ExcelJS from 'exceljs'
import { addDataSheet, addListsSheet, COLORS, LIST_ORDER } from './sheetBuilder'
import {
  ASSET_FIXED_COLUMNS, customFieldHeader, META_SHEET, type ColumnSpec, type ListName,
} from './spec'
import type { FieldDef } from './validateMasters'

// Workbook 2 of 2: the equipment list. Generated from the master data already in the
// app, so every dropdown holds real values and each sub-category gets its own tab
// whose columns include that sub-category's custom fields.

export interface AssetsTemplateContext {
  subCategories: { id: string; code: string; name: string; categoryName: string; fields: FieldDef[] }[]
  rooms: string[] // "Campus / Building / Room"
  vendors: string[]
  rowsPerTab?: number
}

export const DEFAULT_ROWS_PER_TAB = 1000

// One tab per sub-category: Excel allows 31 characters and none of  [ ] : * ? / \
export function tabNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map(n => {
    const base = n.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet'
    let name = base
    let i = 2
    while (used.has(name.toLowerCase()) || ['read me', 'lists', META_SHEET.toLowerCase()].includes(name.toLowerCase())) {
      const suffix = ` (${i++})`
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(name.toLowerCase())
    return name
  })
}

// The columns of one asset tab: the fixed ones, then the sub-category's custom fields.
export function assetColumns(fields: FieldDef[]): ColumnSpec[] {
  return [
    ...ASSET_FIXED_COLUMNS,
    ...fields.map<ColumnSpec>(f => ({
      key: `cf:${f.key}`,
      header: customFieldHeader(f),
      required: f.required,
      kind: f.type === 'Number' ? 'number' : f.type === 'Date' ? 'date' : 'text',
      width: 22,
    })),
  ]
}

// Which tab is which sub-category, and what each column is. The loader trusts this, not
// the tab's name, so a renamed tab is noticed rather than loaded into the wrong place.
export function writeAssetsMeta(
  meta: ExcelJS.Worksheet,
  tabs: { name: string; subCategoryId: string; subCategoryCode: string; columns: ColumnSpec[] }[]
): void {
  meta.getCell('A1').value = 'kind'
  meta.getCell('B1').value = 'assets'
  meta.getCell('A2').value = 'generatedAt'
  meta.getCell('B2').value = new Date().toISOString()
  meta.getCell('A4').value = 'sheet'
  meta.getCell('B4').value = 'subCategoryId'
  meta.getCell('C4').value = 'subCategoryCode'
  meta.getCell('D4').value = 'columns'
  tabs.forEach((t, i) => {
    meta.getCell(5 + i, 1).value = t.name
    meta.getCell(5 + i, 2).value = t.subCategoryId
    meta.getCell(5 + i, 3).value = t.subCategoryCode
    meta.getCell(5 + i, 4).value = JSON.stringify(t.columns.map(c => ({ key: c.key, header: c.header })))
  })
}

const q = (name: string) => `'${name.replace(/'/g, "''")}'`

export async function generateAssetsWorkbook(ctx: AssetsTemplateContext): Promise<Uint8Array> {
  if (ctx.subCategories.length === 0) {
    throw new Error('There are no sub-categories in the app yet. Load the Masters workbook first.')
  }
  const rowsPerTab = ctx.rowsPerTab ?? DEFAULT_ROWS_PER_TAB
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AFMS'
  wb.created = new Date()

  const names = tabNames(ctx.subCategories.map(s => s.name))
  const readMe = wb.addWorksheet('Read Me', { properties: { tabColor: { argb: 'FF0F2129' } }, views: [{ showGridLines: false }] })

  const listRows = Object.fromEntries(LIST_ORDER.map(l => [l, 1])) as Record<ListName, number>
  listRows.rooms = Math.max(ctx.rooms.length, 1)
  listRows.vendors = Math.max(ctx.vendors.length, 1)

  const tabs: { name: string; sub: AssetsTemplateContext['subCategories'][number]; checkCol: string; columns: ColumnSpec[] }[] = []
  ctx.subCategories.forEach((sub, i) => {
    const columns = assetColumns(sub.fields)
    const { checkCol } = addDataSheet(wb, {
      name: names[i], columns, keyColumns: [], maxRows: rowsPerTab, listRows,
      intro: `Equipment of type "${sub.categoryName} / ${sub.name}". One row per asset.`,
      tabColor: 'FF2563EB',
    })
    tabs.push({ name: names[i], sub, checkCol, columns })
  })

  addListsSheet(wb, {
    rooms: { header: 'Rooms (Campus / Building / Room)', values: ctx.rooms, rows: ctx.rooms.length },
    vendors: { header: 'Vendors', values: ctx.vendors, rows: ctx.vendors.length },
  })

  writeAssetsMeta(
    wb.addWorksheet(META_SHEET, { state: 'veryHidden' }),
    tabs.map(t => ({ name: t.name, subCategoryId: t.sub.id, subCategoryCode: t.sub.code, columns: t.columns }))
  )

  // ---- Read Me ----
  readMe.getColumn(1).width = 3
  readMe.getColumn(2).width = 34
  readMe.getColumn(3).width = 30
  readMe.getColumn(4).width = 14
  readMe.getColumn(5).width = 14
  let r = 2
  const put = (text: string, style: Partial<ExcelJS.Font> = {}, height?: number) => {
    readMe.mergeCells(r, 2, r, 5)
    const c = readMe.getCell(r, 2)
    c.value = text
    c.font = { size: 11, ...style }
    c.alignment = { wrapText: true, vertical: 'top' }
    readMe.getRow(r).height = height ?? Math.max(18, Math.ceil(text.length / 95) * 16)
    r += 1
  }
  put('AFMS - Equipment (Assets) Workbook', { bold: true, size: 20, color: { argb: COLORS.ink } }, 32)
  put('Step 2 of 2. There is one tab per type of equipment (sub-category). Each tab already has the extra details (custom fields) that type needs. Fill one row per asset, on the tab for its type.')
  r += 1
  put('How to fill it in', { bold: true, size: 13, color: { argb: 'FF0F766E' } })
  ;[
    '1. Go to the tab for the type of equipment and add one row per asset, starting on row 2. Leave no blank rows in the middle. Do not add, rename, move or delete columns or tabs.',
    '2. Headings ending in * (dark green) must be filled. Grey headings are optional.',
    '3. Use the dropdowns for Room, SLA priority, Status, Maintained by and Vendors. A room or vendor that is missing must be added to the system first; tell us.',
    '4. SLA priority is how quickly a fault on this asset must be dealt with: Critical, High, Medium or Low.',
    '5. Last serviced date: the date the equipment was last serviced. The first maintenance and inspection are then due one interval after it (for example a quarterly service is due 3 months later). Leave it blank if unknown; they are then counted from the day we load the data.',
    '6. Dates: type them as 25-09-2026 (a real Excel date). Cost: just the number, in rupees.',
    '7. Copying from another file? Use Paste Special > Values, otherwise the dropdowns are overwritten.',
    '8. Do not type asset numbers or tags. The system gives every asset its own number.',
    '9. The last column of every tab is "Row check". It must say OK (green) on every row before you send the file.',
    '10. Photos and documents cannot go in this file. Send them separately, in a folder named after the asset.',
  ].forEach(t => put(t))
  r += 1
  put('Progress', { bold: true, size: 13, color: { argb: 'FF0F766E' } })
  ;['Tab', 'Type of equipment', 'Assets', 'To fix'].forEach((t, i) => {
    const c = readMe.getCell(r, 2 + i)
    c.value = t
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.checkHeader } }
  })
  r += 1
  const firstRow = r
  for (const t of tabs) {
    const chk = `${q(t.name)}!$${t.checkCol}$2:$${t.checkCol}$${rowsPerTab + 1}`
    const link = readMe.getCell(r, 2)
    link.value = { text: t.name, hyperlink: `#${q(t.name)}!A1` } as ExcelJS.CellHyperlinkValue
    link.font = { color: { argb: 'FF1D4ED8' }, underline: true }
    readMe.getCell(r, 3).value = `${t.sub.categoryName} / ${t.sub.name}`
    readMe.getCell(r, 4).value = { formula: `SUMPRODUCT(--(${chk}<>""))` } as ExcelJS.CellFormulaValue
    readMe.getCell(r, 5).value = { formula: `SUMPRODUCT((${chk}<>"")*(${chk}<>"OK"))` } as ExcelJS.CellFormulaValue
    r += 1
  }
  readMe.getCell(r, 2).value = 'Rows still needing attention'
  readMe.getCell(r, 2).font = { bold: true }
  const total = readMe.getCell(r, 5)
  total.value = { formula: `SUM(E${firstRow}:E${r - 1})` } as ExcelJS.CellFormulaValue
  total.font = { bold: true, size: 13 }
  readMe.addConditionalFormatting({
    ref: `E${firstRow}:E${r}`,
    rules: [
      { type: 'expression', priority: 1, formulae: [`E${firstRow}>0`], style: { font: { color: { argb: COLORS.badFont }, bold: true } } },
      { type: 'expression', priority: 2, formulae: [`E${firstRow}=0`], style: { font: { color: { argb: COLORS.okFont }, bold: true } } },
    ],
  })
  r += 1
  put('Send the file back when "Rows still needing attention" is 0.', { bold: true })

  const buffer = await wb.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}
