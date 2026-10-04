// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exactIlikePattern, STAFF_EMAIL_FOR_GUEST } from '@/lib/guestEmail'

// Staff accounts the admin client "finds" (the email check), by exact,
// case-insensitive match the way ILIKE with escaped wildcards behaves.
let staffEmails: string[] = []
let adminFails = false
const ilikeCalls: string[] = []

function adminProfiles() {
  const q: Record<string, unknown> = {}
  let pattern = ''
  q.select = () => q
  q.ilike = (_col: string, p: string) => {
    pattern = p
    ilikeCalls.push(p)
    return q
  }
  q.neq = () => q
  q.eq = () => q
  q.order = () => q
  q.limit = async () => {
    if (adminFails) return { data: null, error: { message: 'boom' } }
    const plain = pattern.replace(/\\([\\%_])/g, '$1')
    return { data: staffEmails.filter(e => e.toLowerCase() === plain.toLowerCase()).map(() => ({ id: 's1' })), error: null }
  }
  q.maybeSingle = async () => ({ data: null })
  return q
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => adminProfiles() }) }))

const signInAnonymously = vi.fn(async () => ({ data: { user: { id: 'g1' } }, error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInAnonymously },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  }),
}))

const { guestSignIn } = await import('./auth')

beforeEach(() => {
  staffEmails = ['Ravi.Kumar@hemrajmarines.com', 'john_doe@campus.edu']
  adminFails = false
  ilikeCalls.length = 0
  signInAnonymously.mockClear()
})

describe('guestSignIn with a staff email', () => {
  it('is refused before any guest session is started, whatever the letter case', async () => {
    const r = await guestSignIn({ fullName: 'Visitor', email: '  ravi.kumar@HEMRAJMARINES.com ', phone: '9820000000' })
    expect(r).toEqual({ success: false, error: STAFF_EMAIL_FOR_GUEST })
    expect(signInAnonymously).not.toHaveBeenCalled()
  })

  it('matches exactly: an underscore is not a wildcard', async () => {
    expect(await guestSignIn({ email: 'johnxdoe@campus.edu', phone: '1' })).toMatchObject({ success: true })
    expect(ilikeCalls[0]).toBe('johnxdoe@campus.edu')
    expect((await guestSignIn({ email: 'john_doe@campus.edu', phone: '1' })).success).toBe(false)
    expect(ilikeCalls[1]).toBe('john\\_doe@campus.edu')
  })

  it('lets an ordinary visitor in', async () => {
    const r = await guestSignIn({ fullName: 'Anita Desai', email: 'anita@gmail.com', phone: '9820011457' })
    expect(r).toEqual({ success: true, profile: { id: 'g1', fullName: 'Anita Desai', email: 'anita@gmail.com', phone: '9820011457' } })
    expect(signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('still lets visitors in if the check itself fails', async () => {
    adminFails = true
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await guestSignIn({ email: 'anita@gmail.com', phone: '1' })).success).toBe(true)
    spy.mockRestore()
  })
})

describe('exactIlikePattern', () => {
  it('escapes the ILIKE wildcards and the escape character', () => {
    expect(exactIlikePattern('a_b%c\\d@x.com')).toBe('a\\_b\\%c\\\\d@x.com')
    expect(exactIlikePattern('plain@x.com')).toBe('plain@x.com')
  })
})
