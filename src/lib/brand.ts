// Product and client branding. AssetNXG is deployed under each client's
// brand: the client's name and logo are set per deployment (build-time
// environment variables, e.g. on Vercel), and lead at the top of the sidebar.
// With none set, the app shows AssetNXG itself.
//
//   NEXT_PUBLIC_CLIENT_NAME            e.g. "Hemraj Maritime Training Institute"
//   NEXT_PUBLIC_CLIENT_LOGO_URL        wide logo, e.g. "/images/client-logo.svg" (put the file in public/images)
//   NEXT_PUBLIC_CLIENT_LOGO_MARK_URL   optional square mark for the collapsed sidebar

export const PRODUCT_NAME = 'AssetNXG'

export const CLIENT_NAME = (process.env.NEXT_PUBLIC_CLIENT_NAME ?? '').trim()
export const CLIENT_LOGO_URL = (process.env.NEXT_PUBLIC_CLIENT_LOGO_URL ?? '').trim()
export const CLIENT_LOGO_MARK_URL = (process.env.NEXT_PUBLIC_CLIENT_LOGO_MARK_URL ?? '').trim()

/** Up to two initials, for a square mark when there is no logo. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')
}
