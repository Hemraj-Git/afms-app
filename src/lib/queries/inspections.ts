import { getLocalDateStr } from '@/lib/dateUtils'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { ChecklistItemDef, Inspection } from '@/types/afms'
import { defineEntity, table } from './entity'

type Json = TableInsert<'inspections'>['checklist_responses']

export function mapInspectionRow(i: TableRow<'inspections'>): Inspection {
  return {
    id: i.id,
    inspectionNumber: i.inspection_number,
    assetId: i.asset_id ?? '',
    templateId: i.template_id ?? '',
    templateVersion: i.template_version || 1,
    assignedInspectorId: i.conducted_by_user_id ?? undefined,
    assignedInspectorName: i.conducted_by ?? undefined,
    dueDate: i.due_date,
    status: (i.status as Inspection['status']) || 'Scheduled',
    result: (i.result as Inspection['result']) ?? undefined,
    inspectorRemarks: i.remarks ?? undefined,
    checklistSnapshot: (i.checklist_snapshot as unknown as ChecklistItemDef[] | null) || [],
    checklistResponses: (i.checklist_responses as unknown as Inspection['checklistResponses'] | null) || {},
    photoUrl: i.photo_url || undefined,
    itemPhotos: (i.item_photos as unknown as Record<string, string> | null) || undefined,
    completedAt: i.conducted_at ?? undefined,
    createdAt: i.created_at,
  }
}

// inspection_number is re-minted by a database trigger on insert, ignoring what is
// sent; the value here is only the on-screen guess until the list is re-read,
// which happens as soon as the write settles.
export function inspectionToInsert(i: Inspection): TableInsert<'inspections'> {
  return {
    id: i.id,
    inspection_number: i.inspectionNumber || i.id,
    asset_id: i.assetId || null,
    template_id: i.templateId || null,
    template_version: i.templateVersion || 1,
    due_date: i.dueDate || getLocalDateStr(),
    status: i.status || 'Scheduled',
    result: i.result || null,
    remarks: i.inspectorRemarks || null,
    checklist_snapshot: (i.checklistSnapshot || []) as unknown as Json,
    checklist_responses: (i.checklistResponses || {}) as unknown as Json,
    conducted_by: i.assignedInspectorName || null,
    conducted_by_user_id: i.assignedInspectorId || null,
    conducted_at: i.completedAt || null,
    created_at: new Date().toISOString(),
  }
}

// Assignment, completion (result, remarks, responses, photos) and rescheduling.
// The inspection number and asset never change.
export function inspectionToUpdate(changes: Partial<Inspection>): TableUpdate<'inspections'> {
  const u: TableUpdate<'inspections'> = {}
  if (changes.status !== undefined) u.status = changes.status
  if (changes.result !== undefined) u.result = changes.result
  if (changes.inspectorRemarks !== undefined) u.remarks = changes.inspectorRemarks
  if (changes.assignedInspectorId !== undefined) u.conducted_by_user_id = changes.assignedInspectorId
  if (changes.assignedInspectorName !== undefined) u.conducted_by = changes.assignedInspectorName
  if (changes.checklistResponses !== undefined) u.checklist_responses = changes.checklistResponses as unknown as Json
  if (changes.checklistSnapshot !== undefined) u.checklist_snapshot = changes.checklistSnapshot as unknown as Json
  if (changes.dueDate !== undefined) u.due_date = changes.dueDate
  if (changes.completedAt !== undefined) u.conducted_at = changes.completedAt
  if (changes.photoUrl !== undefined) u.photo_url = changes.photoUrl || null
  if (changes.itemPhotos !== undefined) u.item_photos = (changes.itemPhotos || null) as unknown as Json
  return u
}

const inspections = defineEntity<Inspection, 'inspections'>({
  table: 'inspections',
  label: 'inspection',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapInspectionRow,
  toInsert: inspectionToInsert,
  toUpdate: inspectionToUpdate,
  immutable: ['id', 'inspectionNumber', 'assetId', 'createdAt'],
})

export const inspectionKeys = { list: inspections.key }
export const useUpdateInspection = inspections.useUpdate
export const useDeleteInspection = inspections.useDelete
export function useInspections(userId: string, enabled: boolean) {
  const { items, ...query } = inspections.useList(userId, enabled)
  return { ...query, inspections: items }
}

// One write for a single inspection or a batch (the ones scheduled for a new
// asset, or a bulk import's): one insert statement, so a batch lands whole.
export function useAddInspections(userId: string) {
  return inspections.useWrite<Inspection[]>(
    userId,
    'Schedule inspection',
    async created => {
      const { error } = await table('inspections').insert(created.map(inspectionToInsert))
      if (error) throw new Error(error.message)
    },
    (list, created) => [...created, ...list]
  )
}
