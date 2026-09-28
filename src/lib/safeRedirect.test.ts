// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { safeNextPath, safeRedirectPath } from './safeRedirect'

describe('safeRedirectPath', () => {
  it('keeps ordinary in-app destinations', () => {
    expect(safeRedirectPath('/dashboard', '/fallback')).toBe('/dashboard')
    expect(safeRedirectPath('/maintenance/work-orders', '/fallback')).toBe('/maintenance/work-orders')
  })

  it('keeps the query string — a QR scan depends on it', () => {
    const scan = '/mobile?type=room&id=8f1c1e0a-0000-4000-8000-000000000001'
    expect(safeRedirectPath(scan, '/fallback')).toBe(scan)
  })

  it('drops a fragment, which the server never needs', () => {
    expect(safeRedirectPath('/assets#top', '/fallback')).toBe('/assets')
  })

  it('refuses another site', () => {
    for (const hostile of ['//evil.com', '//evil.com/path', '/\\evil.com', 'https://evil.com', 'http://evil.com']) {
      expect(safeRedirectPath(hostile, '/fallback'), hostile).toBe('/fallback')
    }
  })

  it('refuses anything that is not a plain path', () => {
    for (const bad of ['dashboard', '', ' ', '/path with space', '/path\\x', 'javascript:alert(1)']) {
      expect(safeRedirectPath(bad, '/fallback'), bad).toBe('/fallback')
    }
  })

  it('refuses control characters, which browsers strip', () => {
    expect(safeRedirectPath('/pa\u0000th', '/fallback')).toBe('/fallback')
    expect(safeRedirectPath('/pa\nth', '/fallback')).toBe('/fallback')
    expect(safeRedirectPath('/pa\rth', '/fallback')).toBe('/fallback')
    expect(safeRedirectPath('/pa\tth', '/fallback')).toBe('/fallback')
  })

  it('refuses a missing value', () => {
    expect(safeRedirectPath(null, '/fallback')).toBe('/fallback')
    expect(safeRedirectPath(undefined, '/fallback')).toBe('/fallback')
  })
})

describe('safeNextPath', () => {
  it('allows only the three pages an email link may land on', () => {
    expect(safeNextPath('/auth/set-password')).toBe('/auth/set-password')
    expect(safeNextPath('/mobile')).toBe('/mobile')
    expect(safeNextPath('/dashboard')).toBe('/dashboard')
  })

  it('sends anything else to the password page, session and all', () => {
    for (const other of ['/admin/users', '/assets', '//evil.com', 'https://evil.com', null, undefined, '']) {
      expect(safeNextPath(other), String(other)).toBe('/auth/set-password')
    }
  })

  it('keeps a query on an allowed destination', () => {
    expect(safeNextPath('/mobile?type=room&id=1')).toBe('/mobile?type=room&id=1')
  })
})
