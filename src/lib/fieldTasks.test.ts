import { describe, expect, it } from 'vitest'
import type { WorkOrder } from '@/types/afms'
import {
  assetFor, checklistProgress, cleaningCounts, cleaningFor, draftProblems, dueFact, dueText, floorText, whenText, expectedBackText, jobDateText, jobKindOf, longDate, preventiveLock, placeText, shortDate, taskCounts, tasksFor,
  type WorkOrderDraft,
} from './fieldTasks'

// Wednesday 30 September 2026, mid-morning.
const NOW = new Date(2026, 8, 30, 10, 30)

const wo = (over: Partial<WorkOrder>): WorkOrder => ({
  id: over.id ?? 'w',
  woNumber: over.woNumber ?? 'WO-PM-0001',
  type: 'Preventive',
  source: 'Scheduled',
  dueDate: '2026-10-02',
  status: 'Scheduled',
  createdAt: '2026-09-01',
  ...over,
})

describe('dates on a job', () => {
  it('says today, tomorrow, a date, or how late', () => {
    expect(dueText('2026-09-30', NOW)).toEqual({ text: 'Due today', overdue: false })
    expect(dueText('2026-10-01', NOW)).toEqual({ text: 'Due tomorrow', overdue: false })
    expect(dueText('2026-10-07', NOW)).toEqual({ text: 'Due 7 Oct', overdue: false })
    expect(dueText('2026-09-29', NOW)).toEqual({ text: 'Overdue by 1 day · was due 29 Sep', overdue: true })
    expect(dueText('2026-09-28T00:00:00', NOW)).toEqual({ text: 'Overdue by 2 days · was due 28 Sep', overdue: true })
    expect(dueText('', NOW)).toBeUndefined()
  })

  it('adds the year only when it is not this year', () => {
    expect(shortDate('2027-01-05', NOW)).toBe('5 Jan 2027')
    expect(shortDate('2026-01-05', NOW)).toBe('5 Jan')
    expect(longDate('2026-08-28')).toBe('28 Aug 2026')
    expect(longDate(undefined)).toBe('')
  })

  it('a finished job shows when it was finished, not that it is late', () => {
    expect(jobDateText(wo({ status: 'Completed', dueDate: '2026-09-01', completedAt: '2026-09-03' }), NOW)).toEqual({ text: 'Completed 3 Sep', overdue: false })
    expect(jobDateText(wo({ status: 'Cancelled', dueDate: '2026-09-01' }), NOW)).toEqual({ text: 'Cancelled', overdue: false })
  })

  it('calls a corrective job a breakdown', () => {
    expect(jobKindOf({ type: 'Corrective' })).toBe('Breakdown')
    expect(jobKindOf({ type: 'Preventive' })).toBe('Preventive')
  })

  it('says how long until a part is back, or how late', () => {
    expect(expectedBackText('2026-10-07', NOW)).toEqual({ text: 'Expected back 7 Oct 2026 (in 7 days)', late: false })
    expect(expectedBackText('2026-09-30', NOW)).toEqual({ text: 'Expected back 30 Sep 2026 (today)', late: false })
    expect(expectedBackText('2026-09-28', NOW)).toEqual({ text: 'Expected back 28 Sep 2026 (2 days late)', late: true })
  })
})

describe('the Tasks list', () => {
  const list = [
    wo({ id: 'a', type: 'Corrective', dueDate: '2026-10-02', priority: 'Low' }),
    wo({ id: 'b', type: 'Preventive', dueDate: '2026-09-28', priority: 'Low' }),
    wo({ id: 'c', type: 'Corrective', dueDate: '2026-10-02', priority: 'Critical', status: 'In Progress' }),
    wo({ id: 'd', type: 'Preventive', status: 'Completed', completedAt: '2026-09-10' }),
    wo({ id: 'e', type: 'Preventive', status: 'Completed', completedAt: '2026-09-20' }),
    wo({ id: 'f', type: 'Corrective', status: 'Cancelled' }),
  ]

  it('counts open work by kind, and finished work', () => {
    expect(taskCounts(list)).toEqual({ open: 3, preventive: 1, corrective: 2, completed: 2 })
  })

  it('puts the latest-due first, then the more urgent', () => {
    expect(tasksFor(list, 'All').map(w => w.id)).toEqual(['b', 'c', 'a'])
    expect(tasksFor(list, 'Corrective').map(w => w.id)).toEqual(['c', 'a'])
    expect(tasksFor(list, 'Preventive').map(w => w.id)).toEqual(['b'])
  })

  it('shows finished work newest first, and never cancelled work', () => {
    expect(tasksFor(list, 'Completed').map(w => w.id)).toEqual(['e', 'd'])
  })
})

