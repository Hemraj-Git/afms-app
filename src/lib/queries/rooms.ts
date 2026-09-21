import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Room } from '@/types/afms'
import { defineEntity, fetchExistingCodes } from './entity'

export function mapRoomRow(r: TableRow<'rooms'>): Room {
  return {
    id: r.id,
    buildingId: r.building_id ?? '',
    name: r.name,
    roomNumber: r.room_number,
    type: r.type || 'General',
    floor: r.floor ?? undefined,
    roomSizeSqft: r.room_size_sqft ?? undefined,
    isReservable: Boolean(r.is_reservable),
    qrCodeKey: r.qr_code_key || `ROOM-${r.room_number}`,
    status: (r.status as Room['status']) || 'Available',
    currentOccupant: r.current_occupant || undefined,
    lastPrintedAt: r.last_printed_at ?? undefined,
  }
}

export function roomToInsert(r: Room): TableInsert<'rooms'> {
  return {
    id: r.id,
    building_id: r.buildingId || null,
    name: r.name,
    room_number: r.roomNumber,
    type: r.type || 'General',
    floor: r.floor ?? null,
    room_size_sqft: r.roomSizeSqft ?? null,
    is_reservable: Boolean(r.isReservable),
    qr_code_key: r.qrCodeKey,
    status: r.status || 'Available',
  }
}

// Building, floor, size and last-printed are editable on the Rooms and QR pages;
// they used not to be written, so those edits vanished on reload. The room
// number and QR key never change.
export function roomToUpdate(changes: Partial<Room>): TableUpdate<'rooms'> {
  const u: TableUpdate<'rooms'> = {}
  if (changes.buildingId !== undefined) u.building_id = changes.buildingId || null
  if (changes.name !== undefined) u.name = changes.name
  if (changes.type !== undefined) u.type = changes.type
  if (changes.floor !== undefined) u.floor = changes.floor
  if (changes.roomSizeSqft !== undefined) u.room_size_sqft = changes.roomSizeSqft
  if (changes.isReservable !== undefined) u.is_reservable = changes.isReservable
  if (changes.status !== undefined) u.status = changes.status
  if (changes.lastPrintedAt !== undefined) u.last_printed_at = changes.lastPrintedAt
  return u
}

const rooms = defineEntity<Room, 'rooms'>({
  table: 'rooms',
  label: 'room',
  orderBy: 'room_number',
  fromRow: mapRoomRow,
  toInsert: roomToInsert,
  toUpdate: roomToUpdate,
  immutable: ['id', 'roomNumber', 'qrCodeKey'],
})

export const roomKeys = { list: rooms.key }
export const fetchRooms = rooms.fetchAll
export const useAddRoom = rooms.useAdd
export const useUpdateRoom = rooms.useUpdate
export const useDeleteRoom = rooms.useDelete
export function useRooms(userId: string, enabled: boolean) {
  const { items, ...query } = rooms.useList(userId, enabled)
  return { ...query, rooms: items }
}

// roomNumber (ROM-####) is also the room page's URL key, so a collision would make
// two rooms indistinguishable; it is checked against the database, not only the
// list on screen.
export async function allocateRoom(input: Omit<Room, 'id' | 'roomNumber' | 'qrCodeKey'>, known: Room[]): Promise<Room> {
  const numbers = [...known.map(r => r.roomNumber || r.id), ...(await fetchExistingCodes('rooms', 'room_number'))]
  const roomNumber = formatId('ROM', getNextSequence(numbers, 'ROM'))
  return { ...input, id: generateUUID(), roomNumber, qrCodeKey: roomNumber }
}
