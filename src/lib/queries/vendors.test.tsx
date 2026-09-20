import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Vendor } from '@/types/afms'

// A scriptable stand-in for the typed Supabase client: each test decides what
// the vendors table answers, and can hold a write open to look at the cache mid-flight.
const h = vi.hoisted(() => {
  const state = {
    rows: [] as Record<string, unknown>[],
    result: { data: null as unknown, error: null as { message: string } | null },
    gate: null as Promise<void> | null,
    calls: [] as string[],
  }
  return { state }
})

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({ order: async () => ({ data: h.state.rows, error: null }), then: (r: (v: unknown) => void) => r({ data: h.state.rows, error: null }) }),
      insert: async () => {
        h.state.calls.push('insert')
        if (h.state.gate) await h.state.gate
        return h.state.result
      },
      update: () => ({ eq: () => ({ select: async () => {
        h.state.calls.push('update')
        if (h.state.gate) await h.state.gate
        return h.state.result
      } }) }),
      delete: () => ({ eq: () => ({ select: async () => {
        h.state.calls.push('delete')
        if (h.state.gate) await h.state.gate
        return h.state.result
      } }) }),
    }),
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import {
  mapVendorRow, useAddVendor, useDeleteVendor, useUpdateVendor, useVendors, vendorKeys, vendorToInsert, vendorToUpdate,
} from './vendors'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v1', code: 'VND-0001', name: 'Acme', category_supplied: 'Electrical', contact_person: 'Sam',
  email: 'a@x.test', phone: '123', address: 'Dock 1', has_amc: true, amc_contract_no: 'C-1',
  amc_start_date: '2026-01-01', amc_end_date: '2027-01-01', created_at: 'now', ...over,
})

const acme: Vendor = {
  id: 'v1', code: 'VND-0001', name: 'Acme', categorySupplied: 'Electrical', contactPerson: 'Sam',
  email: 'a@x.test', phone: '123', address: 'Dock 1', hasAmc: true, amcContractNo: 'C-1',
  amcStartDate: '2026-01-01', amcEndDate: '2027-01-01',
}

describe('vendor row mapping', () => {
  it('maps a database row to a Vendor', () => {
    expect(mapVendorRow(row() as never)).toEqual(acme)
  })

  it('fills blanks and treats null AMC fields as absent', () => {
    const v = mapVendorRow(row({ code: null, category_supplied: null, has_amc: null, amc_contract_no: null, amc_start_date: null, amc_end_date: null }) as never)
    expect(v).toMatchObject({ code: undefined, categorySupplied: '', hasAmc: false, amcContractNo: undefined, amcStartDate: undefined })
  })

  it('builds an insert row, using null for empty AMC fields', () => {
    const ins = vendorToInsert({ ...acme, amcContractNo: '', amcStartDate: undefined, hasAmc: false })
    expect(ins).toMatchObject({ id: 'v1', code: 'VND-0001', has_amc: false, amc_contract_no: null, amc_start_date: null, amc_end_date: '2027-01-01' })
  })

  it('builds an update from only the fields that were set, never id or code', () => {
    expect(vendorToUpdate({ name: 'New', phone: '9' })).toEqual({ name: 'New', phone: '9' })
    expect(vendorToUpdate({ id: 'zzz', code: 'VND-9999' })).toEqual({})
  })
})

function setup(initial: Vendor[] = [acme]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(vendorKeys.list('u1'), initial)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const list = () => client.getQueryData<Vendor[]>(vendorKeys.list('u1'))
  return { client, wrapper, list }
}

beforeEach(() => {
  h.state.rows = [row()]
  h.state.result = { data: [{ id: 'v1' }], error: null }
  h.state.gate = null
  h.state.calls = []
  toast.mockClear()
})
afterEach(cleanup)

