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
