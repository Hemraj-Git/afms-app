// PM and inspection schedules on assets. A schedule is one template running on
// one asset: it is "running" while that asset has an open job for the
// template (a PM job not Completed or Cancelled, an inspection not Completed);
// completing it makes the next one (migration 0050). An asset can run several
// templates at once, but never the same one twice.

import type { Asset, ChecklistTemplate, Inspection, SubCategory, WorkOrder } from '@/types/afms'
import type { FirstScheduleMode } from '@/lib/firstSchedule'

/** One schedule to start: a template and how its first date is set. */
export interface AssetScheduleRequest {
  templateId: string
  mode: FirstScheduleMode
  /** The first job's date, for mode 'date' (YYYY-MM-DD). */
  date?: string
}

/** What the database did for one asset. */
export interface ScheduleResult {
  assetId: string
  status: 'scheduled' | 'skipped'
  dueDate?: string
  reason?: string
}

export type ScheduleKind = 'pm' | 'inspection'

export const kindOf = (t: Pick<ChecklistTemplate, 'type'>): ScheduleKind => (t.type === 'Inspection' ? 'inspection' : 'pm')

/** The sub-category's templates of one kind (the old single-id fields as a fallback). */
export function subCategoryTemplateIds(sub: SubCategory | undefined, kind: ScheduleKind): string[] {
  if (!sub) return []
  const many = kind === 'pm' ? sub.pmTemplateIds : sub.inspectionTemplateIds
  const one = kind === 'pm' ? sub.pmTemplateId : sub.inspectionTemplateId
  return Array.from(new Set(many && many.length ? many : one ? [one] : [])).filter(Boolean)
}

export interface RunningSchedule {
  kind: ScheduleKind
  templateId: string
  /** The open job's due date and status: the next one in the schedule. */
  dueDate: string
  status: string
  jobId: string
}

const isOpenPm = (w: WorkOrder) => w.type === 'Preventive' && !!w.checklistTemplateId && w.status !== 'Completed' && w.status !== 'Cancelled'
const isOpenInspection = (i: Inspection) => !!i.templateId && i.status !== 'Completed'

/** "assetId:templateId" for every schedule that is running. */
export function runningKeys(workOrders: WorkOrder[], inspections: Inspection[]): Set<string> {
  const keys = new Set<string>()
  for (const w of workOrders) if (w.assetId && isOpenPm(w)) keys.add(`${w.assetId}:${w.checklistTemplateId}`)
  for (const i of inspections) if (i.assetId && isOpenInspection(i)) keys.add(`${i.assetId}:${i.templateId}`)
  return keys
}

/** One asset's running schedules, the next due first. */
export function runningSchedules(assetId: string, workOrders: WorkOrder[], inspections: Inspection[]): RunningSchedule[] {
  const byTemplate = new Map<string, RunningSchedule>()
  const keep = (s: RunningSchedule) => {
    const key = `${s.kind}:${s.templateId}`
    const had = byTemplate.get(key)
    if (!had || s.dueDate < had.dueDate) byTemplate.set(key, s)
  }
  for (const w of workOrders) {
    if (w.assetId === assetId && isOpenPm(w)) keep({ kind: 'pm', templateId: w.checklistTemplateId!, dueDate: w.dueDate, status: w.status, jobId: w.id })
  }
  for (const i of inspections) {
    if (i.assetId === assetId && isOpenInspection(i)) keep({ kind: 'inspection', templateId: i.templateId, dueDate: i.dueDate, status: i.status, jobId: i.id })
  }
  return [...byTemplate.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export interface ScheduleGap {
  asset: Asset
  template: ChecklistTemplate
}

/**
 * Assets that should run a template of their sub-category but don't: not
 * retired, and no open job for it. These are what "Not scheduled" lists.
 */
export function scheduleGaps(
  kind: ScheduleKind,
  { assets, subCategories, templates, workOrders, inspections }: {
    assets: Asset[]
    subCategories: SubCategory[]
    templates: ChecklistTemplate[]
    workOrders: WorkOrder[]
    inspections: Inspection[]
  },
): ScheduleGap[] {
  const running = runningKeys(workOrders, inspections)
  const subById = new Map(subCategories.map(s => [s.id, s]))
  const templateById = new Map(templates.map(t => [t.id, t]))
  const gaps: ScheduleGap[] = []
  for (const asset of assets) {
    if (asset.status === 'Retired') continue
    for (const id of subCategoryTemplateIds(subById.get(asset.subCategoryId), kind)) {
      const template = templateById.get(id)
      if (!template || kindOf(template) !== kind) continue
      if (!running.has(`${asset.id}:${id}`)) gaps.push({ asset, template })
    }
  }
  return gaps
}

/** What a template is missing before it can be scheduled, if anything. */
export function templateProblem(t: ChecklistTemplate): string | null {
  if (!t.interval) return `Set how often "${t.title}" repeats first`
  if (!t.items?.length) return `Add checklist items to "${t.title}" first`
  return null
}
