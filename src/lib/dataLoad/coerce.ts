// Turning what people type into Excel cells into clean values. Every function is
// strict: a value that can't be understood is reported, never guessed.

export interface Issue {
  severity: 'error' | 'warning'
  sheet: string
  row: number
  message: string
}

export type Parsed<T> = { ok: true; value: T | undefined } | { ok: false; message: string }

export const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

export function cleanText(v: unknown): string {
  if (isBlank(v)) return ''
  if (v instanceof Date) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

export function parseInteger(v: unknown): Parsed<number> {
  if (isBlank(v)) return { ok: true, value: undefined }
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, message: `"${cleanText(v)}" is not a whole number` }
  if (n < 0) return { ok: false, message: `"${n}" cannot be negative` }
  return { ok: true, value: n }
}

// Accepts 1234.5, "1,234.50" and "₹ 1,234.50". Never a negative.
export function parseNumber(v: unknown): Parsed<number> {
  if (isBlank(v)) return { ok: true, value: undefined }
  if (typeof v === 'number') {
    return Number.isFinite(v) && v >= 0 ? { ok: true, value: v } : { ok: false, message: `"${v}" is not a valid amount` }
  }
  const stripped = String(v).replace(/[₹$,\s]|INR|Rs\.?/gi, '')
  const n = Number(stripped)
  if (stripped === '' || !Number.isFinite(n) || n < 0) return { ok: false, message: `"${cleanText(v)}" is not a valid number` }
  return { ok: true, value: n }
}

const pad = (n: number) => String(n).padStart(2, '0')

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// A real Excel date arrives as a Date at UTC midnight (the UTC parts are the date the
// person sees). Typed text is read day-first, the Indian convention: 25-09-2026 or
// 25/09/2026; 2026-09-25 is also fine. Anything else is refused rather than guessed.
export function parseDate(v: unknown): Parsed<string> {
  if (isBlank(v)) return { ok: true, value: undefined }
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { ok: false, message: 'is not a valid date' }
    const s = validYmd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate())
    return s ? { ok: true, value: s } : { ok: false, message: 'is not a valid date' }
  }
  const t = String(v).trim()
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t)
  if (m) {
    const s = validYmd(Number(m[1]), Number(m[2]), Number(m[3]))
    return s ? { ok: true, value: s } : { ok: false, message: `"${t}" is not a valid date` }
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t)
  if (m) {
    const s = validYmd(Number(m[3]), Number(m[2]), Number(m[1]))
    return s ? { ok: true, value: s } : { ok: false, message: `"${t}" is not a valid date (use DD-MM-YYYY)` }
  }
  return { ok: false, message: `"${t}" is not a date (use a real Excel date or DD-MM-YYYY)` }
}

export function parseYesNo(v: unknown): Parsed<boolean> {
  if (isBlank(v)) return { ok: true, value: undefined }
  if (typeof v === 'boolean') return { ok: true, value: v }
  const t = String(v).trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(t)) return { ok: true, value: true }
  if (['no', 'n', 'false', '0'].includes(t)) return { ok: true, value: false }
  return { ok: false, message: `"${cleanText(v)}" must be Yes or No` }
}

// The canonical spelling of a choice, matched ignoring case and spacing.
export function parseChoice<T extends string>(v: unknown, choices: readonly T[]): Parsed<T> | { ok: 'other'; value: string } {
  if (isBlank(v)) return { ok: true, value: undefined }
  const t = cleanText(v).toLowerCase()
  const hit = choices.find(c => c.toLowerCase() === t)
  if (hit) return { ok: true, value: hit }
  return { ok: 'other', value: cleanText(v) }
}

// Case- and spacing-insensitive key for matching names ("Block  A" = "block a").
export const nameKey = (v: unknown): string => cleanText(v).toLowerCase()
