// Error monitoring in the browser (desktop and field app). See src/lib/sentry.ts.
import * as Sentry from '@sentry/nextjs'
import { IGNORE_ERRORS, sentryOptions } from '@/lib/sentry'

try {
  Sentry.init({
    ...sentryOptions,
    ignoreErrors: IGNORE_ERRORS,
    // Errors raised inside browser extensions are not ours.
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
    integrations: sentryOptions.tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
  })
} catch {
  // Monitoring must never stop the app from starting.
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
