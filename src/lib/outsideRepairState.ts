import { getLocalDateStr } from '@/lib/dateUtils'
import type { OutsideRepair } from '@/types/afms'

// Rules for parts and assets sent off site during a corrective job. The database
// enforces the same limits (0043); these give the person a clear message first.

export const isOutForRepair = (r: Pick<OutsideRepair, 'status'>) => r.status === 'Out for Repair'

// Still out after the day it was due back.
export function isOverdueReturn(
  r: Pick<OutsideRepair, 'status' | 'expectedReturnDate'>,
  today: string = getLocalDateStr()
): boolean {
  return isOutForRepair(r) && Boolean(r.expectedReturnDate) && r.expectedReturnDate < today
}

export function repairsForWorkOrder<T extends Pick<OutsideRepair, 'workOrderId'>>(list: T[], workOrderId: string): T[] {
  return list.filter(r => r.workOrderId === workOrderId)
}

export function openRepairsForWorkOrder<T extends Pick<OutsideRepair, 'workOrderId' | 'status'>>(
  list: T[],
  workOrderId: string
): T[] {
  return list.filter(r => r.workOrderId === workOrderId && isOutForRepair(r))
}

// What was sent: the part's name, or the asset itself.
export const repairItemLabel = (r: Pick<OutsideRepair, 'scope' | 'componentName'>) =>
  r.scope === 'Component' ? r.componentName || 'Component' : 'Complete asset'

// Days since it left: to its return, or to today while it is still out.
export function daysOut(
  r: Pick<OutsideRepair, 'sentDate' | 'returnedDate'>,
  today: string = getLocalDateStr()
): number {
  const end = r.returnedDate || today
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${r.sentDate}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0
}

// The tag on a work order card while something is away, e.g. "Asset off-site".
export function workOrderRepairTag(
  list: Pick<OutsideRepair, 'workOrderId' | 'status' | 'scope' | 'expectedReturnDate'>[],
  workOrderId: string,
  today: string = getLocalDateStr()
): { label: string; overdue: boolean } | undefined {
  const open = openRepairsForWorkOrder(list, workOrderId)
  if (open.length === 0) return undefined
  const overdue = open.some(r => isOverdueReturn(r, today))
  if (open.some(r => r.scope === 'Complete Asset')) return { label: 'Asset off-site', overdue }
  return { label: open.length === 1 ? 'Part out for repair' : `${open.length} parts out for repair`, overdue }
}

// Why a work order cannot be completed yet, or null.
export function completionBlockedMessage(
  list: Pick<OutsideRepair, 'workOrderId' | 'status' | 'repairNumber' | 'scope' | 'componentName'>[],
  workOrderId: string
): string | null {
  const open = openRepairsForWorkOrder(list, workOrderId)
  if (open.length === 0) return null
  const items = open.map(r => `${repairItemLabel(r)} (${r.repairNumber})`).join(', ')
  return `This work order cannot be completed yet: ${items} ${open.length === 1 ? 'is' : 'are'} still out for repair. Record ${open.length === 1 ? 'its' : 'their'} return first.`
}

export interface SendInput {
  scope?: OutsideRepair['scope']
  componentName?: string
  vendorId?: string
  sentDate?: string
  expectedReturnDate?: string
  estimatedCost?: number
}

export function validateSend(input: SendInput, today: string = getLocalDateStr()): string | null {
  if (!input.scope) return 'Choose what is being sent: a component or the complete asset.'
  if (input.scope === 'Component' && !input.componentName?.trim()) return 'Enter the name of the part being sent (e.g. Motherboard).'
  if (!input.vendorId) return 'Select the vendor it is being sent to.'
  if (!input.sentDate) return 'Enter the date it was sent.'
  if (input.sentDate > today) return 'The sent date cannot be in the future.'
  if (!input.expectedReturnDate) return 'Enter the expected return date (ETD).'
  if (input.expectedReturnDate < input.sentDate) return 'The expected return date cannot be before the sent date.'
  if (input.estimatedCost !== undefined && (!Number.isFinite(input.estimatedCost) || input.estimatedCost < 0)) {
    return 'The estimated cost must be 0 or more.'
  }
  return null
}

export interface ReturnInput {
  returnedDate?: string
  outcome?: OutsideRepair['outcome']
  actualCost?: number
}

export function validateReturn(
  input: ReturnInput,
  sentDate: string,
  today: string = getLocalDateStr()
): string | null {
  if (!input.returnedDate) return 'Enter the date it came back.'
  if (input.returnedDate < sentDate) return 'The return date cannot be before the date it was sent.'
  if (input.returnedDate > today) return 'The return date cannot be in the future.'
  if (!input.outcome) return 'Choose the outcome: Repaired, Replaced by vendor or Not repairable.'
  if (input.actualCost !== undefined && (!Number.isFinite(input.actualCost) || input.actualCost < 0)) {
    return 'The cost must be 0 or more.'
  }
  return null
}
