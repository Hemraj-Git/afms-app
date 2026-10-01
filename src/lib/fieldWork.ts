import type { Inspection, UserProfile, WorkOrder } from '@/types/afms'
import { isOpenWorkOrder } from '@/lib/workOrderState'

// Whose work is whose, in the field app. The same rules the app has always
// used: a job is someone's when it is assigned to their id -- or, for records
// made before ids were stored, to their name. Pure functions, so the screens,
// the bottom-nav badges and the tests agree.

type Person = Pick<UserProfile, 'id' | 'fullName'>

const isMine = (id: string | undefined, name: string | undefined, me: Person) =>
  (!!id && id === me.id) || (!!name && name === me.fullName)

// Preventive and corrective work orders (a technician never does housekeeping).
export const technicianWorkOrders = (all: WorkOrder[], me: Person) =>
  all.filter(w => w.type !== 'Housekeeping' && isMine(w.assignedTechnicianId, w.assignedTechnicianName, me))

export const housekeepingWorkOrders = (all: WorkOrder[], me: Person) =>
  all.filter(w => w.type === 'Housekeeping' && isMine(w.assignedTechnicianId, w.assignedTechnicianName, me))

export const myInspections = (all: Inspection[], me: Person) =>
  all.filter(i => isMine(i.assignedInspectorId, i.assignedInspectorName, me))

// The counts on the bottom-nav badges: OPEN work only.
export function openWorkCounts(workOrders: WorkOrder[], inspections: Inspection[], me: Person) {
  return {
    Tasks: technicianWorkOrders(workOrders, me).filter(isOpenWorkOrder).length,
    Cleaning: housekeepingWorkOrders(workOrders, me).filter(isOpenWorkOrder).length,
    Inspections: myInspections(inspections, me).filter(i => i.status !== 'Completed').length,
  }
}

// "5 min ago", "2 h ago", "Yesterday", "28 Sep" -- how long ago, for lists.
export function timeAgo(value: string | Date | undefined | null, now: Date = new Date()): string {
  if (!value) return ''
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return ''
  const mins = Math.round((now.getTime() - then.getTime()) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (then >= startOfToday) return `${hours} h ago`
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000)
  if (then >= startOfYesterday) return 'Yesterday'
  // Spelled out here: browsers disagree ("Sep" or "Sept"), the design says "Sep".
  const day = `${then.getDate()} ${MONTHS[then.getMonth()]}`
  return then.getFullYear() !== now.getFullYear() ? `${day} ${then.getFullYear()}` : day
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
