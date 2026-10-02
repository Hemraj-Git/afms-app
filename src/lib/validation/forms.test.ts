// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assetBasicsSchema,
  assetLocationSchema,
  canBeAssigned,
  fieldErrors,
  serviceRequestSchema,
  serviceRequestSchemaFor,
  workOrderSchema,
  nameSchema,
  roomSchema,
  inventoryItemSchema,
  templateSchema,
  subCategorySchema,
  documentUploadSchema,
  deploySchema,
  reservationSchema,
} from './forms'

describe('service request form (same rules as the phone)', () => {
  const ok = { title: 'AC not cooling', type: 'Maintenance', priority: 'High', roomId: 'r1', assetId: 'a1', description: 'Water dripping' } as const

  it('accepts a complete request and trims the title', () => {
    const r = serviceRequestSchema.parse({ ...ok, title: '  AC not cooling  ' })
    expect(r.title).toBe('AC not cooling')
  })

  it('lets the title be blank but needs the room and a description', () => {
    expect(fieldErrors(serviceRequestSchema, { ...ok, title: '', roomId: '', description: ' ' })).toEqual({
      roomId: 'Choose the room or area.',
      description: 'Describe the problem.',
    })
  })

  it('needs the equipment for Maintenance only when the room has some', () => {
    expect(fieldErrors(serviceRequestSchema, { ...ok, assetId: '' })).toEqual({ assetId: 'Choose the equipment that needs attention.' })
    expect(fieldErrors(serviceRequestSchemaFor(() => false), { ...ok, assetId: '' })).toEqual({})
    expect(fieldErrors(serviceRequestSchema, { ...ok, type: 'Housekeeping', assetId: '' })).toEqual({})
  })
})

describe('work order form', () => {
  const ok = {
    type: 'Corrective', title: 'Fix compressor', assetId: 'a1', roomId: 'r1', assignedTechnicianId: 'u1',
    priority: 'Medium', dueDate: '2026-10-01', issueLogged: '',
  } as const

  it('requires an asset except for housekeeping, and always a room', () => {
    expect(fieldErrors(workOrderSchema, { ...ok, assetId: '' })).toEqual({ assetId: 'Choose the asset.' })
    expect(fieldErrors(workOrderSchema, { ...ok, type: 'Housekeeping', assetId: '' })).toEqual({})
    expect(fieldErrors(workOrderSchema, { ...ok, roomId: '' })).toEqual({ roomId: 'Choose the room or area.' })
  })

  it('requires an assignee and a real date', () => {
    expect(fieldErrors(workOrderSchema, { ...ok, assignedTechnicianId: '', dueDate: '' })).toEqual({
      assignedTechnicianId: 'Choose who does the work.',
      dueDate: 'Choose the due date.',
    })
  })

  it('knows who may take each type of order', () => {
    expect(canBeAssigned('Housekeeping', 'Housekeeping')).toBe(true)
    expect(canBeAssigned('Admin', 'Housekeeping')).toBe(true)
    expect(canBeAssigned('Technician', 'Housekeeping')).toBe(false)
    expect(canBeAssigned('Technician', 'Corrective')).toBe(true)
    expect(canBeAssigned('Guest', 'Preventive')).toBe(false)
  })
})

describe('asset wizard', () => {
  const basics = {
    assetName: 'Chiller', categoryId: 'c1', subCategoryId: 's1', manufacturer: 'Carrier', modelNumber: 'X1',
    purchaseDate: '2026-01-10', installationDate: '2026-01-20', warrantyTill: '2028-01-10',
    purchasedFromId: 'v1', maintenanceBy: 'In House', amcVendorId: '', amcStartDate: '', amcEndDate: '',
  } as const

  it('accepts complete basics', () => {
    expect(fieldErrors(assetBasicsSchema, basics)).toEqual({})
  })

  it('lists all missing basics together, in plain words', () => {
    const errors = fieldErrors(assetBasicsSchema, { ...basics, assetName: '', manufacturer: ' ', purchaseDate: '', purchasedFromId: '' })
    expect(errors).toEqual({
      assetName: 'Enter asset name.',
      manufacturer: 'Enter manufacturer.',
      purchaseDate: 'Choose the purchase date.',
      purchasedFromId: 'Choose the vendor it was bought from.',
    })
  })

  it('checks dates against the purchase date', () => {
    expect(fieldErrors(assetBasicsSchema, { ...basics, installationDate: '2026-01-01', warrantyTill: '2025-01-01' })).toEqual({
      installationDate: 'Installation can’t be before the purchase date.',
      warrantyTill: 'Warranty can’t end before the purchase date.',
    })
  })

  it('needs the AMC details only when a vendor maintains it', () => {
    expect(fieldErrors(assetBasicsSchema, { ...basics, maintenanceBy: 'Vendor' })).toEqual({
      amcVendorId: 'Choose the AMC vendor.',
      amcStartDate: 'Choose the AMC start date.',
      amcEndDate: 'Choose the AMC end date.',
    })
    expect(
      fieldErrors(assetBasicsSchema, { ...basics, maintenanceBy: 'Vendor', amcVendorId: 'v2', amcStartDate: '2026-06-01', amcEndDate: '2026-05-01' })
    ).toEqual({ amcEndDate: 'The AMC can’t end before it starts.' })
  })

  it('requires the full location', () => {
    expect(fieldErrors(assetLocationSchema, { campusId: 'c', buildingId: '', roomId: '' })).toEqual({
      buildingId: 'Choose a building / block.',
      roomId: 'Choose a room / area.',
    })
  })
})