describe('when a preventive job may be started', () => {
  it('is locked until its window opens, and says when', () => {
    // Monthly: opens 7 days before it is due.
    expect(preventiveLock(wo({ dueDate: '2026-10-20', frequency: 'Monthly' }), NOW)).toEqual({ opensOn: '13 Oct', rule: '7 days before scheduled date' })
    expect(preventiveLock(wo({ dueDate: '2026-10-07', frequency: 'Monthly' }), NOW)).toBeNull()
  })

  it('never locks breakdowns or finished jobs', () => {
    expect(preventiveLock(wo({ type: 'Corrective', dueDate: '2026-12-20', frequency: 'Monthly' }), NOW)).toBeNull()
    expect(preventiveLock(wo({ status: 'Completed', dueDate: '2026-12-20', frequency: 'Monthly' }), NOW)).toBeNull()
  })
})

describe('checklist progress', () => {
  it('counts only ticked steps', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
    expect(checklistProgress(items, { '1': { value: true }, '2': { value: false, remarks: 'later' }, '3': { value: true } })).toEqual({ done: 2, total: 4, percent: 50 })
    expect(checklistProgress(undefined, {})).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('what stops a save', () => {
  const base: WorkOrderDraft = {
    type: 'Preventive', mode: 'In House', startPhoto: '', completionPhoto: '', vendorId: '', vendorTicketNo: '', uploading: 0, failed: 0,
  }
  const fields = (d: Partial<WorkOrderDraft>, intent: 'In Progress' | 'Completed') => draftProblems({ ...base, ...d }, intent).map(p => p.field)

  it('lets work in progress be saved without photos', () => {
    expect(fields({}, 'In Progress')).toEqual([])
    expect(fields({ type: 'Corrective' }, 'In Progress')).toEqual([])
  })

  it('needs the on-site and the completion photos to close a preventive job', () => {
    expect(fields({}, 'Completed')).toEqual(['startPhoto', 'completionPhoto'])
    expect(fields({ startPhoto: 'u' }, 'Completed')).toEqual(['completionPhoto'])
    expect(fields({ startPhoto: 'u', completionPhoto: 'u' }, 'Completed')).toEqual([])
  })

  it('needs both photos and what was done to close your own breakdown', () => {
    expect(fields({ type: 'Corrective' }, 'Completed')).toEqual(['startPhoto', 'solution', 'completionPhoto'])
    expect(fields({ type: 'Corrective', startPhoto: 'u', completionPhoto: 'u', solution: ' ' }, 'Completed')).toEqual(['solution'])
    expect(fields({ type: 'Corrective', startPhoto: 'u', completionPhoto: 'u', solution: 'Replaced capacitor' }, 'Completed')).toEqual([])
  })

  it('needs the vendor, then their job number to close, for a vendor job -- and no photos', () => {
    const v = { type: 'Corrective' as const, mode: 'Vendor' as const }
    expect(fields(v, 'In Progress')).toEqual(['vendorId'])
    expect(fields({ ...v, vendorId: 'x' }, 'In Progress')).toEqual([])
    expect(fields({ ...v, vendorId: 'x' }, 'Completed')).toEqual(['vendorTicketNo', 'solution'])
    expect(fields({ ...v, vendorId: 'x', vendorTicketNo: 'J-1', solution: 'Gas top-up' }, 'Completed')).toEqual([])
  })

  it('waits for photos, and will not save one that failed', () => {
    expect(fields({ uploading: 1 }, 'In Progress')).toEqual(['photos'])
    expect(fields({ failed: 1 }, 'In Progress')).toEqual(['photos'])
  })

  it('will not close while a part is out for repair', () => {
    const p = draftProblems({ ...base, type: 'Corrective', startPhoto: 'u', completionPhoto: 'u', solution: 'Fixed', completionBlocked: 'Still out' }, 'Completed')
    expect(p).toEqual([{ field: 'outsideRepair', message: 'Still out' }])
  })
})

describe('where a job is', () => {
  it('finds the asset by row id or by its code', () => {
    const assets = [{ id: 'u1', assetId: 'AST-0042' }]
    expect(assetFor(assets, 'u1')?.assetId).toBe('AST-0042')
    expect(assetFor(assets, 'AST-0042')?.id).toBe('u1')
    expect(assetFor(assets, undefined)).toBeUndefined()
  })

  it('names the room, its number and building', () => {
    const buildings = [{ id: 'b1', name: 'Utility Block' }]
    expect(placeText({ name: 'DG Yard', roomNumber: 'R-0003', buildingId: 'b1' }, buildings)).toBe('DG Yard (R-0003) · Utility Block')
    expect(placeText({ name: 'DG Yard', roomNumber: '', buildingId: 'gone' }, buildings)).toBe('DG Yard')
    expect(placeText(undefined, buildings)).toBe('')
  })

  it('floorText says the floor once', () => {
    expect(floorText('2')).toBe('Floor 2')
    expect(floorText('3rd Floor')).toBe('3rd Floor')
    expect(floorText('Ground')).toBe('Ground floor')
    expect(floorText('')).toBe('')
    expect(floorText(undefined)).toBe('')
  })
})

describe('the job screen’s facts', () => {
  it('says when it is due, or when it was finished', () => {
    expect(dueFact(wo({ dueDate: '2026-09-30' }), NOW)).toEqual({ label: 'Due', value: 'Today' })
    expect(dueFact(wo({ dueDate: '2026-10-07' }), NOW)).toEqual({ label: 'Due', value: '7 Oct' })
    expect(dueFact(wo({ dueDate: '2026-09-28' }), NOW)).toEqual({ label: 'Due', value: 'Overdue by 2 days', tone: 'danger' })
    expect(dueFact(wo({ status: 'Completed', completedAt: '2026-09-29' }), NOW)).toEqual({ label: 'Completed', value: '29 Sep' })
  })

  it('says a moment the way people do', () => {
    expect(whenText(new Date(2026, 8, 30, 17, 15).toISOString(), NOW)).toBe('today, 5:15 PM')
    expect(whenText(new Date(2026, 8, 29, 9, 5).toISOString(), NOW)).toBe('yesterday, 9:05 AM')
    expect(whenText(new Date(2026, 9, 1, 0, 30).toISOString(), NOW)).toBe('tomorrow, 12:30 AM')
    expect(whenText(new Date(2026, 8, 20, 12, 0).toISOString(), NOW)).toBe('20 Sep, 12:00 PM')
    expect(whenText('', NOW)).toBe('')
  })
})

describe('cleaning', () => {
  const base: WorkOrderDraft = {
    type: 'Housekeeping', mode: 'In House', startPhoto: '', completionPhoto: '', vendorId: '', vendorTicketNo: '', uploading: 0, failed: 0,
  }

  it('needs only the after-cleaning photo to finish', () => {
    expect(draftProblems(base, 'In Progress')).toEqual([])
    expect(draftProblems(base, 'Completed').map(p => p.field)).toEqual(['completionPhoto'])
    expect(draftProblems({ ...base, completionPhoto: 'u' }, 'Completed')).toEqual([])
  })

  it('counts and filters rooms', () => {
    const list = [
      wo({ id: 'a', type: 'Housekeeping', status: 'Scheduled', dueDate: '2026-10-01' }),
      wo({ id: 'b', type: 'Housekeeping', status: 'In Progress', dueDate: '2026-09-30' }),
      wo({ id: 'c', type: 'Housekeeping', status: 'Completed', completedAt: '2026-09-29' }),
    ]
    expect(cleaningCounts(list)).toEqual({ open: 2, scheduled: 1, inProgress: 1, completed: 1 })
    expect(cleaningFor(list, 'Open').map(w => w.id)).toEqual(['b', 'a'])
    expect(cleaningFor(list, 'In Progress').map(w => w.id)).toEqual(['b'])
    expect(cleaningFor(list, 'Completed').map(w => w.id)).toEqual(['c'])
  })
})
