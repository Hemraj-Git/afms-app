import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key'

// Per the locked product decision: Technician/Housekeeping/Faculty/Guest are
// mobile-PWA-only. Every desktop route is Admin-only except the public ones
// below; everything else (dashboard, assets, categories, inspections,
// inventory, maintenance, organization, reports, reservations,
// service-requests, sub-categories, utility, admin, the root redirect) is
// gated to Admin here rather than maintained as an explicit allowlist, so a
// newly added desktop route is admin-gated by default instead of silently
// falling through as reachable by every role.
const ROLE_UNRESTRICTED_PREFIXES = ['/mobile', '/auth']
// /auth/confirm and /auth/auth-error must be reachable with NO existing
// session — they're how a session gets established (invite/magic-link/
// recovery token exchange) or how a failed exchange gets explained.
// /auth/set-password deliberately isn't public: it requires the session
// /auth/confirm just created, which is what makes this safe from the
// pre-existing-cookie race a client-side-only exchange would have.
const PUBLIC_PATHS = ['/login', '/qr', '/auth/confirm', '/auth/auth-error']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANT: getUser() re-validates the JWT against Supabase Auth on every
  // call — this is the "optimistic but still real" check the Next.js Proxy
  // docs recommend over trusting a decoded cookie/getSession() alone.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const isRoleUnrestricted = ROLE_UNRESTRICTED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (user && !isPublicPath && !isRoleUnrestricted) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role && profile.role !== 'Admin') {
      return NextResponse.redirect(new URL('/mobile', request.url))
    }
  }

  return supabaseResponse
}
