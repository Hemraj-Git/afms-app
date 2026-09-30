import ExcelJS from 'exceljs'
import { addDataSheet, addListsSheet, colLetter, COLORS, LIST_ORDER } from './sheetBuilder'
import {
  ASSET_FIXED_COLUMNS, customFieldHeader, FIELDS_SHEET, META_SHEET, type ColumnSpec, type ListName,
} from './spec'
import type { FieldDef } from './validateMasters'

// Workbook 2 of 2: the equipment list. One tab per category. On each row the
// person picks the sub-category first, then fills in the asset.
//
// Why by category rather than one tab per sub-category: 74 tabs is a lot to
// move around in. The cost is that a category's custom fields differ between
// its sub-categories, so a tab carries all of them and each row uses only the
// ones its sub-category defines. The Row check says which are required for the
// sub-category chosen, and which do not belong to it at all.

export interface AssetsTemplateContext {
  subCategories: { id: string; code: string; name: string; categoryName: string; fields: FieldDef[] }[]
  rooms: string[] // "Campus / Building / Room"
  vendors: string[]
  rowsPerTab?: number
}

export const DEFAULT_ROWS_PER_TAB = 1000

// Excel allows 31 characters and none of  [ ] : * ? / \
export function tabNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map(n => {
    const base = n.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet'
    let name = base
    let i = 2
    while (used.has(name.toLowerCase()) || ['read me', 'lists', META_SHEET.toLowerCase(), FIELDS_SHEET.toLowerCase()].includes(name.toLowerCase())) {
      const suffix = ` (${i++})`
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    used.add(name.toLowerCase())
    return name
  })
}

export interface SubCategoryInfo {
  id: string
  code: string
  name: string
  categoryName: string
  fields: FieldDef[]
}

export interface CategoryGroup {
  name: string
  subCategories: SubCategoryInfo[]
  // Every custom field used anywhere in the category, in the order it first appears.
  fields: FieldDef[]
}

