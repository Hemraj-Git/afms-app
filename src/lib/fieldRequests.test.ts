import { describe, expect, it } from 'vitest'
import type { ServiceRequest } from '@/types/afms'
import {
  checkInPurpose, durationText, myRequests, newRequestProblems, parseScan, requestCounts, requestSteps, requestsFor, requestTitle, sinceText, slaHours, slaText,
} from './fieldRequests'

const NOW = new Date(2026, 8, 30, 10, 30)
const sr = (over: Partial<ServiceRequest>): ServiceRequest => ({
  id: over.id ?? 'x',
  ticketId: 'SR-2026-0001',
  title: 'Fan noise',
  description: '',
  requestType: 'Maintenance',
  roomId: 'r1',
  requestedBy: 'A',
  requestedByRole: 'Faculty',
  status: 'Open',
  priority: 'Medium',
  createdAt: '2026-09-30T04:00:00.000Z',
  slaDueDate: '2026-10-01T04:00:00.000Z',
  ...over,
})

describe('my requests', () => {
  const all = [
    sr({ id: 'a', requestedByUserId: 'me', createdAt: '2026-09-01' }),
    sr({ id: 'b', requestedByUserId: 'other', requestedByEmail: 'Guest@Mail.com', createdAt: '2026-09-03' }),
    sr({ id: 'c', requestedByUserId: 'me', createdAt: '2026-09-02' }),
  ]
  it('are the ones I raised, newest first', () => {
    expect(myRequests(all, { id: 'me', role: 'Faculty', email: 'guest@mail.com' }).map(r => r.id)).toEqual(['c', 'a'])
  })
  it('include a returning guest’s earlier ones by email', () => {
    expect(myRequests(all, { id: 'new', role: 'Guest', email: 'guest@mail.com' }).map(r => r.id)).toEqual(['b'])
  })
  it('count and filter by state', () => {
    const list = [sr({ status: 'Open' }), sr({ status: 'Escalated' }), sr({ status: 'Resolved' }), sr({ status: 'Closed' })]
    expect(requestCounts(list)).toEqual({ all: 4, open: 2, resolved: 1, closed: 1 })
    expect(requestsFor(list, 'Open').map(r => r.status)).toEqual(['Open', 'Escalated'])
  })
})

describe('deadlines', () => {
  it('reads durations the short way', () => {
    expect(durationText(23 * 3600e3 + 58 * 60e3)).toBe('23 h 58 m')
    expect(durationText(6 * 3600e3)).toBe('6 h')
    expect(durationText(45 * 60e3)).toBe('45 m')
    expect(durationText(72 * 3600e3)).toBe('3 days')
  })
  it('counts down, then up', () => {
    const due = new Date(NOW.getTime() + (2 * 60 + 32) * 60e3).toISOString()
    expect(slaText(sr({ slaDueDate: due }), NOW)).toEqual({ text: 'Due in 2 h 32 m', overdue: false })
    const late = new Date(NOW.getTime() - 6 * 3600e3).toISOString()
    expect(slaText(sr({ slaDueDate: late, status: 'Escalated' }), NOW)).toEqual({ text: 'Overdue by 6 h', overdue: true })
    expect(slaText(sr({ status: 'Resolved', slaDueDate: late }), NOW)).toEqual({ text: 'Resolved', overdue: false })
  })
  it('uses the SLA settings for a new request', () => {
    expect(slaHours('Critical', { Critical: 4 })).toBe(4)
    expect(slaHours('Low', {})).toBe(24)
  })
})

