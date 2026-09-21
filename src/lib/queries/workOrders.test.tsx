import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkOrder } from '@/types/afms'

const h = vi.hoisted(() => ({
  inserted: [] as unknown[][],
  insertResult: { error: null as { message: string } | null },
  updates: [] as { patch: unknown; filter: string }[],
  updateResult: { data: null as Record<string, unknown> | null, error: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: async (rows: unknown[]) => {
        h.inserted.push(rows)
        return h.insertResult
      },
      update: (patch: unknown) => ({
        or: (filter: string) => {
          h.updates.push({ patch, filter })
          return { select: () => ({ maybeSingle: async () => h.updateResult }) }
        },
      }),
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import { mapWorkOrderRow, useAddWorkOrders, useUpdateWorkOrder, workOrderKeys, workOrderToInsert, workOrderToUpdate } from './workOrders'

const wo = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 'w1', woNumber: 'PENDING-w1', type: 'Corrective', title: 'Fix pump', source: 'Service Request', sourceRefId: 'SR-2026-0001',
  dueDate: '2026-10-01', status: 'Scheduled', createdAt: '2026-09-20', ...over,
})

beforeEach(() => {
  h.inserted = []
  h.insertResult = { error: null }
  h.updates = []
  h.updateResult = { data: { id: 'w1', wo_number: 'WO-CR-2026-0007' }, error: null }
  toast.mockClear()
})
afterEach(cleanup)

function setup(initial: WorkOrder[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(workOrderKeys.list('u1'), initial)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { wrapper, list: () => client.getQueryData<WorkOrder[]>(workOrderKeys.list('u1')) }
}

describe('work order mapping', () => {
  const row = {
    id: 'w1', wo_number: 'WO-PM-2026-0001', title: '', type: 'Preventive', asset_id: null, room_id: null, priority: null, source: null,
    source_ref_id: null, frequency: null, due_date: '2026-10-01', assigned_technician_id: 'u5', assigned_technician_name: 'Ann', status: 'Scheduled',
    checklist_template_id: null, checklist_snapshot: null, checklist_responses: null, executed_by: null, issue_logged: null, solution_taken: null,
    technician_remarks: null, start_photo_url: null, completion_photo_url: null, parts_replaced: null, vendor_id: null, vendor_ticket_no: null,
    vendor_tech_name: null, vendor_tech_phone: null, vendor_service_date: null, vendor_job_sheet_url: null, vendor_remarks: null, vendor_cost: 0,
    created_at: '2026-09-20T00:00:00Z', completed_at: null,
  }

  it('fills the title, source and lists; nulls become absent; a zero vendor cost is kept', () => {
    expect(mapWorkOrderRow(row as never)).toMatchObject({
      title: 'Preventive Work Order', source: 'Scheduled', assetId: undefined, priority: undefined, sourceRefId: undefined, frequency: undefined,
      checklistSnapshot: [], checklistResponses: {}, assignedTechnicianId: 'u5', vendorCost: 0, completedAt: undefined, partsReplaced: undefined,
    })
  })

  it('the insert saves the link to its service request, and frequency and priority', () => {
    expect(workOrderToInsert(wo({ frequency: 'Monthly', priority: undefined }))).toMatchObject({
      wo_number: 'PENDING-w1', source_ref_id: 'SR-2026-0001', frequency: 'Monthly', priority: 'Medium', source: 'Service Request', status: 'Scheduled',
    })
  })

  it('maps assignment, execution and completion details to their columns', () => {
    expect(
      workOrderToUpdate({
        status: 'Completed', woNumber: 'WO-CR-2026-0007', assignedTechnicianId: 'u5', technicianRemarks: 'done', completedAt: '2026-09-21',
        executedBy: 'Vendor', vendorCost: 500, startPhotoUrl: 's', completionPhotoUrl: 'c', createdAt: 'x', id: 'y',
      })
    ).toEqual({
      status: 'Completed', wo_number: 'WO-CR-2026-0007', assigned_technician_id: 'u5', technician_remarks: 'done', completed_at: '2026-09-21',
      executed_by: 'Vendor', vendor_cost: 500, start_photo_url: 's', completion_photo_url: 'c',
    })
  })
})

describe('creating work orders', () => {
  it('a batch shows at once and saves as one insert; a failure removes it as a unit', async () => {
    const { wrapper, list } = setup([wo({ id: 'old', woNumber: 'WO-1' })])
    const { result } = renderHook(() => useAddWorkOrders('u1'), { wrapper })
    await act(async () => { await result.current.mutateAsync([wo({ id: 'a' }), wo({ id: 'b' })]) })
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toHaveLength(2)

    h.insertResult = { error: { message: 'duplicate key value' } }
    const before = list()?.map(w => w.id)
    await act(async () => {
      await expect(result.current.mutateAsync([wo({ id: 'c' })])).rejects.toThrow('duplicate key')
    })
    expect(list()?.map(w => w.id)).toEqual(before)
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Create work order failed and was undone'))
  })
})

describe('updating a work order', () => {
  it('folds the number minted by the database into the list, replacing the on-screen guess', async () => {
    const { wrapper, list } = setup([wo()])
    const { result } = renderHook(() => useUpdateWorkOrder('u1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        id: 'w1', changes: { status: 'Scheduled', woNumber: 'WO-CR-2026-0001', assignedTechnicianId: 'u5' },
      })
    })
    expect(h.updates[0].filter).toBe('id.eq.w1,wo_number.eq.w1')
    expect(list()?.[0]).toMatchObject({ woNumber: 'WO-CR-2026-0007', assignedTechnicianId: 'u5' })
  })

  it('matches on the WO number as well as the id', async () => {
    const { wrapper } = setup([wo({ woNumber: 'WO-CR-2026-0003' })])
    h.updateResult = { data: { id: 'w1', wo_number: 'WO-CR-2026-0003' }, error: null }
    const { result } = renderHook(() => useUpdateWorkOrder('u1'), { wrapper })
    await act(async () => { await result.current.mutateAsync({ id: 'WO-CR-2026-0003', changes: { status: 'In Progress' } }) })
    expect(h.updates[0].filter).toBe('id.eq.WO-CR-2026-0003,wo_number.eq.WO-CR-2026-0003')
  })

  it('shows In Progress at once; an update that matches no row is undone (what row-level security does)', async () => {
    const { wrapper, list } = setup([wo()])
    h.updateResult = { data: null, error: null }
    const { result } = renderHook(() => useUpdateWorkOrder('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'w1', changes: { status: 'In Progress' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0].status).toBe('Scheduled')
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('nothing was changed'))
  })

  it('a database error is undone and reported; the id and created date never change', async () => {
    const { wrapper, list } = setup([wo()])
    h.updateResult = { data: null, error: { message: 'new row violates row-level security policy' } }
    const { result } = renderHook(() => useUpdateWorkOrder('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'w1', changes: { status: 'Completed', createdAt: 'HACK', id: 'other' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0]).toMatchObject({ id: 'w1', status: 'Scheduled', createdAt: '2026-09-20' })
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('row-level security'))
  })
})
