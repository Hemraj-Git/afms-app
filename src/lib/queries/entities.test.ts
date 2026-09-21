import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Building, Campus, Category, Department, SubCategory } from '@/types/afms'

// The codes "already in the database" for whichever table a test asks about.
const h = vi.hoisted(() => ({ dbCodes: [] as string[] }))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    from: () => ({
      select: () => ({
        order: async () => ({ data: [], error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: h.dbCodes.map(code => ({ code, room_number: code, inventory_number: code })), error: null }),
      }),
    }),
  },
}))

import { uniqueCode } from './entity'
import { allocateDepartment, departmentToInsert, departmentToUpdate, mapDepartmentRow } from './departments'
import { allocateCampus, campusToUpdate, mapCampusRow } from './campuses'
import { allocateBuilding, buildingToInsert, buildingToUpdate, mapBuildingRow } from './buildings'
import { allocateCategory, categoryToUpdate, mapCategoryRow } from './categories'
import { allocateSubCategory, mapSubCategoryRow, subCategoryToInsert, subCategoryToUpdate } from './subCategories'
import { allocateRoom, mapRoomRow, roomToInsert, roomToUpdate } from './rooms'
import { allocateInventoryItem, inventoryToInsert, inventoryToUpdate, mapInventoryRow } from './inventory'
import { documentToInsert, documentToUpdate, mapDocumentRow, newDocument } from './documents'
import { checklistTemplateToInsert, checklistTemplateToUpdate, mapChecklistTemplateRow, newChecklistTemplate } from './checklistTemplates'

beforeEach(() => {
  h.dbCodes = []
})

describe('uniqueCode', () => {
  it('keeps a free code and numbers a taken one from 2', () => {
    expect(uniqueCode('ELEC', [])).toBe('ELEC')
    expect(uniqueCode('ELEC', ['ELEC'])).toBe('ELEC-2')
    expect(uniqueCode('ELEC', ['ELEC', 'ELEC-2', 'ELEC-3'])).toBe('ELEC-4')
  })
})

