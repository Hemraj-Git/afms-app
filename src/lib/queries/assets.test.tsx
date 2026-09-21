import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@/types/afms'

const h = vi.hoisted(() => ({
  dbAssetIds: [] as string[],
  insertResult: { error: null as { message: string } | null },
  inserted: [] as unknown[][],
  gate: null as Promise<void> | null,
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: h.dbAssetIds.map(asset_id => ({ asset_id })), error: null }),
      }),
      insert: async (rows: unknown[]) => {
        h.inserted.push(rows)
        if (h.gate) await h.gate
        return h.insertResult
      },
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import { allocateAssets, assetKeys, assetToInsert, assetToUpdate, mapAssetRow, useAddAssets } from './assets'

const base = {
  name: 'Pump', subCategoryId: 's1', roomId: 'r1', installationDate: '2026-01-01', maintenanceBy: 'In House' as const,
  dynamicSpecifications: {}, status: 'Operational' as const,
}

const existing: Asset = { ...base, id: 'u-old', assetId: 'AST-0003', createdAt: '2026-01-01', qrCodeUrl: 'q' }

beforeEach(() => {
  h.dbAssetIds = []
  h.insertResult = { error: null }
  h.inserted = []
  h.gate = null
  toast.mockClear()
})
afterEach(cleanup)

describe('asset mapping', () => {
  const row = {
    id: 'a1', asset_id: 'AST-0001', name: 'Pump', sub_category_id: null, room_id: null, manufacturer: null, model_number: null,
    serial_number: null, price: 1200, installation_date: '2026-01-01', purchase_date: null, last_serviced_date: null,
    warranty_till: null, maintenance_by: null, purchase_vendor_id: null, maintenance_vendor_id: null, amc_start_date: null,
    amc_end_date: null, assigned_to_user_id: null, assigned_to_user_name: null, last_printed_at: null, status: null,
    image_url: null, notes: null, qr_code_url: null, dynamic_specifications: null, created_at: '2026-01-01T00:00:00Z',
  }

  it('fills defaults and treats nulls as absent', () => {
    expect(mapAssetRow(row as never)).toMatchObject({
      subCategoryId: '', roomId: '', manufacturer: undefined, price: 1200, maintenanceBy: 'In House', status: 'Operational',
      qrCodeUrl: 'AST-0001', dynamicSpecifications: {}, warrantyTill: undefined,
    })
  })

  it('a price of 0 or null reads back as no price', () => {
    expect(mapAssetRow({ ...row, price: 0 } as never).price).toBeUndefined()
  })
})

describe('asset writes', () => {
  it('the insert includes the assignee and AMC dates (the bulk path used to drop them)', () => {
    const ins = assetToInsert({
      ...existing, assignedToUserId: 'u9', assignedToUserName: 'Sam', amcStartDate: '2026-02-01', amcEndDate: '2027-02-01',
    })
    expect(ins).toMatchObject({
      assigned_to_user_id: 'u9', assigned_to_user_name: 'Sam', amc_start_date: '2026-02-01', amc_end_date: '2027-02-01',
      asset_id: 'AST-0003', room_id: 'r1',
    })
    expect(typeof ins.created_at).toBe('string')
  })

  it('an edit never writes the asset id, installation date or created date', () => {
    expect(assetToUpdate({ assetId: 'AST-9999', installationDate: '2020-01-01', createdAt: 'x', id: 'y' })).toEqual({})
    expect(assetToUpdate({ name: 'New', status: 'Retired', lastPrintedAt: '2026-09-20' })).toEqual({
      name: 'New', status: 'Retired', last_printed_at: '2026-09-20',
    })
  })
})

describe('allocateAssets', () => {
  it('continues from the highest number on screen or stored, one per asset', async () => {
    h.dbAssetIds = ['AST-0009']
    const made = await allocateAssets([{ ...base }, { ...base, name: 'Fan' }, { ...base, name: 'Lamp' }], [existing])
    expect(made.map(a => a.assetId)).toEqual(['AST-0010', 'AST-0011', 'AST-0012'])
    expect(new Set(made.map(a => a.id)).size).toBe(3)
  })

  it('starts at AST-0001 when nothing exists, and adds the placeholder image and QR link', async () => {
    const [a] = await allocateAssets([{ ...base }], [])
    expect(a.assetId).toBe('AST-0001')
    expect(a.imageUrl).toBe('/images/asset-placeholder.png')
    expect(a.qrCodeUrl).toContain('AFMS-AST-0001')
    expect((await allocateAssets([{ ...base, imageUrl: '/mine.png' }], []))[0].imageUrl).toBe('/mine.png')
  })
})

describe('useAddAssets', () => {
  function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    client.setQueryData(assetKeys.list('u1'), [existing])
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return { wrapper, list: () => client.getQueryData<Asset[]>(assetKeys.list('u1')) }
  }
  const made = async () => allocateAssets([{ ...base, name: 'A' }, { ...base, name: 'B' }], [existing])

  it('shows the whole import at once, newest first, and saves it as one insert', async () => {
    const { wrapper, list } = setup()
    const created = await made()
    let release!: () => void
    h.gate = new Promise<void>(r => { release = r })
    const { result } = renderHook(() => useAddAssets('u1'), { wrapper })

    let done: Promise<void>
    act(() => { done = result.current.mutateAsync(created) })
    await waitFor(() => expect(list()?.map(a => a.name)).toEqual(['A', 'B', 'Pump']))
    release()
    await done!
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0]).toHaveLength(2)
    expect(toast).not.toHaveBeenCalled()
  })

  it('a failed import is removed again as a unit, rejects, and toasts', async () => {
    const { wrapper, list } = setup()
    const created = await made()
    h.insertResult = { error: { message: 'duplicate key value' } }
    const { result } = renderHook(() => useAddAssets('u1'), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync(created)).rejects.toThrow('duplicate key value')
    })
    expect(list()?.map(a => a.assetId)).toEqual(['AST-0003'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Add asset failed and was undone: duplicate key value'))
  })
})
