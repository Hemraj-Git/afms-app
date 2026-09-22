import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetActivityLog, Reservation } from '@/types/afms'

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  orderCalls: [] as unknown[][],
  inserted: [] as unknown[][],
  insertResult: { error: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({
        order: async (...args: unknown[]) => {
          h.orderCalls.push(args)
          return { data: h.rows, error: null }
        },
      }),
      insert: async (rows: unknown[]) => {
        h.inserted.push(rows)
        return h.insertResult
      },
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import { mapReservationRow, reservationKeys, reservationToInsert, reservationToUpdate, useAddReservations } from './reservations'
import { mapRoomAccessLogRow, useRoomAccessLogs } from './roomAccessLogs'
import { assetActivityLogToInsert, mapAssetActivityLogRow, useAddAssetActivityLogs, useAssetActivityLogs, assetActivityLogKeys, withoutRepeats } from './assetActivityLogs'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

beforeEach(() => {
  h.rows = []
  h.orderCalls = []
  h.inserted = []
  h.insertResult = { error: null }
  toast.mockClear()
})
afterEach(cleanup)

const res = (over: Partial<Reservation> = {}): Reservation => ({
  id: 'r1', reservationNumber: 'RSV-2026-0001', roomId: 'room1', roomName: 'Lab', userId: 'u1', userName: 'Sam', userRole: 'Faculty',
  date: '2026-10-01', timeSlot: '09:00 AM - 10:00 AM', slotHour: 9, purpose: 'Class', status: 'Confirmed', createdAt: '2026-09-20', ...over,
})

describe('reservations', () => {
  const row = {
    id: 'r1', reservation_number: null, room_id: null, room_name: null, user_id: 'u1', user_name: 'Sam', user_role: null,
    department_name: null, date: '2026-10-01', slot_hour: 9, time_slot: '09:00 AM - 10:00 AM', purpose: '', status: 'Confirmed',
    group_booking_id: 'g1', created_at: '2026-09-20T10:00:00Z',
  }

  it('maps a row, filling blanks and keeping the group id', () => {
    expect(mapReservationRow(row as never)).toMatchObject({
      reservationNumber: 'r1', roomId: '', roomName: '', userRole: 'Staff', departmentName: undefined, groupBookingId: 'g1', createdAt: '2026-09-20',
    })
  })

  it('saves the group id (it used to be dropped) and defaults the purpose', () => {
    expect(reservationToInsert(res({ groupBookingId: 'g9', purpose: '' }))).toMatchObject({
      group_booking_id: 'g9', purpose: 'Room Reservation', room_id: 'room1', department_name: null,
    })
  })

  it('an edit only ever changes the status', () => {
    expect(reservationToUpdate({ status: 'Cancelled', roomId: 'x', purpose: 'y' })).toEqual({ status: 'Cancelled' })
  })

  it('a multi-date booking shows at once and saves as one insert; a failure removes it as a unit', async () => {
    const { client, wrapper } = makeWrapper()
    client.setQueryData(reservationKeys.list('u1'), [res({ id: 'old', reservationNumber: 'RSV-2026-0000' })])
    const { result } = renderHook(() => useAddReservations('u1'), { wrapper })
    const group = [res({ id: 'a', reservationNumber: 'RSV-2026-0002' }), res({ id: 'b', reservationNumber: 'RSV-2026-0003' })]

    await act(async () => { await result.current.mutateAsync(group) })
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toHaveLength(2)

    h.insertResult = { error: { message: 'slot taken' } }
    client.setQueryData(reservationKeys.list('u1'), [res({ id: 'old' })])
    await act(async () => {
      await expect(result.current.mutateAsync(group)).rejects.toThrow('slot taken')
    })
    expect(client.getQueryData<Reservation[]>(reservationKeys.list('u1'))?.map(r => r.id)).toEqual(['old'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Add reservation failed and was undone: slot taken'))
  })
})

describe('room access logs', () => {
  it('maps a row: nulls become absent, the room name starts as the room id', () => {
    const log = mapRoomAccessLogRow({
      id: 'l1', activity_number: null, auto_checkout_note: null, check_in_date: '2026-09-20', check_in_time: '10:00 AM',
      check_in_timestamp: 1, check_out_time: null, check_out_timestamp: null, guest_email: null, is_force_checkout: null, purpose: null,
      room_id: 'room1', user_id: 'u1', user_name: 'Sam', user_role: null,
    })
    expect(log).toMatchObject({
      activityNumber: undefined, roomId: 'room1', roomName: 'room1', userRole: 'Staff', checkOutTime: undefined,
      checkOutTimestamp: undefined, isForceCheckout: false, purpose: '', autoCheckOutNote: undefined,
    })
  })

  it('loads newest check-in first', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useRoomAccessLogs('u1', true), { wrapper })
    await waitFor(() => expect(h.orderCalls).toHaveLength(1))
    expect(h.orderCalls[0]).toEqual(['check_in_timestamp', { ascending: false }])
  })
})

describe('asset activity logs', () => {
  const log: AssetActivityLog = { id: 'a1', assetId: 'asset1', action: 'Asset Created', byUser: 'Sam', source: 'Manual', timestamp: '9/20/2026', timestampEpoch: 5 }

  it('saves and reads the reference number (WO / inspection / ticket), which had no column before', () => {
    expect(assetActivityLogToInsert({ ...log, referenceId: 'WO-CR-2026-0007' })).toMatchObject({ reference_id: 'WO-CR-2026-0007' })
    expect(assetActivityLogToInsert(log)).toMatchObject({ reference_id: null })
    expect(
      mapAssetActivityLogRow({ id: 'a1', asset_id: 'x', action: 'x', by_user: 'Sam', remarks: null, reference_id: 'INSP-2026-0003', source: 'Manual', timestamp: 't', timestamp_epoch: 1 })
    ).toMatchObject({ referenceId: 'INSP-2026-0003' })
  })

  it('the same event for the same record is never recorded twice', () => {
    const done: AssetActivityLog = { ...log, action: 'Corrective Maintenance Completed', referenceId: 'WO-CR-2026-0007' }
    // already on screen or saved -> dropped
    expect(withoutRepeats([done], [{ ...done, id: 'a2' }])).toEqual([])
    // repeated inside one batch -> only the first goes through
    expect(withoutRepeats([], [{ ...done, id: 'a2' }, { ...done, id: 'a3' }]).map(l => l.id)).toEqual(['a2'])
    // a different record, a different asset, or a different action is a different event
    expect(withoutRepeats([done], [{ ...done, id: 'b1', referenceId: 'WO-CR-2026-0008' }])).toHaveLength(1)
    expect(withoutRepeats([done], [{ ...done, id: 'b2', assetId: 'other' }])).toHaveLength(1)
    expect(withoutRepeats([done], [{ ...done, id: 'b3', action: 'Under Maintenance' }])).toHaveLength(1)
  })

  it('events with no reference (asset created / updated) always go through, however often', () => {
    const updated: AssetActivityLog = { ...log, action: 'Asset Updated', referenceId: undefined }
    expect(withoutRepeats([updated], [{ ...updated, id: 'u2' }, { ...updated, id: 'u3' }])).toHaveLength(2)
  })

  it('maps rows both ways', () => {
    expect(assetActivityLogToInsert({ ...log, remarks: '' })).toMatchObject({ asset_id: 'asset1', remarks: null, timestamp_epoch: 5 })
    expect(
      mapAssetActivityLogRow({ id: 'a1', asset_id: null, action: 'x', by_user: 'Sam', remarks: null, reference_id: null, source: 'System', timestamp: 't', timestamp_epoch: null })
    ).toMatchObject({ assetId: '', remarks: undefined, source: 'System', timestampEpoch: undefined })
  })

  it('loads newest first with rows that have no epoch last', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useAssetActivityLogs('u1', true), { wrapper })
    await waitFor(() => expect(h.orderCalls).toHaveLength(1))
    expect(h.orderCalls[0]).toEqual(['timestamp_epoch', { ascending: false, nullsFirst: false }])
  })

  it('a bulk import writes all of its logs in one insert', async () => {
    const { client, wrapper } = makeWrapper()
    client.setQueryData(assetActivityLogKeys.list('u1'), [])
    const { result } = renderHook(() => useAddAssetActivityLogs('u1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync([log, { ...log, id: 'a2' }, { ...log, id: 'a3' }])
    })
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toHaveLength(3)
  })
})
