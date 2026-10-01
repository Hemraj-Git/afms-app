'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, DoorOpen, LogOut, Monitor, RefreshCw, Undo2 } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { AppNotification, UserRole } from '@/types/afms'
import { openWorkCounts } from '@/lib/fieldWork'
import { parseScan } from '@/lib/fieldRequests'
import { useOnline } from '@/lib/useFieldDevice'
import { dismissToast, subscribeToasts, type ToastItem } from '@/lib/toast'
import {
  ActiveRoomBanner, AppBar, BottomNav, Button, Card, ConfirmSheet, EmptyState, ListSkeleton, OfflineBanner, Toast, cn, homeTab, navForRole,
  type FieldRole, type FieldTab,
} from '@/components/field'
import { ProfileScreen } from './_screens/ProfileScreen'
import { NotificationsScreen } from './_screens/NotificationsScreen'
import { ChangePasswordSheet } from './_screens/ChangePasswordSheet'
import { TasksScreen } from './_screens/TasksScreen'
import { WorkOrderScreen } from './_screens/workOrder/WorkOrderScreen'
import { CleaningScreen } from './_screens/CleaningScreen'
import { InspectionsScreen } from './_screens/InspectionsScreen'
import { InspectionScreen } from './_screens/inspection/InspectionScreen'
import { ScanScreen } from './_screens/scan/ScanScreen'
import { PickScreen } from './_screens/scan/PickScreen'
import { RoomScreen } from './_screens/scan/RoomScreen'
import { AssetScreen } from './_screens/scan/AssetScreen'
import { RequestsScreen } from './_screens/requests/RequestsScreen'
import { RequestScreen } from './_screens/requests/RequestScreen'
import { NewRequestScreen } from './_screens/requests/NewRequestScreen'
import { RequestSuccessScreen } from './_screens/requests/RequestSuccessScreen'

// The field app at /mobile: Technician, Housekeeping, Faculty and Guest on a
// phone (light theme, redesign canvas "AFMS Field Operations - Mobile").

const FIELD_ROLES: FieldRole[] = ['Technician', 'Housekeeping', 'Faculty', 'Guest']
const asFieldRole = (r: UserRole): FieldRole => (FIELD_ROLES as string[]).includes(r) ? (r as FieldRole) : 'Guest'

// Screens opened over the tabs, as a stack. Each one opened adds a browser
// history entry (its depth in the stack), so the phone's back button and the
// screen's Back do the same thing.
type Screen =
  | { kind: 'notifications' }
  | { kind: 'workOrder'; id: string }
  | { kind: 'inspection'; id: string }
  | { kind: 'pick'; what: 'room' | 'asset' }
  | { kind: 'room'; id: string }
  | { kind: 'asset'; id: string }
  | { kind: 'request'; id: string }
  | { kind: 'newRequest'; roomId?: string; assetId?: string }
  | { kind: 'requestSuccess'; id: string }

