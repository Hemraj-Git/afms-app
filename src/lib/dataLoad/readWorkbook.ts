import ExcelJS from 'exceljs'
import { cleanText, isBlank, type Issue } from './coerce'
import { normalizeHeader, type SheetSpec } from './spec'

// A tab read into plain rows. Formulas are read by their result; the Row check
// column and anything to the right of the defined columns is ignored.
export interface RawRow {
  row: number // the row number in Excel (header is row 1)
  cells: unknown[] // by column position, 0-based
}

export interface RawSheet {
  name: string
  headers: string[]
  rows: RawRow[]
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('result' in o) {
      const r = o.result
      if (r && typeof r === 'object' && 'error' in (r as object)) return null
      return r === undefined ? null : (r as unknown)
    }
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map(t => t.text).join('')
    }
    if ('text' in o) return o.text // a hyperlink
    if ('error' in o) return null
    return null
  }
  return v
}

// Reads every tab. `widths` is how many columns to keep for a tab (by tab name); the
// others keep their first `defaultWidth`.
export async function readWorkbook(
  data: ArrayBuffer | Uint8Array,
  widths: Record<string, number> = {},
  defaultWidth = 60
): Promise<Map<string, RawSheet>> {
  const wb = new ExcelJS.Workbook()
  // ExcelJS types want its own Buffer type; Uint8Array is accepted at runtime.
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer)
  const out = new Map<string, RawSheet>()
  wb.eachSheet(ws => {
    const width = widths[ws.name] ?? defaultWidth
    const headers: string[] = []
    const headerRow = ws.getRow(1)
    for (let c = 1; c <= width; c++) headers.push(cleanText(cellValue(headerRow.getCell(c))))
    const rows: RawRow[] = []
    const last = ws.rowCount
    for (let r = 2; r <= last; r++) {
      const row = ws.getRow(r)
      const cells: unknown[] = []
      let any = false
      for (let c = 1; c <= width; c++) {
        const v = cellValue(row.getCell(c))
        cells.push(v)
        if (!isBlank(v)) any = true
      }
      if (any) rows.push({ row: r, cells })
    }
    out.set(ws.name, { name: ws.name, headers, rows })
  })
  return out
}

// The header row must be exactly the template's. A renamed, moved or deleted
// column would silently shift every value, so it stops the load.
export function checkHeaders(sheet: RawSheet, spec: Pick<SheetSpec, 'columns'>, sheetName: string): Issue[] {
  const issues: Issue[] = []
  spec.columns.forEach((c, i) => {
    if (normalizeHeader(sheet.headers[i]) !== normalizeHeader(c.header)) {
      issues.push({
        severity: 'error',
        sheet: sheetName,
        row: 1,
        message: `Column ${i + 1} should be "${c.header}" but is "${sheet.headers[i] || '(empty)'}". Do not rename, move or delete columns; use a fresh copy of the template.`,
      })
    }
  })
  return issues
}
