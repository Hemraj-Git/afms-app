import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/auth/set-password'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    }
  }

  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/auth/auth-error'
  errorUrl.search = ''
  return NextResponse.redirect(errorUrl)
}
