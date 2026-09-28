// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  completionBlockedMessage, daysOut, isOverdueReturn, openRepairsForWorkOrder, repairItemLabel,
  validateReturn, validateSend, workOrderRepairTag,
} from './outsideRepairState'
import type { OutsideRepair } from '@/types/afms'

const TODAY = '2026-09-28'

const rep = (over: Partial<OutsideRepair>): OutsideRepair => ({
  id: 'r', repairNumber: 'OSR-2026-0001', workOrderId: 'wo1', scope: 'Component', componentName: 'Motherboard',
  sentBy: 'Technician', vendorId: 'v1', sentDate: '2026-09-20', expectedReturnDate: '2026-10-05',
  status: 'Out for Repair', createdAt: '', ...over,
})

describe('isOverdueReturn', () => {
  it('is overdue only when still out and past its expected return date', () => {
    expect(isOverdueReturn(rep({ expectedReturnDate: '2026-09-27' }), TODAY)).toBe(true)
    expect(isOverdueReturn(rep({ expectedReturnDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdueReturn(rep({ expectedReturnDate: '2026-09-27', status: 'Returned' }), TODAY)).toBe(false)
  })
})

describe('work order views', () => {
  const list = [
    rep({ id: 'a', workOrderId: 'wo1' }),
    rep({ id: 'b', workOrderId: 'wo1', status: 'Returned' }),
    rep({ id: 'c', workOrderId: 'wo2', scope: 'Complete Asset', componentName: undefined, expectedReturnDate: '2026-09-01' }),
  ]

  it('lists only the ones still out for that work order', () => {
    expect(openRepairsForWorkOrder(list, 'wo1').map(r => r.id)).toEqual(['a'])
  })

  it('tags a card: a part, several parts, or the whole asset off-site, and overdue', () => {
    expect(workOrderRepairTag(list, 'wo1', TODAY)).toEqual({ label: 'Part out for repair', overdue: false })
    expect(workOrderRepairTag(list, 'wo2', TODAY)).toEqual({ label: 'Asset off-site', overdue: true })
    expect(workOrderRepairTag([rep({ id: 'x' }), rep({ id: 'y' })], 'wo1', TODAY)?.label).toBe('2 parts out for repair')
    expect(workOrderRepairTag(list, 'wo3', TODAY)).toBeUndefined()
  })

  it('blocks completion while anything is out, naming it', () => {
    expect(completionBlockedMessage(list, 'wo1')).toMatch(/Motherboard \(OSR-2026-0001\) is still out/)
    expect(completionBlockedMessage([rep({ status: 'Returned' })], 'wo1')).toBeNull()
  })

  it('labels the item and counts the days out', () => {
    expect(repairItemLabel(rep({}))).toBe('Motherboard')
    expect(repairItemLabel(rep({ scope: 'Complete Asset' }))).toBe('Complete asset')
    expect(daysOut(rep({}), TODAY)).toBe(8)
    expect(daysOut(rep({ returnedDate: '2026-09-25' }), TODAY)).toBe(5)
  })
})

describe('validateSend', () => {
  const ok = { scope: 'Component' as const, componentName: 'Motherboard', vendorId: 'v1', sentDate: TODAY, expectedReturnDate: '2026-10-05' }

  it('accepts a complete send-out, and a complete asset needs no part name', () => {
    expect(validateSend(ok, TODAY)).toBeNull()
    expect(validateSend({ ...ok, scope: 'Complete Asset', componentName: '' }, TODAY)).toBeNull()
  })

  it('names what is missing or wrong', () => {
    expect(validateSend({ ...ok, scope: undefined }, TODAY)).toMatch(/component or the complete asset/)
    expect(validateSend({ ...ok, componentName: '  ' }, TODAY)).toMatch(/name of the part/)
    expect(validateSend({ ...ok, vendorId: '' }, TODAY)).toMatch(/vendor/)
    expect(validateSend({ ...ok, sentDate: '2026-09-29' }, TODAY)).toMatch(/future/)
    expect(validateSend({ ...ok, expectedReturnDate: '' }, TODAY)).toMatch(/ETD/)
    expect(validateSend({ ...ok, expectedReturnDate: '2026-09-27' }, TODAY)).toMatch(/before the sent date/)
    expect(validateSend({ ...ok, estimatedCost: -1 }, TODAY)).toMatch(/0 or more/)
  })
})

describe('validateReturn', () => {
  it('needs a date between sending and today, and an outcome', () => {
    expect(validateReturn({ returnedDate: '2026-09-27', outcome: 'Repaired' }, '2026-09-20', TODAY)).toBeNull()
    expect(validateReturn({ outcome: 'Repaired' }, '2026-09-20', TODAY)).toMatch(/date it came back/)
    expect(validateReturn({ returnedDate: '2026-09-19', outcome: 'Repaired' }, '2026-09-20', TODAY)).toMatch(/before the date it was sent/)
    expect(validateReturn({ returnedDate: '2026-09-29', outcome: 'Repaired' }, '2026-09-20', TODAY)).toMatch(/future/)
    expect(validateReturn({ returnedDate: '2026-09-27' }, '2026-09-20', TODAY)).toMatch(/outcome/)
    expect(validateReturn({ returnedDate: '2026-09-27', outcome: 'Repaired', actualCost: -5 }, '2026-09-20', TODAY)).toMatch(/0 or more/)
  })
})
