import { getLocalDateStr } from '@/lib/dateUtils'
import { formatId, getNextSequence } from '@/lib/idGenerator'
import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { InventoryItem } from '@/types/afms'
import { defineEntity, fetchExistingCodes } from './entity'

type Json = TableInsert<'inventory_items'>['dynamic_specifications']

export function mapInventoryRow(inv: TableRow<'inventory_items'>): InventoryItem {
  return {
    id: inv.id,
    inventoryNumber: inv.inventory_number || inv.id,
    name: inv.name,
    subCategoryId: inv.sub_category_id || '',
    manufacturer: inv.manufacturer || '',
    modelNumber: inv.model_number || '',
    serialNumber: inv.serial_number || undefined,
    quantity: inv.quantity || 1,
    unit: 'Units',
    minStockThreshold: inv.min_stock_level ?? undefined,
    unitPrice: inv.unit_cost ?? undefined,
    purchaseDate: inv.purchase_date || undefined,
    warrantyTill: inv.warranty_till || undefined,
    storageLocation: inv.storage_location || '',
    roomId: inv.room_id || undefined,
    purchaseVendorId: inv.vendor_id || undefined,
    dynamicSpecifications: (inv.dynamic_specifications as Record<string, unknown> | null) || {},
    imageUrl: inv.image_url || undefined,
    notes: inv.notes || undefined,
    createdAt: inv.created_at ? inv.created_at.split('T')[0] : getLocalDateStr(),
  }
}

export function inventoryToInsert(i: InventoryItem): TableInsert<'inventory_items'> {
  return {
    id: i.id,
    inventory_number: i.inventoryNumber,
    name: i.name,
    sub_category_id: i.subCategoryId || null,
    manufacturer: i.manufacturer || null,
    model_number: i.modelNumber || null,
    serial_number: i.serialNumber || null,
    quantity: i.quantity || 1,
    min_stock_level: i.minStockThreshold ?? null,
    unit_cost: i.unitPrice ?? null,
    vendor_id: i.purchaseVendorId || null,
    storage_location: i.storageLocation || null,
    room_id: i.roomId || null,
    purchase_date: i.purchaseDate || null,
    warranty_till: i.warrantyTill || null,
    dynamic_specifications: (i.dynamicSpecifications || {}) as Json,
    image_url: i.imageUrl || null,
    notes: i.notes || null,
    created_at: new Date().toISOString(),
  }
}

// `unit` has no column (every item reads back as "Units"). Number and created date never change.
export function inventoryToUpdate(changes: Partial<InventoryItem>): TableUpdate<'inventory_items'> {
  const u: TableUpdate<'inventory_items'> = {}
  if (changes.name !== undefined) u.name = changes.name
  if (changes.subCategoryId !== undefined) u.sub_category_id = changes.subCategoryId
  if (changes.manufacturer !== undefined) u.manufacturer = changes.manufacturer
  if (changes.modelNumber !== undefined) u.model_number = changes.modelNumber
  if (changes.serialNumber !== undefined) u.serial_number = changes.serialNumber
  if (changes.quantity !== undefined) u.quantity = changes.quantity
  if (changes.minStockThreshold !== undefined) u.min_stock_level = changes.minStockThreshold
  if (changes.unitPrice !== undefined) u.unit_cost = changes.unitPrice
  if (changes.purchaseVendorId !== undefined) u.vendor_id = changes.purchaseVendorId
  if (changes.storageLocation !== undefined) u.storage_location = changes.storageLocation
  if (changes.roomId !== undefined) u.room_id = changes.roomId
  if (changes.purchaseDate !== undefined) u.purchase_date = changes.purchaseDate
  if (changes.warrantyTill !== undefined) u.warranty_till = changes.warrantyTill
  if (changes.dynamicSpecifications !== undefined) u.dynamic_specifications = changes.dynamicSpecifications as Json
  if (changes.imageUrl !== undefined) u.image_url = changes.imageUrl
  if (changes.notes !== undefined) u.notes = changes.notes
  return u
}

const inventory = defineEntity<InventoryItem, 'inventory_items'>({
  table: 'inventory_items',
  label: 'spare part',
  orderBy: 'created_at',
  descending: true,
  fromRow: mapInventoryRow,
  toInsert: inventoryToInsert,
  toUpdate: inventoryToUpdate,
  immutable: ['id', 'inventoryNumber', 'createdAt'],
})

export const inventoryKeys = { list: inventory.key }
export const useAddInventoryItem = inventory.useAdd
export const useUpdateInventoryItem = inventory.useUpdate
export const useDeleteInventoryItem = inventory.useDelete
export function useInventoryItems(userId: string, enabled: boolean) {
  const { items, ...query } = inventory.useList(userId, enabled)
  return { ...query, inventoryItems: items }
}

// The next INV-#### number, checked against stored numbers as well as the list on
// screen (the id is a UUID, so it is the inventoryNumber that carries the sequence).
export async function allocateInventoryItem(
  input: Omit<InventoryItem, 'id' | 'inventoryNumber' | 'createdAt'>,
  known: InventoryItem[]
): Promise<InventoryItem> {
  const numbers = [...known.map(i => i.inventoryNumber || i.id), ...(await fetchExistingCodes('inventory_items', 'inventory_number'))]
  return {
    ...input,
    id: generateUUID(),
    inventoryNumber: formatId('INV', getNextSequence(numbers, 'INV')),
    createdAt: getLocalDateStr(),
  }
}
