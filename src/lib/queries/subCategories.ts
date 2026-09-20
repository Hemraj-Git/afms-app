import { formatSubCategoryId } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { MetadataFieldDef, SubCategory } from '@/types/afms'
import { defineEntity, fetchExistingCodes, uniqueCode } from './entity'

// The template link is stored as arrays; the single-id fields on SubCategory are
// older callers' shorthand for "an array of one", so accept either when writing.
const templateIds = (many: string[] | undefined, one: string | undefined) =>
  Array.from(new Set(many || (one ? [one] : [])))

export function mapSubCategoryRow(s: TableRow<'sub_categories'>): SubCategory {
  return {
    id: s.id,
    categoryId: s.category_id ?? '',
    name: s.name,
    code: s.code,
    description: s.description || '',
    metadataFields: (s.metadata_fields as unknown as MetadataFieldDef[] | null) || [],
    pmTemplateIds: s.pm_template_ids || [],
    inspectionTemplateIds: s.inspection_template_ids || [],
  }
}

export function subCategoryToInsert(s: SubCategory): TableInsert<'sub_categories'> {
  return {
    id: s.id,
    category_id: s.categoryId || null,
    name: s.name,
    code: s.code,
    description: s.description || '',
    metadata_fields: (s.metadataFields || []) as unknown as TableInsert<'sub_categories'>['metadata_fields'],
    pm_template_ids: templateIds(s.pmTemplateIds, s.pmTemplateId),
    inspection_template_ids: templateIds(s.inspectionTemplateIds, s.inspectionTemplateId),
  }
}

export function subCategoryToUpdate(changes: Partial<SubCategory>): TableUpdate<'sub_categories'> {
  const u: TableUpdate<'sub_categories'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.description !== undefined) u.description = changes.description
  if (changes.metadataFields !== undefined) {
    u.metadata_fields = changes.metadataFields as unknown as TableUpdate<'sub_categories'>['metadata_fields']
  }
  if (changes.pmTemplateIds !== undefined || changes.pmTemplateId !== undefined) {
    u.pm_template_ids = templateIds(changes.pmTemplateIds, changes.pmTemplateId)
  }
  if (changes.inspectionTemplateIds !== undefined || changes.inspectionTemplateId !== undefined) {
    u.inspection_template_ids = templateIds(changes.inspectionTemplateIds, changes.inspectionTemplateId)
  }
  return u
}

const subCategories = defineEntity<SubCategory, 'sub_categories'>({
  table: 'sub_categories',
  label: 'sub-category',
  orderBy: 'name',
  fromRow: mapSubCategoryRow,
  toInsert: subCategoryToInsert,
  toUpdate: subCategoryToUpdate,
  immutable: ['id', 'code'],
})

export const subCategoryKeys = { list: subCategories.key }
export const useAddSubCategory = subCategories.useAdd
export const useUpdateSubCategory = subCategories.useUpdate
export const useDeleteSubCategory = subCategories.useDelete
export function useSubCategories(userId: string, enabled: boolean) {
  const { items, ...query } = subCategories.useList(userId, enabled)
  return { ...query, subCategories: items }
}

// "FURN-OFFI" for both "Office Table" and "Office Chair" would collide, so the
// later one becomes FURN-OFFI-2.
export async function allocateSubCategory(
  input: Omit<SubCategory, 'id' | 'code'>,
  parentCode: string,
  known: SubCategory[]
): Promise<SubCategory> {
  const base = formatSubCategoryId(parentCode, input.name)
  const code = uniqueCode(base, [...known.map(s => s.code), ...(await fetchExistingCodes('sub_categories'))])
  return { ...input, id: generateUUID(), code }
}
