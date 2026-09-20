'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/afms'

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

  const email = input.email.trim()
  const fullName = input.fullName.trim()
  const phone = input.phone?.trim() || ''

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Admin client is not configured.' }
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

  // handle_new_user() (the SECURITY DEFINER trigger on auth.users insert)
  // auto-creates the matching profiles row from the metadata above — no
  // separate insert needed here.
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
