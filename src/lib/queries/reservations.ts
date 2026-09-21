import { getLocalDateStr } from '@/lib/dateUtils'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Reservation } from '@/types/afms'
import { defineEntity, table } from './entity'

export function mapReservationRow(r: TableRow<'reservations'>): Reservation {
  return {
    id: r.id,
    reservationNumber: r.reservation_number || r.id,
    roomId: r.room_id ?? '',
    roomName: r.room_name || '',
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role || 'Staff',
    departmentName: r.department_name ?? undefined,
    date: r.date,
    slotHour: r.slot_hour,
    timeSlot: r.time_slot,
    purpose: r.purpose || '',
    status: r.status as Reservation['status'],
    groupBookingId: r.group_booking_id ?? undefined,
    createdAt: r.created_at ? r.created_at.split('T')[0] : getLocalDateStr(),
  }
}

// groupBookingId has a column but used not to be written, so a multi-date booking
// lost its grouping on reload.
export function reservationToInsert(r: Reservation): TableInsert<'reservations'> {
  return {
    id: r.id,
    reservation_number: r.reservationNumber,
    room_id: r.roomId || null,
    room_name: r.roomName || 'Room',
    user_id: r.userId,
    user_name: r.userName,
    user_role: r.userRole || 'Staff',
    department_name: r.departmentName || null,
    date: r.date,
    slot_hour: r.slotHour,
    time_slot: r.timeSlot,
    purpose: r.purpose || 'Room Reservation',
    status: r.status || 'Confirmed',
    group_booking_id: r.groupBookingId || null,
    created_at: new Date().toISOString(),
  }
}

// The only thing that changes on a booking is its status.
export function reservationToUpdate(changes: Partial<Reservation>): TableUpdate<'reservations'> {
  const u: TableUpdate<'reservations'> = {}
  if (changes.status !== undefined) u.status = changes.status
  return u
}

const reservations = defineEntity<Reservation, 'reservations'>({
  table: 'reservations',
  label: 'reservation',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapReservationRow,
  toInsert: reservationToInsert,
  toUpdate: reservationToUpdate,
  immutable: ['id', 'reservationNumber', 'createdAt'],
})

export const reservationKeys = { list: reservations.key }
export const useUpdateReservation = reservations.useUpdate
export const useDeleteReservation = reservations.useDelete
export function useReservations(userId: string, enabled: boolean) {
  const { items, ...query } = reservations.useList(userId, enabled)
  return { ...query, reservations: items }
}

// One write for a single booking or a whole multi-date booking: one insert
// statement, so a group of slots lands completely or not at all.
export function useAddReservations(userId: string) {
  return reservations.useWrite<Reservation[]>(
    userId,
    'Add reservation',
    async created => {
      const { error } = await table('reservations').insert(created.map(reservationToInsert))
      if (error) throw new Error(error.message)
    },
    (list, created) => [...created, ...list]
  )
}
