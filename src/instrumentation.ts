// Error monitoring on the server: server actions, route handlers, pages and
// the proxy. See src/lib/sentry.ts.
import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/sentry'

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    try {
      Sentry.init(sentryOptions)
    } catch {
      // Monitoring must never stop the server from starting.
    }
  }
}

// Errors Next.js catches while handling a request.
export const onRequestError = Sentry.captureRequestError
