'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push'

// Browser state read through useSyncExternalStore: subscribed to, never copied
// into React state from an effect. The server render assumes online / in the
// browser, and the first client render corrects it.

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

// Is this phone online? (navigator.onLine can be wrong in the optimistic
// direction, so a save still reports its own failure.)
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

const STANDALONE = '(display-mode: standalone)'

function subscribeDisplayMode(onChange: () => void) {
  const mq = window.matchMedia?.(STANDALONE)
  mq?.addEventListener?.('change', onChange)
  return () => mq?.removeEventListener?.('change', onChange)
}

const isStandalone = () =>
  !!window.matchMedia?.(STANDALONE).matches ||
  // iOS Safari's own flag for a home-screen app.
  (navigator as Navigator & { standalone?: boolean }).standalone === true

// Whether the app was opened from the home-screen icon rather than a browser tab.
export function useInstalledApp(): boolean {
  return useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false)
}

// "Alerts when the app is closed" (Web Push) for this device: its state, what
// to tell the person about it, and the switch.
export const PUSH_HELP: Record<PushState, string> = {
  on: 'This phone gets alerts even when the app is closed.',
  off: 'Get alerts on this phone even when the app is closed.',
  denied: 'Notifications are blocked for this site. Allow them in the browser’s site settings, then try again.',
  'needs-install': 'On iPhone/iPad: Share › Add to Home Screen, open the app from there, then turn this on.',
  unsupported: 'This browser can’t show alerts when the app is closed.',
}

export function usePushSetting() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getPushState()
      .then(s => alive && setState(s))
      .catch(() => alive && setState('unsupported'))
    return () => {
      alive = false
    }
  }, [])

  const toggle = useCallback(async () => {
    if (state !== 'on' && state !== 'off') return
    setBusy(true)
    setError(null)
    try {
      setState(state === 'on' ? await disablePush() : await enablePush())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change alerts on this phone.')
    } finally {
      setBusy(false)
    }
  }, [state])

  return {
    state,
    busy,
    // Only these two states can be switched; the others need the person to act.
    canToggle: state === 'on' || state === 'off',
    help: error ?? (state ? PUSH_HELP[state] : ''),
    toggle,
  }
}