describe('a request’s progress', () => {
  const states = (s: Partial<ServiceRequest>) => requestSteps(sr(s), 'today').map(x => `${x.title}:${x.state}`)
  it('waits for the team, then is worked on, then resolved', () => {
    expect(states({ status: 'Open' })).toEqual(['Request raised:done', 'Sent to Maintenance:current', 'In progress:upcoming', 'Resolved:upcoming'])
    expect(states({ status: 'In Progress', assignedToName: 'Ravi', workOrderNumber: 'WO-CR-2026-0004' })).toEqual([
      'Request raised:done', 'Assigned to Maintenance:done', 'In progress:current', 'Resolved:upcoming',
    ])
    expect(states({ status: 'Resolved' })).toEqual(['Request raised:done', 'Assigned to Maintenance:done', 'In progress:done', 'Resolved:done'])
  })
  it('names the team by the request until there is a job', () => {
    expect(requestSteps(sr({ requestType: 'Housekeeping' }), 'today')[1].title).toBe('Sent to Housekeeping')
    expect(requestSteps(sr({ requestType: 'Housekeeping', workOrderType: 'Corrective', status: 'In Progress' }), 'today')[1].title).toBe('Assigned to Maintenance')
  })
  it('names the team for a cleaning job, never a pending number, and says when it is escalated', () => {
    const steps = requestSteps(sr({ status: 'Escalated', workOrderType: 'Housekeeping', workOrderNumber: 'PENDING-abc' }), 'today')
    expect(steps[1]).toEqual({ title: 'Sent to Housekeeping', state: 'current', detail: 'Waiting for the team to assign it' })
    expect(steps[2]).toEqual({ title: 'Escalated', state: 'current', detail: 'Raised to a supervisor for urgent attention' })
  })
  it('says why when it was closed without a job', () => {
    expect(requestSteps(sr({ status: 'Closed', dismissalReason: 'Duplicate of SR-2026-0003' }), 'today')).toEqual([
      { title: 'Request raised', state: 'done', detail: 'today' },
      { title: 'Closed without a job', state: 'done', detail: 'Duplicate of SR-2026-0003' },
    ])
  })
})

describe('scan', () => {
  it('reads the app’s own room and asset links, nothing else', () => {
    expect(parseScan('https://afms.example/qr?type=room&id=abc', 'https://x')).toEqual({ type: 'room', id: 'abc' })
    expect(parseScan('/mobile?type=asset&code=AST-1', 'https://x')).toEqual({ type: 'asset', id: 'AST-1' })
    expect(parseScan('https://evil.example/?type=user&id=1', 'https://x')).toBeNull()
    expect(parseScan('just text', 'https://x')).toBeNull()
  })
  it('saves the purpose of a visit', () => {
    expect(checkInPurpose('', '')).toEqual({ problem: 'Choose why you are here.' })
    expect(checkInPurpose('Lab session', '')).toEqual({ purpose: 'Lab session' })
    expect(checkInPurpose('Meeting', ' Dept review ')).toEqual({ purpose: 'Meeting: Dept review' })
    expect(checkInPurpose('Other', '')).toEqual({ problem: 'Say what the visit is for.' })
    expect(checkInPurpose('Other', 'Fire drill')).toEqual({ purpose: 'Fire drill' })
  })
  it('says since when, with the date when not today', () => {
    expect(sinceText(new Date(2026, 8, 30, 10, 31).getTime(), '', NOW)).toBe('10:31 AM')
    expect(sinceText(new Date(2026, 8, 29, 18, 5).getTime(), '', NOW)).toBe('29 Sep, 6:05 PM')
    expect(sinceText(undefined, '10:31:00', NOW)).toBe('10:31:00')
  })
})

describe('a new request', () => {
  const base = { type: 'Maintenance' as const, roomId: 'r1', roomHasEquipment: true, assetId: 'a1', description: 'Grinding noise', uploading: 0, failed: 0 }
  it('needs a room, the equipment when the room has any, and a description', () => {
    expect(newRequestProblems(base)).toEqual([])
    expect(newRequestProblems({ ...base, roomId: '', description: ' ' }).map(p => p.field)).toEqual(['roomId', 'description'])
    expect(newRequestProblems({ ...base, assetId: '' }).map(p => p.field)).toEqual(['assetId'])
    expect(newRequestProblems({ ...base, assetId: '', roomHasEquipment: false })).toEqual([])
    expect(newRequestProblems({ ...base, type: 'Housekeeping', assetId: '' })).toEqual([])
    expect(newRequestProblems({ ...base, uploading: 1 }).map(p => p.field)).toEqual(['photo'])
  })
  it('makes a title when none is typed', () => {
    expect(requestTitle(' Fan noise ', 'Maintenance', 'Fan', 'Lab', 'x')).toBe('Fan noise')
    expect(requestTitle('', 'Maintenance', 'Ceiling Fan', 'Lab', 'Loud grinding sound at speed 3 and above. Blades wobble.')).toBe('[Maintenance] Ceiling Fan - Loud grinding sound at speed 3 and above')
    expect(requestTitle('', 'Housekeeping', 'Fan', 'Catering Lab', 'Spill')).toBe('[Housekeeping] Catering Lab - Spill')
  })
})
