import { getLocalDateStr } from '@/lib/dateUtils'
import { db, type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import type { ChecklistItemDef, WorkOrder, WorkOrderPartItem } from '@/types/afms'
import { defineList, NO_ROWS, table } from './entity'

type Json = TableInsert<'work_orders'>['checklist_snapshot']

export function mapWorkOrderRow(w: TableRow<'work_orders'>): WorkOrder {
  return {
    id: w.id,
    woNumber: w.wo_number,
    title: w.title || `${w.type || 'Maintenance'} Work Order`,
    type: w.type as WorkOrder['type'],
    assetId: w.asset_id ?? undefined,
    roomId: w.room_id ?? undefined,
    priority: (w.priority as WorkOrder['priority']) ?? undefined,
    source: (w.source || 'Scheduled') as WorkOrder['source'],
    sourceRefId: w.source_ref_id ?? undefined,
    frequency: w.frequency ?? undefined,
    dueDate: w.due_date,
    assignedTechnicianId: w.assigned_technician_id ?? undefined,
    assignedTechnicianName: w.assigned_technician_name ?? undefined,
    status: w.status as WorkOrder['status'],
    checklistTemplateId: w.checklist_template_id ?? undefined,
    checklistSnapshot: (w.checklist_snapshot as unknown as ChecklistItemDef[] | null) || [],
    checklistResponses: (w.checklist_responses as unknown as WorkOrder['checklistResponses'] | null) || {},
    executedBy: (w.executed_by as WorkOrder['executedBy']) ?? undefined,
    issueLogged: w.issue_logged ?? undefined,
    solutionTaken: w.solution_taken ?? undefined,
    technicianRemarks: w.technician_remarks ?? undefined,
    startPhotoUrl: w.start_photo_url || undefined,
    completionPhotoUrl: w.completion_photo_url || undefined,
    partsReplaced: (w.parts_replaced as unknown as WorkOrderPartItem[] | null) || undefined,
    vendorId: w.vendor_id || undefined,
    vendorTicketNo: w.vendor_ticket_no || undefined,
    vendorTechName: w.vendor_tech_name || undefined,
    vendorTechPhone: w.vendor_tech_phone || undefined,
    vendorServiceDate: w.vendor_service_date || undefined,
    vendorJobSheetUrl: w.vendor_job_sheet_url || undefined,
    vendorRemarks: w.vendor_remarks || undefined,
    vendorCost: w.vendor_cost ?? undefined,
    createdAt: w.created_at,
    completedAt: w.completed_at ?? undefined,
  }
}

// One mapping for every place that creates work orders: manually raised ones, the
// preventive ones scheduled for a new asset (single or bulk), the recurring next
// cycle, and the corrective one from a failed inspection. (The single-asset path
// used to leave out frequency and priority, so the attempt window and recurrence
// lost them on reload.) The wo_number is 'PENDING-<id>' until a technician is
// first assigned; a database trigger then mints the real WO-PM/CR number.
export function workOrderToInsert(wo: WorkOrder): TableInsert<'work_orders'> {
  return {
    id: wo.id,
    wo_number: wo.woNumber || wo.id,
    title: wo.title || `${wo.type || 'Maintenance'} Work Order`,
    type: wo.type,
    asset_id: wo.assetId || null,
    room_id: wo.roomId || null,
    priority: wo.priority || 'Medium',
    frequency: wo.frequency || null,
    source: wo.source || 'Scheduled',
    // Must be saved: a service-request-linked work order's completion cascade
    // (auto-resolving the ticket) keys off it.
    source_ref_id: wo.sourceRefId || null,
    due_date: wo.dueDate || getLocalDateStr(),
    assigned_technician_id: wo.assignedTechnicianId || null,
    assigned_technician_name: wo.assignedTechnicianName || null,
    status: wo.status || 'Scheduled',
    checklist_template_id: wo.checklistTemplateId || null,
    checklist_snapshot: (wo.checklistSnapshot || []) as unknown as Json,
    issue_logged: wo.issueLogged || null,
    solution_taken: wo.solutionTaken || null,
    technician_remarks: wo.technicianRemarks || null,
    created_at: new Date().toISOString(),
  }
}

// Status changes, first-assignment numbering, execution details (checklist,
// photos, parts, vendor fields) and completion.
export function workOrderToUpdate(c: Partial<WorkOrder>): TableUpdate<'work_orders'> {
  const u: TableUpdate<'work_orders'> = {}
  if (c.status !== undefined) u.status = c.status
  if (c.woNumber !== undefined) u.wo_number = c.woNumber
  if (c.assignedTechnicianId !== undefined) u.assigned_technician_id = c.assignedTechnicianId
  if (c.assignedTechnicianName !== undefined) u.assigned_technician_name = c.assignedTechnicianName
  if (c.checklistResponses !== undefined) u.checklist_responses = c.checklistResponses as unknown as Json
  if (c.checklistSnapshot !== undefined) u.checklist_snapshot = c.checklistSnapshot as unknown as Json
  if (c.issueLogged !== undefined) u.issue_logged = c.issueLogged
  if (c.solutionTaken !== undefined) u.solution_taken = c.solutionTaken
  if (c.technicianRemarks !== undefined) u.technician_remarks = c.technicianRemarks
  if (c.executedBy !== undefined) u.executed_by = c.executedBy
  if (c.completedAt !== undefined) u.completed_at = c.completedAt
  if (c.priority !== undefined) u.priority = c.priority
  if (c.dueDate !== undefined) u.due_date = c.dueDate
  if (c.title !== undefined) u.title = c.title
  if (c.roomId !== undefined) u.room_id = c.roomId
  if (c.frequency !== undefined) u.frequency = c.frequency
  if (c.startPhotoUrl !== undefined) u.start_photo_url = c.startPhotoUrl
  if (c.completionPhotoUrl !== undefined) u.completion_photo_url = c.completionPhotoUrl
  if (c.partsReplaced !== undefined) u.parts_replaced = c.partsReplaced as unknown as TableUpdate<'work_orders'>['parts_replaced']
  if (c.vendorId !== undefined) u.vendor_id = c.vendorId
  if (c.vendorTicketNo !== undefined) u.vendor_ticket_no = c.vendorTicketNo
  if (c.vendorTechName !== undefined) u.vendor_tech_name = c.vendorTechName
  if (c.vendorTechPhone !== undefined) u.vendor_tech_phone = c.vendorTechPhone
  if (c.vendorServiceDate !== undefined) u.vendor_service_date = c.vendorServiceDate
  if (c.vendorJobSheetUrl !== undefined) u.vendor_job_sheet_url = c.vendorJobSheetUrl
  if (c.vendorRemarks !== undefined) u.vendor_remarks = c.vendorRemarks
  if (c.vendorCost !== undefined) u.vendor_cost = c.vendorCost
  return u
}

const workOrders = defineList<WorkOrder, 'work_orders'>({
  table: 'work_orders',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapWorkOrderRow,
})

export const workOrderKeys = { list: workOrders.key }
export function useWorkOrders(userId: string, enabled: boolean) {
  const { items, ...query } = workOrders.useList(userId, enabled)
  return { ...query, workOrders: items }
}

// One write for one work order or a batch (a new asset's preventive schedule, a
// bulk import's): one insert statement, so a batch lands whole.
export function useAddWorkOrders(userId: string) {
  return workOrders.useWrite<WorkOrder[]>(
    userId,
    'Create work order',
    async created => {
      const { error } = await table('work_orders').insert(created.map(workOrderToInsert))
      if (error) throw new Error(error.message)
    },
    (list, created) => [...created, ...list]
  )
}

// Matches on the row id or the WO number. Returns the saved row's id and number
// because the number is (re)minted by a database trigger the first time a
// technician is assigned -- whatever the client guessed is replaced by it, and
// the service request that links to this order needs the real one.
export function useUpdateWorkOrder(userId: string) {
  return workOrders.useWrite<{ id: string; changes: Partial<WorkOrder> }, { id: string; woNumber: string } | null>(
    userId,
    'Update work order',
    async ({ id, changes }) => {
      const patch = workOrderToUpdate(changes)
      if (Object.keys(patch).length === 0) return null
      const { data, error } = await db.from('work_orders').update(patch).or(`id.eq.${id},wo_number.eq.${id}`).select().maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error(NO_ROWS)
      return { id: data.id, woNumber: data.wo_number }
    },
    (list, { id, changes }) =>
      list.map(w => (w.id === id || w.woNumber === id ? { ...w, ...changes, id: w.id, createdAt: w.createdAt } : w)),
    {
      applyResult: (list, saved) => (saved ? list.map(w => (w.id === saved.id ? { ...w, woNumber: saved.woNumber } : w)) : list),
    }
  )
}
