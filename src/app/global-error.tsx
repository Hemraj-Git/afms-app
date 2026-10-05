'use client'

// Shown when a page crashes while rendering, in place of Next's bare error
// screen. The error is reported to Sentry. It replaces the root layout, so it
// brings its own <html>, <body> and styles.
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#0f172a', padding: 16 }}>
        <title>Something went wrong | AssetNXG</title>
        <main style={{ maxWidth: 420, width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand file */}
          <img src="/images/assetnxg-logo.svg" alt="AssetNXG" style={{ height: 28, marginBottom: 20 }} />
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '0 0 20px' }}>
            The page couldn&apos;t be shown. The problem has been reported. Try again, and if it keeps happening, email support@assetnxg.app.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button type="button" onClick={() => retry()} style={{ padding: '9px 16px', borderRadius: 8, border: 0, background: '#1d4ed8', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point after a crash */}
            <a href="/" style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #cbd5e1', color: '#334155', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Go to the start
            </a>
          </div>
          {error.digest ? <p style={{ fontSize: 11, color: '#94a3b8', margin: '18px 0 0' }}>Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  )
}