// Screens with save buttons pinned to the bottom: the toast sits above them.
const WITH_ACTION_BAR = new Set<Screen['kind']>(['workOrder', 'inspection', 'newRequest'])

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
    currentUser, logout, workOrders, inspections, serviceRequests, notifications, unreadNotificationCount, markNotificationRead, activeCheckIn, checkOutRoom,
    isDataLoading, dataLoadError, reloadData,
  } = useAFMS()

  // Admins use the desktop (the proxy sends them there; see the notice below
  // for the rare case it could not tell).
  const isAdmin = currentUser.role === 'Admin'
  const role: FieldRole = asFieldRole(currentUser.role)

  const [tab, setTab] = useState<FieldTab>(() => homeTab(role))
  const [stack, setStack] = useState<Screen[]>([])
  const stackRef = useRef<Screen[]>([])
  useEffect(() => {
    stackRef.current = stack
  }, [stack])
  const screen = stack.length ? stack[stack.length - 1] : null

  // Set by a screen with unsaved changes, so leaving it asks first.
  const dirtyRef = useRef(false)
  const [askLeave, setAskLeave] = useState(false)

  const openScreen = useCallback((next: Screen, opts: { replace?: boolean } = {}) => {
    dirtyRef.current = false
    const s = stackRef.current
    const nextStack = opts.replace && s.length ? [...s.slice(0, -1), next] : [...s, next]
    if (opts.replace && s.length) window.history.replaceState({ fieldDepth: nextStack.length }, '')
    else window.history.pushState({ fieldDepth: nextStack.length }, '')
    stackRef.current = nextStack
    setStack(nextStack)
  }, [])
  const goBack = useCallback(() => window.history.back(), [])
  // Back to the tabs, whatever is open.
  const closeAll = useCallback(() => {
    const n = stackRef.current.length
    if (n) window.history.go(-n)
  }, [])
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = stackRef.current
      const depth = typeof e.state?.fieldDepth === 'number' ? e.state.fieldDepth : 0
      if (depth >= s.length) return
      if (dirtyRef.current) {
        // Stay put and ask; "Leave" goes back again.
        window.history.pushState({ fieldDepth: s.length }, '')
        setAskLeave(true)
        return
      }
      stackRef.current = s.slice(0, depth)
      setStack(stackRef.current)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Opened from a room's or an asset's QR code (/mobile?type=room&id=…): show
  // it once the data is in, and take the code out of the address.
  const qrChecked = useRef(false)
  useEffect(() => {
    if (qrChecked.current || isDataLoading) return
    qrChecked.current = true
    const target = parseScan(window.location.href, window.location.origin)
    if (!target) return
    window.history.replaceState(window.history.state, '', window.location.pathname)
    openScreen(target.type === 'room' ? { kind: 'room', id: target.id } : { kind: 'asset', id: target.id })
  }, [isDataLoading, openScreen])

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
  // Messages from the shared data layer ("could not save …"), shown in this
  // app's style rather than the desktop's corner pop-ups.
  const [shared, setShared] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setShared), [])

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

  // Opening a notification marks it read and goes to what it is about.
  const openNotification = (n: AppNotification) => {
    if (!n.isRead) markNotificationRead(n.id)
    if (n.refTable === 'work_orders' && n.refId && workOrders.some(w => w.id === n.refId)) {
      openScreen({ kind: 'workOrder', id: n.refId }, { replace: true })
      return
    }
    if (n.refTable === 'inspections' && n.refId && inspections.some(i => i.id === n.refId)) {
      openScreen({ kind: 'inspection', id: n.refId }, { replace: true })
      return
    }
    if (n.refTable === 'service_requests' && n.refId) {
      openScreen({ kind: 'request', id: n.refId }, { replace: true })
      return
    }
    const target: FieldTab =
      n.type === 'due_today' ? (role === 'Technician' ? 'Tasks' : 'Inspections')
      : n.type === 'inspection_assigned' ? 'Inspections' : n.type === 'auto_checkout' ? 'Scan' : role === 'Housekeeping' ? 'Cleaning' : 'Tasks'
    setTab(tabsForRole.has(target) ? target : homeTab(role))
    goBack()
  }

  const markAllRead = () => notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id))

  const signOut = () => {
    logout()
    router.push('/login')
  }

  const openWork = (id: string) => openScreen({ kind: 'workOrder', id })
  const openRoom = (id: string, replace = false) => openScreen({ kind: 'room', id }, { replace })
  const openAsset = (id: string, replace = false) => openScreen({ kind: 'asset', id }, { replace })

  const tabContent = renderTab()
  const content = (() => {
    if (isDataLoading) return <div className="p-4"><ListSkeleton count={3} label="Loading your work" /></div>
    if (!dataLoadError) return tabContent
    return (
      <>
        <div className="px-4 pt-4">
          <Card className="flex-row items-start gap-3 border-fa-warning-weak bg-fa-warning-weak">
            <CloudOff className="mt-0.5 h-6 w-6 shrink-0 text-fa-warning-ink" strokeWidth={2} aria-hidden />
            <div className="flex flex-1 flex-col gap-2">
              <p className="m-0 text-base font-semibold text-fa-warning-ink">Some of your work didn’t load</p>
              <p className="m-0 text-[15px] text-fa-warning-ink">Lists may look empty even though there is work. Check your signal and try again.</p>
              <Button size="md" variant="secondary" block={false} icon={RefreshCw} onClick={() => void reloadData()}>
                Try again
              </Button>
            </div>
          </Card>
        </div>
        {tabContent}
      </>
    )
  })()

  function renderTab() {
    if (tab === 'Tasks') return <TasksScreen onOpen={wo => openWork(wo.id)} />
    if (tab === 'Cleaning') return <CleaningScreen onOpen={wo => openWork(wo.id)} />
    if (tab === 'Inspections') return <InspectionsScreen onOpen={insp => openScreen({ kind: 'inspection', id: insp.id })} />
    if (tab === 'Scan') {
      return (
        <ScanScreen
          onFound={t => (t.type === 'room' ? openRoom(t.id) : openAsset(t.id))}
          onPick={what => openScreen({ kind: 'pick', what })}
          onNotOurs={() => showToast('That QR code is not a room or asset label from this site.')}
        />
      )
    }
    if (tab === 'Requests') return <RequestsScreen onOpen={id => openScreen({ kind: 'request', id })} onNew={() => openScreen({ kind: 'newRequest' })} />
    return <ProfileScreen user={currentUser} role={role} onChangePassword={() => setChangingPassword(true)} onSignOut={() => setConfirmSignOut(true)} />
  }

  const screenView = (() => {
    switch (screen?.kind) {
      case 'workOrder':
        return (
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
        )
      case 'inspection':
        return <InspectionScreen inspectionId={screen.id} onBack={goBack} onDirtyChange={setDirty} onToast={showToast} />
      case 'notifications':
        return (
          <NotificationsScreen
            notifications={notifications}
            workOrders={workOrders}
            inspections={inspections}
            requests={serviceRequests}
            onBack={goBack}
            backLabel={`Back to ${TAB_LABEL[homeTab(role)]}`}
            onOpen={openNotification}
            onMarkAllRead={markAllRead}
          />
        )
      case 'pick':
        return <PickScreen initial={screen.what} onBack={goBack} onRoom={id => openRoom(id, true)} onAsset={id => openAsset(id, true)} />
      case 'room':
        return (
          <RoomScreen
            roomId={screen.id}
            onBack={goBack}
            onReport={roomId => openScreen({ kind: 'newRequest', roomId })}
            onAsset={id => openAsset(id)}
            onToast={showToast}
          />
        )
      case 'asset':
        return (
          <AssetScreen
            assetId={screen.id}
            onBack={goBack}
            onReport={(roomId, assetId) => openScreen({ kind: 'newRequest', roomId, assetId })}
            onOpenWork={openWork}
          />
        )
      case 'request':
        return <RequestScreen requestId={screen.id} onBack={goBack} />
      case 'newRequest':
        return (
          <NewRequestScreen
            key={`${screen.roomId}-${screen.assetId}`}
            roomId={screen.roomId}
            assetId={screen.assetId}
            onBack={goBack}
            onDirtyChange={setDirty}
            onToast={showToast}
            onSubmitted={id => openScreen({ kind: 'requestSuccess', id }, { replace: true })}
          />
        )
      case 'requestSuccess':
        return (
          <RequestSuccessScreen
            requestId={screen.id}
            onDone={goBack}
            onViewAll={() => {
              setTab('Requests')
              closeAll()
            }}
          />
        )
      default:
        return null
    }
  })()

  return (
    <div className="flex h-dvh justify-center bg-fa-bg">
      <div className="relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-fa-bg sm:border-x sm:border-fa-border">
        {isAdmin ? (
          <main className="flex flex-1 items-center p-4">
            <EmptyState
              icon={Monitor}
              title="The field app is for field staff"
              action={
                <Button block={false} icon={Monitor} onClick={() => router.push('/dashboard')}>
                  Go to the desktop
                </Button>
              }
            >
              Admins manage everything from the desktop. A scanned room or asset opens there too.
            </EmptyState>
          </main>
        ) : screenView ?? (
          <>
            <AppBar role={role} unread={unreadNotificationCount} onBell={() => openScreen({ kind: 'notifications' })} />
            {!online ? <OfflineBanner onRetry={() => void reloadData()} /> : null}
            {activeCheckIn ? <ActiveRoomBanner room={activeCheckIn.roomName} onCheckOut={() => setConfirmCheckout(true)} busy={checkingOut} /> : null}
            <main className="min-h-0 flex-1 overflow-y-auto">{content}</main>
            <BottomNav role={role} active={tab} onChange={setTab} badges={{ Tasks: counts.Tasks, Cleaning: counts.Cleaning, Inspections: counts.Inspections }} />
          </>
        )}

        {toast || shared.length ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-3 z-40 flex flex-col gap-2',
              // Above the bottom nav, or above a screen's save buttons.
              screen && WITH_ACTION_BAR.has(screen.kind) ? 'bottom-[calc(150px+env(safe-area-inset-bottom))]' : 'bottom-[calc(104px+env(safe-area-inset-bottom))]',
            )}
          >
            {shared.slice(-2).map(t => (
              <div key={t.id} className="pointer-events-auto">
                <Toast tone={t.type === 'error' ? 'error' : t.type === 'info' ? 'info' : 'success'} onDismiss={() => dismissToast(t.id)}>
                  {t.text}
                </Toast>
              </div>
            ))}
            {toast ? (
              <div className="pointer-events-auto">
                <Toast>{toast}</Toast>
              </div>
            ) : null}
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
          body="What you have entered on this screen will be lost."
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
