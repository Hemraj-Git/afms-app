import { describe, expect, it } from 'vitest'
import type { Inspection, WorkOrder } from '@/types/afms'
import { housekeepingWorkOrders, myInspections, openWorkCounts, technicianWorkOrders, timeAgo } from './fieldWork'

const me = { id: 'u1', fullName: 'Ravi Kumar' }
const wo = (over: Partial<WorkOrder>) => ({ id: Math.random().toString(), type: 'Preventive', status: 'Scheduled', ...over }) as WorkOrder
const insp = (over: Partial<Inspection>) => ({ id: Math.random().toString(), status: 'Scheduled', ...over }) as Inspection

describe('whose work is whose', () => {
  const orders = [
    wo({ assignedTechnicianId: 'u1' }),
    wo({ type: 'Corrective', assignedTechnicianName: 'Ravi Kumar' }), // older record: by name
    wo({ type: 'Corrective', assignedTechnicianId: 'u2' }),
    wo({ type: 'Housekeeping', assignedTechnicianId: 'u1' }),
    wo({ assignedTechnicianId: 'u1', status: 'Completed' }),
  ]

  it('a technician gets their preventive and corrective jobs, never housekeeping', () => {
    expect(technicianWorkOrders(orders, me)).toHaveLength(3)
  })

  it('housekeeping gets only cleaning jobs', () => {
    expect(housekeepingWorkOrders(orders, me)).toHaveLength(1)
  })

  it('an Admin is not given everyone else\'s work any more', () => {
    expect(technicianWorkOrders(orders, { id: 'admin', fullName: 'Admin' })).toHaveLength(0)
  })

  it('counts open work only, for the badges', () => {
    const inspections = [insp({ assignedInspectorId: 'u1' }), insp({ assignedInspectorId: 'u1', status: 'Completed' }), insp({ assignedInspectorId: 'u9' })]
    expect(myInspections(inspections, me)).toHaveLength(2)
    expect(openWorkCounts(orders, inspections, me)).toEqual({ Tasks: 2, Cleaning: 1, Inspections: 1 })
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-10-01T15:00:00')
  it('says how long ago in plain words', () => {
    expect(timeAgo('2026-10-01T14:59:40', now)).toBe('Just now')
    expect(timeAgo('2026-10-01T14:55:00', now)).toBe('5 min ago')
    expect(timeAgo('2026-10-01T13:00:00', now)).toBe('2 h ago')
    expect(timeAgo('2026-09-30T20:00:00', now)).toBe('Yesterday')
    expect(timeAgo('2026-09-28T10:00:00', now)).toBe('28 Sep')
    expect(timeAgo(undefined, now)).toBe('')
  })
})
