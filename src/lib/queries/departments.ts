import { getLocalDateStr } from '@/lib/dateUtils'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Department } from '@/types/afms'
import { defineEntity, fetchExistingCodes, uniqueCode } from './entity'

export function mapDepartmentRow(d: TableRow<'departments'>): Department {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description || '',
    headUserId: d.head_user_id ?? undefined,
    createdAt: d.created_at,
  }
}

// The head is a registered user (head_user_id). The name shown next to it is looked
// up from the users list by the context, so it is never stored as text.
export function departmentToInsert(d: Department): TableInsert<'departments'> {
  return { id: d.id, name: d.name, code: d.code, description: d.description || '', head_user_id: d.headUserId || null }
}

export function departmentToUpdate(changes: Partial<Department>): TableUpdate<'departments'> {
  const u: TableUpdate<'departments'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.code !== undefined) u.code = changes.code
  if (changes.description !== undefined) u.description = changes.description
  if (changes.headUserId !== undefined) u.head_user_id = changes.headUserId || null
  return u
}

const departments = defineEntity<Department, 'departments'>({
  table: 'departments',
  label: 'department',
  orderBy: 'name',
  fromRow: mapDepartmentRow,
  toInsert: departmentToInsert,
  toUpdate: departmentToUpdate,
  immutable: ['id'],
})

export const departmentKeys = { list: departments.key }
export const useAddDepartment = departments.useAdd
export const useUpdateDepartment = departments.useUpdate
export const useDeleteDepartment = departments.useDelete
export function useDepartments(userId: string, enabled: boolean) {
  const { items, ...query } = departments.useList(userId, enabled)
  return { ...query, departments: items }
}

// The typed code (or the first letters of the name) can collide with an existing
// department's UNIQUE code, so it gets -2, -3... appended when taken.
export async function allocateDepartment(input: Omit<Department, 'id'>, known: Department[]): Promise<Department> {
  const nextSeq = getNextSequence(known.map(d => d.code || d.id), 'DEP')
  const base = input.code || formatId('DEP', nextSeq)
  const code = uniqueCode(base, [...known.map(d => d.code), ...(await fetchExistingCodes('departments'))])
  return { ...input, id: generateUUID(), code, createdAt: getLocalDateStr() }
}
