// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The signed-in caller (an Admin) and the service-role client, both faked.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'Admin' } }) }) }) }),
  }),
}))

type FakeUser = { id: string; email: string; invited_at?: string | null; last_sign_in_at?: string | null; is_anonymous?: boolean; user_metadata?: object }
let accounts: FakeUser[] = []
let profileUpdateError: { message: string } | null = null
const inviteUserByEmail = vi.fn()
const deleteUser = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: accounts }, error: null }),
        getUserById: async (id: string) => {
          const user = accounts.find(a => a.id === id)
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'User not found' } }
        },
        inviteUserByEmail: (...args: unknown[]) => inviteUserByEmail(...args),
        deleteUser: (...args: unknown[]) => deleteUser(...(args as [])),
      },
    },
    from: () => ({ update: () => ({ eq: async () => ({ error: profileUpdateError }) }) }),
  }),
}))

const { inviteUser, listAccountStatuses, resendInvite } = await import('./users')

const NEW_ID = '11111111-1111-4111-8111-111111111111'
const PENDING_ID = '22222222-2222-4222-8222-222222222222'
const ACTIVE_ID = '33333333-3333-4333-8333-333333333333'
const pending: FakeUser = { id: PENDING_ID, email: 'priya@example.com', invited_at: '2026-10-01T09:00:00Z', last_sign_in_at: null }
const active: FakeUser = { id: ACTIVE_ID, email: 'ravi@example.com', invited_at: '2026-09-01T09:00:00Z', last_sign_in_at: '2026-09-02T09:00:00Z' }
const invite = (email: string) => inviteUser({ email, fullName: 'Someone', role: 'Technician', department: 'Maintenance' })

beforeEach(() => {
  accounts = [pending, active, { id: 'guest-1', email: '', is_anonymous: true }]
  profileUpdateError = null
  inviteUserByEmail.mockReset()
  deleteUser.mockClear()
})

describe('inviteUser', () => {
  it('invites a new person', async () => {
    inviteUserByEmail.mockResolvedValueOnce({ data: { user: { id: NEW_ID } }, error: null })
    const r = await invite('new@example.com')
    expect(r.success).toBe(true)
    expect(inviteUserByEmail).toHaveBeenCalledWith('new@example.com', expect.anything())
  })

  it('refuses an email whose account is already in use, without touching it', async () => {
    const r = await invite('RAVI@example.com')
    expect(r).toEqual({ success: false, error: expect.stringMatching(/already has an account that is in use/) })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('invites again someone who never accepted', async () => {
    inviteUserByEmail.mockResolvedValueOnce({ data: { user: { id: PENDING_ID } }, error: null })
    expect((await invite('priya@example.com')).success).toBe(true)
  })

  // The bug this guards against: a failed step after re-inviting an account that
  // already existed used to delete that account.
  it('never deletes an account that existed before, even if a later step fails', async () => {
    inviteUserByEmail.mockResolvedValueOnce({ data: { user: { id: PENDING_ID } }, error: null })
    profileUpdateError = { message: 'boom' }
    const r = await invite('priya@example.com')
    expect(r.success).toBe(false)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('removes an account it has just created if a later step fails', async () => {
    inviteUserByEmail.mockResolvedValueOnce({ data: { user: { id: NEW_ID } }, error: null })
    profileUpdateError = { message: 'boom' }
    const r = await invite('new@example.com')
    expect(r).toEqual({ success: false, error: expect.stringMatching(/Nothing was created/) })
    expect(deleteUser).toHaveBeenCalledWith(NEW_ID)
  })
})

describe('listAccountStatuses', () => {
  it('reports which staff accounts are still waiting on their invite, leaving out guests', async () => {
    const r = await listAccountStatuses()
    expect(r.success && r.statuses.map(s => [s.id, s.state])).toEqual([
      [PENDING_ID, 'invite-pending'],
      [ACTIVE_ID, 'active'],
    ])
  })
})

describe('resendInvite', () => {
  it('sends the invite again to someone who has not accepted it', async () => {
    inviteUserByEmail.mockResolvedValueOnce({ data: { user: { id: PENDING_ID } }, error: null })
    expect(await resendInvite(PENDING_ID)).toEqual({ success: true, email: 'priya@example.com' })
  })

  it('points someone who already accepted to "Forgot password?" instead', async () => {
    const r = await resendInvite(ACTIVE_ID)
    expect(r).toEqual({ success: false, error: expect.stringMatching(/already accepted.*Forgot password/) })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('refuses something that is not a user id', async () => {
    expect(await resendInvite('not-an-id')).toEqual({ success: false, error: 'Invalid user.' })
  })
})
