'use server'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/afms'

export type AuthResult =
  | { success: true; profile: { id: string; fullName: string; role: UserRole; department: string; phone: string; email: string } }
  | { success: false; error: string }

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error || !data.user) {
    return { success: false, error: error?.message || 'Incorrect password or email. Please verify credentials.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, department, phone, email')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    return { success: false, error: 'No staff profile is registered for this account. Contact your administrator.' }
  }

  return {
    success: true,
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role as UserRole,
      department: profile.department || '',
      phone: profile.phone || '',
      email: profile.email,
    },
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export type GuestSignInResult =
  | { success: true; profile: { id: string; fullName: string; email: string; phone: string } }
  | { success: false; error: string }

export async function guestSignIn(input: { fullName?: string; email: string; phone: string }): Promise<GuestSignInResult> {
  const supabase = await createClient()

  const fullName = input.fullName?.trim() || 'Guest Visitor'
  const email = input.email.trim()
  const phone = input.phone.trim()

  // `handle_new_user()` (a SECURITY DEFINER trigger on auth.users) auto-creates
  // the matching `profiles` row from this metadata — passing role/full_name/
  // department/phone here means we never need an INSERT policy on `profiles`
  // for guests (none exists; only an own-row UPDATE policy does).
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        full_name: fullName,
        role: 'Guest',
        department: 'Visitor Services',
        phone,
      },
    },
  })
  if (error || !data.user) {
    return { success: false, error: error?.message || 'Could not start a guest session. Please try again.' }
  }

  // Anonymous auth.users rows always have a null email, so the trigger leaves
  // profiles.email null. Fill in the guest's self-reported email as an
  // ordinary authenticated update of their own row.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ email })
    .eq('id', data.user.id)

  if (profileError) {
    return { success: false, error: 'Guest session started, but the visitor profile could not be saved: ' + profileError.message }
  }

  return { success: true, profile: { id: data.user.id, fullName, email, phone } }
}
