import { describe, expect, it } from 'vitest'
import { initialsOf, isSupportAccount, labelName, placardTitle, visibleUsers } from './brand'

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

describe('support logins', () => {
  const people = [
    { id: '1', email: 'admin@assetnxg.app' },
    { id: '2', email: 'Anushka.bhardwaj@pragyamatic.com' },
    { id: '3', email: 'Ops@AssetNXG.app ' },
  ]

  it('recognises any @assetnxg.app address, and only that domain', () => {
    expect(isSupportAccount('admin@assetnxg.app')).toBe(true)
    expect(isSupportAccount('Ops@AssetNXG.app ')).toBe(true)
    expect(isSupportAccount('someone@assetnxg.app.example.com')).toBe(false)
    expect(isSupportAccount('assetnxg.app@gmail.com')).toBe(false)
    expect(isSupportAccount(undefined)).toBe(false)
  })

  it('hides them from client staff, and shows everyone to a support login', () => {
    expect(visibleUsers(people, 'anushka.bhardwaj@pragyamatic.com').map(p => p.id)).toEqual(['2'])
    expect(visibleUsers(people, '').map(p => p.id)).toEqual(['2'])
    expect(visibleUsers(people, 'admin@assetnxg.app').map(p => p.id)).toEqual(['1', '2', '3'])
  })
})
