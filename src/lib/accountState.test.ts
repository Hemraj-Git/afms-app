import { describe, expect, it } from 'vitest'
import { accountStateOf, firstAssignableId, orderForAssignment, toAccountStatus } from './accountState'

describe('accountStateOf', () => {
  it('is pending for an invited account that has never been signed into', () => {
    expect(accountStateOf({ id: 'a', invited_at: '2026-10-01T09:00:00Z', last_sign_in_at: null })).toBe('invite-pending')
  })

  it('is active once the invited person has signed in', () => {
    expect(accountStateOf({ id: 'a', invited_at: '2026-10-01T09:00:00Z', last_sign_in_at: '2026-10-01T10:00:00Z' })).toBe('active')
  })

  // Accounts made another way (seeded, or before invites existed) have their
  // password already; never signing in does not make them unusable.
  it('is active for an account that was never invited, signed in or not', () => {
    expect(accountStateOf({ id: 'a', invited_at: null, last_sign_in_at: null })).toBe('active')
  })

  it('keeps the dates for display', () => {
    expect(toAccountStatus({ id: 'a', invited_at: '2026-10-01T09:00:00Z' })).toEqual({
      id: 'a', state: 'invite-pending', invitedAt: '2026-10-01T09:00:00Z', lastSignInAt: undefined,
    })
  })
})

describe('assignment dropdowns', () => {
  const people = [{ id: 'priya' }, { id: 'ravi' }, { id: 'sam' }]
  const pending = (id: string) => id === 'priya'

  it('lists people who can sign in first, pending invites last', () => {
    expect(orderForAssignment(people, pending).map(p => p.id)).toEqual(['ravi', 'sam', 'priya'])
  })

  it('starts on the first person who can sign in', () => {
    expect(firstAssignableId(people, pending)).toBe('ravi')
    expect(firstAssignableId(people, () => true)).toBe('')
    expect(firstAssignableId(people, () => false)).toBe('priya')
  })
})
