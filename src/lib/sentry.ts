import type { ErrorEvent } from '@sentry/nextjs'

// Error monitoring (Sentry), shared by the browser, the server and the edge.
//
// Only errors leave the app, never the people in them: no names, emails or
// phone numbers (sendDefaultPii off, and anything that slips into a message or
// a breadcrumb is masked below), no IP addresses, cookies or request bodies, and
// no session replay. An error carries the user's id and role, the page, the app
// version and the client site, which is enough to find and fix it.
//
// Sends only from a production build with a DSN (NEXT_PUBLIC_SENTRY_DSN), so
// `npm run dev` stays quiet; a local production build reports as "local".

export const SENTRY_DSN = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? '').trim()

// "production" or "preview" on Vercel (set in next.config.ts), else "local".
export const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_DEPLOY_ENV || 'local'

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
// Indian mobile numbers, with or without +91 and spaces.
const PHONE = /(\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g

export const maskPersonalData = (text: string) => text.replace(EMAIL, '[email]').replace(PHONE, '[phone]')

const maskValues = (data: Record<string, unknown> | undefined) => {
  if (!data) return
  for (const [k, v] of Object.entries(data)) if (typeof v === 'string') data[k] = maskPersonalData(v)
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = maskPersonalData(event.message)
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = maskPersonalData(ex.value)
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = maskPersonalData(crumb.message)
    maskValues(crumb.data)
  }
  if (event.request) {
    delete event.request.cookies
    delete event.request.data
    delete event.request.headers
    if (event.request.url) event.request.url = maskPersonalData(event.request.url)
    if (typeof event.request.query_string === 'string') event.request.query_string = maskPersonalData(event.request.query_string)
  }
  if (event.user) event.user = { id: event.user.id }
  return event
}

// Errors that say nothing about the app: a phone losing signal, a browser
// extension, or a browser quirk.
export const IGNORE_ERRORS: (string | RegExp)[] = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Failed to fetch',
  'NetworkError when attempting to fetch resource',
  'Load failed',
  'The operation was aborted',
  /AbortError/,
  /Non-Error promise rejection captured/,
]

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN) && process.env.NODE_ENV === 'production',
  environment: SENTRY_ENVIRONMENT,
  release: `assetnxg@${process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}`,
  sendDefaultPii: false,
  // A sample of page loads and server requests for speed, in production only.
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 0,
  initialScope: { tags: { client: (process.env.NEXT_PUBLIC_CLIENT_SHORT_NAME ?? '').trim() || 'unknown' } },
  beforeSend: scrubEvent,
}
