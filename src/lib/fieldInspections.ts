import type { ChecklistItemDef, ChecklistTemplate, Inspection } from '@/types/afms'
import { getAttemptWindowStatus } from '@/lib/attemptWindow'
import { shortDate } from '@/lib/fieldTasks'

// The Inspections tab of the field app: the list, when one may be started,
// and running one -- PASS or FAIL per checkpoint, what is wrong with a
// failure, the photos -- through to its result. Pure functions, so the
// screens and the tests agree.

export type InspectionFilter = 'To do' | 'Passed' | 'Defects'

const isOpen = (i: Pick<Inspection, 'status'>) => i.status !== 'Completed'

export function inspectionCounts(list: Pick<Inspection, 'status' | 'result' | 'dueDate'>[], today: string) {
  const open = list.filter(isOpen)
  return {
    todo: open.length,
    overdue: open.filter(i => !!i.dueDate && i.dueDate.slice(0, 10) < today).length,
    passed: list.filter(i => !isOpen(i) && i.result === 'Pass').length,
    defects: list.filter(i => !isOpen(i) && i.result === 'Fail').length,
  }
}

// To do: soonest due first. Done: most recent first.
export function inspectionsFor<T extends Pick<Inspection, 'status' | 'result' | 'dueDate' | 'completedAt'>>(list: T[], filter: InspectionFilter): T[] {
  if (filter === 'To do') return list.filter(isOpen).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const result = filter === 'Passed' ? 'Pass' : 'Fail'
  return list
    .filter(i => !isOpen(i) && i.result === result)
    .sort((a, b) => (b.completedAt || b.dueDate || '').localeCompare(a.completedAt || a.dueDate || ''))
}

// An inspection opens a set time before it is due, by its template's
// interval (see attemptWindow.ts) -- the same rule completeInspection checks.
export function inspectionLock(
  insp: Pick<Inspection, 'status' | 'dueDate'>,
  interval: string | undefined,
  now: Date = new Date(),
): { opensOn: string; rule: string } | null {
  if (!isOpen(insp)) return null
  const w = getAttemptWindowStatus(insp.dueDate, interval, now)
  return w.canAttempt ? null : { opensOn: shortDate(w.unlockDate, now), rule: w.windowDescription }
}

// The checkpoints: the copy taken when it was scheduled, or the template's.
export function checkpointsFor(insp: Pick<Inspection, 'checklistSnapshot' | 'templateId'>, templates: Pick<ChecklistTemplate, 'id' | 'items'>[]): ChecklistItemDef[] {
  const items = insp.checklistSnapshot?.length ? insp.checklistSnapshot : templates.find(t => t.id === insp.templateId)?.items ?? []
  return [...items].sort((a, b) => a.order - b.order)
}

// A saved answer: older records keep a bare 'Pass' / 'Fail', newer ones
// { value, remarks } (the desktop reads both).
export function answerOf(saved: unknown): { result: 'Pass' | 'Fail' | null; note: string } {
  const v = typeof saved === 'string' ? saved : (saved as { value?: unknown } | null | undefined)?.value
  const remarks = typeof saved === 'object' && saved ? (saved as { remarks?: unknown }).remarks : undefined
  return { result: v === 'Fail' ? 'Fail' : v === 'Pass' ? 'Pass' : null, note: typeof remarks === 'string' ? remarks : '' }
}

export interface InspectionDraft {
  items: Pick<ChecklistItemDef, 'id' | 'itemText' | 'mandatory' | 'photoRequired'>[]
  answers: Record<string, 'Pass' | 'Fail' | undefined>
  notes: Record<string, string>
  // Which checkpoints have an uploaded photo.
  photos: Record<string, boolean>
  uploading: number
  failed: number
}

export interface InspectionProblem {
  // A checkpoint id, or 'photos' for uploads in flight or failed.
  field: string
  message: string
}

// What stops a submit, in screen order. As before: every mandatory
// checkpoint answered, and a photo wherever the checkpoint asks for one. New
// with this screen: a FAIL says what is wrong -- it becomes the job the
// maintenance team gets.
export function inspectionProblems(d: InspectionDraft): InspectionProblem[] {
  const problems: InspectionProblem[] = []
  if (d.uploading > 0) problems.push({ field: 'photos', message: 'Wait for the photos to finish uploading.' })
  if (d.failed > 0) problems.push({ field: 'photos', message: 'A photo did not upload. Retry it or retake it.' })
  for (const item of d.items) {
    const answer = d.answers[item.id]
    if (item.mandatory && !answer) problems.push({ field: item.id, message: 'Choose PASS or FAIL.' })
    else if (answer === 'Fail' && !d.notes[item.id]?.trim()) problems.push({ field: item.id, message: 'Say what is wrong.' })
    if (item.photoRequired && !d.photos[item.id]) problems.push({ field: item.id, message: 'Take the photo for this checkpoint.' })
  }
  return problems
}

export const resultOf = (answers: Record<string, 'Pass' | 'Fail' | undefined>): 'Pass' | 'Fail' =>
  Object.values(answers).includes('Fail') ? 'Fail' : 'Pass'

// The record's remarks: what the inspector wrote, and each failure with what is
// wrong -- this text also becomes the issue on the breakdown job a failure raises.
export function inspectionRemarks(
  items: Pick<ChecklistItemDef, 'id' | 'itemText'>[],
  answers: Record<string, 'Pass' | 'Fail' | undefined>,
  notes: Record<string, string>,
  overall: string,
): string {
  const failures = items.filter(i => answers[i.id] === 'Fail').map(i => `${i.itemText}: ${notes[i.id]?.trim() || 'failed'}`)
  const said = overall.trim()
  if (!failures.length) return said || 'Physical checkpoints verified compliant on-site.'
  return [said, `Failed: ${failures.join('; ')}`].filter(Boolean).join('\n')
}

// The previous finished inspection of the same asset with the same template.
export function previousResult<T extends Pick<Inspection, 'id' | 'assetId' | 'templateId' | 'status' | 'result' | 'completedAt' | 'dueDate'>>(
  all: T[],
  insp: T,
): T | undefined {
  return all
    .filter(i => i.id !== insp.id && i.assetId === insp.assetId && i.templateId === insp.templateId && i.status === 'Completed' && i.result)
    .sort((a, b) => (b.completedAt || b.dueDate || '').localeCompare(a.completedAt || a.dueDate || ''))[0]
}
