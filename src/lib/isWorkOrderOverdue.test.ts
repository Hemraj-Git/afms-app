import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWorkOrderOverdue } from './isWorkOrderOverdue'

// "Today" is pinned so the tests don't depend on the day they run.
function today(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${iso}T12:00:00`))
}

afterEach(() => vi.useRealTimers())

describe('isWorkOrderOverdue', () => {
  it('is overdue when the due date is before today and the order is still open', () => {
    today('2026-09-20')
    expect(isWorkOrderOverdue({ status: 'Scheduled', dueDate: '2026-09-19' })).toBe(true)
    expect(isWorkOrderOverdue({ status: 'In Progress', dueDate: '2026-01-01' })).toBe(true)
  })

  it('is not overdue on the due date itself or before it', () => {
    today('2026-09-20')
    expect(isWorkOrderOverdue({ status: 'Scheduled', dueDate: '2026-09-20' })).toBe(false)
    expect(isWorkOrderOverdue({ status: 'Scheduled', dueDate: '2026-09-21' })).toBe(false)
  })

  it('never marks Completed or Cancelled orders overdue', () => {
    today('2026-09-20')
    expect(isWorkOrderOverdue({ status: 'Completed', dueDate: '2020-01-01' })).toBe(false)
    expect(isWorkOrderOverdue({ status: 'Cancelled', dueDate: '2020-01-01' })).toBe(false)
  })

  it('is not overdue without a due date', () => {
    today('2026-09-20')
    expect(isWorkOrderOverdue({ status: 'Scheduled', dueDate: '' })).toBe(false)
  })
})
