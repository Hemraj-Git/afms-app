import { describe, expect, it } from 'vitest'
import { complianceBand, complianceRate } from './compliance'

const done = (result: 'Pass' | 'Fail') => ({ status: 'Completed' as const, result })
const open = { status: 'Scheduled' as const, result: undefined }

describe('complianceRate', () => {
  it('has nothing to score with no inspections, or none completed', () => {
    expect(complianceRate([])).toBeNull()
    expect(complianceRate([open, open])).toBeNull()
  })

  it('is passed ÷ completed, ignoring the ones not done yet', () => {
    expect(complianceRate([done('Pass'), done('Pass'), done('Fail'), open])).toBe(67)
    expect(complianceRate([done('Pass')])).toBe(100)
  })

  it('is a real 0% when every completed inspection failed', () => {
    expect(complianceRate([done('Fail'), done('Fail')])).toBe(0)
  })
})

describe('complianceBand', () => {
  it('labels each range', () => {
    expect(complianceBand(null)).toEqual({ label: 'No inspections yet', tone: 'none' })
    expect(complianceBand(95).label).toBe('Outstanding')
    expect(complianceBand(80).label).toBe('Good')
    expect(complianceBand(0)).toEqual({ label: 'Needs Action', tone: 'poor' })
  })
})
