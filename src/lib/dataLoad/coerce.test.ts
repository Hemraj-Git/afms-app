// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cleanText, nameKey, parseChoice, parseDate, parseInteger, parseNumber, parseYesNo } from './coerce'

describe('parseDate', () => {
  it('reads a real Excel date (UTC midnight) as that calendar day, in any timezone', () => {
    expect(parseDate(new Date(Date.UTC(2026, 8, 25)))).toEqual({ ok: true, value: '2026-09-25' })
  })
  it('reads typed text day-first, the Indian convention', () => {
    expect(parseDate('25-09-2026')).toEqual({ ok: true, value: '2026-09-25' })
    expect(parseDate('05/03/2026')).toEqual({ ok: true, value: '2026-03-05' })
    expect(parseDate('5.3.2026')).toEqual({ ok: true, value: '2026-03-05' })
    expect(parseDate('2026-09-25')).toEqual({ ok: true, value: '2026-09-25' })
  })
  it('refuses impossible or unreadable dates instead of guessing', () => {
    expect(parseDate('31-02-2026').ok).toBe(false)
    expect(parseDate('2026-13-01').ok).toBe(false)
    expect(parseDate('tomorrow').ok).toBe(false)
    expect(parseDate(new Date('nope')).ok).toBe(false)
  })
  it('treats blank as absent', () => {
    expect(parseDate('  ')).toEqual({ ok: true, value: undefined })
    expect(parseDate(null)).toEqual({ ok: true, value: undefined })
  })
})

describe('parseNumber / parseInteger', () => {
  it('accepts plain numbers, thousands separators and a rupee sign', () => {
    expect(parseNumber(1250.5)).toEqual({ ok: true, value: 1250.5 })
    expect(parseNumber('1,25,000')).toEqual({ ok: true, value: 125000 })
    expect(parseNumber('₹ 4,500.75')).toEqual({ ok: true, value: 4500.75 })
    expect(parseNumber('Rs. 300')).toEqual({ ok: true, value: 300 })
  })
  it('refuses text and negatives', () => {
    expect(parseNumber('about ten').ok).toBe(false)
    expect(parseNumber(-5).ok).toBe(false)
    expect(parseNumber('-5').ok).toBe(false)
  })
  it('integers must be whole and not negative', () => {
    expect(parseInteger(3)).toEqual({ ok: true, value: 3 })
    expect(parseInteger('12')).toEqual({ ok: true, value: 12 })
    expect(parseInteger(2.5).ok).toBe(false)
    expect(parseInteger(-1).ok).toBe(false)
  })
})

describe('parseYesNo / parseChoice / text', () => {
  it('reads yes and no in the usual spellings', () => {
    expect(parseYesNo('Yes')).toEqual({ ok: true, value: true })
    expect(parseYesNo('n')).toEqual({ ok: true, value: false })
    expect(parseYesNo('')).toEqual({ ok: true, value: undefined })
    expect(parseYesNo('maybe').ok).toBe(false)
  })
  it('returns the canonical spelling of a choice, ignoring case', () => {
    expect(parseChoice('half-yearly', ['Weekly', 'Half-Yearly'])).toEqual({ ok: true, value: 'Half-Yearly' })
    expect(parseChoice('Fortnightly', ['Weekly'])).toEqual({ ok: 'other', value: 'Fortnightly' })
  })
  it('cleans spacing so names compare fairly', () => {
    expect(cleanText('  Block   A ')).toBe('Block A')
    expect(nameKey('  BLOCK  a ')).toBe(nameKey('block a'))
    expect(cleanText(42)).toBe('42')
  })
})
