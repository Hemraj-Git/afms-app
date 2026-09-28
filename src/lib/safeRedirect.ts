// Where the app is allowed to send someone after signing in or after following
// an email link. Both destinations come from the query string (`?redirect=` on
// /login, `?next=` on /auth/confirm), so neither can be trusted as-is.
//
// Plain module on purpose -- no 'use server', no 'server-only' -- so the login
// page (a Client Component) and the confirm route handler can both use it.

// Anything that is not a path on this same site is refused. That means:
// a single leading slash (`//host` and `/\host` are protocol-relative, i.e.
// another site), no backslashes, and no control characters or spaces, which
// browsers strip and which can therefore smuggle a different target through.
function isSameSitePath(value: string): boolean {
  if (!value.startsWith('/')) return false
  if (value.startsWith('//') || value.startsWith('/\\')) return false
  if (value.includes('\\')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return false
  return true
}

/**
 * The query string is kept: a QR scan really does arrive as
 * `/mobile?type=room&id=<uuid>`, and dropping it would break guest check-in.
 * Any fragment is dropped, since the server never needs it.
 */
export function safeRedirectPath(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string' || !isSameSitePath(value)) return fallback
  try {
    // Resolving against a dummy origin normalises the path and guarantees the
    // result can never carry a host of its own.
    const url = new URL(value, 'http://localhost')
    return `${url.pathname}${url.search}`
  } catch {
    return fallback
  }
}

// /auth/confirm hands out a real session, so its destination is an allowlist
// rather than a shape check.
const CONFIRM_DESTINATIONS = ['/auth/set-password', '/mobile', '/dashboard']

export function safeNextPath(value: string | null | undefined): string {
  const fallback = '/auth/set-password'
  if (typeof value !== 'string') return fallback
  const path = safeRedirectPath(value, fallback)
  const [pathname] = path.split('?')
  return CONFIRM_DESTINATIONS.includes(pathname) ? path : fallback
}
