'use client'

import { CalendarClock, X } from 'lucide-react'
import type { ChecklistTemplate, SubCategory } from '@/types/afms'
import { kindOf, subCategoryTemplateIds, templateProblem, type AssetScheduleRequest } from '@/lib/assetSchedules'
import { defaultFirstMode, firstDueDate } from '@/lib/firstSchedule'
import { formatDateDisplay } from '@/lib/dateUtils'
import { FirstDatePicker, type FirstDateChoice } from './FirstDatePicker'

// The schedules a new asset starts with: its sub-category's PM and inspection
// templates (each can be left out) plus any other template added here. Each
// has its own first date.

export type ScheduleChoice = FirstDateChoice & { enabled: boolean }

export interface NewScheduleRow {
  template: ChecklistTemplate
  /** Added here, not from the sub-category (can be removed). */
  extra: boolean
  choice: ScheduleChoice
  /** Why it can't be scheduled (no items, no interval). */
  problem: string | null
}

export function newScheduleRows({
  subCategory,
  extraTemplateIds,
  choices,
  templates,
  installationDate,
  today,
}: {
  subCategory?: SubCategory
  extraTemplateIds: string[]
  choices: Record<string, ScheduleChoice>
  templates: ChecklistTemplate[]
  installationDate: string
  today: string
}): NewScheduleRow[] {
  const fromSub = [...subCategoryTemplateIds(subCategory, 'pm'), ...subCategoryTemplateIds(subCategory, 'inspection')]
  const ids = [...new Set([...fromSub, ...extraTemplateIds])]
  return ids.flatMap(id => {
    const template = templates.find(t => t.id === id)
    if (!template) return []
    const problem = templateProblem(template)
    const choice = choices[id] ?? { enabled: true, mode: defaultFirstMode(installationDate, template.interval ?? '', today) }
    return [{ template, extra: !fromSub.includes(id), choice: problem ? { ...choice, enabled: false } : choice, problem }]
  })
}

/** The rows to start, with their first dates -- or the first problem to fix. */
export function checkNewSchedules(
  rows: NewScheduleRow[],
  installationDate: string,
  today: string,
): { ok: true; schedules: (AssetScheduleRequest & { title: string; firstDate: string })[] } | { ok: false; error: string } {
  const schedules: (AssetScheduleRequest & { title: string; firstDate: string })[] = []
  for (const { template, choice } of rows) {
    if (!choice.enabled) continue
    const due = firstDueDate(choice.mode, { installationDate, interval: template.interval ?? '', customDate: choice.date, today })
    if ('error' in due) return { ok: false, error: `${template.title}: ${due.error}` }
    schedules.push({ templateId: template.id, mode: choice.mode, date: choice.mode === 'date' ? due.date : undefined, title: template.title, firstDate: due.date })
  }
  return { ok: true, schedules }
}

export function NewAssetSchedules({
  rows,
  templates,
  installationDate,
  today,
  onChoice,
  onAdd,
  onRemove,
}: {
  rows: NewScheduleRow[]
  templates: ChecklistTemplate[]
  installationDate: string
  today: string
  onChoice: (templateId: string, choice: ScheduleChoice) => void
  onAdd: (templateId: string) => void
  onRemove: (templateId: string) => void
}) {
  const inList = new Set(rows.map(r => r.template.id))
  const addable = (kind: 'pm' | 'inspection') =>
    templates.filter(t => kindOf(t) === kind && !inList.has(t.id)).sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-200/80 text-xs">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-blue-600" />
        <p className="font-bold text-slate-900">PM & inspection schedule</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500">
          No PM or inspection templates on this sub-category yet. Add one here, or schedule later from the asset page or the Preventive / Inspections pages.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ template, extra, choice, problem }) => (
            <li key={template.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  aria-label={`Schedule ${template.title}`}
                  checked={choice.enabled}
                  disabled={!!problem}
                  onChange={e => onChoice(template.id, { ...choice, enabled: e.target.checked })}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">
                    {template.title}{' '}
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                      {kindOf(template) === 'pm' ? 'PM' : 'Inspection'} · {template.interval ?? '—'}
                    </span>
                  </p>
                  {problem ? <p className="text-[11px] text-amber-700 mt-0.5">{problem}</p> : null}
                  {!choice.enabled && !problem ? <p className="text-[11px] text-slate-400 mt-0.5">Not scheduled now</p> : null}
                </div>
                {extra ? (
                  <button type="button" onClick={() => onRemove(template.id)} aria-label={`Remove ${template.title}`} className="p-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
              {choice.enabled ? (
                <div className="pl-6">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">First {kindOf(template) === 'pm' ? 'PM' : 'inspection'}</p>
                  <FirstDatePicker
                    name={template.title}
                    value={choice}
                    onChange={next => onChoice(template.id, { ...next, enabled: true })}
                    interval={template.interval ?? ''}
                    installationDate={installationDate}
                    today={today}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {(['pm', 'inspection'] as const).map(kind => (
          <select
            key={kind}
            aria-label={kind === 'pm' ? 'Add a PM schedule' : 'Add an inspection schedule'}
            value=""
            onChange={e => e.target.value && onAdd(e.target.value)}
            disabled={addable(kind).length === 0}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 disabled:opacity-50"
          >
            <option value="">{kind === 'pm' ? '+ Add PM' : '+ Add inspection'}</option>
            {addable(kind).map(t => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.interval ?? '—'})
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  )
}

/** The confirmation text: each schedule and its first date, then the warning. */
export const scheduleConfirmLines = (schedules: { title: string; firstDate: string }[]) =>
  schedules.map(s => `• ${s.title} — first on ${formatDateDisplay(s.firstDate)}`).join('\n')
