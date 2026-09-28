'use client'

import { useEffect } from 'react'

// Lets the header search open a list page with its search box already filled
// (`/service-requests?q=SR-2026-0012`). Reads `?q=` once when the page mounts,
// and also hears the palette when it targets the page that is already open
// (the page doesn't remount then). Read from `window` rather than
// useSearchParams so the pages need no Suspense boundary.

export const SEARCH_PREFILL_EVENT = 'afms:search-prefill'

export interface SearchPrefillDetail {
  pathname: string
  q: string
}

export function useSearchPrefill(apply: (q: string) => void) {
  useEffect(() => {
    let q: string | null = null
    try {
      q = new URLSearchParams(window.location.search).get('q')
    } catch {
      /* no query string to read */
    }
    if (q) apply(q)

    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent<SearchPrefillDetail>).detail
      if (detail && detail.pathname === window.location.pathname) apply(detail.q)
    }
    window.addEventListener(SEARCH_PREFILL_EVENT, onPrefill)
    return () => window.removeEventListener(SEARCH_PREFILL_EVENT, onPrefill)
    // Once per mount: `apply` is usually a fresh closure over setState each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// Called by the palette when it opens a link to the page already on screen.
export function announceSearchPrefill(pathname: string, q: string) {
  window.dispatchEvent(new CustomEvent<SearchPrefillDetail>(SEARCH_PREFILL_EVENT, { detail: { pathname, q } }))
}
