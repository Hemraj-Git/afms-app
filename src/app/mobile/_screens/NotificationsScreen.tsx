'use client'

import React from 'react'
import { ArrowUp, Bell, CalendarClock, CircleCheck, CircleX, ClipboardCheck, LogOut, Package, Phone, TimerOff, Wrench, type LucideIcon } from 'lucide-react'
import type { AppNotification, Inspection, ServiceRequest, WorkOrder } from '@/types/afms'
import { timeAgo } from '@/lib/fieldWork'
import { Button, EmptyState, IdText, ScreenHeader, TextButton, cn } from '@/components/field'

const ICON: Record<AppNotification['type'], LucideIcon> = {
  wo_assigned: Wrench,
  inspection_assigned: ClipboardCheck,
  auto_checkout: LogOut,
  vendor_handover: Phone,
  outside_repair_sent: Package,
  outside_repair_overdue: TimerOff,
  request_resolved: CircleCheck,
  request_escalated: ArrowUp,
  request_closed: CircleX,
  due_today: CalendarClock,
}

// The human number of what a notification is about (WO-PM-0012, INSP-...),
// looked up from the lists already loaded; nothing when it is not one of them.
function refLabel(n: AppNotification, workOrders: WorkOrder[], inspections: Inspection[], requests: ServiceRequest[]): string | undefined {
  if (!n.refId) return undefined
  if (n.refTable === 'work_orders') return workOrders.find(w => w.id === n.refId)?.woNumber
  if (n.refTable === 'inspections') return inspections.find(i => i.id === n.refId)?.inspectionNumber
  if (n.refTable === 'service_requests') return requests.find(r => r.id === n.refId)?.ticketId
  return undefined
}

function Item({ n, workOrders, inspections, requests, onOpen }: { n: AppNotification; workOrders: WorkOrder[]; inspections: Inspection[]; requests: ServiceRequest[]; onOpen: () => void }) {
  const Icon = ICON[n.type] ?? Bell
  const ref = refLabel(n, workOrders, inspections, requests)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-start gap-3 rounded-[14px] border px-3.5 py-3 text-left transition',
          n.isRead ? 'border-fa-border bg-fa-surface' : 'border-[#BFD0FB] bg-fa-primary-weak/60',
        )}
      >
        <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]', n.isRead ? 'bg-fa-sunken text-fa-text-2' : 'bg-fa-primary text-white')}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-start gap-2">
            <span className="flex-1 text-base font-semibold leading-snug text-fa-text">{n.title}</span>
            <span className="shrink-0 pt-0.5 text-sm text-fa-text-2">{timeAgo(n.createdAt)}</span>
          </span>
          {ref && !n.title.includes(ref) ? <IdText>{ref}</IdText> : null}
          {n.body ? <span className="text-[15px] leading-snug text-fa-text-2">{n.body}</span> : null}
        </span>
        {!n.isRead ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-fa-primary" aria-label="Unread" /> : null}
      </button>
    </li>
  )
}

// Notifications (redesign canvas, "Notifications" and its empty state). Unread
// first ("New"), then the rest ("Earlier").
export function NotificationsScreen({
  notifications,
  workOrders,
  inspections,
  requests,
  onBack,
  backLabel,
  onOpen,
  onMarkAllRead,
}: {
  notifications: AppNotification[]
  workOrders: WorkOrder[]
  inspections: Inspection[]
  requests: ServiceRequest[]
  onBack: () => void
  // What "Back" returns to, for the empty state's button ("Back to tasks").
  backLabel: string
  onOpen: (n: AppNotification) => void
  onMarkAllRead: () => void
}) {
  const fresh = notifications.filter(n => !n.isRead)
  const earlier = notifications.filter(n => n.isRead)

  return (
    <>
      <ScreenHeader kicker="Field Operations" title="Notifications" onBack={onBack} />
      <main className="flex min-h-0 flex-1 flex-col [&>*]:shrink-0 gap-4 overflow-y-auto p-4">
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" action={<Button block={false} onClick={onBack}>{backLabel}</Button>}>
            New assignments, due inspections and updates on your requests will show up here.
          </EmptyState>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-fa-text-2">{fresh.length ? `${fresh.length} unread` : 'All read'}</span>
              {fresh.length ? <TextButton onClick={onMarkAllRead}>Mark all as read</TextButton> : null}
            </div>
            {fresh.length ? (
              <section className="flex flex-col gap-2">
                <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-fa-text-2">New</h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {fresh.map(n => (
                    <Item key={n.id} n={n} workOrders={workOrders} inspections={inspections} requests={requests} onOpen={() => onOpen(n)} />
                  ))}
                </ul>
              </section>
            ) : null}
            {earlier.length ? (
              <section className="flex flex-col gap-2">
                <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-fa-text-2">Earlier</h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {earlier.map(n => (
                    <Item key={n.id} n={n} workOrders={workOrders} inspections={inspections} requests={requests} onOpen={() => onOpen(n)} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}
