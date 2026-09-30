import ExcelJS from 'exceljs'
import { ROW_CHECK_HEADER, type ColumnSpec, type ListName } from './spec'

// The tabs of both workbooks are built the same way: a frozen header row, dropdowns
// and cell rules on every input column, and a "Row check" formula that tells the
// person, right on the row, what is missing or wrong.

export const COLORS = {
  ink: 'FF0F2129',
  requiredHeader: 'FF0F766E', // teal
  optionalHeader: 'FF475569', // slate
  checkHeader: 'FF1E293B',
  okFill: 'FFDCFCE7',
  okFont: 'FF166534',
  badFill: 'FFFEE2E2',
  badFont: 'FF991B1B',
  lookup: 'FFF1F5F9',
}

export function colLetter(n: number): string {
  let s = ''
  let x = n
  while (x > 0) {
    const r = (x - 1) % 26
    s = String.fromCharCode(65 + r) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

// Where each dropdown list lives on the Lists tab.
export const LIST_ORDER: ListName[] = [
  'campuses', 'buildings', 'rooms', 'vendors', 'categories', 'subCategories', 'pmTemplates', 'inspTemplates',
]
export const listColumn = (l: ListName) => colLetter(LIST_ORDER.indexOf(l) + 1)

// Formulas to read a list: `range` for MATCH, `dropdown` for a dropdown that
// grows as the list grows (no blank entries at the end).
export function listRefs(l: ListName, rows: number) {
  const c = listColumn(l)
  return {
    range: `Lists!$${c}$2:$${c}$${rows + 1}`,
    dropdown: `OFFSET(Lists!$${c}$2,0,0,MAX(1,COUNTIF(Lists!$${c}$2:$${c}$${rows + 1},"?*")),1)`,
  }
}

export interface DataSheetOptions {
  name: string
  columns: ColumnSpec[]
  keyColumns: string[]
  maxRows: number
  intro?: string
  tabColor?: string
  // Rows in each list, for the dropdown and MATCH ranges.
  listRows: Record<ListName, number>
  // Custom-field columns whose rules depend on the sub-category chosen on the
  // row (0-based columns). `table` is a block on the hidden fields tab: one row
  // per sub-category (names in `subs`), one column per custom field, "R" where
  // required, "Y" where allowed, "N" where it does not belong.
  fieldRules?: { subColumn: number; firstColumn: number; lastColumn: number; subs: string; table: string }
}

const label = (c: ColumnSpec) => c.header.replace(/ \*$/, '')

// Where a column's dropdown reads from: its own explicit range, or one of the
// named lists.
export function listFor(c: ColumnSpec, listRows: Record<ListName, number>) {
  if (c.listRange) return c.listRange
  return c.listRef ? listRefs(c.listRef, listRows[c.listRef]) : undefined
}

// The text of the Row check formula for one row.
export function rowCheckFormula(opts: DataSheetOptions, r: number): string {
  const { columns, keyColumns, maxRows } = opts
  const last = maxRows + 1
  const L = (i: number) => colLetter(i + 1)
  const cell = (i: number) => `${L(i)}${r}`
  const blank = (i: number) => `TRIM(${cell(i)}&"")=""`
  const filled = (i: number) => `TRIM(${cell(i)}&"")<>""`
  const rowRange = `${L(0)}${r}:${L(columns.length - 1)}${r}`

  // [condition, message text]
  const checks: [string, string][] = []
  // [condition, a formula that builds the message], checked after the ones above.
  const builtChecks: [string, string][] = []
  columns.forEach((c, i) => {
    if (c.required) checks.push([blank(i), `${label(c)} is required`])
  })
  columns.forEach((c, i) => {
    const list = listFor(c, opts.listRows)
    if (list) {
      checks.push([`AND(${filled(i)},ISNA(MATCH(${cell(i)},${list.range},0)))`, `Pick ${label(c)} from the list`])
    }
    if (c.kind === 'integer' || c.kind === 'number') {
      checks.push([`AND(${filled(i)},NOT(ISNUMBER(${cell(i)})))`, `${label(c)} must be a number`])
    }
    if (c.kind === 'date') {
      checks.push([`AND(${filled(i)},NOT(ISNUMBER(${cell(i)})))`, `${label(c)} must be a date`])
    }
    if (c.kind === 'yesno') {
      checks.push([`AND(${filled(i)},NOT(OR(${cell(i)}="Yes",${cell(i)}="No")))`, `${label(c)} must be Yes or No`])
    }
    if (c.kind === 'choice' && c.choices && !c.allowOther) {
      const any = c.choices.map(x => `${cell(i)}="${x}"`).join(',')
      checks.push([`AND(${filled(i)},NOT(OR(${any})))`, `Pick ${label(c)} from the list`])
    }
  })
  // The custom fields, judged by the sub-category chosen on the row. Excel
  // deletes a formula nested more than 64 levels deep or longer than 8,192
  // characters, and one pair of checks per field broke that on a 21-field tab.
  // So each field gets a hidden helper cell on the row (fieldRuleFormula: 1 = a
  // required field is empty, 2 = a field that does not belong is filled), and
  // these two checks only look for the first 1 or 2 and name that field from
  // the header row -- the same size however many fields the tab has. Placed
  // after the list checks, so an empty or misspelled sub-category comes first.
  if (opts.fieldRules) {
    const fr = opts.fieldRules
    const n = fr.lastColumn - fr.firstColumn + 1
    const helpers = `${L(columns.length + 1)}${r}:${L(columns.length + n)}${r}`
    const heads = `$${L(fr.firstColumn)}$1:$${L(fr.lastColumn)}$1`
    const at = (code: number) => `MATCH(${code},${helpers},0)`
    // INDEX(row, 1, n), not INDEX(row, n): the short form means "column n" to
    // Excel only for a one-row range, and "row n" to other spreadsheet programs.
    builtChecks.push([`ISNUMBER(${at(1)})`, `INDEX(${heads},1,${at(1)})&" is required for this sub-category"`])
    builtChecks.push([`ISNUMBER(${at(2)})`, `INDEX(${heads},1,${at(2)})&" does not apply to this sub-category"`])
  }

  if (keyColumns.length > 0) {
    const idx = keyColumns.map(k => columns.findIndex(c => c.key === k))
    const allFilled = idx.map(filled).join(',')
    const same = idx.map(i => `(${L(i)}$2:${L(i)}$${last}=${cell(i)})`).join('*')
    checks.push([`AND(${allFilled},SUMPRODUCT(${same})>1)`, 'This row appears twice'])
  }

  const all: [string, string][] = [
    ...checks.map(([cond, m]): [string, string] => [cond, `"${m.replace(/"/g, '""')}"`]),
    ...builtChecks,
  ]
  let f = '"OK"'
  for (let i = all.length - 1; i >= 0; i--) f = `IF(${all[i][0]},${all[i][1]},${f})`
  return `IF(COUNTA(${rowRange})=0,"",${f})`
}

// The hidden helper cell for custom field `k` (0-based) on row `r`: 1 when the
// row's sub-category requires the field and it is empty, 2 when the field does
// not belong to that sub-category but is filled, blank otherwise (including a
// row with no sub-category yet). Blank rather than 0, so a saved workbook does
// not look as if every empty row had something typed beside the table.
export function fieldRuleFormula(opts: DataSheetOptions, r: number, k: number): string {
  const fr = opts.fieldRules!
  const L = (i: number) => colLetter(i + 1)
  const value = `${L(fr.firstColumn + k)}${r}`
  const rule = `INDEX(${fr.table},MATCH($${L(fr.subColumn)}${r},${fr.subs},0),${k + 1})`
  const empty = `TRIM(${value}&"")=""`
  return `IFERROR(IF(${rule}="R",IF(${empty},1,""),IF(${rule}="N",IF(${empty},"",2),"")),"")`
}

// Adds one input tab. Returns the sheet and the letter of its Row check column.
export function addDataSheet(wb: ExcelJS.Workbook, opts: DataSheetOptions): { ws: ExcelJS.Worksheet; checkCol: string } {
  const { columns, maxRows } = opts
  const last = maxRows + 1
  const ws = wb.addWorksheet(opts.name, {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
    properties: { tabColor: opts.tabColor ? { argb: opts.tabColor } : undefined },
  })

  ws.columns = [
    ...columns.map(c => ({ width: c.width })),
    { width: 34 },
  ]

  // Header
  const header = ws.getRow(1)
  header.height = 30
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? COLORS.requiredHeader : COLORS.optionalHeader } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  const checkCell = header.getCell(columns.length + 1)
  checkCell.value = ROW_CHECK_HEADER
  checkCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  checkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.checkHeader } }
  checkCell.alignment = { vertical: 'middle' }
  if (opts.intro) {
    header.getCell(1).note = `${opts.intro}\n\nDo not rename, move or delete the column headings.`
  }

  // Column formats and dropdowns / cell rules for every input row.
  columns.forEach((c, i) => {
    const colNo = i + 1
    const letter = colLetter(colNo)
    const range = `${letter}2:${letter}${last}`
    if (c.kind === 'date') ws.getColumn(colNo).numFmt = 'dd-mm-yyyy'
    if (c.kind === 'number') ws.getColumn(colNo).numFmt = '#,##0.00'
    if (c.kind === 'integer') ws.getColumn(colNo).numFmt = '0'

    // ExcelJS keeps validations in a map of range -> rule at runtime, but leaves it
    // out of its typings.
    const dv = (ws as unknown as { dataValidations: { add(range: string, rule: ExcelJS.DataValidation): void } }).dataValidations
    const list = listFor(c, opts.listRows)
    if (list) {
      dv.add(range, {
        type: 'list', allowBlank: true, formulae: [list.dropdown],
        showErrorMessage: true, errorStyle: 'stop', errorTitle: `Unknown ${label(c)}`,
        error: `Pick ${label(c)} from the list. If it is not there, add it on its own tab first.`,
      })
    } else if (c.kind === 'yesno') {
      dv.add(range, {
        type: 'list', allowBlank: true, formulae: ['"Yes,No"'], showErrorMessage: true, errorStyle: 'stop',
        errorTitle: 'Yes or No', error: 'Choose Yes or No.',
      })
    } else if (c.kind === 'choice' && c.choices) {
      dv.add(range, {
        type: 'list', allowBlank: true, formulae: [`"${c.choices.join(',')}"`], showErrorMessage: true,
        errorStyle: c.allowOther ? 'warning' : 'stop', errorTitle: label(c),
        error: c.allowOther ? 'That is not one of the usual choices. Keep it anyway?' : `Choose one of: ${c.choices.join(', ')}.`,
      })
    } else if (c.kind === 'integer') {
      dv.add(range, {
        type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true,
        errorStyle: 'stop', errorTitle: label(c), error: 'Enter a whole number (0 or more).',
      })
    } else if (c.kind === 'number') {
      dv.add(range, {
        type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0], showErrorMessage: true,
        errorStyle: 'stop', errorTitle: label(c), error: 'Enter a number (0 or more), without text.',
      })
    } else if (c.kind === 'date') {
      dv.add(range, {
        type: 'date', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [new Date(Date.UTC(1990, 0, 1))],
        showErrorMessage: true, errorStyle: 'stop', errorTitle: label(c),
        error: 'Enter a real date, for example 25-09-2026.',
      })
    }
  })

  // Row check formulas.
  const checkLetter = colLetter(columns.length + 1)
  for (let r = 2; r <= last; r++) {
    const cell = ws.getCell(`${checkLetter}${r}`)
    cell.value = { formula: rowCheckFormula(opts, r) } as ExcelJS.CellFormulaValue
    cell.font = { size: 10 }
  }

  // The hidden helper cells the Row check reads for the custom fields.
  if (opts.fieldRules) {
    const n = opts.fieldRules.lastColumn - opts.fieldRules.firstColumn + 1
    for (let k = 0; k < n; k++) {
      const colNo = columns.length + 2 + k
      ws.getColumn(colNo).hidden = true
      for (let r = 2; r <= last; r++) {
        ws.getCell(r, colNo).value = { formula: fieldRuleFormula(opts, r, k) } as ExcelJS.CellFormulaValue
      }
    }
  }
  const checkRange = `${checkLetter}2:${checkLetter}${last}`
  ws.addConditionalFormatting({
    ref: checkRange,
    rules: [
      {
        type: 'expression', priority: 1, formulae: [`AND(${checkLetter}2<>"",${checkLetter}2<>"OK")`],
        style: { font: { color: { argb: COLORS.badFont }, bold: true }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.badFill } } },
      },
      {
        type: 'expression', priority: 2, formulae: [`${checkLetter}2="OK"`],
        style: { font: { color: { argb: COLORS.okFont } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.okFill } } },
      },
    ],
  })

  return { ws, checkCol: checkLetter }
}

export interface ListSource {
  header: string
  // Static values (Assets workbook) or one formula per row (Masters workbook).
  values?: string[]
  formula?: (row: number) => string
  rows: number
}

// The dropdown sources. Hidden from the client; the input tabs read from it.
export function addListsSheet(wb: ExcelJS.Workbook, sources: Partial<Record<ListName, ListSource>>): ExcelJS.Worksheet {
  const ws = wb.addWorksheet('Lists', { state: 'hidden' })
  LIST_ORDER.forEach((l, i) => {
    const src = sources[l]
    const colNo = i + 1
    ws.getColumn(colNo).width = 34
    const head = ws.getCell(1, colNo)
    head.value = src?.header ?? l
    head.font = { bold: true }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lookup } }
    if (!src) return
    if (src.values) {
      src.values.forEach((v, k) => { ws.getCell(k + 2, colNo).value = v })
    } else if (src.formula) {
      for (let r = 2; r <= src.rows + 1; r++) ws.getCell(r, colNo).value = { formula: src.formula(r) } as ExcelJS.CellFormulaValue
    }
  })
  return ws
}