describe('smaller forms', () => {
  it('name-only forms say what to enter', () => {
    expect(fieldErrors(nameSchema('Category name'), { name: '  ' })).toEqual({ name: 'Enter category name.' })
    expect(fieldErrors(nameSchema('Document title', 'title'), { title: 'Manual' })).toEqual({})
  })

  it('room: building, name and a positive size', () => {
    expect(fieldErrors(roomSchema, { buildingId: '', name: '', roomSizeSqft: '0' })).toEqual({
      buildingId: 'Choose a building in the selected campus.',
      name: 'Enter room name.',
      roomSizeSqft: 'Room size must be more than 0.',
    })
  })

  it('inventory item: negative or missing quantity is explained', () => {
    const ok = { name: 'Filter', categoryId: 'c', subCategoryId: 's', quantity: 2, storageLocation: 'Rack A' }
    expect(fieldErrors(inventoryItemSchema, ok)).toEqual({})
    expect(fieldErrors(inventoryItemSchema, { ...ok, quantity: -1 })).toEqual({ quantity: 'Quantity can’t be negative.' })
    expect(fieldErrors(inventoryItemSchema, { ...ok, quantity: Number.NaN })).toEqual({ quantity: 'Enter the quantity.' })
  })

  it('templates and sub-category fields point at the exact row', () => {
    const tmpl = templateSchema('checkpoint')
    expect(fieldErrors(tmpl, { title: 'Fire safety', items: [{ itemText: 'Hose' }, { itemText: ' ' }] })).toEqual({
      'items.1.itemText': 'Describe this checkpoint, or remove it.',
    })
    expect(fieldErrors(tmpl, { title: '', items: [] })).toEqual({ title: 'Enter template title.', items: 'Add at least one checkpoint.' })
    expect(fieldErrors(subCategorySchema, { categoryId: 'c', name: 'AC', fields: [{ label: 'kW' }, { label: '' }] })).toEqual({
      'fields.1.label': 'Give this field a label, or remove it.',
    })
  })

  it('documents need a title and a file', () => {
    expect(fieldErrors(documentUploadSchema, { title: '', hasFile: false })).toEqual({
      title: 'Enter document title.',
      hasFile: 'Choose a file to upload.',
    })
  })

  it('deploying a spare needs the full location and a date', () => {
    expect(fieldErrors(deploySchema, { campusId: 'c', buildingId: '', roomId: '', installDate: '' })).toEqual({
      buildingId: 'Choose a building.',
      roomId: 'Choose the room / area to deploy it to.',
      installDate: 'Choose the installation date.',
    })
  })

  it('reservation: dates in order, dates in range, a slot and a purpose', () => {
    const ok = { roomId: 'r', startDate: '2026-10-01', endDate: '2026-10-05', dateCount: 3, slotCount: 1, purpose: 'Lecture' }
    expect(fieldErrors(reservationSchema, ok)).toEqual({})
    expect(fieldErrors(reservationSchema, { ...ok, endDate: '2026-09-30' })).toEqual({ endDate: 'The end date can’t be before the start date.' })
    expect(fieldErrors(reservationSchema, { ...ok, dateCount: 0 })).toEqual({
      dateCount: 'No dates fall in this range. Check the start / end dates and the excluded days.',
    })
    expect(fieldErrors(reservationSchema, { ...ok, slotCount: 0, purpose: '' })).toEqual({
      slotCount: 'Choose at least one time slot.',
      purpose: 'Enter purpose.',
    })
  })
})
