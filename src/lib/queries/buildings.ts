import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Building } from '@/types/afms'
import { defineEntity, fetchExistingCodes } from './entity'

export function mapBuildingRow(b: TableRow<'buildings'>): Building {
  return { id: b.id, campusId: b.campus_id ?? '', name: b.name, code: b.code, totalFloors: b.total_floors || 1 }
}

export function buildingToInsert(b: Building): TableInsert<'buildings'> {
  return { id: b.id, campus_id: b.campusId || null, name: b.name, code: b.code, total_floors: b.totalFloors || 1 }
}

export function buildingToUpdate(changes: Partial<Building>): TableUpdate<'buildings'> {
  const u: TableUpdate<'buildings'> = {}
  if (changes.campusId !== undefined) u.campus_id = changes.campusId || null
  if (changes.name !== undefined) u.name = changes.name
  if (changes.totalFloors !== undefined) u.total_floors = changes.totalFloors
  return u
}

const buildings = defineEntity<Building, 'buildings'>({
  table: 'buildings',
  label: 'building',
  orderBy: 'name',
  fromRow: mapBuildingRow,
  toInsert: buildingToInsert,
  toUpdate: buildingToUpdate,
  immutable: ['id', 'code'],
})

export const buildingKeys = { list: buildings.key }
export const useAddBuilding = buildings.useAdd
export const useUpdateBuilding = buildings.useUpdate
export const useDeleteBuilding = buildings.useDelete
export function useBuildings(userId: string, enabled: boolean) {
  const { items, ...query } = buildings.useList(userId, enabled)
  return { ...query, buildings: items }
}

export async function allocateBuilding(input: Omit<Building, 'id' | 'code'>, known: Building[]): Promise<Building> {
  const codes = [...known.map(b => b.code || b.id), ...(await fetchExistingCodes('buildings'))]
  return { ...input, id: generateUUID(), code: formatId('BLD', getNextSequence(codes, 'BLD')) }
}
