import { describe, expect, it } from 'vitest'
import { desktopPathForFieldApp, isPublicPath, isRoleUnrestrictedPath } from './routeAccess'

describe('isPublicPath', () => {
  it('lets someone with no session reach the way in', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/qr')).toBe(true)
    expect(isPublicPath('/qr/room/abc-123')).toBe(true)
  })

  it('lets an invite or reset link establish a session', () => {
    expect(isPublicPath('/auth/confirm')).toBe(true)
    expect(isPublicPath('/auth/auth-error')).toBe(true)
  })

  // The bug this file exists for: someone who cannot sign in has no session,
  // so gating the reset page behind one sent them back to /login.
  it('lets a signed-out person ask for a password reset', () => {
    expect(isPublicPath('/auth/forgot-password')).toBe(true)
  })

  it('still requires the session /auth/confirm just created to set a password', () => {
    expect(isPublicPath('/auth/set-password')).toBe(false)
  })

  it('keeps the app itself behind a sign-in', () => {
    for (const path of ['/dashboard', '/assets', '/admin/users', '/reports', '/mobile', '/']) {
      expect(isPublicPath(path)).toBe(false)
    }
  })

  it('matches whole segments, not merely the same opening letters', () => {
    expect(isPublicPath('/loginhelp')).toBe(false)
    expect(isPublicPath('/auth/forgot-password-x')).toBe(false)
    expect(isPublicPath('/qrcodes')).toBe(false)
  })
})

describe('isRoleUnrestrictedPath', () => {
  it('covers the field app and the auth screens', () => {
    expect(isRoleUnrestrictedPath('/mobile')).toBe(true)
    expect(isRoleUnrestrictedPath('/mobile/work-order/1')).toBe(true)
    expect(isRoleUnrestrictedPath('/auth/set-password')).toBe(true)
  })

  it('leaves every desktop route Admin-gated by default', () => {
    for (const path of ['/dashboard', '/assets', '/sub-categories', '/admin/users', '/mobiles']) {
      expect(isRoleUnrestrictedPath(path)).toBe(false)
    }
  })
})

describe('desktopPathForFieldApp (an Admin who opens the field app)', () => {
  const id = '3f2b8c1e-0a4d-4f5e-9b7c-2d1e0f9a8b7c'
  it('sends a scanned room or asset to its desktop page', () => {
    expect(desktopPathForFieldApp(`?type=room&id=${id}`)).toBe(`/organization/rooms/${id}`)
    expect(desktopPathForFieldApp(`?type=asset&id=${id}`)).toBe(`/assets/${id}`)
  })

  it('sends everything else to the dashboard', () => {
    expect(desktopPathForFieldApp('')).toBe('/dashboard')
    expect(desktopPathForFieldApp('?type=room')).toBe('/dashboard')
    expect(desktopPathForFieldApp(`?type=vendor&id=${id}`)).toBe('/dashboard')
  })

  it('never puts an id that is not id-shaped into the path', () => {
    expect(desktopPathForFieldApp('?type=room&id=../../admin')).toBe('/dashboard')
    expect(desktopPathForFieldApp('?type=asset&id=a%2Fb')).toBe('/dashboard')
    expect(desktopPathForFieldApp('?type=room&id=//evil.example')).toBe('/dashboard')
  })
})
