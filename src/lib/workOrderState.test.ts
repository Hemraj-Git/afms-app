import { describe, it, expect } from 'vitest'
import { isOpenWorkOrder, isWithVendor, validateVendorHandover } from './workOrderState'

describe('isOpenWorkOrder', () => {
  it('counts Scheduled and In Progress as open', () => {
    expect(isOpenWorkOrder({ status: 'Scheduled' })).toBe(true)
    expect(isOpenWorkOrder({ status: 'In Progress' })).toBe(true)
  })

  it('does not count Completed or Cancelled', () => {
    expect(isOpenWorkOrder({ status: 'Completed' })).toBe(false)
    expect(isOpenWorkOrder({ status: 'Cancelled' })).toBe(false)
  })
})

describe('isWithVendor', () => {
  it('is true for an open Corrective order executed by a vendor', () => {
    expect(isWithVendor({ type: 'Corrective', status: 'In Progress', executedBy: 'Vendor' })).toBe(true)
    expect(isWithVendor({ type: 'Corrective', status: 'Scheduled', executedBy: 'Vendor' })).toBe(true)
  })

  it('is false once the job is finished or cancelled', () => {
    expect(isWithVendor({ type: 'Corrective', status: 'Completed', executedBy: 'Vendor' })).toBe(false)
    expect(isWithVendor({ type: 'Corrective', status: 'Cancelled', executedBy: 'Vendor' })).toBe(false)
  })

  it('is false for in-house or non-corrective orders', () => {
    expect(isWithVendor({ type: 'Corrective', status: 'In Progress', executedBy: 'In House' })).toBe(false)
    expect(isWithVendor({ type: 'Corrective', status: 'In Progress' })).toBe(false)
    expect(isWithVendor({ type: 'Preventive', status: 'In Progress', executedBy: 'Vendor' })).toBe(false)
  })
})

describe('validateVendorHandover', () => {
  it('requires a vendor for any save', () => {
    expect(validateVendorHandover({}, 'In Progress')).toMatch(/select the vendor/i)
    expect(validateVendorHandover({ vendorId: '' }, 'Completed')).toMatch(/select the vendor/i)
  })

  it('lets a vendor with no ticket number be saved as In Progress', () => {
    expect(validateVendorHandover({ vendorId: 'v1' }, 'In Progress')).toBeNull()
  })

  it('requires the vendor ticket number to complete', () => {
    expect(validateVendorHandover({ vendorId: 'v1' }, 'Completed')).toMatch(/ticket/i)
    expect(validateVendorHandover({ vendorId: 'v1', vendorTicketNo: '   ' }, 'Completed')).toMatch(/ticket/i)
  })

  it('passes a complete handover', () => {
    expect(validateVendorHandover({ vendorId: 'v1', vendorTicketNo: 'TKT-42' }, 'Completed')).toBeNull()
  })
})
