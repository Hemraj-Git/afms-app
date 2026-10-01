import React from 'react'
import {
  Bell, ClipboardCheck, DoorOpen, Inbox, RefreshCw, ScanLine, Sparkles, UserRound, WifiOff, Wrench, CircleCheck, type LucideIcon,
} from 'lucide-react'
import { cn } from './cn'
import { IconButton } from './Button'

// The frame around every field-app screen: the top bar, the banners under it,
// and the bottom navigation (redesign canvas, "Navigation per role").

export type FieldRole = 'Technician' | 'Housekeeping' | 'Faculty' | 'Guest'

// Each role's accent: its badge in the top bar and its active tab.
export const ROLE_ACCENT: Record<FieldRole, { badge: string; active: string }> = {
  Technician: { badge: 'bg-fa-primary-weak text-fa-primary', active: 'text-fa-primary' },
  Housekeeping: { badge: 'bg-fa-hk-weak text-fa-hk', active: 'text-fa-hk' },
  Faculty: { badge: 'bg-fa-insp-weak text-fa-insp', active: 'text-fa-insp' },
  Guest: { badge: 'bg-fa-guest-weak text-fa-guest', active: 'text-fa-guest' },
}

export function AppBar({
  role,
  unread = 0,
  onBell,
  title = 'Field Operations',
}: {
  role: FieldRole
  unread?: number
  onBell?: () => void
  title?: string
}) {
  return (
    <header className="shrink-0 border-b border-fa-border bg-fa-surface pl-4 pr-2 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="truncate text-[19px] font-bold text-fa-text max-[359px]:text-[17px]">{title}</span>
          <span className={cn('inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[13px] font-semibold', ROLE_ACCENT[role].badge)}>{role}</span>
        </div>
        {onBell ? <IconButton icon={Bell} label="Notifications" badge={unread} onClick={onBell} /> : null}
      </div>
    </header>
  )
}

// Shown on every screen while the person is checked into a room.
export function ActiveRoomBanner({ room, onCheckOut, busy }: { room: string; onCheckOut: () => void; busy?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 bg-fa-primary-strong py-1 pl-4 pr-2 text-white">
      <DoorOpen className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 text-[15px] leading-tight">
        <span className="opacity-85">Active in:</span> <strong className="font-semibold">{room}</strong>
      </div>
      <button
        type="button"
        onClick={onCheckOut}
        disabled={busy}
        className="min-h-11 rounded-[10px] border-[1.5px] border-white/70 px-3.5 text-[15px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
      >
        Check out
      </button>
    </div>
  )
}

// No connection. Nothing is queued on the phone (an honest message, not the
// design's "will sync": saving while offline is not built), so it says that
// changes cannot be saved until the connection is back.
export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="status" className="flex shrink-0 items-center gap-2.5 border-b border-fa-warning-line bg-fa-warning-weak py-1.5 pl-4 pr-2 text-fa-warning-ink">
      <WifiOff className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 text-[15px] leading-tight">
        <strong className="font-semibold">No connection.</strong> You can look around, but nothing can be saved until you are back online.
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex min-h-11 items-center gap-1.5 rounded-[10px] border-[1.5px] border-fa-high bg-fa-surface px-3 text-[15px] font-semibold text-fa-warning-ink"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  )
}

// A short confirmation that floats above the bottom bar, with an optional action.
export function Toast({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-[14px] bg-fa-text py-3 pl-3.5 pr-2.5 text-white shadow-fa-toast">
      <CircleCheck className="h-[22px] w-[22px] shrink-0 text-[#4ADE80]" strokeWidth={2.25} aria-hidden />
      <div className="flex-1 text-base font-medium leading-snug">{children}</div>
      {action && onAction ? (
        <button type="button" onClick={onAction} className="min-h-11 px-2 text-base font-semibold text-[#93C5FD]">
          {action}
        </button>
      ) : null}
    </div>
  )
}

// ---- Bottom navigation ----

export type FieldTab = 'Tasks' | 'Cleaning' | 'Inspections' | 'Scan' | 'Requests' | 'Profile'

interface TabDef {
  tab: FieldTab
  label: string
  icon: LucideIcon
}

