import { type TableInsert, type TableRow, type TableUpdate } from '@/lib/supabase/typed'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { Vendor } from '@/types/afms'
import { defineEntity, fetchExistingCodes } from './entity'

// Vendors: the pilot entity for the move from AFMSContext to TanStack Query.
// AFMSContext re-exposes these hooks under the old names (vendors / addVendor /
// updateVendor / deleteVendor), so pages don't change.

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

const vendors = defineEntity<Vendor, 'vendors'>({
  table: 'vendors',
  label: 'vendor',
  orderBy: 'name',
  fromRow: mapVendorRow,
  toInsert: vendorToInsert,
  toUpdate: vendorToUpdate,
  immutable: ['id', 'code'],
})

export const vendorKeys = { list: vendors.key }
export const fetchVendors = vendors.fetchAll
export const useAddVendor = vendors.useAdd
export const useUpdateVendor = vendors.useUpdate
export const useDeleteVendor = vendors.useDelete

export function useVendors(userId: string, enabled: boolean) {
  const { items, ...query } = vendors.useList(userId, enabled)
  return { ...query, data: query.data, vendors: items }
}

// The next VND-#### code, checked against the database as well as what is on
// screen (another admin may have added one since this tab loaded).
export async function allocateVendor(input: Omit<Vendor, 'id' | 'code'>, known: Vendor[]): Promise<Vendor> {
  const codes = [...known.map(v => v.code || v.id), ...(await fetchExistingCodes('vendors'))]
  return { ...input, id: generateUUID(), code: formatId('VND', getNextSequence(codes, 'VND')) }
}
