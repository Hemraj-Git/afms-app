import { getLocalDateStr } from '@/lib/dateUtils'
import type { WorkOrder } from '@/types/afms'

// The single definition of "overdue" for a work order, used by the Work Orders,
// Preventive and Corrective pages. Previously each page had its own copy, and
// they disagreed: only Work Orders excluded Cancelled orders, so a Cancelled
// order showed as Overdue on the other two. A finished or cancelled order can't
// be late, and one with no due date has nothing to be late against.
export function isWorkOrderOverdue(wo: Pick<WorkOrder, 'status' | 'dueDate'>): boolean {
  if (wo.status === 'Completed' || wo.status === 'Cancelled') return false
  if (!wo.dueDate) return false
  return wo.dueDate < getLocalDateStr()
}
