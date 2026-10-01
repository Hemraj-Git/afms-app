// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The person's own session (cookies), faked.
let signedIn: { id: string; email?: string; is_anonymous?: boolean } | null = { id: 'u1', email: 'ravi@example.com' }
const updateUser = vi.fn(async (attrs: { password: string }) => {
  void attrs
  return { error: null as null | { message: string } }
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn } }), updateUser: (a: { password: string }) => updateUser(a) },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

// The throwaway client used only to check the current password.
let checkResult: { error: null | { message: string; status?: number } } = { error: null }
const signInWithPassword = vi.fn(async (creds: { email: string; password: string }) => {
  void creds
  return checkResult
})
const signOut = vi.fn(async (opts?: { scope?: string }) => {
  void opts
  return { error: null }
})
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: (c: { email: string; password: string }) => signInWithPassword(c), signOut: (o?: { scope?: string }) => signOut(o) } }),
}))

const { changePassword } = await import('./auth')

beforeEach(() => {
  signedIn = { id: 'u1', email: 'ravi@example.com' }
  checkResult = { error: null }
  updateUser.mockClear()
  signInWithPassword.mockClear()
  signOut.mockClear()
})

describe('changePassword', () => {
  it('checks the current password, then sets the new one on the person\'s own session', async () => {
    expect(await changePassword('Old#Pass2025', 'Harbour#2026')).toEqual({ success: true })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ravi@example.com', password: 'Old#Pass2025' })
    expect(updateUser).toHaveBeenCalledWith({ password: 'Harbour#2026' })
  })

  // Signing out with the default scope would end every session of the account,
  // including the one the person is using.
  it('ends only the session made for the check', async () => {
    await changePassword('Old#Pass2025', 'Harbour#2026')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('refuses a wrong current password and changes nothing', async () => {
    checkResult = { error: { message: 'Invalid login credentials', status: 400 } }
    expect(await changePassword('guess', 'Harbour#2026')).toEqual({ success: false, field: 'current', error: 'That is not your current password.' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('says to wait when there have been too many attempts', async () => {
    checkResult = { error: { message: 'Request rate limit reached', status: 429 } }
    const r = await changePassword('guess', 'Harbour#2026')
    expect(r).toMatchObject({ success: false, field: 'current', error: expect.stringMatching(/Too many attempts/) })
  })

  it('refuses a new password that breaks the rules, before checking anything', async () => {
    const r = await changePassword('Old#Pass2025', 'harbour2026')
    expect(r).toMatchObject({ success: false, field: 'new', error: expect.stringMatching(/at least 8 characters/) })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('refuses the same password again', async () => {
    const r = await changePassword('Harbour#2026', 'Harbour#2026')
    expect(r).toMatchObject({ success: false, field: 'new', error: expect.stringMatching(/different/) })
  })

  it('refuses a guest or someone not signed in', async () => {
    signedIn = { id: 'g1', is_anonymous: true }
    expect(await changePassword('x', 'Harbour#2026')).toMatchObject({ success: false })
    signedIn = null
    expect(await changePassword('x', 'Harbour#2026')).toMatchObject({ success: false })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('explains a refusal from Supabase in plain words', async () => {
    updateUser.mockResolvedValueOnce({ error: { message: 'Password is known to be weak and easy to guess, please choose a different one.' } })
    const r = await changePassword('Old#Pass2025', 'Harbour#2026')
    expect(r).toMatchObject({ success: false, field: 'new', error: expect.stringMatching(/data breach/) })
  })
})
