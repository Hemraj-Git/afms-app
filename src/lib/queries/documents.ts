import { generateUUID } from '@/lib/uuid'
import type { TableInsert, TableRow, TableUpdate } from '@/lib/supabase/typed'
import type { DocumentItem } from '@/types/afms'
import { defineEntity } from './entity'

// A document row links to at most one asset and one spare part. The app-level
// `linkedAssetIds` mixes both, so the cache also carries the two real columns.
export type DocumentEntity = DocumentItem & { assetId: string | null; inventoryItemId: string | null }

export function mapDocumentRow(d: TableRow<'documents'>): DocumentEntity {
  return {
    id: d.id,
    title: d.title,
    fileType: (d.file_type as DocumentItem['fileType']) || 'Invoice',
    fileUrl: d.file_url || '',
    fileSizeKb: Math.round((d.file_size_bytes || 102400) / 1024),
    uploadedBy: d.uploaded_by_user_name || 'Staff',
    uploadedAt: d.uploaded_at,
    linkedAssetIds: [d.asset_id, d.inventory_item_id].filter((x): x is string => Boolean(x)),
    assetId: d.asset_id,
    inventoryItemId: d.inventory_item_id,
  }
}

export function documentToInsert(d: DocumentEntity): TableInsert<'documents'> {
  return {
    id: d.id,
    title: d.title,
    category: 'General',
    file_name: d.title.replace(/[^a-zA-Z0-9.-]/g, '_') + '.pdf',
    file_type: d.fileType || 'Invoice',
    file_size_bytes: (d.fileSizeKb || 100) * 1024,
    file_url: d.fileUrl,
    uploaded_by_user_name: d.uploadedBy || 'Staff',
    uploaded_at: d.uploadedAt,
    asset_id: d.assetId,
    inventory_item_id: d.inventoryItemId,
  }
}

// Only the two link columns are ever edited.
export function documentToUpdate(changes: Partial<DocumentEntity>): TableUpdate<'documents'> {
  const u: TableUpdate<'documents'> = {}
  if (changes.assetId !== undefined) u.asset_id = changes.assetId
  if (changes.inventoryItemId !== undefined) u.inventory_item_id = changes.inventoryItemId
  return u
}

const documents = defineEntity<DocumentEntity, 'documents'>({
  table: 'documents',
  label: 'document',
  orderBy: 'uploaded_at',
  descending: true,
  fromRow: mapDocumentRow,
  toInsert: documentToInsert,
  toUpdate: documentToUpdate,
  immutable: ['id', 'uploadedAt'],
})

export const documentKeys = { list: documents.key }
export const useAddDocument = documents.useAdd
export const useUpdateDocument = documents.useUpdate
export const useDeleteDocument = documents.useDelete
export function useDocuments(userId: string, enabled: boolean) {
  const { items, ...query } = documents.useList(userId, enabled)
  return { ...query, documents: items }
}

// The first linked id is resolved against assets, then spare parts (the wizards
// pass one flat list without saying which kind). Resolving needs both lists, so
// the caller supplies the two real ids.
export function newDocument(
  input: Omit<DocumentItem, 'id' | 'uploadedAt'>,
  links: { assetId: string | null; inventoryItemId: string | null }
): DocumentEntity {
  return { ...input, id: generateUUID(), uploadedAt: new Date().toISOString(), ...links }
}
