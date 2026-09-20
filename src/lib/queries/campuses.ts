import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Campus } from '@/types/afms'
import { defineEntity, fetchExistingCodes } from './entity'

export function mapCampusRow(c: TableRow<'campuses'>): Campus {
  return { id: c.id, name: c.name, code: c.code, address: c.address || '' }
}

export function campusToInsert(c: Campus): TableInsert<'campuses'> {
  return { id: c.id, name: c.name, code: c.code, address: c.address || '' }
}

export function campusToUpdate(changes: Partial<Campus>): TableUpdate<'campuses'> {
  const u: TableUpdate<'campuses'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.address !== undefined) u.address = changes.address
  return u
}

const campuses = defineEntity<Campus, 'campuses'>({
  table: 'campuses',
  label: 'campus',
  orderBy: 'name',
  fromRow: mapCampusRow,
  toInsert: campusToInsert,
  toUpdate: campusToUpdate,
  immutable: ['id', 'code'],
})

export const campusKeys = { list: campuses.key }
export const useAddCampus = campuses.useAdd
export const useUpdateCampus = campuses.useUpdate
export const useDeleteCampus = campuses.useDelete
export function useCampuses(userId: string, enabled: boolean) {
  const { items, ...query } = campuses.useList(userId, enabled)
  return { ...query, campuses: items }
}

export async function allocateCampus(input: Omit<Campus, 'id' | 'code'>, known: Campus[]): Promise<Campus> {
  const codes = [...known.map(c => c.code || c.id), ...(await fetchExistingCodes('campuses'))]
  return { ...input, id: generateUUID(), code: formatId('CAM', getNextSequence(codes, 'CAM')) }
}