export function groupByCategory(subCategories: SubCategoryInfo[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>()
  for (const sub of subCategories) {
    let g = groups.get(sub.categoryName)
    if (!g) {
      g = { name: sub.categoryName, subCategories: [], fields: [] }
      groups.set(sub.categoryName, g)
    }
    g.subCategories.push(sub)
    for (const f of sub.fields) if (!g.fields.some(x => x.key === f.key)) g.fields.push(f)
  }
  return [...groups.values()]
}

// The same field can carry a different unit in two sub-categories ("Dimensions"
// in ft/inches and in mm). One column cannot claim both, so the unit is shown
// only when every sub-category that has the field agrees on it. Never " *":
// whether it is required depends on the row's sub-category, not the column.
export function unionFieldHeader(group: CategoryGroup, field: FieldDef): string {
  const units = new Set(
    group.subCategories.flatMap(s => s.fields.filter(f => f.key === field.key).map(f => f.unit ?? ''))
  )
  const unit = units.size === 1 ? [...units][0] : ''
  return customFieldHeader({ label: field.label, unit: unit || undefined, required: false })
}

export interface CategoryRefs {
  subCategoryList: { range: string; dropdown: string }
  // Per custom field key: where its sub-category names are listed.
  fieldRanges: Map<string, { appliesRange: string; requiredRange: string }>
}

// The columns of one category tab: the sub-category, the fixed asset columns,
// then every custom field used in the category. `refs` is only needed when the
// workbook is being written; reading one back just needs the keys and headers.
export function categoryColumns(group: CategoryGroup, refs?: CategoryRefs): ColumnSpec[] {
  return [
    {
      key: 'subCategory',
      header: 'Sub-category *',
      required: true,
      kind: 'text',
      width: 34,
      listRange: refs?.subCategoryList,
    },
    ...ASSET_FIXED_COLUMNS,
    ...group.fields.map<ColumnSpec>(f => {
      const ranges = refs?.fieldRanges.get(f.key)
      return {
        key: `cf:${f.key}`,
        header: unionFieldHeader(group, f),
        kind: f.type === 'Number' ? 'number' : f.type === 'Date' ? 'date' : 'text',
        width: 22,
        conditional: ranges ? { onColumn: 0, ...ranges } : undefined,
      }
    }),
  ]
}

// Which tab is which category, and what each column is. The loader trusts this,
// not the tab's name, so a renamed tab is noticed rather than read as another.
export function writeAssetsMeta(
  meta: ExcelJS.Worksheet,
  tabs: { name: string; category: string; columns: ColumnSpec[] }[]
): void {
  meta.getCell('A1').value = 'kind'
  meta.getCell('B1').value = 'assets'
  meta.getCell('A2').value = 'generatedAt'
  meta.getCell('B2').value = new Date().toISOString()
  meta.getCell('A4').value = 'sheet'
  meta.getCell('B4').value = 'category'
  meta.getCell('C4').value = 'columns'
  tabs.forEach((t, i) => {
    meta.getCell(5 + i, 1).value = t.name
    meta.getCell(5 + i, 2).value = t.category
    meta.getCell(5 + i, 3).value = JSON.stringify(t.columns.map(c => ({ key: c.key, header: c.header })))
  })
}

const q = (name: string) => `'${name.replace(/'/g, "''")}'`

const colRange = (sheet: string, column: number, rows: number) => {
  const c = colLetter(column)
  return `${q(sheet)}!$${c}$2:$${c}$${Math.max(rows, 1) + 1}`
}

export async function generateAssetsWorkbook(ctx: AssetsTemplateContext): Promise<Uint8Array> {
  if (ctx.subCategories.length === 0) {
    throw new Error('There are no sub-categories in the app yet. Load the Masters workbook first.')
  }
  const rowsPerTab = ctx.rowsPerTab ?? DEFAULT_ROWS_PER_TAB
  const groups = groupByCategory(ctx.subCategories)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'AFMS'
  wb.created = new Date()

  const names = tabNames(groups.map(g => g.name))
  const readMe = wb.addWorksheet('Read Me', { properties: { tabColor: { argb: 'FF0F2129' } }, views: [{ showGridLines: false }] })

  const listRows = Object.fromEntries(LIST_ORDER.map(l => [l, 1])) as Record<ListName, number>
  listRows.rooms = Math.max(ctx.rooms.length, 1)
  listRows.vendors = Math.max(ctx.vendors.length, 1)

  // Work out where every list lives before writing anything, so the formulas
  // and the sheets they read agree.
  // Lists tab: the named lists first, then one column of sub-categories per category.
  const subListColumn = (i: number) => LIST_ORDER.length + 1 + i
  // _Fields tab: two columns per custom field (applies / required).
  const fieldColumn = (groupIndex: number, fieldIndex: number) => {
    let n = 1
    for (let g = 0; g < groupIndex; g++) n += groups[g].fields.length * 2
    return n + fieldIndex * 2
  }

  const refsFor = (g: CategoryGroup, i: number): CategoryRefs => {
    const c = colLetter(subListColumn(i))
    const rows = Math.max(g.subCategories.length, 1)
    return {
      subCategoryList: {
        range: `Lists!$${c}$2:$${c}$${rows + 1}`,
        dropdown: `OFFSET(Lists!$${c}$2,0,0,MAX(1,COUNTIF(Lists!$${c}$2:$${c}$${rows + 1},"?*")),1)`,
      },
      fieldRanges: new Map(
        g.fields.map((f, fi) => [
          f.key,
          {
            appliesRange: colRange(FIELDS_SHEET, fieldColumn(i, fi), rows),
            requiredRange: colRange(FIELDS_SHEET, fieldColumn(i, fi) + 1, rows),
          },
        ])
      ),
    }
  }

  const tabs = groups.map((g, i) => {
    const columns = categoryColumns(g, refsFor(g, i))
    const { checkCol } = addDataSheet(wb, {
      name: names[i], columns, keyColumns: [], maxRows: rowsPerTab, listRows,
      intro: `Equipment in "${g.name}". One row per asset; choose its sub-category in the first column.`,
      tabColor: 'FF2563EB',
    })
    return { name: names[i], group: g, checkCol, columns }
  })

  // ---- Lists: rooms and vendors, then each category's sub-categories ----
  const lists = addListsSheet(wb, {
    rooms: { header: 'Rooms (Campus / Building / Room)', values: ctx.rooms, rows: ctx.rooms.length },
    vendors: { header: 'Vendors', values: ctx.vendors, rows: ctx.vendors.length },
  })
  groups.forEach((g, i) => {
    const colNo = subListColumn(i)
    lists.getColumn(colNo).width = 34
    const head = lists.getCell(1, colNo)
    head.value = `${g.name} sub-categories`
    head.font = { bold: true }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lookup } }
    g.subCategories.forEach((s, k) => { lists.getCell(k + 2, colNo).value = s.name })
  })

  // ---- Which fields belong to which sub-category (read by the Row check) ----
  const fieldsWs = wb.addWorksheet(FIELDS_SHEET, { state: 'veryHidden' })
  groups.forEach((g, i) => {
    g.fields.forEach((f, fi) => {
      const applies = fieldColumn(i, fi)
      fieldsWs.getCell(1, applies).value = `${g.name} | ${f.label} | applies to`
      fieldsWs.getCell(1, applies + 1).value = `${g.name} | ${f.label} | required for`
      let a = 2
      let req = 2
      for (const sub of g.subCategories) {
        const own = sub.fields.find(x => x.key === f.key)
        if (!own) continue
        fieldsWs.getCell(a++, applies).value = sub.name
        if (own.required) fieldsWs.getCell(req++, applies + 1).value = sub.name
      }
    })
  })

  writeAssetsMeta(
    wb.addWorksheet(META_SHEET, { state: 'veryHidden' }),
    tabs.map(t => ({ name: t.name, category: t.group.name, columns: t.columns }))
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
  put('Step 2 of 2. There is one tab per category of equipment. On every row, choose the sub-category in the first column, then fill in that asset.')
  r += 1
  put('How to fill it in', { bold: true, size: 13, color: { argb: 'FF0F766E' } })
  ;[
    '1. Go to the tab for the category and add one row per asset, starting on row 2. Leave no blank rows in the middle. Do not add, rename, move or delete columns or tabs.',
    '2. Choose the Sub-category first: it decides which of the extra detail columns on the right apply to that row.',
    '3. Headings ending in * (dark green) must be filled on every row. Grey headings are optional, or depend on the sub-category.',
    '4. The extra detail columns after the standard ones are the custom fields of the whole category. Fill only the ones that belong to the sub-category you chose; the Row check names any that are required or that do not belong.',
    '5. Use the dropdowns for Sub-category, Room, SLA priority, Status, Maintained by and Vendors. A room or vendor that is missing must be added to the system first; tell us.',
    '6. SLA priority is how quickly a fault on this asset must be dealt with: Critical, High, Medium or Low.',
    '7. Last serviced date: the date the equipment was last serviced. The first maintenance and inspection are then due one interval after it (for example a quarterly service is due 3 months later). Leave it blank if unknown; they are then counted from the day we load the data.',
    '8. Dates: type them as 25-09-2026 (a real Excel date). Cost: just the number, in rupees.',
    '9. Copying from another file? Use Paste Special > Values, otherwise the dropdowns are overwritten.',
    '10. Do not type asset numbers or tags. The system gives every asset its own number.',
    '11. The last column of every tab is "Row check". It must say OK (green) on every row before you send the file.',
    '12. Photos and documents cannot go in this file. Send them separately, in a folder named after the asset.',
  ].forEach(t => put(t))
  r += 1
  put('Progress', { bold: true, size: 13, color: { argb: 'FF0F766E' } })
  ;['Tab', 'Category', 'Assets', 'To fix'].forEach((t, i) => {
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
    readMe.getCell(r, 3).value = `${t.group.name} (${t.group.subCategories.length} sub-categories)`
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
