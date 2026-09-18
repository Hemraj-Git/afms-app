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

export type RequestPasswordResetResult = { success: true } | { success: false; error: string }

// Always reports success regardless of whether the email matches an account
// -- Supabase itself doesn't error for unknown emails either, so this avoids
// letting the form be used to enumerate registered accounts. Requires the
// Supabase Dashboard's "Reset Password" email template to point at
// /auth/confirm?type=recovery (see /auth/confirm/route.ts), the same way
// the "Invite user" template already points there.
export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email.trim())
  return { success: true }
}

export type GuestSignInResult =
  | { success: true; profile: { id: string; fullName: string; email: string; phone: string } }
  | { success: false; error: string }

export async function guestSignIn(input: { fullName?: string; email: string; phone: string }): Promise<GuestSignInResult> {
  const supabase = await createClient()

  const trimmedName = input.fullName?.trim() || ''
  // Lower-cased so "John@x.com" and "john@x.com" are treated as the same
  // returning guest everywhere history is grouped/matched by email.
  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()

  // `handle_new_user()` (a SECURITY DEFINER trigger on auth.users) auto-creates
  // the matching `profiles` row from this metadata — passing role/full_name/
  // department/phone here means we never need an INSERT policy on `profiles`
  // for guests (none exists; only an own-row UPDATE policy does).
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        full_name: trimmedName || 'Guest Visitor',
        role: 'Guest',
        department: 'Visitor Services',
        phone,
      },
    },
  })
  if (error || !data.user) {
    return { success: false, error: error?.message || 'Could not start a guest session. Please try again.' }
  }

  let fullName = trimmedName || 'Guest Visitor'
  if (!trimmedName) {
    // Returning guest left the Name field blank -- reuse the name from their
    // most recent visit under this same email instead of overwriting it
    // with the generic placeholder (which would also blank out their real
    // name in the Admin Guests tab, grouped by email and showing the latest
    // visit's name).
    const { data: priorVisit } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('email', email)
      .eq('role', 'Guest')
      .neq('id', data.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (priorVisit?.full_name) {
      fullName = priorVisit.full_name
    }
  }

  // Anonymous auth.users rows always have a null email, so the trigger leaves
  // profiles.email null. Fill in the guest's self-reported email (and, when
  // the name was left blank, the reused prior name) as an ordinary
  // authenticated update of their own row.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ email, full_name: fullName })
    .eq('id', data.user.id)

  if (profileError) {
    return { success: false, error: 'Guest session started, but the visitor profile could not be saved: ' + profileError.message }
  }

  return { success: true, profile: { id: data.user.id, fullName, email, phone } }
}
