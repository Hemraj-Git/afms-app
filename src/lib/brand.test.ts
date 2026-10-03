import { describe, expect, it } from 'vitest'
import { initialsOf, labelName, placardTitle } from './brand'

describe('initialsOf', () => {
  it('takes up to two initials, ignoring punctuation', () => {
    expect(initialsOf('Hemraj Maritime Training Institute')).toBe('HM')
    expect(initialsOf('Ravi Kumar')).toBe('RK')
    expect(initialsOf('[E2E] Admin')).toBe('EA')
    expect(initialsOf('Admin')).toBe('A')
    expect(initialsOf('  ')).toBe('')
  })
})

describe('QR label names', () => {
  it('uses the client name on placards, AssetNXG without one', () => {
    expect(placardTitle('School of Maritime Studies, Centurion University')).toBe('School of Maritime Studies, Centurion University')
    expect(placardTitle('')).toBe('AssetNXG')
  })

  it('uses the short name on small labels, never a long name', () => {
    expect(labelName('SoMS', 'School of Maritime Studies, Centurion University')).toBe('SoMS')
    expect(labelName('', 'School of Maritime Studies, Centurion University')).toBe('')
    expect(labelName('', 'Acme Campus')).toBe('Acme Campus')
  })
})
