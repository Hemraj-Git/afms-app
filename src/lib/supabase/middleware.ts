import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath, isRoleUnrestrictedPath } from '@/lib/routeAccess'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key'

// Per the locked product decision: Technician/Housekeeping/Faculty/Guest are
// mobile-PWA-only. Every desktop route is Admin-only except the public ones
// listed in routeAccess.ts; everything else (dashboard, assets, categories,
// inspections, inventory, maintenance, organization, reports, reservations,
// service-requests, sub-categories, utility, admin, the root redirect) is
// gated to Admin here rather than maintained as an explicit allowlist, so a
// newly added desktop route is admin-gated by default instead of silently
// falling through as reachable by every role.

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
  const isPublic = isPublicPath(pathname)

  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isPublic && !isRoleUnrestrictedPath(pathname)) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // A failed read is a transient problem, not an answer: send them somewhere
    // they can retry cleanly rather than guessing at their role.
    if (error) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Only an explicit 'Admin' continues onto a desktop route. This used to
    // read `profile?.role && profile.role !== 'Admin'`, which let a session
    // whose profile row was missing fall straight through to the Admin pages.
    if (profile?.role !== 'Admin') {
      return NextResponse.redirect(new URL('/mobile', request.url))
    }
  }

  return supabaseResponse
}
