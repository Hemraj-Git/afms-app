import type { TableRow } from '@/lib/supabase/typed'
import type { RoomAccessLog } from '@/types/afms'
import { defineList } from './entity'

// Check-ins and check-outs are written by the room_check_in / room_check_out
// database functions (one atomic step that also flips the room's status), never
// by a plain insert or update, so this is read-only here. The context adds and
// closes entries in the cache around those calls and re-reads afterwards.
//
// There is no room_name column: roomName is the raw room id until the context
// resolves it against the rooms list (so it also follows a renamed room).
export function mapRoomAccessLogRow(l: TableRow<'room_access_logs'>): RoomAccessLog {
  return {
    id: l.id,
    activityNumber: l.activity_number || undefined,
    roomId: l.room_id ?? '',
    roomName: l.room_id ?? '',
    userId: l.user_id,
    userName: l.user_name,
    userRole: l.user_role || 'Staff',
    checkInTime: l.check_in_time,
    checkInDate: l.check_in_date,
    checkInTimestamp: l.check_in_timestamp,
    checkOutTime: l.check_out_time ?? undefined,
    checkOutTimestamp: l.check_out_timestamp ?? undefined,
    purpose: l.purpose || '',
    isForceCheckout: Boolean(l.is_force_checkout),
    autoCheckOutNote: l.auto_checkout_note ?? undefined,
  }
}

// Newest first by check_in_timestamp (a real epoch): check_in_time is only a
// display string with no date, so it can't order entries across days.
const roomAccessLogs = defineList<RoomAccessLog, 'room_access_logs'>({
  table: 'room_access_logs',
  orderBy: 'check_in_timestamp',
  descending: true,
  fromRow: mapRoomAccessLogRow,
})

export const roomAccessLogKeys = { list: roomAccessLogs.key }
export function useRoomAccessLogs(userId: string, enabled: boolean) {
  const { items, ...query } = roomAccessLogs.useList(userId, enabled)
  return { ...query, roomAccessLogs: items }
}
