import ExcelJS from 'exceljs'

// Test-only: fill a generated workbook the way a person would (values typed into the
// input cells, from row 2), and let a test tamper with it before it is read back.
export async function fillWorkbook(
  template: Uint8Array,
  fills: Record<string, unknown[][]>,
  tamper?: (wb: ExcelJS.Workbook) => void
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(template as unknown as ExcelJS.Buffer)
  for (const [sheet, rows] of Object.entries(fills)) {
    const ws = wb.getWorksheet(sheet)
    if (!ws) throw new Error(`No tab "${sheet}" in the template`)
    rows.forEach((values, i) => {
      values.forEach((v, c) => {
        if (v !== undefined && v !== null && v !== '') ws.getCell(i + 2, c + 1).value = v as ExcelJS.CellValue
      })
    })
  }
  tamper?.(wb)
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

export const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

// Deterministic ids for assertions.
export function counterIds(prefix = 'id'): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

// A light stand-in for a filled workbook: just the header rows the loader checks and
// the values, with none of the template's formulas or dropdowns. Building it is
// instant; filling the real template (about 20,000 formulas) takes seconds each time.
export async function plainWorkbook(
  tabs: { name: string; headers: string[] }[],
  fills: Record<string, unknown[][]>,
  tamper?: (wb: ExcelJS.Workbook) => void
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  for (const t of tabs) {
    const ws = wb.addWorksheet(t.name)
    t.headers.forEach((h, i) => { ws.getCell(1, i + 1).value = h })
    ;(fills[t.name] ?? []).forEach((values, r) => {
      values.forEach((v, c) => {
        if (v !== undefined && v !== null && v !== '') ws.getCell(r + 2, c + 1).value = v as ExcelJS.CellValue
      })
    })
  }
  tamper?.(wb)
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
