// Operational attempt window rules for scheduled PM and Inspections
export type MaintenanceInterval = 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annually'

export interface AttemptWindowStatus {
  canAttempt: boolean
  unlockDate: string
  windowDays: number
  windowDescription: string
  daysUntilUnlock: number
  isOverdue: boolean
}

/**
 * Calculates whether a scheduled task (PM Work Order or Inspection) can be attempted.
 * Policy:
 * - Annually: Before 2 months from scheduled date
 * - Half-Yearly: Before 1 month from scheduled date
 * - Quarterly: Before 15 days from scheduled date
 * - Monthly: Before 7 days from scheduled date
 * - Weekly: Before 1 day from scheduled date
 * 
 * When inside the window or on/after the scheduled due date, execution is unlocked.
 */
export function getAttemptWindowStatus(
  dueDateStr?: string | null,
  interval?: string | null,
  referenceDate: Date = new Date()
): AttemptWindowStatus {
  const defaultStatus: AttemptWindowStatus = {
    canAttempt: true,
    unlockDate: '',
    windowDays: 0,
    windowDescription: 'Standard Window',
    daysUntilUnlock: 0,
    isOverdue: false,
  }

  if (!dueDateStr || typeof dueDateStr !== 'string') {
    return defaultStatus
  }

  let targetDue: Date
  try {
    const cleanDateStr = dueDateStr.split('T')[0]
    const parts = cleanDateStr.split('-').map(p => parseInt(p, 10))
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDue = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59)
    } else {
      targetDue = new Date(dueDateStr)
    }
    if (isNaN(targetDue.getTime())) {
      return defaultStatus
    }
  } catch {
    return defaultStatus
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 0, 0, 0)
  const dueDay = new Date(targetDue.getFullYear(), targetDue.getMonth(), targetDue.getDate(), 0, 0, 0)

  let unlockDate: Date
  let windowDescription: string
  let windowDays: number

  const safeInterval = (typeof interval === 'string' && interval ? interval : 'Quarterly')
  const normalizedInterval = safeInterval.toLowerCase().replace(/[-_]/g, '')

  if (normalizedInterval.includes('annual') || (normalizedInterval.includes('year') && !normalizedInterval.includes('half'))) {
    // 2 months before scheduled date
    unlockDate = new Date(dueDay.getFullYear(), dueDay.getMonth() - 2, dueDay.getDate(), 0, 0, 0)
    windowDescription = '2 months before scheduled date'
    windowDays = 60
  } else if (normalizedInterval.includes('half') || normalizedInterval.includes('semi')) {
    // 1 month before scheduled date
    unlockDate = new Date(dueDay.getFullYear(), dueDay.getMonth() - 1, dueDay.getDate(), 0, 0, 0)
    windowDescription = '1 month before scheduled date'
    windowDays = 30
  } else if (normalizedInterval.includes('quarter')) {
    // 15 days before scheduled date
    unlockDate = new Date(dueDay.getTime() - 15 * 86400000)
    windowDescription = '15 days before scheduled date'
    windowDays = 15
  } else if (normalizedInterval.includes('month')) {
    // 7 days before scheduled date
    unlockDate = new Date(dueDay.getTime() - 7 * 86400000)
    windowDescription = '7 days before scheduled date'
    windowDays = 7
  } else if (normalizedInterval.includes('week')) {
    // 1 day before scheduled date
    unlockDate = new Date(dueDay.getTime() - 1 * 86400000)
    windowDescription = '1 day before scheduled date'
    windowDays = 1
  } else {
    // Default quarterly (15 days)
    unlockDate = new Date(dueDay.getTime() - 15 * 86400000)
    windowDescription = '15 days before scheduled date'
    windowDays = 15
  }

  const unlockDateStr = !isNaN(unlockDate.getTime()) ? unlockDate.toISOString().split('T')[0] : ''
  const diffToUnlockMs = unlockDate.getTime() - today.getTime()
  const daysUntilUnlock = Math.ceil(diffToUnlockMs / 86400000)
  const isOverdue = today.getTime() > dueDay.getTime()
  const canAttempt = today.getTime() >= unlockDate.getTime()

  return {
    canAttempt,
    unlockDate: unlockDateStr,
    windowDays,
    windowDescription,
    daysUntilUnlock: daysUntilUnlock > 0 ? daysUntilUnlock : 0,
    isOverdue,
  }
}
