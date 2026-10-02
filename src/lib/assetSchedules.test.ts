import { describe, expect, it } from 'vitest'
import type { Asset, ChecklistTemplate, Inspection, SubCategory, WorkOrder } from '@/types/afms'
import { runningSchedules, scheduleGaps, subCategoryTemplateIds, templateProblem } from './assetSchedules'

const asset = (id: string, extra: Partial<Asset> = {}) => ({ id, assetId: id, name: id, subCategoryId: 'sc', roomId: 'r', installationDate: '2024-01-01', status: 'Operational', ...extra }) as Asset
const tpl = (id: string, type: ChecklistTemplate['type'], interval: ChecklistTemplate['interval'] = 'Monthly') =>
  ({ id, title: id, type, interval, items: [{ id: 'i', order: 1, itemText: 'x', mandatory: false, photoRequired: false, responseType: 'Checkbox' }] }) as ChecklistTemplate
const pmJob = (assetId: string, templateId: string, status: WorkOrder['status'], dueDate = '2026-11-01') =>
  ({ id: `${assetId}-${templateId}-${status}`, woNumber: 'x', title: 'x', type: 'Preventive', assetId, checklistTemplateId: templateId, status, dueDate, createdAt: '' }) as WorkOrder
const insp = (assetId: string, templateId: string, status: Inspection['status'], dueDate = '2026-12-01') =>
  ({ id: `${assetId}-${templateId}-${status}`, inspectionNumber: 'x', assetId, templateId, templateVersion: 1, status, dueDate, createdAt: '' }) as Inspection

const sub = { id: 'sc', categoryId: 'c', name: 'AC', code: 'AC', metadataFields: [], pmTemplateIds: ['monthly', 'quarterly'], inspectionTemplateIds: ['look'] } as SubCategory
const templates = [tpl('monthly', 'Preventive Maintenance'), tpl('quarterly', 'Preventive Maintenance', 'Quarterly'), tpl('look', 'Inspection')]

describe('scheduleGaps', () => {
  it('lists each template of the sub-category an asset is not running', () => {
    const gaps = scheduleGaps('pm', { assets: [asset('a1')], subCategories: [sub], templates, workOrders: [pmJob('a1', 'monthly', 'Scheduled')], inspections: [] })
    expect(gaps.map(g => `${g.asset.id}:${g.template.id}`)).toEqual(['a1:quarterly'])
  })

  it('counts a job under way as running, and a finished or cancelled chain as a gap', () => {
    const base = { assets: [asset('a1')], subCategories: [sub], templates, inspections: [] }
    expect(scheduleGaps('pm', { ...base, workOrders: [pmJob('a1', 'monthly', 'In Progress'), pmJob('a1', 'quarterly', 'On Hold' as WorkOrder['status'])] })).toEqual([])
    expect(scheduleGaps('pm', { ...base, workOrders: [pmJob('a1', 'monthly', 'Completed'), pmJob('a1', 'quarterly', 'Cancelled')] })).toHaveLength(2)
  })

  it('leaves out retired assets and keeps PM and inspections apart', () => {
    const lists = { assets: [asset('a1'), asset('a2', { status: 'Retired' })], subCategories: [sub], templates, workOrders: [] }
    expect(scheduleGaps('inspection', { ...lists, inspections: [] }).map(g => g.asset.id)).toEqual(['a1'])
    expect(scheduleGaps('inspection', { ...lists, inspections: [insp('a1', 'look', 'Scheduled')] })).toEqual([])
    expect(scheduleGaps('pm', { ...lists, inspections: [] })).toHaveLength(2)
  })

  it('ignores a template that no longer exists', () => {
    expect(scheduleGaps('pm', { assets: [asset('a1')], subCategories: [{ ...sub, pmTemplateIds: ['gone'] }], templates, workOrders: [], inspections: [] })).toEqual([])
  })
})

describe('runningSchedules', () => {
  it('lists each running template once with its next due date', () => {
    const rows = runningSchedules(
      'a1',
      [pmJob('a1', 'monthly', 'Scheduled', '2026-11-02'), pmJob('a1', 'quarterly', 'Scheduled', '2026-10-12'), pmJob('a1', 'quarterly', 'Completed'), pmJob('a2', 'monthly', 'Scheduled')],
      [insp('a1', 'look', 'In Progress', '2026-10-05')],
    )
    expect(rows.map(r => `${r.kind}:${r.templateId}:${r.dueDate}`)).toEqual(['inspection:look:2026-10-05', 'pm:quarterly:2026-10-12', 'pm:monthly:2026-11-02'])
  })
})

describe('subCategoryTemplateIds / templateProblem', () => {
  it('falls back to the old single template field', () => {
    expect(subCategoryTemplateIds({ ...sub, pmTemplateIds: [], pmTemplateId: 'old' }, 'pm')).toEqual(['old'])
    expect(subCategoryTemplateIds(undefined, 'pm')).toEqual([])
  })

  it('says what a template needs before it can be scheduled', () => {
    expect(templateProblem(templates[0])).toBeNull()
    expect(templateProblem({ ...templates[0], items: [] })).toBe('Add checklist items to "monthly" first')
    expect(templateProblem({ ...templates[0], interval: undefined })).toBe('Set how often "monthly" repeats first')
  })
})
