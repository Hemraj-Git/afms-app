import { formatCategoryId } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Category } from '@/types/afms'
import { defineEntity, fetchExistingCodes, uniqueCode } from './entity'

export function mapCategoryRow(c: TableRow<'categories'>): Category {
  return { id: c.id, name: c.name, code: c.code, description: c.description || '' }
}

export function categoryToInsert(c: Category): TableInsert<'categories'> {
  return { id: c.id, name: c.name, code: c.code, description: c.description || '' }
}

export function categoryToUpdate(changes: Partial<Category>): TableUpdate<'categories'> {
  const u: TableUpdate<'categories'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.description !== undefined) u.description = changes.description
  return u
}

const categories = defineEntity<Category, 'categories'>({
  table: 'categories',
  label: 'category',
  orderBy: 'name',
  fromRow: mapCategoryRow,
  toInsert: categoryToInsert,
  toUpdate: categoryToUpdate,
  immutable: ['id', 'code'],
})

export const categoryKeys = { list: categories.key }
export const useAddCategory = categories.useAdd
export const useUpdateCategory = categories.useUpdate
export const useDeleteCategory = categories.useDelete
export function useCategories(userId: string, enabled: boolean) {
  const { items, ...query } = categories.useList(userId, enabled)
  return { ...query, categories: items }
}

// The code is the first four letters of the name, so "Electrical" and
// "Electronics" would both be ELEC; the second gets ELEC-2.
export async function allocateCategory(input: Omit<Category, 'id' | 'code'>, known: Category[]): Promise<Category> {
  const code = uniqueCode(formatCategoryId(input.name), [...known.map(c => c.code), ...(await fetchExistingCodes('categories'))])
  return { ...input, id: generateUUID(), code }
}
