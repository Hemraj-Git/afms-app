import ExcelJS from 'exceljs'
import type { Issue } from './coerce'

export function summarizeIssues(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
  }
}

// Errors first, then by tab and row, so the person fixing the file works top to bottom.
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) =>
      Number(a.severity === 'warning') - Number(b.severity === 'warning') ||
      a.sheet.localeCompare(b.sheet) ||
      a.row - b.row
  )
}

// A plain sheet the client can filter: what is wrong, on which tab and row.
export async function issuesWorkbook(issues: Issue[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Import report', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Type', width: 10 },
    { header: 'Tab', width: 28 },
    { header: 'Row', width: 8 },
    { header: 'What to fix', width: 110 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const i of sortIssues(issues)) {
    ws.addRow([i.severity === 'error' ? 'Error' : 'Warning', i.sheet, i.row > 0 ? i.row : '', i.message])
  }
  if (issues.length === 0) ws.addRow(['OK', '', '', 'No problems found.'])
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
