'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { accountStateOf, toAccountStatus, type AccountStatus } from '@/lib/accountState'
import type { UserRole } from '@/types/afms'

type AdminClient = ReturnType<typeof createAdminClient>

// Every sign-in account, page by page (the admin API has no lookup by email).
// Visitors' anonymous guest accounts are left out: they are not staff.
async function allStaffAccounts(admin: AdminClient) {
  const out = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Could not read the accounts: ${error.message}`)
    out.push(...data.users.filter(u => !u.is_anonymous))
    if (data.users.length < 1000) return out
  }
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const wanted = email.trim().toLowerCase()
  return (await allStaffAccounts(admin)).find(u => (u.email ?? '').toLowerCase() === wanted)
}

export type InviteUserResult =
  | {
      success: true
      profile: { id: string; email: string; fullName: string; role: UserRole; department: string; phone: string }
    }
  | { success: false; error: string }

// Creates a REAL Supabase Auth account and sends the person an email invite
// to set their own password — replacing the old "Add User" flow, which only
// ever wrote to local browser state and never created anyone who could
// actually sign in. Requires SUPABASE_SERVICE_ROLE_KEY (see admin.ts).
export async function inviteUser(input: {
  email: string
  fullName: string
  role: UserRole
  department: string
  phone?: string
}): Promise<InviteUserResult> {
  // Re-verify the caller is Admin server-side — never trust the client's
  // role state for a privileged action like this.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'Admin') {
    return { success: false, error: 'Only Admins can add new users.' }
  }

  // The dropdown only offers these four, so this is reachable only by calling
  // the action directly -- but 'Guest' must never be invitable: a Guest cannot
  // afterwards be given a staff role (see updateUserProfile), so such an
  // account would be stuck.
  if (!EDITABLE_ROLES.includes(input.role)) {
    return { success: false, error: 'Invalid role.' }
  }

  const email = input.email.trim()
  const fullName = input.fullName.trim()
  const phone = input.phone?.trim() || ''

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Admin client is not configured.' }
  }

  // Is there already a sign-in account for this email? (Checked on the accounts
  // themselves: a visitor's guest profile can carry the same email without
  // having one.) An account that is still waiting on its invite is simply
  // invited again; one that is in use is not touched.
  let existing: Awaited<ReturnType<typeof findAuthUserByEmail>>
  try {
    existing = await findAuthUserByEmail(admin, email)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not check existing accounts.' }
  }
  if (existing && accountStateOf(existing) === 'active') {
    return {
      success: false,
      error: `${email} already has an account that is in use. Find it in the list to change its details.`,
    }
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role: input.role,
      department: input.department,
      phone,
    },
  })

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Could not send the invite email.' }
  }

  // handle_new_user() (the trigger on the auth.users insert) creates the
  // matching profiles row, but grants nothing a caller asked for: it starts
  // every invited account as 'Faculty'. The real role is applied a moment later
  // by apply_invited_role(), when Supabase stamps invited_at (migration 0048).
  // This write makes that certain rather than relying on the timing, and is
  // what keeps the role right if either trigger is ever changed.
  const { error: profileError } = await admin.from('profiles').update({ role: input.role }).eq('id', data.user.id)
  if (profileError) {
    // An invite sent again to an account that already existed: that account
    // was there before this call, so it is left exactly as it was.
    if (existing) {
      return { success: false, error: `The invite was sent again, but the role could not be updated (${profileError.message}). Check ${email} in the list.` }
    }
    // Don't leave a half-made account behind: the invitee would otherwise exist
    // as a Faculty who was never told about it. Only ever an account this call
    // has just created.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
    return {
      success: false,
      error: cleanupError
        ? `Could not set the role (${profileError.message}), and the half-created account could not be removed. Check Users for "${email}".`
        : `Could not set the role (${profileError.message}). Nothing was created -- please try again.`,
    }
  }

  return {
    success: true,
    profile: {
      id: data.user.id,
      email,
      fullName,
      role: input.role,
      department: input.department,
      phone,
    },
  }
}

export type UserActionResult = { success: true } | { success: false; error: string }

const EDITABLE_ROLES: UserRole[] = ['Admin', 'Faculty', 'Technician', 'Housekeeping']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Same server-side identity check inviteUser does: derive the caller from the
// verified session and read their role fresh -- never trust one sent by the
// client.
async function requireAdmin(): Promise<{ ok: true; callerId: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You must be signed in.' }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'Admin') return { ok: false, error: 'Only Admins can manage users.' }
  return { ok: true, callerId: user.id }
}

// The `profiles` table only allows a user to update their own row and has no
// delete policy, so an Admin's edit of someone else through the browser client
// matched 0 rows and silently did nothing. The write is done here with the
// service-role client instead, after the Admin check above.
export async function updateUserProfile(input: {
  id: string
  fullName?: string
  role?: UserRole
  department?: string
  phone?: string
}): Promise<UserActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!UUID_RE.test(input.id)) {
    return { success: false, error: 'This is a demo record, not a real account, so it cannot be changed.' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Admin client is not configured.' }
  }

  const { data: target } = await admin.from('profiles').select('id, role').eq('id', input.id).maybeSingle()
  if (!target) return { success: false, error: 'User not found.' }

  const updates: Record<string, string> = {}
  if (input.fullName !== undefined) {
    const name = input.fullName.trim()
    if (!name) return { success: false, error: 'Full name is required.' }
    updates.full_name = name
  }
  if (input.department !== undefined) updates.department = input.department.trim()
  if (input.phone !== undefined) updates.phone = input.phone.trim()

  if (input.role !== undefined && input.role !== target.role) {
    if (!EDITABLE_ROLES.includes(input.role)) return { success: false, error: 'Invalid role.' }
    if (target.role === 'Guest') {
      return { success: false, error: 'Guest visitor accounts cannot be given a staff role.' }
    }
    if (target.role === 'Admin') {
      if (input.id === auth.callerId) {
        return { success: false, error: 'You cannot remove your own Admin role.' }
      }
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Admin')
      if ((count ?? 0) <= 1) return { success: false, error: 'At least one Admin must remain.' }
    }
    updates.role = input.role
  }

  if (Object.keys(updates).length === 0) return { success: true }

  const { data, error } = await admin.from('profiles').update(updates).eq('id', input.id).select('id')
  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: false, error: 'User not found.' }
  return { success: true }
}

// Deleting the auth user cascades to their profile and notifications. It is
// blocked by any service request they raised (no cascade, deliberately -- that
// history shouldn't disappear), so check for that first and say so plainly.
export async function deleteUserAccount(id: string): Promise<UserActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!UUID_RE.test(id)) {
    return { success: false, error: 'This is a demo record, not a real account, so it cannot be deleted.' }
  }
  if (id === auth.callerId) return { success: false, error: 'You cannot delete your own account.' }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Admin client is not configured.' }
  }

  const { data: target } = await admin.from('profiles').select('id, role').eq('id', id).maybeSingle()
  if (!target) return { success: false, error: 'User not found.' }

  if (target.role === 'Admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Admin')
    if ((count ?? 0) <= 1) return { success: false, error: 'At least one Admin must remain.' }
  }

  const { count: requestCount } = await admin
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by_user_id', id)
  if ((requestCount ?? 0) > 0) {
    return {
      success: false,
      error: `This user raised ${requestCount} service request${requestCount === 1 ? '' : 's'}, so the account can't be deleted without losing that history.`,
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export type AccountStatusesResult = { success: true; statuses: AccountStatus[] } | { success: false; error: string }

// Which staff accounts are still waiting on their invite, for the Users list
// and the "assign to" dropdowns. Admin only: it reads the sign-in accounts
// themselves (with the service-role key), which no browser can.
export async function listAccountStatuses(): Promise<AccountStatusesResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  try {
    const accounts = await allStaffAccounts(createAdminClient())
    return { success: true, statuses: accounts.map(toAccountStatus) }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not read the accounts.' }
  }
}

export type ResendInviteResult = { success: true; email: string } | { success: false; error: string }

// Sends the invite email again to someone who has not accepted it yet (the
// link lasts 12 hours, and people miss emails). Supabase allows this only for
// an account that has never been confirmed; one that is in use is refused here
// first, with a pointer to "Forgot password?".
export async function resendInvite(userId: string): Promise<ResendInviteResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!UUID_RE.test(userId)) return { success: false, error: 'Invalid user.' }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Admin client is not configured.' }
  }

  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return { success: false, error: error?.message || 'That account no longer exists.' }
  const user = data.user
  if (!user.email) return { success: false, error: 'This account has no email address to send an invite to.' }
  if (accountStateOf(user) === 'active') {
    return {
      success: false,
      error: user.invited_at
        ? `${user.email} has already accepted the invite. If they have forgotten the password, they can use "Forgot password?" on the sign-in page.`
        : `${user.email} was not added by invite; they can use "Forgot password?" on the sign-in page to set a password.`,
    }
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(user.email, { data: user.user_metadata })
  if (inviteError) return { success: false, error: `Could not resend the invite: ${inviteError.message}` }
  return { success: true, email: user.email }
}
