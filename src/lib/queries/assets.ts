import { getLocalDateStr } from '@/lib/dateUtils'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { Asset } from '@/types/afms'
import { defineEntity, fetchExistingCodes, table } from './entity'

type Json = TableInsert<'assets'>['dynamic_specifications']

export function mapAssetRow(a: TableRow<'assets'>): Asset {
  return {
    id: a.id,
    assetId: a.asset_id,
    name: a.name,
    subCategoryId: a.sub_category_id ?? '',
    roomId: a.room_id ?? '',
    manufacturer: a.manufacturer ?? undefined,
    modelNumber: a.model_number ?? undefined,
    serialNumber: a.serial_number ?? undefined,
    price: a.price ? Number(a.price) : undefined,
    installationDate: a.installation_date,
    purchaseDate: a.purchase_date ?? undefined,
    lastServicedDate: a.last_serviced_date || undefined,
    warrantyTill: a.warranty_till ?? undefined,
    maintenanceBy: (a.maintenance_by || 'In House') as Asset['maintenanceBy'],
    purchaseVendorId: a.purchase_vendor_id || undefined,
    maintenanceVendorId: a.maintenance_vendor_id || undefined,
    amcStartDate: a.amc_start_date || undefined,
    amcEndDate: a.amc_end_date || undefined,
    assignedToUserId: a.assigned_to_user_id || undefined,
    assignedToUserName: a.assigned_to_user_name || undefined,
    lastPrintedAt: a.last_printed_at || undefined,
    status: (a.status as Asset['status']) || 'Operational',
    imageUrl: a.image_url || undefined,
    notes: a.notes || undefined,
    qrCodeUrl: a.qr_code_url || a.asset_id,
    dynamicSpecifications: (a.dynamic_specifications as Record<string, unknown> | null) || {},
    createdAt: a.created_at,
  }
}

// One mapping for both the single and the bulk add. (The bulk path used to leave
// out the assignee and the AMC dates.)
export function assetToInsert(a: Asset): TableInsert<'assets'> {
  return {
    id: a.id,
    asset_id: a.assetId,
    name: a.name,
    sub_category_id: a.subCategoryId || null,
    room_id: a.roomId || null,
    manufacturer: a.manufacturer || null,
    model_number: a.modelNumber || null,
    serial_number: a.serialNumber || null,
    price: a.price || null,
    installation_date: a.installationDate || getLocalDateStr(),
    last_serviced_date: a.lastServicedDate || null,
    purchase_date: a.purchaseDate || null,
    warranty_till: a.warrantyTill || null,
    maintenance_by: a.maintenanceBy || 'In House',
    purchase_vendor_id: a.purchaseVendorId || null,
    maintenance_vendor_id: a.maintenanceVendorId || null,
    amc_start_date: a.amcStartDate || null,
    amc_end_date: a.amcEndDate || null,
    assigned_to_user_id: a.assignedToUserId || null,
    assigned_to_user_name: a.assignedToUserName || null,
    image_url: a.imageUrl || null,
    notes: a.notes || null,
    status: a.status || 'Operational',
    qr_code_url: a.qrCodeUrl,
    dynamic_specifications: (a.dynamicSpecifications || {}) as Json,
    created_at: new Date().toISOString(),
  }
}

// The fields an edit may change. The asset id, installation date (it anchors the
// PM/inspection schedule generated at creation) and created date are never written.
export function assetToUpdate(changes: Partial<Asset>): TableUpdate<'assets'> {
  const u: TableUpdate<'assets'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.subCategoryId !== undefined) u.sub_category_id = changes.subCategoryId
  if (changes.roomId !== undefined) u.room_id = changes.roomId
  if (changes.manufacturer !== undefined) u.manufacturer = changes.manufacturer
  if (changes.modelNumber !== undefined) u.model_number = changes.modelNumber
  if (changes.serialNumber !== undefined) u.serial_number = changes.serialNumber
  if (changes.price !== undefined) u.price = changes.price
  if (changes.purchaseDate !== undefined) u.purchase_date = changes.purchaseDate
  if (changes.lastServicedDate !== undefined) u.last_serviced_date = changes.lastServicedDate
  if (changes.warrantyTill !== undefined) u.warranty_till = changes.warrantyTill
  if (changes.maintenanceBy !== undefined) u.maintenance_by = changes.maintenanceBy
  if (changes.maintenanceVendorId !== undefined) u.maintenance_vendor_id = changes.maintenanceVendorId
  if (changes.amcStartDate !== undefined) u.amc_start_date = changes.amcStartDate
  if (changes.amcEndDate !== undefined) u.amc_end_date = changes.amcEndDate
  if (changes.purchaseVendorId !== undefined) u.purchase_vendor_id = changes.purchaseVendorId
  if (changes.assignedToUserId !== undefined) u.assigned_to_user_id = changes.assignedToUserId
  if (changes.assignedToUserName !== undefined) u.assigned_to_user_name = changes.assignedToUserName
  if (changes.dynamicSpecifications !== undefined) u.dynamic_specifications = changes.dynamicSpecifications as Json
  if (changes.imageUrl !== undefined) u.image_url = changes.imageUrl
  if (changes.notes !== undefined) u.notes = changes.notes
  if (changes.status !== undefined) u.status = changes.status
  if (changes.qrCodeUrl !== undefined) u.qr_code_url = changes.qrCodeUrl
  if (changes.lastPrintedAt !== undefined) u.last_printed_at = changes.lastPrintedAt
  return u
}

const assets = defineEntity<Asset, 'assets'>({
  table: 'assets',
  label: 'asset',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapAssetRow,
  toInsert: assetToInsert,
  toUpdate: assetToUpdate,
  immutable: ['id', 'assetId', 'createdAt', 'installationDate'],
})

export const assetKeys = { list: assets.key }
export const useUpdateAsset = assets.useUpdate
export const useDeleteAsset = assets.useDelete
export function useAssets(userId: string, enabled: boolean) {
  const { items, ...query } = assets.useList(userId, enabled)
  return { ...query, assets: items }
}

// One write for one asset or a whole import: one insert statement, so a bulk
// upload either lands completely or not at all, and shows/rolls back as a unit.
export function useAddAssets(userId: string) {
  return assets.useWrite<Asset[]>(
    userId,
    'Add asset',
    async created => {
      const { error } = await table('assets').insert(created.map(assetToInsert))
      if (error) throw new Error(error.message)
    },
    (list, created) => [...created, ...list]
  )
}

export type NewAsset = Omit<Asset, 'id' | 'assetId' | 'createdAt'>

// Numbers, ids and QR links for one or many new assets: AST-#### continues from
// the highest number on screen or stored, so a stale list can't reuse one.
export async function allocateAssets(inputs: NewAsset[], known: Asset[]): Promise<Asset[]> {
  const numbers = [...known.map(a => a.assetId || a.id), ...(await fetchExistingCodes('assets', 'asset_id'))]
  let seq = getNextSequence(numbers, 'AST')
  const today = getLocalDateStr()
  return inputs.map(input => {
    const assetId = formatId('AST', seq++)
    return {
      ...input,
      id: generateUUID(),
      assetId,
      imageUrl: input.imageUrl || '/images/asset-placeholder.png',
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AFMS-${assetId}`,
      createdAt: today,
    }
  })
}
