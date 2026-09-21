import { getLocalDateStr } from '@/lib/dateUtils'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { ChecklistItemDef, ChecklistTemplate } from '@/types/afms'
import { defineEntity } from './entity'

export function mapChecklistTemplateRow(t: TableRow<'checklist_templates'>): ChecklistTemplate {
  return {
    id: t.id,
    title: t.title,
    type: t.type as ChecklistTemplate['type'],
    description: t.description || '',
    interval: (t.interval || 'Quarterly') as ChecklistTemplate['interval'],
    items: (t.items as unknown as ChecklistItemDef[] | null) || [],
    updatedAt: t.updated_at ?? undefined,
  }
}

export function checklistTemplateToInsert(t: ChecklistTemplate): TableInsert<'checklist_templates'> {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    description: t.description || '',
    interval: t.interval || 'Quarterly',
    items: (t.items || []) as unknown as TableInsert<'checklist_templates'>['items'],
    updated_at: new Date().toISOString(),
  }
}

// Every edit stamps updated_at. The template's type never changes after creation.
export function checklistTemplateToUpdate(changes: Partial<ChecklistTemplate>): TableUpdate<'checklist_templates'> {
  const u: TableUpdate<'checklist_templates'> = { updated_at: new Date().toISOString() }
  if (changes.title !== undefined) u.title = changes.title
  if (changes.description !== undefined) u.description = changes.description
  if (changes.interval !== undefined) u.interval = changes.interval
  if (changes.items !== undefined) u.items = changes.items as unknown as TableUpdate<'checklist_templates'>['items']
  return u
}

const templates = defineEntity<ChecklistTemplate, 'checklist_templates'>({
  table: 'checklist_templates',
  label: 'template',
  orderBy: 'title',
  fromRow: mapChecklistTemplateRow,
  toInsert: checklistTemplateToInsert,
  toUpdate: checklistTemplateToUpdate,
  immutable: ['id', 'type'],
})

export const checklistTemplateKeys = { list: templates.key }
export const useAddChecklistTemplate = templates.useAdd
export const useUpdateChecklistTemplate = templates.useUpdate
export const useDeleteChecklistTemplate = templates.useDelete
export function useChecklistTemplates(userId: string, enabled: boolean) {
  const { items, ...query } = templates.useList(userId, enabled)
  return { ...query, checklistTemplates: items }
}

// Built synchronously: the sub-category page uses the new template's id straight
// away, before the save has finished.
export function newChecklistTemplate(input: Omit<ChecklistTemplate, 'id' | 'updatedAt'>): ChecklistTemplate {
  return { ...input, id: generateUUID(), updatedAt: getLocalDateStr() }
}
