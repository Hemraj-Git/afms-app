import { db, type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import { generateUUID } from '@/lib/uuid'
import type { OutsideRepair } from '@/types/afms'
import { defineEntity } from './entity'

// Outside (off-site) repairs of a corrective work order. The database numbers
// each one (OSR-YYYY-####), fills in the asset from the work order, alerts the
// Admins, and refuses to complete a work order while one is still out (0043).

const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v))

export function mapOutsideRepairRow(r: TableRow<'outside_repairs'>): OutsideRepair {
  return {
    id: r.id,
    repairNumber: r.repair_number,
    workOrderId: r.work_order_id,
    assetId: r.asset_id ?? undefined,
    scope: r.scope as OutsideRepair['scope'],
    componentName: r.component_name ?? undefined,
    faultDescription: r.fault_description ?? undefined,
    sentBy: (r.sent_by as OutsideRepair['sentBy']) || 'Technician',
    vendorId: r.vendor_id ?? undefined,
    sentDate: r.sent_date,
    expectedReturnDate: r.expected_return_date,
    dispatchRef: r.dispatch_ref ?? undefined,
    vendorRef: r.vendor_ref ?? undefined,
    estimatedCost: num(r.estimated_cost),
    dispatchPhotoUrl: r.dispatch_photo_url ?? undefined,
    status: (r.status as OutsideRepair['status']) || 'Out for Repair',
    returnedDate: r.returned_date ?? undefined,
    outcome: (r.outcome as OutsideRepair['outcome']) ?? undefined,
    actualCost: num(r.actual_cost),
    returnRemarks: r.return_remarks ?? undefined,
    returnPhotoUrl: r.return_photo_url ?? undefined,
    recordedBy: r.recorded_by ?? undefined,
    returnedBy: r.returned_by ?? undefined,
    createdAt: r.created_at,
  }
}

// The number, status and timestamps are set by the database, so they are not sent.
export function outsideRepairToInsert(r: OutsideRepair): TableInsert<'outside_repairs'> {
  return {
    id: r.id,
    repair_number: r.repairNumber || r.id,
    work_order_id: r.workOrderId,
    asset_id: r.assetId || null,
    scope: r.scope,
    component_name: r.scope === 'Component' ? r.componentName || null : null,
    fault_description: r.faultDescription || null,
    sent_by: r.sentBy,
    vendor_id: r.vendorId || null,
    sent_date: r.sentDate,
    expected_return_date: r.expectedReturnDate,
    dispatch_ref: r.dispatchRef || null,
    vendor_ref: r.vendorRef || null,
    estimated_cost: r.estimatedCost ?? null,
    dispatch_photo_url: r.dispatchPhotoUrl || null,
    recorded_by: r.recordedBy || null,
  }
}

// Corrections to the send-out details, or recording the return. The number and
// the work order never change.
export function outsideRepairToUpdate(c: Partial<OutsideRepair>): TableUpdate<'outside_repairs'> {
  const u: TableUpdate<'outside_repairs'> = {}
  if (c.scope !== undefined) u.scope = c.scope
  if (c.componentName !== undefined) u.component_name = c.componentName || null
  if (c.faultDescription !== undefined) u.fault_description = c.faultDescription || null
  if (c.sentBy !== undefined) u.sent_by = c.sentBy
  if (c.vendorId !== undefined) u.vendor_id = c.vendorId || null
  if (c.sentDate !== undefined) u.sent_date = c.sentDate
  if (c.expectedReturnDate !== undefined) u.expected_return_date = c.expectedReturnDate
  if (c.dispatchRef !== undefined) u.dispatch_ref = c.dispatchRef || null
  if (c.vendorRef !== undefined) u.vendor_ref = c.vendorRef || null
  if (c.estimatedCost !== undefined) u.estimated_cost = c.estimatedCost ?? null
  if (c.dispatchPhotoUrl !== undefined) u.dispatch_photo_url = c.dispatchPhotoUrl || null
  if (c.status !== undefined) u.status = c.status
  if (c.returnedDate !== undefined) u.returned_date = c.returnedDate || null
  if (c.outcome !== undefined) u.outcome = c.outcome || null
  if (c.actualCost !== undefined) u.actual_cost = c.actualCost ?? null
  if (c.returnRemarks !== undefined) u.return_remarks = c.returnRemarks || null
  if (c.returnPhotoUrl !== undefined) u.return_photo_url = c.returnPhotoUrl || null
  if (c.returnedBy !== undefined) u.returned_by = c.returnedBy || null
  return u
}

const repairs = defineEntity<OutsideRepair, 'outside_repairs'>({
  table: 'outside_repairs',
  label: 'outside repair',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapOutsideRepairRow,
  toInsert: outsideRepairToInsert,
  toUpdate: outsideRepairToUpdate,
  immutable: ['id', 'repairNumber', 'workOrderId', 'createdAt'],
})

export const outsideRepairKeys = { list: repairs.key }
export const useUpdateOutsideRepair = repairs.useUpdate
export function useOutsideRepairs(userId: string, enabled: boolean) {
  const { items, ...query } = repairs.useList(userId, enabled)
  return { ...query, outsideRepairs: items }
}

export type NewOutsideRepair = Omit<OutsideRepair, 'id' | 'repairNumber' | 'status' | 'createdAt'>

// Sends one out and returns the saved row, with the number the database gave it.
export function useSendOutsideRepair(userId: string) {
  return repairs.useWrite<NewOutsideRepair, OutsideRepair>(
    userId,
    'Send for outside repair',
    async input => {
      const draft: OutsideRepair = { ...input, id: generateUUID(), repairNumber: '', status: 'Out for Repair', createdAt: '' }
      const { data, error } = await db.from('outside_repairs').insert([outsideRepairToInsert(draft)]).select().single()
      if (error || !data) throw new Error(error?.message || 'Could not save the outside repair.')
      return mapOutsideRepairRow(data)
    },
    // Shown straight away; replaced by the saved row (with its number) once it lands.
    (list, input) => [{ ...input, id: 'pending-osr', repairNumber: 'Saving…', status: 'Out for Repair', createdAt: '' }, ...list],
    { applyResult: (list, saved) => [saved, ...list.filter(r => r.id !== 'pending-osr')] }
  )
}
