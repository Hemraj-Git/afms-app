// Which routes the proxy lets through, and to whom. Kept apart from
// middleware.ts (which pulls in Supabase and next/server) so the rules
// themselves can be read and tested on their own.

// Reachable with NO session at all.
// - /login, /qr: the way in.
// - /auth/confirm, /auth/auth-error: how a session gets established from an
//   invite / recovery link, and how a failed exchange is explained.
// - /auth/forgot-password: someone who cannot sign in has no session by
//   definition, so gating this behind one made the "Forgot password?" link
//   bounce straight back to /login (fixed 30 Sep). It only takes an email
//   address and asks Supabase to send a reset link; it reads no data.
//
// /auth/set-password is deliberately NOT here: it requires the session
// /auth/confirm just created, which is what makes it safe from the
// pre-existing-cookie race a client-side-only exchange would have.
export const PUBLIC_PATHS = ['/login', '/qr', '/auth/confirm', '/auth/auth-error', '/auth/forgot-password'] as const

// Signed in, but not Admin-only: the field app and the auth screens.
// Every other desktop route is Admin-gated by default (see middleware.ts).
export const ROLE_UNRESTRICTED_PREFIXES = ['/mobile', '/auth'] as const

// A prefix matches the path itself or anything below it -- never a route that
// merely starts with the same letters ('/loginhelp' is not '/login').
function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export const isPublicPath = (pathname: string): boolean => matches(pathname, PUBLIC_PATHS)

export const isRoleUnrestrictedPath = (pathname: string): boolean => matches(pathname, ROLE_UNRESTRICTED_PREFIXES)
