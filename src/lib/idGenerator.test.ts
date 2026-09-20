import { describe, expect, it } from 'vitest'
import {
  addIntervalToDate,
  formatCategoryId,
  formatId,
  formatSubCategoryId,
  formatYearlyId,
  getNextSequence,
  isPendingWorkOrder,
  makePendingWoNumber,
} from './idGenerator'

describe('getNextSequence', () => {
  it('starts at 1 when there are no ids', () => {
    expect(getNextSequence([], 'WO')).toBe(1)
  })

  it('returns one more than the highest existing number, not the count', () => {
    expect(getNextSequence(['WO-0001', 'WO-0007', 'WO-0003'], 'WO')).toBe(8)
  })

  it('understands yearly ids and ignores other prefixes and malformed ids', () => {
    expect(getNextSequence(['WO-2026-0004', 'SR-2026-0090', 'WO-abc', 'WO'], 'WO')).toBe(5)
  })
})

describe('id formatting', () => {
  it('pads numbers', () => {
    expect(formatId('AST', 7)).toBe('AST-0007')
    expect(formatYearlyId('SR', 12, 2026)).toBe('SR-2026-0012')
  })

  it('derives a four-letter category code', () => {
    expect(formatCategoryId('Electrical')).toBe('ELEC')
    expect(formatCategoryId('IT')).toBe('ITXX')
    expect(formatCategoryId('  !!! ')).toBe('GENR')
  })

  it('derives a sub-category code from the parent and its own name', () => {
    expect(formatSubCategoryId('ELEC', 'Light')).toBe('ELEC-LIGH')
    expect(formatSubCategoryId('ELEC', 'AC')).toBe('ELEC-AC00')
    expect(formatSubCategoryId('', '')).toBe('GENR-ITEM')
  })
})

describe('pending work order numbers', () => {
  it('is unique per row and recognised as pending', () => {
    const a = makePendingWoNumber('11111111')
    const b = makePendingWoNumber('22222222')
    expect(a).not.toBe(b)
    expect(isPendingWorkOrder(a)).toBe(true)
  })

  it('does not treat real or empty numbers as pending', () => {
    expect(isPendingWorkOrder('WO-PM-2026-0001')).toBe(false)
    expect(isPendingWorkOrder(undefined)).toBe(false)
    expect(isPendingWorkOrder(null)).toBe(false)
  })
})

describe('addIntervalToDate', () => {
  it('adds the interval to a YYYY-MM-DD date', () => {
    expect(addIntervalToDate('2026-01-15', 'Weekly')).toBe('2026-01-22')
    expect(addIntervalToDate('2026-01-15', 'Monthly')).toBe('2026-02-15')
    expect(addIntervalToDate('2026-01-15', 'Quarterly')).toBe('2026-04-15')
    expect(addIntervalToDate('2026-01-15', 'Half-Yearly')).toBe('2026-07-15')
    expect(addIntervalToDate('2026-01-15', 'Annual')).toBe('2027-01-15')
  })

  it('accepts DD-MM-YYYY and defaults to quarterly for an unknown interval', () => {
    expect(addIntervalToDate('15-01-2026', 'Weekly')).toBe('2026-01-22')
    expect(addIntervalToDate('2026-01-15', 'whenever')).toBe('2026-04-15')
  })
})
