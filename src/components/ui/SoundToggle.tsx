'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { playNotificationSound, setSoundEnabled, unlockAudio, useSoundEnabled } from '@/lib/notificationSound'

// The speaker button inside a notification menu: turns the chime on or off (kept per
// browser). Turning it on plays the chime once, so people hear what to expect.
export function SoundToggle({ className = '' }: { className?: string }) {
  const enabled = useSoundEnabled()

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled
        setSoundEnabled(next)
        if (next) {
          unlockAudio()
          playNotificationSound()
        }
      }}
      aria-pressed={enabled}
      title={enabled ? 'Notification sound on (click to mute)' : 'Notification sound off (click to turn on)'}
      className={`p-1.5 rounded-lg transition ${className}`}
    >
      {enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      <span className="sr-only">{enabled ? 'Mute notification sound' : 'Turn on notification sound'}</span>
    </button>
  )
}