describe('code allocation checks the database as well as the screen', () => {
  const cat = (code: string): Category => ({ id: `id-${code}`, name: code, code })

  it('categories: Electrical and Electronics both start ELEC, the second becomes ELEC-2', async () => {
    const first = await allocateCategory({ name: 'Electrical' }, [])
    expect(first.code).toBe('ELEC')
    const second = await allocateCategory({ name: 'Electronics' }, [cat('ELEC')])
    expect(second.code).toBe('ELEC-2')
  })

  it('categories: a code that only exists in the database (not loaded on screen) is still avoided', async () => {
    h.dbCodes = ['ELEC']
    expect((await allocateCategory({ name: 'Electrical' }, [])).code).toBe('ELEC-2')
  })

  it('campuses: continues the CAM sequence from the highest code seen anywhere', async () => {
    h.dbCodes = ['CAM-0007']
    const onScreen: Campus[] = [{ id: 'a', name: 'A', code: 'CAM-0002', address: '' }]
    expect((await allocateCampus({ name: 'B', address: '' }, onScreen)).code).toBe('CAM-0008')
  })

  it('buildings: continues the BLD sequence, starting at 1', async () => {
    expect((await allocateBuilding({ campusId: 'c', name: 'B', totalFloors: 2 }, [])).code).toBe('BLD-0001')
    const onScreen: Building[] = [{ id: 'a', campusId: 'c', name: 'A', code: 'BLD-0004', totalFloors: 1 }]
    expect((await allocateBuilding({ campusId: 'c', name: 'B', totalFloors: 2 }, onScreen)).code).toBe('BLD-0005')
  })

  it('departments: uses the typed code, disambiguates a clash, and stamps a created date', async () => {
    const known: Department[] = [{ id: 'a', name: 'Marine', code: 'MAR' }]
    const d = await allocateDepartment({ name: 'Marketing', code: 'MAR' }, known)
    expect(d.code).toBe('MAR-2')
    expect(d.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sub-categories: the parent code prefixes it and a clash gets a suffix', async () => {
    h.dbCodes = ['FURN-OFFI']
    const sub = await allocateSubCategory({ categoryId: 'c', name: 'Office Chair', metadataFields: [] }, 'FURN', [])
    expect(sub.code).toBe('FURN-OFFI-2')
  })
})

describe('row mapping', () => {
  it('department: blank description, created date carried', () => {
    expect(mapDepartmentRow({ id: '1', name: 'Ops', code: 'OPS', description: null, head_user_id: null, created_at: '2026-01-01' })).toEqual({
      id: '1', name: 'Ops', code: 'OPS', description: '', headUserId: undefined, createdAt: '2026-01-01',
    })
    expect(mapDepartmentRow({ id: '1', name: 'Ops', code: 'OPS', description: null, head_user_id: 'user-7', created_at: 'x' })).toMatchObject({
      headUserId: 'user-7',
    })
    expect(departmentToInsert({ id: '1', name: 'Ops', code: 'OPS', headOfDepartment: 'typed text is never stored' })).toEqual({
      id: '1', name: 'Ops', code: 'OPS', description: '', head_user_id: null,
    })
    expect(departmentToInsert({ id: '1', name: 'Ops', code: 'OPS', headUserId: 'user-7' })).toMatchObject({ head_user_id: 'user-7' })
  })

  it('department: a code change is allowed; nothing else is invented', () => {
    expect(departmentToUpdate({ code: 'NEW' })).toEqual({ code: 'NEW' })
    expect(departmentToUpdate({ headOfDepartment: 'Sam' })).toEqual({})
    // choosing a head, and clearing one
    expect(departmentToUpdate({ headUserId: 'user-7' })).toEqual({ head_user_id: 'user-7' })
    expect(departmentToUpdate({ headUserId: null })).toEqual({ head_user_id: null })
  })

  it('campus, building and category updates only send editable fields', () => {
    expect(campusToUpdate({ id: 'x', code: 'CAM-9999', name: 'N', address: 'A' })).toEqual({ name: 'N', address: 'A' })
    expect(categoryToUpdate({ id: 'x', code: 'ZZZZ', name: 'N' })).toEqual({ name: 'N' })
    expect(buildingToUpdate({ id: 'x', code: 'BLD-9999', name: 'N', totalFloors: 3, campusId: 'c2' })).toEqual({
      name: 'N', total_floors: 3, campus_id: 'c2',
    })
  })

  it('campus, building and category rows map with blanks filled', () => {
    expect(mapCampusRow({ id: '1', name: 'Main', code: 'CAM-0001', address: null, created_at: 'x' })).toMatchObject({ address: '' })
    expect(mapCategoryRow({ id: '1', name: 'Elec', code: 'ELEC', description: null, created_at: 'x' })).toMatchObject({ description: '' })
    expect(mapBuildingRow({ id: '1', campus_id: null, name: 'B', code: 'BLD-0001', total_floors: null, created_at: 'x' })).toMatchObject({
      campusId: '', totalFloors: 1,
    })
    expect(buildingToInsert({ id: '1', campusId: '', name: 'B', code: 'BLD-0001', totalFloors: 0 })).toMatchObject({
      campus_id: null, total_floors: 1,
    })
  })
})

describe('sub-category mapping', () => {
  const row = {
    id: '1', category_id: 'c1', name: 'Light', code: 'ELEC-LIGH', description: null,
    metadata_fields: [{ key: 'watts', label: 'Watts', type: 'Number', required: false, order: 1 }],
    pm_template_ids: ['t1'], inspection_template_ids: null, sla_priority: 'Medium', created_at: 'x',
  }

  it('maps arrays, and blanks for missing ones', () => {
    const s = mapSubCategoryRow(row as never)
    expect(s).toMatchObject({ categoryId: 'c1', description: '', slaPriority: 'Medium', pmTemplateIds: ['t1'], inspectionTemplateIds: [] })
    expect(s.metadataFields).toHaveLength(1)
  })

  it('writes template ids as de-duplicated arrays, accepting the single-id shorthand', () => {
    const s: SubCategory = { id: '1', categoryId: 'c1', name: 'Light', code: 'ELEC-LIGH', metadataFields: [], pmTemplateIds: ['a', 'a', 'b'], inspectionTemplateId: 'i1' }
    expect(subCategoryToInsert(s)).toMatchObject({ pm_template_ids: ['a', 'b'], inspection_template_ids: ['i1'] })
  })

  it('saves the SLA priority chosen for the sub-category, defaulting to Medium', () => {
    const base: SubCategory = { id: '1', categoryId: 'c1', name: 'Light', code: 'ELEC-LIGH', metadataFields: [] }
    expect(subCategoryToInsert({ ...base, slaPriority: 'Critical' })).toMatchObject({ sla_priority: 'Critical' })
    expect(subCategoryToInsert(base)).toMatchObject({ sla_priority: 'Medium' })
    expect(mapSubCategoryRow({ ...row, sla_priority: null } as never).slaPriority).toBeUndefined()
  })

  it('update touches template arrays only when a template field was supplied', () => {
    expect(subCategoryToUpdate({ name: 'N' })).toEqual({ name: 'N' })
    expect(subCategoryToUpdate({ slaPriority: 'Critical' })).toEqual({ sla_priority: 'Critical' })
    expect(subCategoryToUpdate({ pmTemplateId: 'p1' })).toEqual({ pm_template_ids: ['p1'] })
    expect(subCategoryToUpdate({ inspectionTemplateIds: [] })).toEqual({ inspection_template_ids: [] })
  })
})

describe('rooms', () => {
  const row = {
    id: 'r1', building_id: null, name: 'Lab', room_number: 'ROM-0003', type: null, floor: '2nd Floor',
    room_size_sqft: 350, is_reservable: null, qr_code_key: '', status: 'Occupied', current_occupant: 'Sam',
    last_printed_at: '2026-09-01', created_at: 'x',
  }

  it('maps a row, filling defaults', () => {
    expect(mapRoomRow(row as never)).toMatchObject({
      buildingId: '', type: 'General', floor: '2nd Floor', roomSizeSqft: 350, isReservable: false,
      qrCodeKey: 'ROOM-ROM-0003', status: 'Occupied', currentOccupant: 'Sam', lastPrintedAt: '2026-09-01',
    })
  })

  it('numbers a new room after the highest stored one and uses it as the QR key', async () => {
    h.dbCodes = ['ROM-0009']
    const r = await allocateRoom({ buildingId: 'b', name: 'X', type: 'Office', isReservable: true, status: 'Available' }, [])
    expect(r.roomNumber).toBe('ROM-0010')
    expect(r.qrCodeKey).toBe('ROM-0010')
  })

  it('saves building, floor, size and last-printed on edit, never the room number', () => {
    expect(roomToUpdate({ buildingId: 'b2', floor: '3rd', roomSizeSqft: 500, lastPrintedAt: '2026-09-20', roomNumber: 'ROM-9999', qrCodeKey: 'x' })).toEqual({
      building_id: 'b2', floor: '3rd', room_size_sqft: 500, last_printed_at: '2026-09-20',
    })
    expect(roomToInsert({ ...mapRoomRow(row as never), floor: undefined })).toMatchObject({ floor: null, room_number: 'ROM-0003' })
  })
})

describe('inventory', () => {
  const row = {
    id: 'i1', inventory_number: 'INV-0002', name: 'Bearing', sub_category_id: null, manufacturer: null, model_number: null,
    serial_number: null, quantity: null, min_stock_level: 0, unit_cost: 12.5, purchase_date: null, warranty_till: null,
    storage_location: null, room_id: null, vendor_id: null, dynamic_specifications: null, image_url: null, notes: null,
    created_at: '2026-09-01T10:00:00Z',
  }

  it('maps a row: blanks filled, zero threshold kept, created date without the time', () => {
    expect(mapInventoryRow(row as never)).toMatchObject({
      inventoryNumber: 'INV-0002', subCategoryId: '', quantity: 1, unit: 'Units', minStockThreshold: 0, unitPrice: 12.5,
      storageLocation: '', dynamicSpecifications: {}, createdAt: '2026-09-01',
    })
  })

  it('numbers a new item from stored numbers, not the UUID ids', async () => {
    h.dbCodes = ['INV-0004']
    const item = await allocateInventoryItem(
      { name: 'Seal', subCategoryId: 's', quantity: 3, unit: 'Units', storageLocation: '', dynamicSpecifications: {} },
      [{ ...mapInventoryRow(row as never), id: 'uuid-1' }]
    )
    expect(item.inventoryNumber).toBe('INV-0005')
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('an edit sends only what changed and never the number or created date', () => {
    expect(inventoryToUpdate({ quantity: 0, inventoryNumber: 'INV-9999', createdAt: 'x' })).toEqual({ quantity: 0 })
    expect(inventoryToInsert(mapInventoryRow(row as never))).toMatchObject({ inventory_number: 'INV-0002', min_stock_level: 0, quantity: 1 })
  })
})

describe('documents', () => {
  const row = {
    id: 'd1', title: 'Manual', category: 'General', file_name: 'Manual.pdf', file_size_bytes: 2048, file_type: 'User Guide',
    file_url: 'https://x/y.pdf', uploaded_at: '2026-09-01T00:00:00Z', uploaded_by_user_name: 'Sam', asset_id: 'a1', inventory_item_id: null,
    related_entity_id: null, related_entity_type: null,
  }

  it('maps a row, keeping the real link columns and the flat linked-ids list', () => {
    expect(mapDocumentRow(row as never)).toMatchObject({
      fileType: 'User Guide', fileSizeKb: 2, uploadedBy: 'Sam', linkedAssetIds: ['a1'], assetId: 'a1', inventoryItemId: null,
    })
  })

  it('a new document carries the resolved links into the insert', () => {
    const doc = newDocument(
      { title: 'Invoice #1', fileType: 'Invoice', fileUrl: 'u', fileSizeKb: 10, uploadedBy: 'Sam', linkedAssetIds: ['x'] },
      { assetId: null, inventoryItemId: 'inv-1' }
    )
    expect(documentToInsert(doc)).toMatchObject({
      title: 'Invoice #1', file_name: 'Invoice__1.pdf', category: 'General', file_size_bytes: 10 * 1024, asset_id: null, inventory_item_id: 'inv-1',
    })
  })

  it('an edit only touches the two link columns', () => {
    expect(documentToUpdate({ assetId: 'a2', linkedAssetIds: ['a2'], title: 'nope' })).toEqual({ asset_id: 'a2' })
    expect(documentToUpdate({ inventoryItemId: null })).toEqual({ inventory_item_id: null })
  })
})

describe('checklist templates', () => {
  it('maps a row with defaults', () => {
    expect(mapChecklistTemplateRow({ id: 't1', title: 'PM', type: 'Preventive Maintenance', description: null, interval: null, items: null, created_at: 'x', updated_at: null })).toEqual({
      id: 't1', title: 'PM', type: 'Preventive Maintenance', description: '', interval: 'Quarterly', items: [], updatedAt: undefined,
    })
  })

  it('every edit stamps updated_at, and the type is never sent', () => {
    const u = checklistTemplateToUpdate({ title: 'New', type: 'Inspection' })
    expect(u.title).toBe('New')
    expect(u).not.toHaveProperty('type')
    expect(typeof u.updated_at).toBe('string')
  })

  it('a new template is built synchronously with an id and a date', () => {
    const t = newChecklistTemplate({ title: 'T', type: 'Inspection', items: [] })
    expect(t.id).toBeTruthy()
    expect(t.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(checklistTemplateToInsert(t)).toMatchObject({ title: 'T', interval: 'Quarterly' })
  })
})
