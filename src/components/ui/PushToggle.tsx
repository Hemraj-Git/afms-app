'use client'

import { useEffect, useState } from 'react'
import { BellRing, BellOff, Loader2 } from 'lucide-react'
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push'

// "Alerts when the app is closed" switch for the notification menus (desktop
// bell and the field app's bell). One row: what it does, and its state.

const HELP: Record<PushState, string> = {
  on: 'This device gets alerts even when the app is closed.',
  off: 'Get alerts on this device even when the app is closed.',
  denied: 'Notifications are blocked for this site. Allow them in the browser’s site settings, then try again.',
  'needs-install': 'On iPhone/iPad: Share → Add to Home Screen, open the app from there, then turn this on.',
  unsupported: 'This browser can’t show alerts when the app is closed.',
}

export function PushToggle({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
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

  if (state === null) return null

  const dark = theme === 'dark'
  const canToggle = state === 'on' || state === 'off'

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      setState(state === 'on' ? await disablePush() : await enablePush())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change alerts on this device.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`px-3 py-2.5 flex items-start gap-2.5 ${dark ? 'border-t border-slate-800' : 'border-t border-slate-100'}`}>
      <span className={`mt-0.5 ${state === 'on' ? (dark ? 'text-emerald-400' : 'text-emerald-600') : dark ? 'text-slate-500' : 'text-slate-400'}`}>
        {state === 'on' ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Alerts when the app is closed</p>
        <p className={`text-[10px] leading-snug ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{error ?? HELP[state]}</p>
      </div>
      {canToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={state === 'on'}
          aria-label="Alerts when the app is closed"
          disabled={busy}
          onClick={toggle}
          className={`relative shrink-0 w-9 h-5 rounded-full transition ${
            state === 'on' ? 'bg-emerald-500' : dark ? 'bg-slate-700' : 'bg-slate-300'
          } disabled:opacity-60`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
              state === 'on' ? 'translate-x-4' : ''
            }`}
          >
            {busy && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
          </span>
        </button>
      )}
    </div>
  )
}
