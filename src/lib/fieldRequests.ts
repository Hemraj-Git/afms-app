import type { ServiceRequest, SlaConfig, SlaPriority, UserProfile } from '@/types/afms'
import { isPendingWorkOrder } from '@/lib/idGenerator'
import { shortDate } from '@/lib/fieldTasks'

// Requests, Scan and New request in the field app: whose requests are whose,
// how a deadline reads, a request's progress, check-in purposes and what a
// scanned QR code points at. Pure functions, so screens and tests agree.

// ---- My requests -------------------------------------------------------------

// A request is mine when I raised it. A returning Guest gets a new account on
// each visit, so a Guest's earlier requests are matched by email too -- the
// database allows exactly that (see "Guest read same-email service_requests").
export function myRequests<T extends Pick<ServiceRequest, 'requestedByUserId' | 'requestedByEmail' | 'createdAt'>>(
  all: T[],
  me: Pick<UserProfile, 'id' | 'role' | 'email'>,
): T[] {
  const email = me.email?.toLowerCase()
  return all
    .filter(sr => sr.requestedByUserId === me.id || (me.role === 'Guest' && !!email && sr.requestedByEmail?.toLowerCase() === email))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const isOpenRequest = (sr: Pick<ServiceRequest, 'status'>) => sr.status === 'Open' || sr.status === 'In Progress' || sr.status === 'Escalated'

export type RequestFilter = 'All' | 'Open' | 'Resolved' | 'Closed'

export function requestCounts(list: Pick<ServiceRequest, 'status'>[]) {
  return {
    all: list.length,
    open: list.filter(isOpenRequest).length,
    resolved: list.filter(r => r.status === 'Resolved').length,
    closed: list.filter(r => r.status === 'Closed').length,
  }
}

export function requestsFor<T extends Pick<ServiceRequest, 'status'>>(list: T[], filter: RequestFilter): T[] {
  if (filter === 'All') return list
  if (filter === 'Open') return list.filter(isOpenRequest)
  return list.filter(r => r.status === filter)
}

// ---- Deadlines -----------------------------------------------------------------

// "23 h 58 m", "6 h", "45 m", "3 days".
export function durationText(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  if (mins < 60) return `${mins} m`
  const hours = Math.floor(mins / 60)
  if (hours >= 48) return `${Math.round(hours / 24)} days`
  const rest = mins % 60
  return rest ? `${hours} h ${rest} m` : `${hours} h`
}

// The deadline line on a request: "Due in 2 h 32 m", "Overdue by 6 h", or its
// outcome once it is no longer open.
export function slaText(sr: Pick<ServiceRequest, 'status' | 'slaDueDate'>, now: Date = new Date()): { text: string; overdue: boolean } | undefined {
  if (sr.status === 'Resolved') return { text: 'Resolved', overdue: false }
  if (sr.status === 'Closed') return { text: 'Closed', overdue: false }
  const due = sr.slaDueDate ? new Date(sr.slaDueDate).getTime() : NaN
  if (Number.isNaN(due)) return undefined
  const left = due - now.getTime()
  return left >= 0 ? { text: `Due in ${durationText(left)}`, overdue: false } : { text: `Overdue by ${durationText(-left)}`, overdue: true }
}

// How long a new request of this priority has, by the SLA settings.
export const slaHours = (priority: SlaPriority, config: Partial<SlaConfig>) => config[priority] || 24

// ---- A request's progress ------------------------------------------------------

export interface RequestStep {
  title: string
  state: 'done' | 'current' | 'upcoming'
  detail?: string
}

// Raised -> handed to the team -> being worked on -> resolved. Escalation and
// a dismissal are said in the steps themselves.
export function requestSteps(
  sr: Pick<ServiceRequest, 'status' | 'createdAt' | 'requestType' | 'assignedToName' | 'workOrderNumber' | 'workOrderType' | 'resolutionNotes' | 'dismissalReason'>,
  raisedWhen: string,
): RequestStep[] {
  // The job it became, or -- before there is one -- the kind of request.
  const kind = sr.workOrderType ?? sr.requestType
  const team = kind === 'Housekeeping' || kind === 'Cleaning' ? 'Housekeeping' : 'Maintenance'
  const job = sr.workOrderNumber && !isPendingWorkOrder(sr.workOrderNumber) ? sr.workOrderNumber : ''
  const finished = sr.status === 'Resolved' || sr.status === 'Closed'
  const assigned = !!(sr.assignedToName || job) || sr.status === 'In Progress' || finished

  if (sr.status === 'Closed' && sr.dismissalReason) {
    return [
      { title: 'Request raised', state: 'done', detail: raisedWhen },
      { title: 'Closed without a job', state: 'done', detail: sr.dismissalReason },
    ]
  }
  return [
    { title: 'Request raised', state: 'done', detail: raisedWhen },
    {
      title: assigned ? `Assigned to ${team}` : `Sent to ${team}`,
      state: assigned ? 'done' : 'current',
      detail: assigned ? [sr.assignedToName, job].filter(Boolean).join(' · ') || undefined : 'Waiting for the team to assign it',
    },
    {
      title: sr.status === 'Escalated' ? 'Escalated' : 'In progress',
      state: finished ? 'done' : sr.status === 'In Progress' || sr.status === 'Escalated' ? 'current' : 'upcoming',
      detail: sr.status === 'Escalated' ? 'Raised to a supervisor for urgent attention' : undefined,
    },
    { title: sr.status === 'Closed' ? 'Closed' : 'Resolved', state: finished ? 'done' : 'upcoming', detail: finished ? sr.resolutionNotes : undefined },
  ]
}

// ---- Scan ----------------------------------------------------------------------

export const CHECK_IN_PURPOSES = ['Class / lecture', 'Lab session', 'Meeting', 'Visit / tour', 'Maintenance', 'Other'] as const

// What is saved as the visit's purpose: the choice, and the details if any.
// "Other" needs the details to mean anything.
export function checkInPurpose(choice: string, details: string): { purpose?: string; problem?: string } {
  const d = details.trim()
  if (!choice) return { problem: 'Choose why you are here.' }
  if (choice === 'Other' && !d) return { problem: 'Say what the visit is for.' }
  return { purpose: choice === 'Other' ? d : d ? `${choice}: ${d}` : choice }
}

// What a scanned QR code points at: the app's own room or asset link
// (…/qr?type=room&id=… or …/mobile?type=asset&id=…). Anything else is not ours.
export function parseScan(raw: string, origin: string): { type: 'room' | 'asset'; id: string } | null {
  try {
    const url = new URL(raw.trim(), origin)
    const type = url.searchParams.get('type')
    const id = url.searchParams.get('id') || url.searchParams.get('code')
    if ((type === 'room' || type === 'asset') && id) return { type, id }
  } catch {
    // not a link
  }
  return null
}

// "Since 10:31 AM" from a check-in's time, or its date when not today.
export function sinceText(checkInTimestamp: number | undefined, fallback: string, now: Date = new Date()): string {
  if (!checkInTimestamp) return fallback
  const t = new Date(checkInTimestamp)
  const h = t.getHours()
  const time = `${h % 12 || 12}:${String(t.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  const sameDay = t.toDateString() === now.toDateString()
  return sameDay ? time : `${shortDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`, now)}, ${time}`
}

// ---- New request ---------------------------------------------------------------

export interface NewRequestDraft {
  type: 'Maintenance' | 'Housekeeping'
  roomId: string
  // Equipment in the chosen room; a Maintenance request must name one when there is any.
  roomHasEquipment: boolean
  assetId: string
  description: string
  uploading: number
  failed: number
}

export type NewRequestField = 'roomId' | 'assetId' | 'description' | 'photo'

// What stops a submit, as the app has always checked it.
export function newRequestProblems(d: NewRequestDraft): { field: NewRequestField; message: string }[] {
  const out: { field: NewRequestField; message: string }[] = []
  if (!d.roomId) out.push({ field: 'roomId', message: 'Choose the room.' })
  if (d.type === 'Maintenance' && d.roomId && d.roomHasEquipment && !d.assetId) out.push({ field: 'assetId', message: 'Choose the equipment that needs attention.' })
  if (!d.description.trim()) out.push({ field: 'description', message: 'Describe the problem.' })
  if (d.uploading) out.push({ field: 'photo', message: 'Wait for the photo to finish uploading.' })
  if (d.failed) out.push({ field: 'photo', message: 'The photo did not upload. Retry it or retake it.' })
  return out
}

// A title when none is typed: "[Maintenance] Ceiling Fan - Loud grinding…".
export function requestTitle(typed: string, type: string, assetName: string | undefined, roomName: string | undefined, description: string): string {
  if (typed.trim()) return typed.trim()
  const what = type === 'Maintenance' && assetName ? assetName : roomName || 'Facility'
  return `[${type}] ${what} - ${description.trim().slice(0, 40)}`
}

// When a request raised now should be sorted by, from its priority's SLA.
export const slaDueFromNow = (priority: SlaPriority, config: Partial<SlaConfig>, now: Date = new Date()) =>
  new Date(now.getTime() + slaHours(priority, config) * 3_600_000).toISOString()
