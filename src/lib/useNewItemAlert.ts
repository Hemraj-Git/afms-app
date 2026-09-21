'use client'

import { useEffect, useRef } from 'react'

// Calls `onNew` when an id shows up that wasn't there before -- but not for what was
// already there when the data first finished loading, so opening or refreshing a page
// never triggers it. One call per change, however many ids arrived together.
export function useNewItemAlert(ids: string[], ready: boolean, onNew: () => void) {
  const seen = useRef<Set<string> | null>(null)
  const onNewRef = useRef(onNew)
  useEffect(() => {
    onNewRef.current = onNew
  })

  useEffect(() => {
    if (!ready) return
    if (seen.current === null) {
      // First moment the data is trustworthy: remember it, say nothing.
      seen.current = new Set(ids)
      return
    }
    const known = seen.current
    let anyNew = false
    for (const id of ids) {
      if (!known.has(id)) {
        known.add(id)
        anyNew = true
      }
    }
    if (anyNew) onNewRef.current()
  }, [ids, ready])
}
