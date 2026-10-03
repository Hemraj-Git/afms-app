import { describe, expect, it } from 'vitest'
import { initialsOf } from './brand'

describe('initialsOf', () => {
  it('takes up to two initials, ignoring punctuation', () => {
    expect(initialsOf('Hemraj Maritime Training Institute')).toBe('HM')
    expect(initialsOf('Ravi Kumar')).toBe('RK')
    expect(initialsOf('[E2E] Admin')).toBe('EA')
    expect(initialsOf('Admin')).toBe('A')
    expect(initialsOf('  ')).toBe('')
  })
})
