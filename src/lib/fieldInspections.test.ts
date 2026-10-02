import { describe, expect, it } from 'vitest'
import type { Inspection } from '@/types/afms'
import {
  answerOf, checkpointsFor, inspectionCounts, inspectionLock, inspectionProblems, inspectionRemarks, inspectionsFor, previousResult, resultOf,
  type InspectionDraft,
} from './fieldInspections'

const NOW = new Date(2026, 8, 30, 10, 30)
const insp = (over: Partial<Inspection>): Inspection => ({
  id: over.id ?? 'x',
  inspectionNumber: 'INSP-2026-0001',
  assetId: 'a1',
  templateId: 't1',
  templateVersion: 1,
  dueDate: '2026-10-02',
  status: 'Scheduled',
  createdAt: '2026-09-01',
  ...over,
})

describe('the Inspections list', () => {
  const list = [
    insp({ id: 'a', dueDate: '2026-10-05' }),
    insp({ id: 'b', dueDate: '2026-09-28', status: 'In Progress' }),
    insp({ id: 'c', status: 'Completed', result: 'Pass', completedAt: '2026-09-20' }),
    insp({ id: 'd', status: 'Completed', result: 'Pass', completedAt: '2026-09-25' }),
    insp({ id: 'e', status: 'Completed', result: 'Fail', completedAt: '2026-09-22' }),
  ]

  it('counts to do, overdue, passed and defects', () => {
    expect(inspectionCounts(list, '2026-09-30')).toEqual({ todo: 2, overdue: 1, passed: 2, defects: 1 })
  })

  it('lists to do soonest first and finished ones newest first', () => {
    expect(inspectionsFor(list, 'To do').map(i => i.id)).toEqual(['b', 'a'])
    expect(inspectionsFor(list, 'Passed').map(i => i.id)).toEqual(['d', 'c'])
    expect(inspectionsFor(list, 'Defects').map(i => i.id)).toEqual(['e'])
  })

  it('finds the last result for the same asset and template', () => {
    expect(previousResult(list, list[0])?.id).toBe('d')
    expect(previousResult(list, insp({ id: 'z', assetId: 'other' }))).toBeUndefined()
  })
})

describe('when an inspection may be started', () => {
  it('opens by the template interval', () => {
    expect(inspectionLock(insp({ dueDate: '2026-10-20' }), 'Monthly', NOW)).toEqual({ opensOn: '13 Oct', rule: '7 days before scheduled date' })
    expect(inspectionLock(insp({ dueDate: '2026-10-05' }), 'Monthly', NOW)).toBeNull()
    expect(inspectionLock(insp({ dueDate: '2026-12-20', status: 'Completed' }), 'Monthly', NOW)).toBeNull()
  })
})

describe('checkpoints and answers', () => {
  it('uses the scheduled copy, else the template, in order', () => {
    const items = [
      { id: '2', order: 2, itemText: 'B', mandatory: true, photoRequired: false },
      { id: '1', order: 1, itemText: 'A', mandatory: true, photoRequired: false },
    ]
    expect(checkpointsFor(insp({ checklistSnapshot: items }), []).map(i => i.id)).toEqual(['1', '2'])
    expect(checkpointsFor(insp({ checklistSnapshot: [] }), [{ id: 't1', items }]).map(i => i.id)).toEqual(['1', '2'])
    expect(checkpointsFor(insp({}), [])).toEqual([])
  })

  it('reads old bare answers and new ones with a note', () => {
    expect(answerOf('Fail')).toEqual({ result: 'Fail', note: '' })
    expect(answerOf({ value: 'Fail', remarks: 'Cracked hose' })).toEqual({ result: 'Fail', note: 'Cracked hose' })
    expect(answerOf({ value: 'Pass' })).toEqual({ result: 'Pass', note: '' })
    expect(answerOf(undefined)).toEqual({ result: null, note: '' })
  })
})

describe('submitting', () => {
  const items = [
    { id: 'g', itemText: 'Gauge in the green', mandatory: true, photoRequired: true },
    { id: 'h', itemText: 'Hose free of cracks', mandatory: true, photoRequired: false },
    { id: 'm', itemText: 'Mounted and visible', mandatory: false, photoRequired: false },
  ]
  const base: InspectionDraft = { items, answers: {}, notes: {}, photos: {}, uploading: 0, failed: 0, startPhoto: true, endPhoto: true }
  const fields = (d: Partial<InspectionDraft>) => inspectionProblems({ ...base, ...d }).map(p => `${p.field}:${p.message}`)

  it('needs every mandatory checkpoint answered and every required photo', () => {
    expect(fields({})).toEqual(['g:Choose PASS or FAIL.', 'g:Take the photo for this checkpoint.', 'h:Choose PASS or FAIL.'])
    expect(fields({ answers: { g: 'Pass', h: 'Pass' }, photos: { g: true } })).toEqual([])
  })

  it('needs a failure to say what is wrong', () => {
    expect(fields({ answers: { g: 'Pass', h: 'Fail' }, photos: { g: true } })).toEqual(['h:Say what is wrong.'])
    expect(fields({ answers: { g: 'Pass', h: 'Fail' }, notes: { h: 'Crack at the horn' }, photos: { g: true } })).toEqual([])
  })

  it('needs the photo at the start and the one at the end', () => {
    const ok = { answers: { g: 'Pass' as const, h: 'Pass' as const }, photos: { g: true } }
    expect(fields({ ...ok, startPhoto: false, endPhoto: false })).toEqual([
      'start:Take the photo at the asset before starting.',
      'end:Take the photo at the end of the inspection.',
    ])
    expect(fields(ok)).toEqual([])
  })

  it('waits for photos', () => {
    expect(fields({ answers: { g: 'Pass', h: 'Pass' }, photos: { g: true }, uploading: 1 })).toEqual(['photos:Wait for the photos to finish uploading.'])
  })

  it('fails when any checkpoint fails, and says which in the remarks', () => {
    expect(resultOf({ g: 'Pass', h: 'Pass' })).toBe('Pass')
    expect(resultOf({ g: 'Pass', h: 'Fail' })).toBe('Fail')
    expect(inspectionRemarks(items, { g: 'Pass' }, {}, '')).toBe('Physical checkpoints verified compliant on-site.')
    expect(inspectionRemarks(items, { g: 'Pass' }, {}, ' All good ')).toBe('All good')
    expect(inspectionRemarks(items, { h: 'Fail' }, { h: 'Crack at the horn' }, 'Tag due next month')).toBe('Tag due next month\nFailed: Hose free of cracks: Crack at the horn')
  })
})
