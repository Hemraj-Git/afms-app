// Product and client branding. AssetNXG is deployed under each client's
// brand: the client's name and logo are set per deployment (build-time
// environment variables, e.g. on Vercel), and lead at the top of the sidebar.
// With none set, the app shows AssetNXG itself.
//
//   NEXT_PUBLIC_CLIENT_NAME            e.g. "School of Maritime Studies, Centurion University"
//   NEXT_PUBLIC_CLIENT_LOGO_URL        wide logo, e.g. "/images/client-logo.png" (put the file in public/images)
//   NEXT_PUBLIC_CLIENT_LOGO_MARK_URL   square mark for the collapsed sidebar, e.g. "/images/client-logo-mark.png"

export const PRODUCT_NAME = 'AssetNXG'
export const PRODUCT_LOGO_URL = '/images/assetnxg-logo.svg'
export const PRODUCT_MARK_URL = '/images/assetnxg-mark.svg'

// Shown in the About dialog: who makes AssetNXG and who runs it.
export const MAKER_NAME = 'Pinnacle Marine Ventures'
export const MAKER_LOGO_URL = '/images/pmv-logo.svg'
export const POWERED_BY_NAME = 'HMS - Digital Solutions'
export const POWERED_BY_LOGO_URL = '/images/hms-logo.svg'

export const SUPPORT_EMAIL = 'support@hemrajmarines.com'
export const SUPPORT_PHONE = '+91 22 6600 4400'

// Set at build time from package.json (see next.config.ts).
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? ''
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? ''

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
