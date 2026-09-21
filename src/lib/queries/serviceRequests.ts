import { db, type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import { generateUUID } from '@/lib/uuid'
import type { ServiceRequest } from '@/types/afms'
import { defineList, NO_ROWS } from './entity'

export type NewServiceRequest = Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>

// requestedByRole has no column, so a row reads back as 'Staff'; the context
// replaces it with the requester's real role from their profile.
export function mapServiceRequestRow(sr: TableRow<'service_requests'>): ServiceRequest {
  return {
    id: sr.id,
    ticketId: sr.ticket_id,
    title: sr.title,
    description: sr.description || '',
    requestType: (sr.type || 'Maintenance') as ServiceRequest['requestType'],
    roomId: sr.room_id ?? '',
    assetId: sr.asset_id ?? undefined,
    requestedBy: sr.requested_by_name,
    requestedByRole: 'Staff',
    requestedByUserId: sr.requested_by_user_id || undefined,
    requestedByEmail: sr.requested_by_email || undefined,
    assignedTo: sr.assigned_to ?? undefined,
    assignedToName: sr.assigned_to_name ?? undefined,
    status: (sr.status || 'Open') as ServiceRequest['status'],
    priority: (sr.priority || 'Medium') as ServiceRequest['priority'],
    createdAt: sr.created_at,
    slaDueDate: sr.sla_due_date ?? '',
    photoUrls: sr.photo_urls || [],
    workOrderNumber: sr.work_order_number ?? undefined,
    workOrderId: sr.work_order_id ?? undefined,
    workOrderType: (sr.work_order_type as ServiceRequest['workOrderType']) ?? undefined,
    dismissalReason: sr.dismissal_reason ?? undefined,
    dismissedAt: sr.dismissed_at ?? undefined,
    dismissedBy: sr.dismissed_by ?? undefined,
    resolutionNotes: sr.resolution_notes || undefined,
  }
}

// The ticket number is minted by a database trigger, whatever is sent here (a
// client-computed one once collided with tickets a Guest's or Technician's
// RLS-scoped view couldn't see). requested_by_user_id / requested_by_email come
// from the real session, never from the form: the row-level-security "own
// tickets" policies and the returning-Guest email match key off them.
export function serviceRequestToInsert(sr: NewServiceRequest & { id: string }): TableInsert<'service_requests'> {
  return {
    id: sr.id,
    ticket_id: 'PENDING',
    title: sr.title,
    description: sr.description || '',
    type: sr.requestType || 'Maintenance',
    room_id: sr.roomId || null,
    asset_id: sr.assetId || null,
    status: sr.status || 'Open',
    priority: sr.priority || 'Medium',
    requested_by_name: sr.requestedBy,
    requested_by_user_id: sr.requestedByUserId ?? null,
    requested_by_email: sr.requestedByEmail || null,
    sla_due_date: sr.slaDueDate || null,
    photo_urls: sr.photoUrls || [],
    created_at: new Date().toISOString(),
  }
}

// camelCase fields to their columns. Spreading the raw object into an update once
// failed silently for every multi-word field (Postgrest rejects unknown columns).
export function serviceRequestToUpdate(u: Partial<ServiceRequest>): TableUpdate<'service_requests'> {
  const out: TableUpdate<'service_requests'> = {}
  if (u.title !== undefined) out.title = u.title
  if (u.description !== undefined) out.description = u.description
  if (u.requestType !== undefined) out.type = u.requestType
  if (u.roomId !== undefined) out.room_id = u.roomId
  if (u.assetId !== undefined) out.asset_id = u.assetId
  if (u.status !== undefined) out.status = u.status
  if (u.priority !== undefined) out.priority = u.priority
  if (u.requestedBy !== undefined) out.requested_by_name = u.requestedBy
  if (u.assignedTo !== undefined) out.assigned_to = u.assignedTo
  if (u.assignedToName !== undefined) out.assigned_to_name = u.assignedToName
  if (u.slaDueDate !== undefined) out.sla_due_date = u.slaDueDate
  if (u.photoUrls !== undefined) out.photo_urls = u.photoUrls
  if (u.workOrderNumber !== undefined) out.work_order_number = u.workOrderNumber
  if (u.workOrderId !== undefined) out.work_order_id = u.workOrderId
  if (u.workOrderType !== undefined) out.work_order_type = u.workOrderType
  if (u.dismissalReason !== undefined) out.dismissal_reason = u.dismissalReason
  if (u.resolutionNotes !== undefined) out.resolution_notes = u.resolutionNotes
  if (u.dismissedAt !== undefined) out.dismissed_at = u.dismissedAt
  if (u.dismissedBy !== undefined) out.dismissed_by = u.dismissedBy
  return out
}

const serviceRequests = defineList<ServiceRequest, 'service_requests'>({
  table: 'service_requests',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapServiceRequestRow,
})

export const serviceRequestKeys = { list: serviceRequests.key }
export function useServiceRequests(userId: string, enabled: boolean) {
  const { items, ...query } = serviceRequests.useList(userId, enabled)
  return { ...query, serviceRequests: items }
}

// Creating waits for the database: the form shows the minted ticket number, and
// nothing is added on screen until it exists. The caller shows a failure itself
// (it catches the rejection), so this doesn't also toast.
export function useAddServiceRequest(userId: string) {
  return serviceRequests.useWrite<NewServiceRequest, ServiceRequest>(
    userId,
    'Add service request',
    async sr => {
      const id = generateUUID()
      const { data, error } = await db.from('service_requests').insert([serviceRequestToInsert({ ...sr, id })]).select().single()
      if (error || !data) throw new Error(error?.message || 'Failed to create service request.')
      // Keep the caller's own fields (e.g. their role, which has no column) and
      // take the id, ticket number and timestamp the database assigned.
      return { ...sr, id: data.id, ticketId: data.ticket_id, createdAt: data.created_at }
    },
    list => list,
    { reportErrors: false, applyResult: (list, created) => [created, ...list] }
  )
}

// Matches on the row id or the ticket number: the work-order completion handshake
// only knows the ticket's formatted number ("SR-2026-0001"), never its UUID.
export function useUpdateServiceRequest(userId: string) {
  return serviceRequests.useWrite<{ id: string; changes: Partial<ServiceRequest> }>(
    userId,
    'Update service request',
    async ({ id, changes }) => {
      const patch = serviceRequestToUpdate(changes)
      if (Object.keys(patch).length === 0) return
      const { data, error } = await db.from('service_requests').update(patch).or(`id.eq.${id},ticket_id.eq.${id}`).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error(NO_ROWS)
    },
    (list, { id, changes }) =>
      list.map(s => (s.id === id || s.ticketId === id ? { ...s, ...changes, id: s.id, ticketId: s.ticketId, createdAt: s.createdAt } : s))
  )
}
