import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Renamed from `middleware` in Next.js 16 — see node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md. This performs the
// "optimistic" auth check only (re-validates the Supabase session cookie on
// every request); every Server Action still independently re-verifies auth,
// since a Proxy matcher excluding a path also skips Server Functions hosted
// on that path.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // sw.js and the manifest are fetched by the browser itself (service worker
    // install/update, app install); a login or role redirect would break them.
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw\\.js$|manifest\\.webmanifest$|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)',
  ],
}
