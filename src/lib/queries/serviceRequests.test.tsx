import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceRequest } from '@/types/afms'

const h = vi.hoisted(() => ({
  insertResult: { data: null as Record<string, unknown> | null, error: null as { message: string } | null },
  updateResult: { data: [{ id: 'sr1' }] as unknown[] | null, error: null as { message: string } | null },
  gate: null as Promise<void> | null,
  inserted: [] as unknown[][],
  updates: [] as { patch: unknown; filter: string }[],
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: (rows: unknown[]) => {
        h.inserted.push(rows)
        return {
          select: () => ({
            single: async () => {
              if (h.gate) await h.gate
              return h.insertResult
            },
          }),
        }
      },
      update: (patch: unknown) => ({
        or: (filter: string) => {
          h.updates.push({ patch, filter })
          return { select: async () => h.updateResult }
        },
      }),
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import {
  mapServiceRequestRow, serviceRequestKeys, serviceRequestToInsert, serviceRequestToUpdate, useAddServiceRequest, useUpdateServiceRequest,
} from './serviceRequests'

const sr = (over: Partial<ServiceRequest> = {}): ServiceRequest => ({
  id: 'sr1', ticketId: 'SR-2026-0001', title: 'Leak', description: 'x', requestType: 'Maintenance', roomId: 'room1', requestedBy: 'Sam',
  requestedByRole: 'Faculty', status: 'Open', priority: 'High', createdAt: '2026-09-20T00:00:00Z', slaDueDate: '2026-09-21T00:00:00Z', ...over,
})

beforeEach(() => {
  h.insertResult = { data: null, error: null }
  h.updateResult = { data: [{ id: 'sr1' }], error: null }
  h.gate = null
  h.inserted = []
  h.updates = []
  toast.mockClear()
})
afterEach(cleanup)

function setup(initial: ServiceRequest[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(serviceRequestKeys.list('u1'), initial)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { wrapper, list: () => client.getQueryData<ServiceRequest[]>(serviceRequestKeys.list('u1')) }
}

describe('service request mapping', () => {
  const row = {
    id: 'sr1', ticket_id: 'SR-2026-0001', title: 'Leak', description: null, type: null, room_id: null, asset_id: null,
    requested_by_name: 'Sam', requested_by_user_id: null, requested_by_email: null, requested_by_phone: null, assigned_to: null,
    assigned_to_name: null, status: null, priority: null, created_at: 'x', sla_due_date: null, photo_urls: null, work_order_number: null,
    work_order_id: null, work_order_type: null, dismissal_reason: null, dismissed_at: null, dismissed_by: null, resolution_notes: null,
  }

  it('fills defaults; the requester role starts as Staff (it has no column)', () => {
    expect(mapServiceRequestRow(row as never)).toMatchObject({
      description: '', requestType: 'Maintenance', roomId: '', assetId: undefined, requestedByRole: 'Staff', status: 'Open',
      priority: 'Medium', slaDueDate: '', photoUrls: [], workOrderNumber: undefined, dismissedAt: undefined,
    })
  })

  it('the insert sends a placeholder ticket id (the database mints it) and the session-stamped requester', () => {
    const ins = serviceRequestToInsert({ ...sr({ requestedByUserId: 'u9', requestedByEmail: 'a@x.test' }), id: 'new1' })
    expect(ins).toMatchObject({ id: 'new1', ticket_id: 'PENDING', requested_by_user_id: 'u9', requested_by_email: 'a@x.test', type: 'Maintenance' })
    expect(serviceRequestToInsert({ ...sr(), id: 'n' })).toMatchObject({ requested_by_user_id: null, requested_by_email: null, asset_id: null })
  })

  it('maps every editable field to its column and ignores the rest', () => {
    expect(
      serviceRequestToUpdate({
        status: 'Closed', dismissalReason: 'dup', dismissedAt: '2026-09-21T00:00:00Z', dismissedBy: 'Admin',
        workOrderNumber: 'WO-1', workOrderType: 'Housekeeping', requestedByRole: 'Guest', createdAt: 'x', ticketId: 'y',
      })
    ).toEqual({
      status: 'Closed', dismissal_reason: 'dup', dismissed_at: '2026-09-21T00:00:00Z', dismissed_by: 'Admin',
      work_order_number: 'WO-1', work_order_type: 'Housekeeping',
    })
  })
})

describe('creating a service request', () => {
  const input = { ...sr(), id: undefined, ticketId: undefined, createdAt: undefined } as unknown as Omit<ServiceRequest, 'id' | 'ticketId' | 'createdAt'>

  it('adds nothing on screen until the database answers, then adds the row with its minted ticket number and keeps the caller\'s role', async () => {
    const { wrapper, list } = setup([])
    let release!: () => void
    h.gate = new Promise<void>(r => { release = r })
    h.insertResult = { data: { id: 'db-id', ticket_id: 'SR-2026-0042', created_at: '2026-09-20T10:00:00Z' }, error: null }
    const { result } = renderHook(() => useAddServiceRequest('u1'), { wrapper })

    let done: Promise<ServiceRequest>
    act(() => { done = result.current.mutateAsync(input) })
    await waitFor(() => expect(h.inserted).toHaveLength(1))
    expect(list()).toEqual([])

    release()
    const created = await done!
    expect(created).toMatchObject({ id: 'db-id', ticketId: 'SR-2026-0042', requestedByRole: 'Faculty', title: 'Leak' })
    expect(list()?.[0]).toMatchObject({ id: 'db-id', ticketId: 'SR-2026-0042' })
    expect(toast).not.toHaveBeenCalled()
  })

  it('a failure rejects with the database message, changes nothing, and does not toast (the form shows it)', async () => {
    const { wrapper, list } = setup([sr({ id: 'keep' })])
    h.insertResult = { data: null, error: { message: 'permission denied for table service_requests' } }
    const { result } = renderHook(() => useAddServiceRequest('u1'), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('permission denied')
    })
    expect(list()?.map(s => s.id)).toEqual(['keep'])
    expect(toast).not.toHaveBeenCalled()
  })
})

describe('updating a service request', () => {
  it('matches on the ticket number as well as the id, and shows the change at once', async () => {
    const { wrapper, list } = setup([sr()])
    const { result } = renderHook(() => useUpdateServiceRequest('u1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'SR-2026-0001', changes: { status: 'In Progress', workOrderNumber: 'WO-CR-2026-0001' } })
    })
    expect(h.updates[0]).toEqual({
      patch: { status: 'In Progress', work_order_number: 'WO-CR-2026-0001' },
      filter: 'id.eq.SR-2026-0001,ticket_id.eq.SR-2026-0001',
    })
    expect(list()?.[0]).toMatchObject({ status: 'In Progress', workOrderNumber: 'WO-CR-2026-0001' })
  })

  it('an update that matches no rows is undone and reported (what row-level security does)', async () => {
    const { wrapper, list } = setup([sr()])
    h.updateResult = { data: [], error: null }
    const { result } = renderHook(() => useUpdateServiceRequest('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'sr1', changes: { status: 'Resolved' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0].status).toBe('Open')
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Update service request failed and was undone'))
  })

  it('never changes the id, ticket number or created date', async () => {
    const { wrapper, list } = setup([sr()])
    const { result } = renderHook(() => useUpdateServiceRequest('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'sr1', changes: { title: 'New', ticketId: 'HACK', createdAt: 'HACK', id: 'other' } }))
    await waitFor(() => expect(list()?.[0].title).toBe('New'))
    expect(list()?.[0]).toMatchObject({ id: 'sr1', ticketId: 'SR-2026-0001', createdAt: '2026-09-20T00:00:00Z' })
  })
})
