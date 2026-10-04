'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { friendlyPasswordError, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from '@/lib/authPolicy'
import type { UserRole } from '@/types/afms'
import { exactIlikePattern, normaliseGuestEmail, STAFF_EMAIL_FOR_GUEST } from '@/lib/guestEmail'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key'

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
    // signInWithPassword above already set the session cookie. Without this the
    // app would tell them they had failed while leaving them signed in -- and
    // a session with no profile row is exactly the case the route guard used to
    // wave through onto the Admin desktop (see lib/supabase/middleware.ts).
    await supabase.auth.signOut()
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
  const email = normaliseGuestEmail(input.email)
  const phone = input.phone.trim()

  // A staff member's email can't be used as a guest. Checked before any
  // guest session is started, so a refusal leaves no account behind. Read with
  // the server-side admin client: nobody signed in yet can see profiles.
  try {
    const { data: staff, error: lookupError } = await createAdminClient()
      .from('profiles')
      .select('id')
      .ilike('email', exactIlikePattern(email))
      .neq('role', 'Guest')
      .limit(1)
    if (lookupError) throw new Error(lookupError.message)
    if (staff && staff.length > 0) {
      return { success: false, error: STAFF_EMAIL_FOR_GUEST }
    }
  } catch (e) {
    // Admin client not configured or the lookup failed: let the guest in
    // rather than lock every visitor out; RLS (0054) still keeps a guest from
    // seeing a staff member's requests.
    console.error('Guest sign-in: staff email check skipped:', e instanceof Error ? e.message : e)
  }

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
    // Looked up with the server-side admin client, not the guest's own session:
    // a Guest can only read their own profile row (other guests' rows are
    // deliberately hidden from them), so their session can't see a previous
    // visit's row. Only the name is read, and only ever copied onto the caller's
    // own new profile below.
    try {
      const { data: priorVisit } = await createAdminClient()
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
    } catch {
      // Admin client not configured or lookup failed -- keep the placeholder name.
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

export type ChangePasswordResult =
  | { success: true }
  | { success: false; error: string; field?: 'current' | 'new' }

// A signed-in staff member choosing a new password. Supabase itself would let
// any signed-in session set a new password without knowing the old one, so a
// phone left unlocked could be used to take the account over. The current
// password is therefore checked first -- by signing in with it on a separate,
// throwaway client, so the person's own sign-in is not touched -- and that
// extra sign-in is ended straight away. Then the password is changed on the
// person's own session, so Supabase applies its own rules to it as well.
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email || user.is_anonymous) {
    return { success: false, error: 'Sign in with your staff account to change your password.' }
  }

  if (!passwordMeetsPolicy(newPassword)) {
    return {
      success: false,
      field: 'new',
      error: `The new password needs at least ${PASSWORD_MIN_LENGTH} characters, with a lowercase letter, an uppercase letter, a number and a symbol.`,
    }
  }
  if (newPassword === currentPassword) {
    return { success: false, field: 'new', error: 'The new password must be different from the current one.' }
  }

  const verifier = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: checkError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (checkError) {
    if (checkError.status === 429) {
      return { success: false, field: 'current', error: 'Too many attempts. Wait a few minutes, then try again.' }
    }
    return { success: false, field: 'current', error: 'That is not your current password.' }
  }
  // 'local' ends only the session just made for the check; the default would
  // sign the person out everywhere.
  await verifier.auth.signOut({ scope: 'local' })

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { success: false, field: 'new', error: friendlyPasswordError(error.message) }
  return { success: true }
}
