// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  assetBasicsSchema,
  assetLocationSchema,
  canBeAssigned,
  fieldErrors,
  serviceRequestSchema,
  workOrderSchema,
} from './forms'

describe('service request form', () => {
  const ok = { title: 'AC not cooling', type: 'Maintenance', priority: 'High', roomId: 'r1', assetId: 'a1', description: '' } as const

  it('accepts a complete request and trims the title', () => {
    const r = serviceRequestSchema.parse({ ...ok, title: '  AC not cooling  ' })
    expect(r.title).toBe('AC not cooling')
  })

  it('explains every missing field at once', () => {
    expect(fieldErrors(serviceRequestSchema, { ...ok, title: ' a ', roomId: '', assetId: '' })).toEqual({
      title: 'Title needs at least 3 characters.',
      roomId: 'Choose the room or area.',
      assetId: 'Choose the asset that needs attention.',
    })
  })

  it('needs an asset only for Maintenance and IT Support', () => {
    expect(fieldErrors(serviceRequestSchema, { ...ok, type: 'Cleaning', assetId: '' })).toEqual({})
    expect(fieldErrors(serviceRequestSchema, { ...ok, type: 'IT Support', assetId: '' })).toHaveProperty('assetId')
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
    purchaseDate: '2026-01-10', installationDate: '2026-01-20', lastServicedDate: '', warrantyTill: '2028-01-10',
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
    expect(fieldErrors(assetBasicsSchema, { ...basics, installationDate: '2026-01-01', lastServicedDate: '2025-12-01', warrantyTill: '2025-01-01' })).toEqual({
      installationDate: 'Installation can’t be before the purchase date.',
      lastServicedDate: 'Last service can’t be before the purchase date.',
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
