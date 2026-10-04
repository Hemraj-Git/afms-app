import type { Asset, Building, ChecklistItemDef, Room, WorkOrder } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { isOpenWorkOrder, validateVendorHandover } from '@/lib/workOrderState'

// The technician's Tasks tab and work-order screen in the field app: how a
// job's dates read, which jobs a filter shows and in what order, when a
// preventive job may be started, and what still stops a save. Pure functions,
// so the screens and the tests agree.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86_400_000

// A YYYY-MM-DD (or ISO) date as a local calendar day, or null.
function dayOf(value: string | undefined | null): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS)

// "2 Oct", or "2 Oct 2027" when it is not this year.
export function shortDate(value: string | undefined | null, now: Date = new Date()): string {
  const d = dayOf(value)
  if (!d) return ''
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? s : `${s} ${d.getFullYear()}`
}

// "28 Aug 2026": always with the year, for facts like "Last done".
export function longDate(value: string | undefined | null): string {
  const d = dayOf(value)
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''
}

// When a job is due, as the card says it: "Due today", "Due tomorrow",
// "Due 2 Oct", or -- once late -- "Overdue by 2 days · was due 28 Sep".
export function dueText(dueDate: string | undefined | null, now: Date = new Date()): { text: string; overdue: boolean } | undefined {
  const due = dayOf(dueDate)
  if (!due) return undefined
  const days = daysBetween(now, due)
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: 'Due tomorrow', overdue: false }
  if (days > 1) return { text: `Due ${shortDate(dueDate, now)}`, overdue: false }
  const late = -days
  return { text: `Overdue by ${late} day${late === 1 ? '' : 's'} · was due ${shortDate(dueDate, now)}`, overdue: true }
}

// The words on a job's date line, finished or not.
export function jobDateText(wo: Pick<WorkOrder, 'status' | 'dueDate' | 'completedAt'>, now: Date = new Date()) {
  if (wo.status === 'Completed') return { text: wo.completedAt ? `Completed ${shortDate(wo.completedAt, now)}` : 'Completed', overdue: false }
  if (wo.status === 'Cancelled') return { text: 'Cancelled', overdue: false }
  return dueText(wo.dueDate, now)
}

// "Breakdown" is what the field calls a corrective job.
export const jobKindOf = (wo: Pick<WorkOrder, 'type'>) =>
  wo.type === 'Preventive' ? 'Preventive' : wo.type === 'Housekeeping' ? 'Cleaning' : 'Breakdown'

// ---- The Tasks list ---------------------------------------------------------

export type TaskFilter = 'All' | 'Preventive' | 'Corrective' | 'Completed'

export function taskCounts(list: Pick<WorkOrder, 'type' | 'status'>[]) {
  const open = list.filter(isOpenWorkOrder)
  return {
    open: open.length,
    preventive: open.filter(w => w.type === 'Preventive').length,
    corrective: open.filter(w => w.type === 'Corrective').length,
    completed: list.filter(w => w.status === 'Completed').length,
  }
}

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

