import { describe, expect, it } from 'vitest'
import { friendlyPasswordError, PASSWORD_RULES, passwordMeetsPolicy } from './authPolicy'

const unmet = (p: string) => PASSWORD_RULES.filter(r => !r.met(p)).map(r => r.id)

describe('password policy (8+, lowercase, uppercase, digit, symbol)', () => {
  it('accepts a password that has everything', () => {
    expect(passwordMeetsPolicy('Harbour#2026')).toBe(true)
    expect(unmet('Harbour#2026')).toEqual([])
  })

  it('names exactly what is missing', () => {
    expect(unmet('short1!A')).toEqual([])
    expect(unmet('Sh0rt!')).toEqual(['length'])
    expect(unmet('HARBOUR#2026')).toEqual(['lower'])
    expect(unmet('harbour#2026')).toEqual(['upper'])
    expect(unmet('Harbour#Gate')).toEqual(['digit'])
    expect(unmet('Harbour2026')).toEqual(['symbol'])
    expect(unmet('')).toEqual(['length', 'lower', 'upper', 'digit', 'symbol'])
  })

  it('counts only the symbols Supabase counts', () => {
    for (const s of ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '-', '=', '[', ']', '{', '}', ';', "'", '\\', ':', '"', '|', '<', '>', '?', ',', '.', '/', '`', '~']) {
      expect(passwordMeetsPolicy(`Harbour2026${s}`), s).toBe(true)
    }
    // A space or a currency sign is not a symbol to Supabase.
    expect(passwordMeetsPolicy('Harbour 2026')).toBe(false)
    expect(passwordMeetsPolicy('Harbour2026₹')).toBe(false)
  })
})

describe('friendlyPasswordError', () => {
  it('turns Supabase refusals into plain words', () => {
    expect(friendlyPasswordError('Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$')).toMatch(/at least 8 characters, with a lowercase/)
    expect(friendlyPasswordError('Password should be at least 8 characters.')).toMatch(/at least 8 characters/)
    expect(friendlyPasswordError('New password should be different from the old password.')).toMatch(/not used for this account before/)
    expect(friendlyPasswordError('Auth session missing!')).toMatch(/link has expired/)
  })

  it('passes anything else through unchanged', () => {
    expect(friendlyPasswordError('Network request failed')).toBe('Network request failed')
  })
})
