'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, Eye, LogOut, Undo2 } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { AppNotification, UserRole } from '@/types/afms'
import { openWorkCounts } from '@/lib/fieldWork'
import { useOnline } from '@/lib/useFieldDevice'
import {
  ActiveRoomBanner, AppBar, BottomNav, ConfirmSheet, ListSkeleton, OfflineBanner, Toast, cn, homeTab, navForRole, type FieldRole, type FieldTab,
} from '@/components/field'
import { ProfileScreen } from './_screens/ProfileScreen'
import { NotificationsScreen } from './_screens/NotificationsScreen'
import { ChangePasswordSheet } from './_screens/ChangePasswordSheet'
import { ComingSoon } from './_screens/ComingSoon'
import { TasksScreen } from './_screens/TasksScreen'
import { WorkOrderScreen } from './_screens/workOrder/WorkOrderScreen'

// The redesigned field app (light theme), built at /mobile/v2 beside the live
// app at /mobile until every screen is done, then switched over.

const FIELD_ROLES: FieldRole[] = ['Technician', 'Housekeeping', 'Faculty', 'Guest']
const asFieldRole = (r: UserRole): FieldRole => (FIELD_ROLES as string[]).includes(r) ? (r as FieldRole) : 'Guest'

// A screen opened over the tabs. Opening one adds a browser history entry, so
// the phone's back button closes it the same way the screen's Back does.
type Screen = { kind: 'notifications' } | { kind: 'workOrder'; id: string }

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
  const [screen, setScreen] = useState<Screen | null>(null)
  const screenRef = useRef<Screen | null>(null)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])
  // Set by a screen with unsaved changes, so leaving it asks first.
  const dirtyRef = useRef(false)
  const [askLeave, setAskLeave] = useState(false)

  const openScreen = useCallback((next: Screen) => {
    dirtyRef.current = false
    if (screenRef.current) window.history.replaceState({ fieldScreen: true }, '')
    else window.history.pushState({ fieldScreen: true }, '')
    setScreen(next)
  }, [])
  const goBack = useCallback(() => window.history.back(), [])
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  useEffect(() => {
    const onPop = () => {
      if (!screenRef.current) return
      if (dirtyRef.current) {
        // Stay put and ask; "Leave" goes back again.
        window.history.pushState({ fieldScreen: true }, '')
        setAskLeave(true)
        return
      }
      setScreen(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // A role change (Admin preview) starts on that role's home.
  const lastRole = useRef(role)
  useEffect(() => {
    if (lastRole.current !== role) {
      lastRole.current = role
      setTab(homeTab(role))
      if (screenRef.current) {
        dirtyRef.current = false
        window.history.back()
      }
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

  // Opening a notification marks it read and goes to the work it is about:
  // straight to the job when it is one of the technician's work orders.
  const openNotification = (n: AppNotification) => {
    if (!n.isRead) markNotificationRead(n.id)
    if (role === 'Technician' && n.refTable === 'work_orders' && n.refId && workOrders.some(w => w.id === n.refId && w.type !== 'Housekeeping')) {
      openScreen({ kind: 'workOrder', id: n.refId })
      return
    }
    const target: FieldTab =
      n.type === 'inspection_assigned' ? 'Inspections' : n.type === 'auto_checkout' ? 'Scan' : role === 'Housekeeping' ? 'Cleaning' : 'Tasks'
    setTab(tabsForRole.has(target) ? target : homeTab(role))
    goBack()
  }

  const markAllRead = () => notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id))

  const signOut = () => {
    logout()
    router.push('/login')
  }

  const content = (() => {
    if (isDataLoading) return <div className="p-4"><ListSkeleton count={3} label="Loading your work" /></div>
    if (tab === 'Tasks') return <TasksScreen onOpen={wo => openScreen({ kind: 'workOrder', id: wo.id })} />
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

        {screen?.kind === 'workOrder' ? (
          <WorkOrderScreen
            workOrderId={screen.id}
            onBack={goBack}
            onDirtyChange={setDirty}
            onToast={showToast}
            onSaved={text => {
              dirtyRef.current = false
              showToast(text)
              goBack()
            }}
          />
        ) : screen?.kind === 'notifications' ? (
          <NotificationsScreen
            notifications={notifications}
            workOrders={workOrders}
            inspections={inspections}
            onBack={goBack}
            backLabel={`Back to ${TAB_LABEL[homeTab(role)]}`}
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
          />
        ) : (
          <>
            <AppBar role={role} unread={unreadNotificationCount} onBell={() => openScreen({ kind: 'notifications' })} />
            {!online ? <OfflineBanner onRetry={() => void reloadData()} /> : null}
            {activeCheckIn ? <ActiveRoomBanner room={activeCheckIn.roomName} onCheckOut={() => setConfirmCheckout(true)} busy={checkingOut} /> : null}
            <main className="min-h-0 flex-1 overflow-y-auto">{content}</main>
            <BottomNav role={role} active={tab} onChange={setTab} badges={{ Tasks: counts.Tasks, Cleaning: counts.Cleaning, Inspections: counts.Inspections }} />
          </>
        )}

        {toast ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-3 z-40',
              // Above the bottom nav, or above a job's save buttons.
              screen?.kind === 'workOrder' ? 'bottom-[calc(150px+env(safe-area-inset-bottom))]' : 'bottom-[calc(104px+env(safe-area-inset-bottom))]',
            )}
          >
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

      {askLeave ? (
        <ConfirmSheet
          title="Leave without saving?"
          body="Your changes to this work order will be lost."
          icon={Undo2}
          tone="destructive"
          confirmLabel="Leave without saving"
          onConfirm={() => {
            setAskLeave(false)
            dirtyRef.current = false
            window.history.back()
          }}
          onCancel={() => setAskLeave(false)}
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
