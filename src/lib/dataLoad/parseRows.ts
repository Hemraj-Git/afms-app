import {
  cleanText, isBlank, parseChoice, parseDate, parseInteger, parseNumber, parseYesNo, type Issue,
} from './coerce'
import type { RawSheet } from './readWorkbook'
import type { ColumnSpec } from './spec'

// One row with every cell turned into its column's type:
// text -> string ('' when blank), integer/number -> number, date -> 'YYYY-MM-DD',
// yesno -> boolean, choice -> the canonical spelling. Blank optional cells are undefined.
export interface Rec {
  row: number
  v: Record<string, unknown>
}

export function parseSheetRows(
  sheet: RawSheet,
  spec: { columns: ColumnSpec[] },
  sheetName: string,
  issues: Issue[]
): Rec[] {
  const out: Rec[] = []
  const err = (row: number, message: string) => issues.push({ severity: 'error', sheet: sheetName, row, message })
  const warn = (row: number, message: string) => issues.push({ severity: 'warning', sheet: sheetName, row, message })

  for (const r of sheet.rows) {
    const v: Record<string, unknown> = {}
    spec.columns.forEach((c, i) => {
      const raw = r.cells[i]
      const label = c.header.replace(/ \*$/, '')
      const bad = (message: string) => err(r.row, `${label}: ${message}`)

      if (isBlank(raw)) {
        if (c.required) bad('is required')
        v[c.key] = c.kind === 'text' ? '' : undefined
        return
      }

      switch (c.kind) {
        case 'text':
          v[c.key] = cleanText(raw)
          break
        case 'integer': {
          const p = parseInteger(raw)
          if (!p.ok) bad(p.message)
          else v[c.key] = p.value
          break
        }
        case 'number': {
          const p = parseNumber(raw)
          if (!p.ok) bad(p.message)
          else v[c.key] = p.value
          break
        }
        case 'date': {
          const p = parseDate(raw)
          if (!p.ok) bad(p.message)
          else v[c.key] = p.value
          break
        }
        case 'yesno': {
          const p = parseYesNo(raw)
          if (!p.ok) bad(p.message)
          else v[c.key] = p.value
          break
        }
        case 'choice': {
          const p = parseChoice(raw, c.choices ?? [])
          if (p.ok === true) v[c.key] = p.value
          else if (p.ok === 'other') {
            if (c.allowOther) {
              warn(r.row, `${label}: "${p.value}" is not one of the usual choices (${(c.choices ?? []).join(', ')}); it will be used as typed`)
              v[c.key] = p.value
            } else {
              bad(`"${p.value}" is not one of: ${(c.choices ?? []).join(', ')}`)
            }
          } else bad(p.message)
          break
        }
      }
    })
    out.push({ row: r.row, v })
  }
  return out
}
