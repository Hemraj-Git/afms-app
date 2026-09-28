// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { flattenHits, globalSearch, scoreRecord } from './globalSearch'
import type { Asset, Inspection, OutsideRepair, Room, ServiceRequest, UserProfile, Vendor, WorkOrder } from '@/types/afms'

const asset = (over: Partial<Asset>): Asset =>
  ({ id: 'a1', assetId: 'AST-2026-0001', name: 'Chiller Unit', roomId: 'r1', status: 'Operational', ...over }) as Asset
const room = (over: Partial<Room>): Room =>
  ({ id: 'r1', buildingId: 'b1', name: 'Bridge Simulator', roomNumber: '101', type: 'Lab', isReservable: false, qrCodeKey: '', status: 'Available', ...over }) as Room
const wo = (over: Partial<WorkOrder>): WorkOrder =>
  ({ id: 'w1', woNumber: 'WO-CR-2026-0007', type: 'Corrective', title: 'Compressor noise', assetId: 'a1', status: 'In Progress', priority: 'High', source: 'Service Request', dueDate: '2026-09-30', ...over }) as WorkOrder
const sr = (over: Partial<ServiceRequest>): ServiceRequest =>
  ({ id: 's1', ticketId: 'SR-2026-0012', title: 'AC not cooling', requestedBy: 'Asha Rao', status: 'Open', priority: 'High', ...over }) as ServiceRequest
const insp = (over: Partial<Inspection>): Inspection =>
  ({ id: 'i1', inspectionNumber: 'INSP-2026-0003', assetId: 'a1', templateId: 't', templateVersion: 1, dueDate: '2026-10-01', status: 'Scheduled', ...over }) as Inspection
const osr = (over: Partial<OutsideRepair>): OutsideRepair =>
  ({ id: 'o1', repairNumber: 'OSR-2026-0001', workOrderId: 'w1', assetId: 'a1', scope: 'Component', componentName: 'Motherboard', sentBy: 'Technician', vendorId: 'v1', sentDate: '2026-09-20', expectedReturnDate: '2026-10-05', status: 'Out for Repair', createdAt: '', ...over }) as OutsideRepair
const user = (over: Partial<UserProfile>): UserProfile =>
  ({ id: 'u1', email: 'ravi@hms.com', fullName: 'Ravi Kumar', role: 'Technician', ...over }) as UserProfile
const vendor = (over: Partial<Vendor>): Vendor =>
  ({ id: 'v1', name: 'CoolAir Services', categorySupplied: 'HVAC', contactPerson: 'Mehta', email: '', phone: '98200', address: '', hasAmc: false, ...over }) as Vendor

describe('scoreRecord', () => {
  it('ranks whole-field, then prefix, then word start, then anywhere', () => {
    const exact = scoreRecord('chiller', ['chiller'])
    const prefix = scoreRecord('chill', ['chiller unit'])
    const word = scoreRecord('unit', ['chiller unit'])
    const inside = scoreRecord('hill', ['chiller unit'])
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(word)
    expect(word).toBeGreaterThan(inside)
    expect(inside).toBeGreaterThan(0)
  })

  it('needs every word to match somewhere, and ignores case and accents', () => {
    expect(scoreRecord('chiller 0001', ['AST-2026-0001', 'Chiller Unit'])).toBeGreaterThan(0)
    expect(scoreRecord('chiller boiler', ['AST-2026-0001', 'Chiller Unit'])).toBe(0)
    expect(scoreRecord('CAFE', ['Café Block'])).toBeGreaterThan(0)
  })

  it('does not match an empty query or empty fields', () => {
    expect(scoreRecord('   ', ['anything'])).toBe(0)
    expect(scoreRecord('x', [undefined, null, ''])).toBe(0)
  })
})

describe('globalSearch', () => {
  const data = {
    assets: [asset({}), asset({ id: 'a2', assetId: 'AST-2026-0002', name: 'Boiler', serialNumber: 'SN-XY-778' })],
    rooms: [room({})],
    workOrders: [wo({}), wo({ id: 'w2', woNumber: 'PENDING-abc', type: 'Preventive', title: 'Chiller PM' })],
    serviceRequests: [sr({})],
    inspections: [insp({})],
    outsideRepairs: [osr({})],
    users: [user({}), user({ id: 'g', fullName: 'Ravi Guest', email: 'ravi@guest.com', role: 'Guest' })],
    vendors: [vendor({})],
  }

  it('finds an asset by its serial number and links to its page', () => {
    const [group] = globalSearch('SN-XY-778', data)
    expect(group.kind).toBe('asset')
    expect(group.hits[0]).toMatchObject({ title: 'Boiler', href: '/assets/AST-2026-0002' })
  })

  it('finds records by number and opens the list with the search filled in', () => {
    expect(globalSearch('WO-CR-2026-0007', data)[0].hits[0].href).toBe('/maintenance/work-orders?q=WO-CR-2026-0007')
    expect(globalSearch('SR-2026-0012', data)[0].hits[0].href).toBe('/service-requests?q=SR-2026-0012')
    expect(globalSearch('INSP-2026-0003', data)[0].hits[0].href).toBe('/inspections?q=INSP-2026-0003')
    expect(globalSearch('OSR-2026-0001', data)[0].hits[0].href).toBe('/maintenance/outside-repairs?q=OSR-2026-0001')
  })

  it('sends a not-yet-assigned order to its queue, without its placeholder number', () => {
    const hits = flattenHits(globalSearch('chiller pm', data))
    const pending = hits.find(h => h.id === 'w2')
    expect(pending?.href).toBe('/maintenance/preventive')
    expect(pending?.title).not.toContain('PENDING')
    expect(flattenHits(globalSearch('PENDING', data)).some(h => h.id === 'w2')).toBe(false)
  })

  it('finds rooms by number, vendors by contact, and never lists guests', () => {
    expect(globalSearch('101', data)[0].hits[0]).toMatchObject({ kind: 'room', href: '/organization/rooms/101' })
    expect(flattenHits(globalSearch('mehta', data))[0]).toMatchObject({ kind: 'vendor' })
    const people = flattenHits(globalSearch('ravi', data)).filter(h => h.kind === 'user')
    expect(people.map(p => p.id)).toEqual(['u1'])
  })

  it('finds related records through the asset name', () => {
    const kinds = globalSearch('chiller', data).map(g => g.kind)
    expect(kinds).toEqual(expect.arrayContaining(['asset', 'workOrder', 'inspection', 'outsideRepair']))
  })

  it('puts the group with the best match first', () => {
    // An exact room number beats a partial match inside an asset tag.
    const groups = globalSearch('101', { ...data, assets: [asset({ assetId: 'AST-2026-1010' })] })
    expect(groups[0].kind).toBe('room')
  })

  it('keeps the top few per group and reports how many matched', () => {
    const many = Array.from({ length: 12 }, (_, i) => asset({ id: `x${i}`, assetId: `AST-2026-01${String(i).padStart(2, '0')}`, name: `Pump ${i}` }))
    const [group] = globalSearch('pump', { assets: many })
    expect(group.hits).toHaveLength(5)
    expect(group.total).toBe(12)
  })

  it('returns nothing for a blank query or no match', () => {
    expect(globalSearch('  ', data)).toEqual([])
    expect(globalSearch('zzzz-not-here', data)).toEqual([])
  })
})
