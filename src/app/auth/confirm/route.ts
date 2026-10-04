import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { PASSWORD_SETUP_COOKIE, passwordSetupCookieOptions } from '@/lib/passwordSetup'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/safeRedirect'

// Server-side exchange for every email-link auth flow (invite, magic link,
// signup confirmation, password recovery). This is the pattern Supabase's
// own Next.js SSR guide documents — the token is exchanged for a session
// entirely on the server, in the same response that redirects onward, so
// there is no window where the browser is showing a stale pre-existing
// session (e.g. an Admin who already had the app open in another tab)
// before the new one takes over. The default Supabase-hosted confirmation
// link relies on client-side JS to pick up the session from a URL hash,
// which races against whatever cookie session the browser already has —
// this route removes that race by doing the whole exchange before any page
// renders.
//
// Requires the "Invite user" (and ideally Magic Link / Confirm signup /
// Reset password) email templates in the Supabase Dashboard to point here:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// instead of the default {{ .ConfirmationURL }}.
// The app only ever sends two kinds of email link: the Admin invite and the
// password reset. `EmailOtpType` also covers magiclink / signup / email_change,
// which nothing here issues, and the cast below buys no safety at all (the type
// is `string & {}` at the edges), so the value is checked against this list
// before it reaches verifyOtp. Adding an email template means adding its type
// here too.
const ALLOWED_TYPES = ['invite', 'recovery'] as const

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = (ALLOWED_TYPES as readonly string[]).includes(rawType ?? '')
    ? (rawType as EmailOtpType)
    : null
  // Attacker-controlled, and this route hands out a session, so it is checked
  // against an allowlist rather than just being a same-site path.
  const next = safeNextPath(searchParams.get('next'))

  // Built from the validated destination only, so the token never travels on
  // to the next page (setting .search replaces the incoming query wholesale).
  const redirectTo = request.nextUrl.clone()
  const [nextPath, nextQuery] = next.split('?')
  redirectTo.pathname = nextPath
  redirectTo.search = nextQuery ? `?${nextQuery}` : ''

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Signed in by the link, but no password chosen yet: kept on Set
      // password until one is (see lib/passwordSetup.ts).
      const response = NextResponse.redirect(redirectTo)
      response.cookies.set(PASSWORD_SETUP_COOKIE, '1', passwordSetupCookieOptions)
      return response
    }
  }

  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/auth/auth-error'
  errorUrl.search = ''
  return NextResponse.redirect(errorUrl)
}