const TAB: Record<Exclude<FieldTab, 'Scan'>, TabDef> = {
  Tasks: { tab: 'Tasks', label: 'Tasks', icon: Wrench },
  Cleaning: { tab: 'Cleaning', label: 'Cleaning', icon: Sparkles },
  Inspections: { tab: 'Inspections', label: 'Inspections', icon: ClipboardCheck },
  Requests: { tab: 'Requests', label: 'Requests', icon: Inbox },
  Profile: { tab: 'Profile', label: 'Profile', icon: UserRound },
}

// At most five items with Scan fixed in the centre: the role's own work on the
// left, Requests and Profile on the right. A Guest has only Requests on the
// left. (Admins do not use the field app.)
export function navForRole(role: FieldRole): { left: TabDef[]; right: TabDef[] } {
  switch (role) {
    case 'Technician':
      return { left: [TAB.Tasks, TAB.Inspections], right: [TAB.Requests, TAB.Profile] }
    case 'Housekeeping':
      return { left: [TAB.Cleaning, TAB.Inspections], right: [TAB.Requests, TAB.Profile] }
    case 'Faculty':
      return { left: [TAB.Inspections], right: [TAB.Requests, TAB.Profile] }
    case 'Guest':
      return { left: [TAB.Requests], right: [TAB.Profile] }
  }
}

// Where a role lands when the app opens.
export const homeTab = (role: FieldRole): FieldTab =>
  role === 'Technician' ? 'Tasks' : role === 'Housekeeping' ? 'Cleaning' : role === 'Faculty' ? 'Inspections' : 'Scan'

export function BottomNav({
  role,
  active,
  onChange,
  badges = {},
}: {
  role: FieldRole
  active: FieldTab
  onChange: (tab: FieldTab) => void
  // Counts of OPEN work per tab (notifications live on the bell, not here).
  badges?: Partial<Record<FieldTab, number>>
}) {
  const { left, right } = navForRole(role)
  const accent = ROLE_ACCENT[role].active

  const item = (t: TabDef) => {
    const on = t.tab === active
    const count = badges[t.tab]
    return (
      <button
        key={t.tab}
        type="button"
        aria-current={on ? 'page' : undefined}
        onClick={() => onChange(t.tab)}
        className={cn(
          'relative flex min-h-[60px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-[3px] pt-1.5 text-[13px] max-[389px]:text-[12px]',
          on ? cn('font-bold', accent) : 'font-medium text-fa-text-2',
        )}
      >
        <span className="relative flex">
          <t.icon className="h-6 w-6" strokeWidth={on ? 2.25 : 2} aria-hidden />
          {count ? (
            <span className="absolute -top-1.5 left-3.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-fa-text px-[5px] text-xs font-bold tabular-nums text-white">
              {count > 99 ? '99+' : count}
              <span className="sr-only"> open</span>
            </span>
          ) : null}
        </span>
        <span className="max-w-full truncate">{t.label}</span>
      </button>
    )
  }

  // Measured in IBM Plex Sans: "Inspections" is 71 px (73 px bold) at 13 px. Below
  // 390 px wide the labels drop to 12 px and the Scan column to 76 px, so it still
  // fits on 360 and 375 px phones; narrower than that, a label ends in an ellipsis.
  const scanOn = active === 'Scan'
  return (
    <nav aria-label="Main" className="flex shrink-0 items-stretch border-t border-fa-border bg-fa-surface px-1 pb-[max(8px,env(safe-area-inset-bottom))] shadow-fa-e2">
      <div className="flex min-w-0 flex-1 basis-0">{left.map(item)}</div>
      <div className="flex w-[84px] shrink-0 flex-col items-center gap-0.5 max-[389px]:w-[76px]">
        <button
          type="button"
          aria-label="Scan QR code"
          aria-current={scanOn ? 'page' : undefined}
          onClick={() => onChange('Scan')}
          className="-mt-[22px] flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-fa-primary-strong text-white shadow-fa-scan transition active:scale-95"
        >
          <ScanLine className="h-7 w-7" strokeWidth={2.25} aria-hidden />
        </button>
        <span className={cn('text-[13px] font-bold', scanOn ? 'text-fa-primary-strong' : 'text-fa-primary')}>Scan</span>
      </div>
      <div className="flex min-w-0 flex-1 basis-0">{right.map(item)}</div>
    </nav>
  )
}
