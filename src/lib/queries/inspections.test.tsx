import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Inspection } from '@/types/afms'

const h = vi.hoisted(() => ({
  inserted: [] as unknown[][],
  updated: [] as unknown[],
  updateResult: { data: [{ id: 'i1' }] as unknown[] | null, error: null as { message: string } | null },
  insertResult: { error: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: async (rows: unknown[]) => {
        h.inserted.push(rows)
        return h.insertResult
      },
      update: (patch: unknown) => {
        h.updated.push(patch)
        return { eq: () => ({ select: async () => h.updateResult }) }
      },
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import { inspectionKeys, inspectionToInsert, inspectionToUpdate, mapInspectionRow, useAddInspections, useUpdateInspection } from './inspections'

const insp = (over: Partial<Inspection> = {}): Inspection => ({
  id: 'i1', inspectionNumber: 'INSP-2026-0001', assetId: 'a1', templateId: 't1', templateVersion: 1, dueDate: '2026-10-01',
  status: 'Scheduled', createdAt: '2026-09-20', ...over,
})

beforeEach(() => {
  h.inserted = []
  h.updated = []
  h.updateResult = { data: [{ id: 'i1' }], error: null }
  h.insertResult = { error: null }
  toast.mockClear()
})
afterEach(cleanup)

function setup(initial: Inspection[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(inspectionKeys.list('u1'), initial)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { wrapper, list: () => client.getQueryData<Inspection[]>(inspectionKeys.list('u1')) }
}

describe('inspection mapping', () => {
  const row = {
    id: 'i1', inspection_number: 'INSP-2026-0001', asset_id: null, template_id: null, template_version: null,
    conducted_by_user_id: 'u7', conducted_by: 'Sam', due_date: '2026-10-01', status: null, result: null, remarks: null,
    checklist_snapshot: null, checklist_responses: null, photo_url: null, item_photos: null, conducted_at: null, created_at: '2026-09-20',
  }

  it('fills defaults and treats nulls as absent', () => {
    expect(mapInspectionRow(row as never)).toMatchObject({
      assetId: '', templateId: '', templateVersion: 1, assignedInspectorId: 'u7', assignedInspectorName: 'Sam', status: 'Scheduled',
      result: undefined, inspectorRemarks: undefined, checklistSnapshot: [], checklistResponses: {}, photoUrl: undefined,
      itemPhotos: undefined, completedAt: undefined,
    })
  })

  it('the insert falls back to the id as a number and to today as a due date', () => {
    const ins = inspectionToInsert(insp({ inspectionNumber: '', dueDate: '' }))
    expect(ins.inspection_number).toBe('i1')
    expect(ins.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ins).toMatchObject({ status: 'Scheduled', result: null, conducted_by: null, template_version: 1 })
  })

  it('a completion writes result, remarks, responses, photos and the date', () => {
    expect(
      inspectionToUpdate({
        status: 'Completed', result: 'Fail', inspectorRemarks: 'leak', checklistResponses: { a: { value: 'Fail' } },
        photoUrl: 'u', itemPhotos: { a: 'p' }, completedAt: '2026-09-21',
      })
    ).toEqual({
      status: 'Completed', result: 'Fail', remarks: 'leak', checklist_responses: { a: { value: 'Fail' } },
      photo_url: 'u', item_photos: { a: 'p' }, conducted_at: '2026-09-21',
    })
  })

  it('an assignment writes only the inspector; the number and asset are never sent', () => {
    expect(inspectionToUpdate({ assignedInspectorId: 'u9', assignedInspectorName: 'Ann', inspectionNumber: 'X', assetId: 'y' })).toEqual({
      conducted_by_user_id: 'u9', conducted_by: 'Ann',
    })
  })
})

describe('inspection writes', () => {
  it('a batch of scheduled inspections shows at once and saves as one insert', async () => {
    const { wrapper, list } = setup([insp({ id: 'old', inspectionNumber: 'INSP-2026-0000' })])
    const { result } = renderHook(() => useAddInspections('u1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync([insp({ id: 'a' }), insp({ id: 'b' })])
    })
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toHaveLength(2)
    expect(list()?.map(i => i.id)).toContain('a')
  })

  it('a failed schedule is removed again and reported', async () => {
    const { wrapper, list } = setup([insp({ id: 'old' })])
    h.insertResult = { error: { message: 'foreign key violation' } }
    const { result } = renderHook(() => useAddInspections('u1'), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync([insp({ id: 'a' })])).rejects.toThrow('foreign key violation')
    })
    expect(list()?.map(i => i.id)).toEqual(['old'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Schedule inspection failed and was undone'))
  })

  it('completing shows Completed at once; an update matching no rows is undone (what RLS does)', async () => {
    const { wrapper, list } = setup([insp()])
    h.updateResult = { data: [], error: null }
    const { result } = renderHook(() => useUpdateInspection('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'i1', changes: { status: 'Completed', result: 'Pass' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0]).toMatchObject({ status: 'Scheduled' })
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('nothing was changed'))
  })

  it('the inspection number and asset stay put even if a caller passes them', async () => {
    const { wrapper, list } = setup([insp()])
    const { result } = renderHook(() => useUpdateInspection('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'i1', changes: { dueDate: '2026-11-01', inspectionNumber: 'HACK', assetId: 'other' } }))
    await waitFor(() => expect(list()?.[0].dueDate).toBe('2026-11-01'))
    expect(list()?.[0]).toMatchObject({ inspectionNumber: 'INSP-2026-0001', assetId: 'a1' })
  })
})
