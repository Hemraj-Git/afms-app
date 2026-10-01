'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, Eye, LogOut } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { AppNotification, UserRole } from '@/types/afms'
import { openWorkCounts } from '@/lib/fieldWork'
import { useOnline } from '@/lib/useFieldDevice'
import {
  ActiveRoomBanner, AppBar, BottomNav, ConfirmSheet, ListSkeleton, OfflineBanner, Toast, homeTab, navForRole, type FieldRole, type FieldTab,
} from '@/components/field'
import { ProfileScreen } from './_screens/ProfileScreen'
import { NotificationsScreen } from './_screens/NotificationsScreen'
import { ChangePasswordSheet } from './_screens/ChangePasswordSheet'
import { ComingSoon } from './_screens/ComingSoon'

// The redesigned field app (light theme), built at /mobile/v2 beside the live
// app at /mobile until every screen is done, then switched over.

const FIELD_ROLES: FieldRole[] = ['Technician', 'Housekeeping', 'Faculty', 'Guest']
const asFieldRole = (r: UserRole): FieldRole => (FIELD_ROLES as string[]).includes(r) ? (r as FieldRole) : 'Guest'

const TAB_LABEL: Record<FieldTab, string> = {
  Tasks: 'tasks',
  Cleaning: 'cleaning',
  Inspections: 'inspections',
  Scan: 'scan',
  Requests: 'requests',
  Profile: 'profile',
}

export function FieldApp() {
  const router = useRouter()
  const {
    currentUser, logout, workOrders, inspections, notifications, unreadNotificationCount, markNotificationRead, activeCheckIn, checkOutRoom,
    isDataLoading, reloadData,
  } = useAFMS()

  // Admins do not use the field app. While it is being built, an Admin can
  // preview it as any role (the live /mobile sends Admins to the desktop).
  const isAdmin = currentUser.role === 'Admin'
  const [previewRole, setPreviewRole] = useState<FieldRole>('Technician')
  const role: FieldRole = isAdmin ? previewRole : asFieldRole(currentUser.role)

  const [tab, setTab] = useState<FieldTab>(() => homeTab(role))
  const [screen, setScreen] = useState<'tabs' | 'notifications'>('tabs')
  // A role change (Admin preview) starts on that role's home.
  const lastRole = useRef(role)
  useEffect(() => {
    if (lastRole.current !== role) {
      lastRole.current = role
      setTab(homeTab(role))
      setScreen('tabs')
    }
  }, [role])

  const online = useOnline()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }, [])
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const counts = useMemo(() => openWorkCounts(workOrders, inspections, currentUser), [workOrders, inspections, currentUser])
  const tabsForRole = useMemo(() => {
    const { left, right } = navForRole(role)
    return new Set<FieldTab>([...left, ...right].map(t => t.tab).concat('Scan'))
  }, [role])

  const doCheckOut = async () => {
    if (!activeCheckIn) return
    setCheckingOut(true)
    try {
      await checkOutRoom(activeCheckIn.roomId)
      setConfirmCheckout(false)
      showToast(`Checked out of ${activeCheckIn.roomName}`)
    } finally {
      setCheckingOut(false)
    }
  }

  // Opening a notification marks it read and goes to the work it is about.
  const openNotification = (n: AppNotification) => {
    if (!n.isRead) markNotificationRead(n.id)
    const target: FieldTab =
      n.type === 'inspection_assigned' ? 'Inspections' : n.type === 'auto_checkout' ? 'Scan' : role === 'Housekeeping' ? 'Cleaning' : 'Tasks'
    setTab(tabsForRole.has(target) ? target : homeTab(role))
    setScreen('tabs')
  }

  const markAllRead = () => notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id))

  const signOut = () => {
    logout()
    router.push('/login')
  }

  const content = (() => {
    if (isDataLoading) return <div className="p-4"><ListSkeleton count={3} label="Loading your work" /></div>
    if (tab === 'Profile') {
      return <ProfileScreen user={currentUser} role={role} onChangePassword={() => setChangingPassword(true)} onSignOut={() => setConfirmSignOut(true)} />
    }
    return <ComingSoon tab={tab} />
  })()

  return (
    <div className="flex h-dvh justify-center bg-fa-bg">
      <div className="relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-fa-bg sm:border-x sm:border-fa-border">
        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-2 bg-fa-text px-4 py-1.5 text-sm text-white">
            <Eye className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <label htmlFor="preview-role" className="flex-1">Admin preview — view as</label>
            <select
              id="preview-role"
              value={previewRole}
              onChange={e => setPreviewRole(e.target.value as FieldRole)}
              className="min-h-9 rounded-md bg-white/15 px-2 text-sm font-semibold text-white"
            >
              {FIELD_ROLES.map(r => (
                <option key={r} value={r} className="text-fa-text">
                  {r}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {screen === 'notifications' ? (
          <NotificationsScreen
            notifications={notifications}
            workOrders={workOrders}
            inspections={inspections}
            onBack={() => setScreen('tabs')}
            backLabel={`Back to ${TAB_LABEL[homeTab(role)]}`}
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
          />
        ) : (
          <>
            <AppBar role={role} unread={unreadNotificationCount} onBell={() => setScreen('notifications')} />
            {!online ? <OfflineBanner onRetry={() => void reloadData()} /> : null}
            {activeCheckIn ? <ActiveRoomBanner room={activeCheckIn.roomName} onCheckOut={() => setConfirmCheckout(true)} busy={checkingOut} /> : null}
            <main className="min-h-0 flex-1 overflow-y-auto">{content}</main>
            <BottomNav role={role} active={tab} onChange={setTab} badges={{ Tasks: counts.Tasks, Cleaning: counts.Cleaning, Inspections: counts.Inspections }} />
          </>
        )}

        {toast ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-[calc(104px+env(safe-area-inset-bottom))] z-40">
            <div className="pointer-events-auto">
              <Toast>{toast}</Toast>
            </div>
          </div>
        ) : null}
      </div>

      {confirmCheckout && activeCheckIn ? (
        <ConfirmSheet
          title={`Check out of ${activeCheckIn.roomName}?`}
          body="The room shows as free again once everyone has checked out."
          icon={DoorOpen}
          confirmLabel="Check out"
          onConfirm={() => void doCheckOut()}
          onCancel={() => setConfirmCheckout(false)}
          busy={checkingOut}
        />
      ) : null}

      {confirmSignOut ? (
        <ConfirmSheet
          title="Sign out?"
          body={
            role === 'Guest'
              ? 'To come back, scan a room’s QR code or use Guest access with the same email.'
              : 'You’ll need your email and password to sign back in.'
          }
          icon={LogOut}
          tone="destructive"
          confirmLabel="Sign out"
          onConfirm={signOut}
          onCancel={() => setConfirmSignOut(false)}
        />
      ) : null}

      {changingPassword ? (
        <ChangePasswordSheet
          onClose={() => setChangingPassword(false)}
          onDone={() => {
            setChangingPassword(false)
            showToast('Password changed. You’re still signed in on this phone.')
          }}
        />
      ) : null}
    </div>
  )
}
