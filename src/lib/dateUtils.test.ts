import { describe, expect, it } from 'vitest'
import { formatDateDisplay } from './dateUtils'

const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

describe('formatDateDisplay', () => {
  it('shows a plain date as it is, whatever the time zone', () => {
    expect(formatDateDisplay('2026-10-05')).toBe('05-10-2026')
  })

  it('shows a timestamp on the viewer\'s own date, not the UTC one', () => {
    // 3:12 AM on 5 October in India is still 4 October in UTC.
    const iso = '2026-10-04T21:42:00+00:00'
    expect(formatDateDisplay(iso)).toBe(localDate(iso))
    if (new Date(iso).getTimezoneOffset() === -330) expect(formatDateDisplay(iso)).toBe('05-10-2026')
  })

  it('handles empty and invalid values', () => {
    expect(formatDateDisplay('')).toBe('—')
    expect(formatDateDisplay(null)).toBe('—')
    expect(formatDateDisplay('not a date')).toBe('—')
  })
})
