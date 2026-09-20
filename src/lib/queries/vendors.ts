import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db, type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import { showToast } from '@/lib/toast'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { Vendor } from '@/types/afms'

// Vendors: the pilot entity for the move from AFMSContext to TanStack Query.
// Everything about vendors that touches the database lives here -- the read, the
// row <-> Vendor mapping, and the three writes with optimistic update, rollback
// and a toast on failure. AFMSContext re-exposes it under its old names
// (vendors / addVendor / updateVendor / deleteVendor), so pages don't change.

// userId is part of the key so two people signing in on one browser never share
// a cache; the rows are RLS-scoped per user.
export const vendorKeys = {
  list: (userId: string) => ['vendors', userId] as const,
}

const NO_ROWS = 'nothing was changed (you may not have permission, or it no longer exists)'

export function mapVendorRow(v: TableRow<'vendors'>): Vendor {
  return {
    id: v.id,
    code: v.code || undefined,
    name: v.name,
    categorySupplied: v.category_supplied || '',
    contactPerson: v.contact_person || '',
    email: v.email || '',
    phone: v.phone || '',
    address: v.address || '',
    hasAmc: Boolean(v.has_amc),
    amcContractNo: v.amc_contract_no ?? undefined,
    amcStartDate: v.amc_start_date ?? undefined,
    amcEndDate: v.amc_end_date ?? undefined,
  }
}

export function vendorToInsert(v: Vendor): TableInsert<'vendors'> {
  return {
    id: v.id,
    code: v.code,
    name: v.name,
    category_supplied: v.categorySupplied || '',
    contact_person: v.contactPerson || '',
    email: v.email || '',
    phone: v.phone || '',
    address: v.address || '',
    has_amc: Boolean(v.hasAmc),
    amc_contract_no: v.amcContractNo || null,
    amc_start_date: v.amcStartDate || null,
    amc_end_date: v.amcEndDate || null,
  }
}

// Only the fields the caller actually set. `id` and `code` are immutable.
export function vendorToUpdate(changes: Partial<Vendor>): TableUpdate<'vendors'> {
  const u: TableUpdate<'vendors'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.categorySupplied !== undefined) u.category_supplied = changes.categorySupplied
  if (changes.contactPerson !== undefined) u.contact_person = changes.contactPerson
  if (changes.email !== undefined) u.email = changes.email
  if (changes.phone !== undefined) u.phone = changes.phone
  if (changes.address !== undefined) u.address = changes.address
  if (changes.hasAmc !== undefined) u.has_amc = changes.hasAmc
  if (changes.amcContractNo !== undefined) u.amc_contract_no = changes.amcContractNo
  if (changes.amcStartDate !== undefined) u.amc_start_date = changes.amcStartDate
  if (changes.amcEndDate !== undefined) u.amc_end_date = changes.amcEndDate
  return u
}

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await db.from('vendors').select('*').order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapVendorRow)
}

// The next VND-#### code, checked against the database as well as what is on
// screen (another admin may have added one since this tab loaded).
export async function allocateVendor(input: Omit<Vendor, 'id' | 'code'>, known: Vendor[]): Promise<Vendor> {
  const { data } = await db.from('vendors').select('code')
  const codes = [
    ...known.map(v => v.code || v.id),
    ...(data ?? []).map(r => r.code).filter((c): c is string => Boolean(c)),
  ]
  return { ...input, id: generateUUID(), code: formatId('VND', getNextSequence(codes, 'VND')) }
}

const EMPTY: Vendor[] = []

export function useVendors(userId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: vendorKeys.list(userId),
    queryFn: fetchVendors,
    enabled,
  })
  // A stable empty array, so `vendors` doesn't change identity every render
  // while nothing is loaded (it is used in effect dependency lists).
  return { ...query, vendors: query.data ?? EMPTY }
}

type Snapshot = { previous: Vendor[] | undefined }

// Shared shape of the three writes: cancel in-flight reads, apply the change to
// the cache straight away, and on failure put the old list back and say so.
function useVendorMutation<TVars>(
  userId: string,
  label: string,
  write: (vars: TVars) => Promise<void>,
  apply: (list: Vendor[], vars: TVars) => Vendor[]
) {
  const qc = useQueryClient()
  const key = vendorKeys.list(userId)
  return useMutation<void, Error, TVars, Snapshot>({
    mutationFn: write,
    onMutate: async vars => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Vendor[]>(key)
      qc.setQueryData<Vendor[]>(key, list => apply(list ?? [], vars))
      return { previous }
    },
    onError: (error, _vars, snapshot) => {
      if (snapshot) qc.setQueryData(key, snapshot.previous)
      console.error(`Supabase ${label} error:`, error.message)
      showToast('error', `${label} failed and was undone: ${error.message}`)
    },
    // Whatever happened, re-read so the screen shows what the database holds.
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useAddVendor(userId: string) {
  return useVendorMutation<Vendor>(
    userId,
    'Add vendor',
    async vendor => {
      const { error } = await db.from('vendors').insert([vendorToInsert(vendor)])
      if (error) throw new Error(error.message)
    },
    (list, vendor) => [...list, vendor]
  )
}

export function useUpdateVendor(userId: string) {
  return useVendorMutation<{ id: string; changes: Partial<Vendor> }>(
    userId,
    'Update vendor',
    async ({ id, changes }) => {
      const patch = vendorToUpdate(changes)
      if (Object.keys(patch).length === 0) return
      const { data, error } = await db.from('vendors').update(patch).eq('id', id).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error(NO_ROWS)
    },
    (list, { id, changes }) => list.map(v => (v.id === id ? { ...v, ...changes, id: v.id, code: v.code } : v))
  )
}

export function useDeleteVendor(userId: string) {
  return useVendorMutation<string>(
    userId,
    'Delete vendor',
    async id => {
      const { data, error } = await db.from('vendors').delete().eq('id', id).select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) throw new Error(NO_ROWS)
    },
    (list, id) => list.filter(v => v.id !== id)
  )
}
