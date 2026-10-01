'use client'

import React from 'react'
import { ChevronRight, KeyRound, LogOut, Smartphone, Volume2 } from 'lucide-react'
import type { UserProfile } from '@/types/afms'
import { playNotificationSound, setSoundEnabled, unlockAudio, useSoundEnabled } from '@/lib/notificationSound'
import { useInstalledApp, usePushSetting } from '@/lib/useFieldDevice'
import { Card, CardTitle, ROLE_ACCENT, SettingRow, Toggle, cn, type FieldRole } from '@/components/field'

const initials = (name: string) =>
  name
    .split(/\s+/)
    // Words that start with a letter, so "[Contract] Ravi Kumar" reads RK.
    .filter(w => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '?'

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-fa-border py-2.5 last:border-b-0">
      <span className="text-sm text-fa-text-2">{label}</span>
      <span className={cn('break-words text-base', value ? 'text-fa-text' : 'italic text-fa-text-3')}>{value || 'Not set'}</span>
    </div>
  )
}

// Profile (redesign canvas, "Profile · Technician" and "Profile · Guest").
export function ProfileScreen({
  user,
  role,
  onChangePassword,
  onSignOut,
}: {
  user: UserProfile
  role: FieldRole
  onChangePassword: () => void
  onSignOut: () => void
}) {
  const guest = role === 'Guest'
  const push = usePushSetting()
  const sound = useSoundEnabled()
  const installed = useInstalledApp()

  const setSound = (on: boolean) => {
    setSoundEnabled(on)
    // Turning it on plays the chime once, so people hear what to expect.
    if (on) {
      unlockAudio()
      playNotificationSound()
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="m-0 text-[26px] font-bold leading-tight">Profile</h1>

      <Card className="flex-row items-center gap-3.5">
        <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold', ROLE_ACCENT[role].badge)} aria-hidden>
          {initials(user.fullName)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[22px] font-bold leading-tight">{user.fullName}</span>
          <span className={cn('inline-flex h-6 w-fit items-center rounded-md px-2 text-[13px] font-semibold', ROLE_ACCENT[role].badge)}>{role}</span>
        </div>
      </Card>

      <Card className="gap-0 py-1.5">
        {guest ? <DetailRow label="Visiting as" value="Visitor" /> : <DetailRow label="Department" value={user.department} />}
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Phone" value={user.phone} />
      </Card>

      <Card>
        <CardTitle>Alerts</CardTitle>
        <SettingRow
          icon={Smartphone}
          title="Alerts when the app is closed"
          description={
            push.state && push.state !== 'on' && push.state !== 'off'
              ? push.help
              : guest
                ? 'Push notifications when your requests change.'
                : 'Push notifications for new work and due inspections.'
          }
        >
          {push.canToggle ? <Toggle label="Alerts when the app is closed" checked={push.state === 'on'} onChange={() => void push.toggle()} disabled={push.busy} /> : null}
        </SettingRow>
        <SettingRow icon={Volume2} title="Sound for new alerts">
          <Toggle label="Sound for new alerts" checked={sound} onChange={setSound} />
        </SettingRow>
      </Card>

      <Card className="gap-0 py-1.5">
        <CardTitle as="h3">Account</CardTitle>
        {!guest ? (
          <button type="button" onClick={onChangePassword} className="flex min-h-14 items-center gap-3 border-b border-fa-border text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-fa-sunken">
              <KeyRound className="h-5 w-5 text-fa-text" strokeWidth={2} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-semibold text-fa-text">Change password</span>
              <span className="text-sm text-fa-text-2">You stay signed in on this phone</span>
            </span>
            <ChevronRight className="h-5 w-5 text-fa-text-2" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button type="button" onClick={onSignOut} className="flex min-h-14 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-fa-danger-weak">
            <LogOut className="h-5 w-5 text-fa-danger" strokeWidth={2} aria-hidden />
          </span>
          <span className="flex-1 text-base font-semibold text-fa-danger">Sign out</span>
        </button>
      </Card>

      <p className="m-0 pb-2 text-center text-sm text-fa-text-3">Field Operations · {installed ? 'installed app' : 'in the browser'}</p>
    </div>
  )
}