describe('useVendors', () => {
  it('loads and maps the vendors, and stays idle while disabled', async () => {
    const { wrapper, client } = setup([])
    client.removeQueries()
    const off = renderHook(() => useVendors('u1', false), { wrapper })
    expect(off.result.current.vendors).toEqual([])
    expect(off.result.current.isLoading).toBe(false)

    const on = renderHook(() => useVendors('u1', true), { wrapper })
    await waitFor(() => expect(on.result.current.vendors).toEqual([acme]))
  })
})

describe('vendor writes', () => {
  it('update: shows the change immediately, keeps it on success', async () => {
    const { wrapper, list } = setup()
    let release!: () => void
    h.state.gate = new Promise<void>(r => { release = r })
    const { result } = renderHook(() => useUpdateVendor('u1'), { wrapper })

    act(() => result.current.mutate({ id: 'v1', changes: { name: 'Renamed' } }))
    await waitFor(() => expect(list()?.[0].name).toBe('Renamed'))
    expect(result.current.isSuccess).toBe(false) // the write is still in flight, yet the cache already shows the change

    release()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast).not.toHaveBeenCalled()
  })

  it('update: rolls back and says so when the write fails', async () => {
    const { wrapper, list } = setup()
    h.state.result = { data: null, error: { message: 'permission denied' } }
    const { result } = renderHook(() => useUpdateVendor('u1'), { wrapper })

    act(() => result.current.mutate({ id: 'v1', changes: { name: 'Renamed' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0].name).toBe('Acme')
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Update vendor failed and was undone: permission denied'))
  })

  it('update: treats a write that matched no rows as a failure (what RLS does)', async () => {
    const { wrapper, list } = setup()
    h.state.result = { data: [], error: null }
    const { result } = renderHook(() => useUpdateVendor('u1'), { wrapper })

    act(() => result.current.mutate({ id: 'v1', changes: { name: 'Renamed' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0].name).toBe('Acme')
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('nothing was changed'))
  })

  it('update: cannot change id or code through the cache either', async () => {
    const { wrapper, list } = setup()
    const { result } = renderHook(() => useUpdateVendor('u1'), { wrapper })
    act(() => result.current.mutate({ id: 'v1', changes: { name: 'X', id: 'hacked', code: 'VND-9999' } }))
    await waitFor(() => expect(list()?.[0].name).toBe('X'))
    expect(list()?.[0]).toMatchObject({ id: 'v1', code: 'VND-0001' })
  })

  it('delete: removes immediately and restores the vendor if the delete fails', async () => {
    const { wrapper, list } = setup([acme, { ...acme, id: 'v2', code: 'VND-0002', name: 'Beta' }])
    let release!: () => void
    h.state.gate = new Promise<void>(r => { release = r })
    h.state.result = { data: null, error: { message: 'foreign key violation' } }
    const { result } = renderHook(() => useDeleteVendor('u1'), { wrapper })

    act(() => result.current.mutate('v1'))
    await waitFor(() => expect(list()?.map(v => v.id)).toEqual(['v2']))

    release()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.map(v => v.id)).toEqual(['v1', 'v2'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Delete vendor failed and was undone'))
  })

  it('add: appears immediately; a failed insert rejects, removes it again and toasts', async () => {
    const { wrapper, list } = setup()
    let release!: () => void
    h.state.gate = new Promise<void>(r => { release = r })
    h.state.result = { data: null, error: { message: 'duplicate key' } }
    const { result } = renderHook(() => useAddVendor('u1'), { wrapper })

    const newVendor: Vendor = { ...acme, id: 'v9', code: 'VND-0009', name: 'Fresh' }
    let outcome: Promise<void>
    act(() => { outcome = result.current.mutateAsync(newVendor) })
    await waitFor(() => expect(list()?.map(v => v.id)).toEqual(['v1', 'v9']))

    release()
    await expect(outcome!).rejects.toThrow('duplicate key')
    expect(list()?.map(v => v.id)).toEqual(['v1'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Add vendor failed and was undone: duplicate key'))
  })
})
