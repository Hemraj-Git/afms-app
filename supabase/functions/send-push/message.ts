// What a push shows and where tapping it goes. Pure, so it is tested in Node
// (src/lib/webPush.test.ts) and used as-is by the Edge Function.

export interface PushMessage {
  title: string
  body: string
  // Page to open when the notification is tapped.
  url: string
  // Same tag replaces an older notification on the device instead of stacking.
  tag: string
}

export interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
}

export interface ServiceRequestRow {
  id: string
  ticket_id: string
  title: string
  priority: string | null
  requested_by_name: string | null
}

// Admins work on the desktop pages; everyone else in the field app (the
// desktop pages send them to /mobile anyway).
const ADMIN_LINKS: Record<string, string> = {
  wo_assigned: '/maintenance/work-orders',
  inspection_assigned: '/inspections',
  auto_checkout: '/dashboard',
  vendor_handover: '/maintenance/corrective',
  outside_repair_sent: '/maintenance/outside-repairs',
  outside_repair_overdue: '/maintenance/outside-repairs',
}

export function messageForNotification(n: NotificationRow, recipientRole: string): PushMessage {
  return {
    title: n.title,
    body: n.body ?? '',
    url: recipientRole === 'Admin' ? ADMIN_LINKS[n.type] ?? '/dashboard' : '/mobile',
    tag: `n-${n.id}`,
  }
}

export function messageForServiceRequest(r: ServiceRequestRow): PushMessage {
  const who = r.requested_by_name ? ` · ${r.requested_by_name}` : ''
  return {
    title: `New service request: ${r.ticket_id}`,
    body: `${r.title}${r.priority ? ` (${r.priority})` : ''}${who}`,
    url: `/service-requests?q=${encodeURIComponent(r.ticket_id)}`,
    tag: `sr-${r.id}`,
  }
}
