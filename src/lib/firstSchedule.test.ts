import { describe, expect, it } from 'vitest'
import { defaultFirstMode, firstDueDate, latestFirstDate } from './firstSchedule'

const today = '2026-10-02'

describe('firstDueDate', () => {
  it('counts one interval from the installation date while that is still ahead', () => {
    expect(firstDueDate('installation', { installationDate: '2026-09-20', interval: 'Monthly', today })).toEqual({ date: '2026-10-20' })
    expect(firstDueDate('installation', { installationDate: '20-09-2026', interval: 'Quarterly', today })).toEqual({ date: '2026-12-20' })
  })

  it('refuses the installation date when the asset was installed too long ago', () => {
    expect(firstDueDate('installation', { installationDate: '2023-03-10', interval: 'Monthly', today })).toEqual({
      error: 'Installed too long ago — pick a date or count from today',
    })
    expect(firstDueDate('installation', { installationDate: '', interval: 'Monthly', today })).toHaveProperty('error')
  })

  it('counts one interval from today', () => {
    expect(firstDueDate('today', { installationDate: '2023-03-10', interval: 'Half-Yearly', today })).toEqual({ date: '2027-04-02' })
  })

  it('uses a picked date exactly, today or later', () => {
    expect(firstDueDate('date', { installationDate: '2023-03-10', interval: 'Monthly', customDate: today, today })).toEqual({ date: today })
    expect(firstDueDate('date', { installationDate: '2023-03-10', interval: 'Monthly', customDate: '2026-10-01', today })).toEqual({
      error: "The first date can't be in the past",
    })
    expect(firstDueDate('date', { installationDate: '2023-03-10', interval: 'Monthly', customDate: '', today })).toEqual({ error: 'Pick the date of the first job' })
  })

  it('refuses a date more than two years ahead', () => {
    expect(firstDueDate('date', { installationDate: '2023-03-10', interval: 'Monthly', customDate: '2028-10-02', today })).toEqual({ date: '2028-10-02' })
    expect(firstDueDate('date', { installationDate: '2023-03-10', interval: 'Monthly', customDate: '2028-10-03', today })).toEqual({
      error: "The first date can't be more than 2 years ahead",
    })
  })

  it('never lands before the installation of an asset not installed yet', () => {
    expect(firstDueDate('today', { installationDate: '2026-12-01', interval: 'Monthly', today })).toEqual({
      error: "The first date can't be before the installation date (01-12-2026)",
    })
    expect(firstDueDate('installation', { installationDate: '2026-12-01', interval: 'Monthly', today })).toEqual({ date: '2027-01-01' })
  })

  it('stops at month-end like the database', () => {
    expect(firstDueDate('today', { installationDate: '2020-01-01', interval: 'Monthly', today: '2027-01-31' })).toEqual({ date: '2027-02-28' })
  })
})

describe('defaultFirstMode', () => {
  it('starts from the installation date only while it is still ahead', () => {
    expect(defaultFirstMode('2026-09-20', 'Monthly', today)).toBe('installation')
    expect(defaultFirstMode('2023-03-10', 'Monthly', today)).toBe('today')
  })
})

describe('latestFirstDate', () => {
  it('is two years ahead, 28 Feb for a leap day', () => {
    expect(latestFirstDate(today)).toBe('2028-10-02')
    expect(latestFirstDate('2028-02-29')).toBe('2030-02-28')
  })
})
