import { describe, expect, it } from 'vitest'
import { DEFAULT_SLA_CONFIG, slaHoursOf, toSlaConfig } from './slaSettings'

describe('toSlaConfig', () => {
  it('takes the stored hours and falls back to the defaults', () => {
    expect(toSlaConfig([{ priority: 'Medium', hours: 8 }, { priority: 'Bogus', hours: 3 }, { priority: 'Low', hours: 0 }])).toEqual({
      ...DEFAULT_SLA_CONFIG,
      Medium: 8,
    })
    expect(toSlaConfig(null)).toEqual(DEFAULT_SLA_CONFIG)
  })
})

describe('slaHoursOf', () => {
  const config = { ...DEFAULT_SLA_CONFIG, Medium: 8 }

  it('uses the hours stored on the request, not the current setting', () => {
    expect(slaHoursOf({ slaHours: 24, priority: 'Medium', createdAt: '', slaDueDate: '' }, config)).toBe(24)
  })

  it('works them out from an older request\'s own deadline', () => {
    expect(
      slaHoursOf({ priority: 'Medium', createdAt: '2026-10-01T10:00:00.000Z', slaDueDate: '2026-10-02T10:00:00.000Z' }, config),
    ).toBe(24)
  })

  it('falls back to the current setting only when there is no deadline', () => {
    expect(slaHoursOf({ priority: 'Medium', createdAt: '2026-10-01T10:00:00.000Z', slaDueDate: '' }, config)).toBe(8)
  })
})