// Open work: latest due first in line (overdue at the top), then the more
// urgent. Finished work: most recently completed first.
export function tasksFor<T extends Pick<WorkOrder, 'type' | 'status' | 'dueDate' | 'priority' | 'completedAt'>>(list: T[], filter: TaskFilter): T[] {
  if (filter === 'Completed') {
    return list
      .filter(w => w.status === 'Completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  }
  return list
    .filter(w => isOpenWorkOrder(w) && (filter === 'All' || w.type === filter))
    .sort(
      (a, b) =>
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
        (PRIORITY_RANK[a.priority ?? 'Medium'] ?? 2) - (PRIORITY_RANK[b.priority ?? 'Medium'] ?? 2),
    )
}

// ---- Preventive: when it may be started --------------------------------------

// A preventive job opens a set time before it is due (7 days for a monthly
// one; see attemptWindow.ts). Before that it is locked; the card and the
// screen say when it opens. Finished jobs are never "locked".
export function preventiveLock(
  wo: Pick<WorkOrder, 'type' | 'status' | 'dueDate' | 'frequency'>,
  now: Date = new Date(),
): { opensOn: string; rule: string } | null {
  if (wo.type !== 'Preventive' || !isOpenWorkOrder(wo)) return null
  const w = getAttemptWindowStatus(wo.dueDate, wo.frequency, now)
  if (w.canAttempt) return null
  return { opensOn: shortDate(w.unlockDate, now), rule: w.windowDescription }
}

// ---- Checklist ---------------------------------------------------------------

export type ChecklistResponses = NonNullable<WorkOrder['checklistResponses']>

export function checklistProgress(items: Pick<ChecklistItemDef, 'id'>[] | undefined, responses: ChecklistResponses) {
  const total = items?.length ?? 0
  const done = items?.filter(i => responses[i.id]?.value === true).length ?? 0
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

// ---- Saving ------------------------------------------------------------------

export type SaveIntent = 'In Progress' | 'Completed'

export interface WorkOrderDraft {
  type: WorkOrder['type']
  // Corrective only: who is doing the fix.
  mode: 'In House' | 'Vendor'
  startPhoto: string
  completionPhoto: string
  vendorId: string
  vendorTicketNo: string
  // Breakdown: what was done to fix it.
  solution?: string
  // Photos still on their way up, and ones that failed (kept on the phone).
  uploading: number
  failed: number
  // Why it cannot be closed yet (a part still out for repair), if anything.
  completionBlocked?: string | null
}

// Each problem names the part of the screen it belongs to, so the screen can
// show it there and scroll to it.
export type DraftField = 'startPhoto' | 'completionPhoto' | 'solution' | 'vendorId' | 'vendorTicketNo' | 'photos' | 'outsideRepair'
export interface DraftProblem {
  field: DraftField
  message: string
}

// What stops this save, in screen order. The same rules the field app has
// always applied, plus "wait for the photos":
// - a vendor job needs the vendor; closing it also needs the vendor's job no.
// - closing your own job needs the on-site photo; a breakdown also the
//   after-repair photo (a vendor's job sheet is the proof for a vendor job).
// - closing a preventive job needs its completion proof photo, and closing
//   any breakdown says what was done ("Solution taken").
// - closing a cleaning task needs the after-cleaning photo (the before photo
//   is optional, as it always was).
// - nothing closes while a part is still at an outside workshop.
export function draftProblems(d: WorkOrderDraft, intent: SaveIntent): DraftProblem[] {
  const problems: DraftProblem[] = []
  if (d.uploading > 0) problems.push({ field: 'photos', message: 'Wait for the photos to finish uploading.' })
  if (d.failed > 0) problems.push({ field: 'photos', message: 'A photo did not upload. Retry it or retake it.' })

  const vendorJob = d.type === 'Corrective' && d.mode === 'Vendor'
  if (vendorJob) {
    const handover = validateVendorHandover({ vendorId: d.vendorId, vendorTicketNo: d.vendorTicketNo }, intent)
    if (handover) problems.push({ field: d.vendorId ? 'vendorTicketNo' : 'vendorId', message: d.vendorId ? "Enter the vendor's ticket or job number." : 'Choose the vendor.' })
  }
  if (intent === 'Completed') {
    if (d.type === 'Housekeeping') {
      if (!d.completionPhoto) problems.push({ field: 'completionPhoto', message: 'Take the after-cleaning photo.' })
    } else {
      if (!vendorJob && !d.startPhoto) problems.push({ field: 'startPhoto', message: 'Take the photo with the asset on site.' })
      if (d.type === 'Corrective' && !d.solution?.trim()) problems.push({ field: 'solution', message: 'Say what was done to fix it.' })
      if (d.type === 'Corrective' && !vendorJob && !d.completionPhoto) problems.push({ field: 'completionPhoto', message: 'Take the after-repair photo.' })
      if (d.type === 'Preventive' && !d.completionPhoto) problems.push({ field: 'completionPhoto', message: 'Take the completion proof photo.' })
    }
    if (d.completionBlocked) problems.push({ field: 'outsideRepair', message: d.completionBlocked })
  }
  return problems
}

// "Expected back 7 Oct 2026 (in 7 days)" / "(today)" / "(2 days late)".
export function expectedBackText(expected: string, now: Date = new Date()): { text: string; late: boolean } {
  const d = dayOf(expected)
  if (!d) return { text: 'Expected back date not set', late: false }
  const days = daysBetween(now, d)
  const when = days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} late`
  return { text: `Expected back ${longDate(expected)} (${when})`, late: days < 0 }
}

// ---- Where a job is ----------------------------------------------------------

// A work order names its asset by row id or, on older records, by its code.
export const assetFor = <A extends Pick<Asset, 'id' | 'assetId'>>(assets: A[], ref: string | undefined) =>
  ref ? assets.find(a => a.id === ref || a.assetId === ref) : undefined

// "Catering Lab (R-0214) · Main Academic Block"
export function placeText(room: Pick<Room, 'name' | 'roomNumber' | 'buildingId'> | undefined, buildings: Pick<Building, 'id' | 'name'>[]): string {
  if (!room) return ''
  const building = buildings.find(b => b.id === room.buildingId)?.name
  const where = room.roomNumber ? `${room.name} (${room.roomNumber})` : room.name
  return building ? `${where} · ${building}` : where
}

// A room's floor as people say it: "2" -> "Floor 2", "Ground" -> "Ground floor",
// and a value that already says floor ("3rd Floor") as it is.
export function floorText(floor: string | undefined | null): string {
  const f = (floor ?? '').trim()
  if (!f) return ''
  if (/^\d+$/.test(f)) return `Floor ${f}`
  return /\bfloor\b/i.test(f) ? f : `${f} floor`
}

// The "Due" fact on the job screen: "Today", "7 Oct", "Overdue by 2 days" --
// or, once finished, "Completed" and when.
export function dueFact(wo: Pick<WorkOrder, 'status' | 'dueDate' | 'completedAt'>, now: Date = new Date()): { label: string; value?: string; tone?: 'danger' } {
  if (wo.status === 'Completed') return { label: 'Completed', value: wo.completedAt ? shortDate(wo.completedAt, now) : undefined }
  const due = dueText(wo.dueDate, now)
  if (!due) return { label: 'Due' }
  if (due.overdue) return { label: 'Due', value: due.text.split(' · ')[0], tone: 'danger' }
  const rest = due.text.replace(/^Due /, '')
  return { label: 'Due', value: rest.charAt(0).toUpperCase() + rest.slice(1) }
}

// A moment, the way people say it: "today, 5:15 PM", "yesterday, 9:12 AM",
// "28 Sep, 9:12 AM".
export function whenText(value: string | undefined | null, now: Date = new Date()): string {
  if (!value) return ''
  const t = new Date(value)
  if (Number.isNaN(t.getTime())) return ''
  const h = t.getHours()
  const time = `${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  const days = daysBetween(t, now)
  const day = days === 0 ? 'today' : days === 1 ? 'yesterday' : days === -1 ? 'tomorrow' : shortDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`, now)
  return `${day}, ${time}`
}

// ---- The Cleaning list (housekeeping) ----------------------------------------

export type CleaningFilter = 'Open' | 'Scheduled' | 'In Progress' | 'Completed'

export function cleaningCounts(list: Pick<WorkOrder, 'status'>[]) {
  return {
    open: list.filter(isOpenWorkOrder).length,
    scheduled: list.filter(w => w.status === 'Scheduled').length,
    inProgress: list.filter(w => w.status === 'In Progress').length,
    completed: list.filter(w => w.status === 'Completed').length,
  }
}

// Same order as Tasks: open work latest-due first, finished work newest first.
export function cleaningFor<T extends Pick<WorkOrder, 'type' | 'status' | 'dueDate' | 'priority' | 'completedAt'>>(list: T[], filter: CleaningFilter): T[] {
  if (filter === 'Completed') return tasksFor(list, 'Completed')
  const open = tasksFor(list, 'All')
  return filter === 'Open' ? open : open.filter(w => w.status === filter)
}
