import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { maskPersonalData, scrubEvent } from './sentry'

describe('maskPersonalData', () => {
  it('masks emails and Indian mobile numbers', () => {
    expect(maskPersonalData('Invite to rakesh.behera@cutm.ac.in failed')).toBe('Invite to [email] failed')
    expect(maskPersonalData('Call +91 98610 00002 or 9861000002')).toBe('Call [phone] or [phone]')
  })

  it('leaves ids, record numbers and dates alone', () => {
    const text = 'WO-CR-2026-0004 for AST-0007 on 2026-10-05 (1791150097998)'
    expect(maskPersonalData(text)).toBe(text)
  })
})

describe('scrubEvent', () => {
  it('keeps the error but drops personal data, cookies, headers and request bodies', () => {
    const event = {
      type: undefined,
      message: 'Failed for anita@example.com',
      exception: { values: [{ type: 'Error', value: 'No profile for 9861000001' }] },
      breadcrumbs: [{ message: 'GET /rest/v1/profiles?email=eq.anita@example.com', data: { url: 'https://x/rest/v1/profiles?email=eq.anita@example.com', status_code: 200 } }],
      request: { url: 'https://soms.assetnxg.app/admin/users?q=anita@example.com', cookies: { sb: 'token' }, headers: { authorization: 'Bearer x' }, data: { password: 'secret' } },
      user: { id: 'u-1', email: 'anita@example.com', ip_address: '1.2.3.4' },
    } as unknown as ErrorEvent

    const out = scrubEvent(event)
    expect(out.message).toBe('Failed for [email]')
    expect(out.exception?.values?.[0].value).toBe('No profile for [phone]')
    expect(out.breadcrumbs?.[0].message).toContain('[email]')
    expect(out.breadcrumbs?.[0].data?.url).toContain('[email]')
    expect(out.breadcrumbs?.[0].data?.status_code).toBe(200)
    expect(out.request).toEqual({ url: 'https://soms.assetnxg.app/admin/users?q=[email]' })
    expect(out.user).toEqual({ id: 'u-1' })
  })
})
