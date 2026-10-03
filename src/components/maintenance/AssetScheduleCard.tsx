'use client'

import { useState } from 'react'
import { AlertTriangle, CalendarClock, Plus } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import type { Asset, ChecklistTemplate } from '@/types/afms'
import { Modal } from '@/components/ui/Modal'
import { showToast } from '@/lib/toast'
import { formatDateDisplay, getLocalDateStr } from '@/lib/dateUtils'
import { kindOf, runningSchedules, subCategoryTemplateIds, templateProblem, type ScheduleKind } from '@/lib/assetSchedules'
import { FIRST_SCHEDULE_WARNING, defaultFirstMode, firstDueDate } from '@/lib/firstSchedule'
import { FirstDatePicker, type FirstDateChoice } from './FirstDatePicker'

const kindLabel = (k: ScheduleKind) => (k === 'pm' ? 'PM' : 'Inspection')

// An asset's PM and inspection schedules: the ones running (with the next due
// date) and its sub-category's templates not scheduled yet. An Admin adds a
// schedule here; once started, its first date can't be changed.
export function AssetScheduleCard({ asset }: { asset: Asset }) {
  const { checklistTemplates, subCategories, workOrders, inspections, scheduleMaintenance } = useAFMS()
  const [today] = useState(getLocalDateStr)
  const [adding, setAdding] = useState<{ kind: ScheduleKind; templateId: string; choice: FirstDateChoice } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sub = subCategories.find(s => s.id === asset.subCategoryId)
  const templateOf = (id: string) => checklistTemplates.find(t => t.id === id)
  const running = runningSchedules(asset.id, workOrders, inspections)
  const runningIds = new Set(running.map(r => r.templateId))
  const fromSub = [...subCategoryTemplateIds(sub, 'pm'), ...subCategoryTemplateIds(sub, 'inspection')]
  const notScheduled = fromSub.map(templateOf).filter((t): t is ChecklistTemplate => !!t && !runningIds.has(t.id))
  const retired = asset.status === 'Retired'

  const choiceFor = (t?: ChecklistTemplate): FirstDateChoice => ({ mode: defaultFirstMode(asset.installationDate, t?.interval ?? '', today) })
  const open = (kind: ScheduleKind, templateId = '') => {
    setError('')
    setAdding({ kind, templateId, choice: choiceFor(templateOf(templateId)) })
  }

  const chosen = adding?.templateId ? templateOf(adding.templateId) : undefined
  // The sub-category's templates first, then every other one of that kind.
  const options = adding
    ? checklistTemplates
        .filter(t => kindOf(t) === adding.kind)
        .sort((a, b) => Number(fromSub.includes(b.id)) - Number(fromSub.includes(a.id)) || a.title.localeCompare(b.title))
    : []

  const save = async () => {
    if (!adding || !chosen) return setError('Choose a template.')
    const problem = templateProblem(chosen)
    if (problem) return setError(problem)
    const due = firstDueDate(adding.choice.mode, {
      installationDate: asset.installationDate,
      interval: chosen.interval ?? '',
      customDate: adding.choice.date,
      today,
    })
    if ('error' in due) return setError(due.error)
    setSaving(true)
    const res = await scheduleMaintenance([asset.id], chosen.id, adding.choice.mode, adding.choice.mode === 'date' ? due.date : undefined)
    setSaving(false)
    const r = res?.[0]
    if (!r) return
    if (r.status === 'skipped') return setError(r.reason ?? 'Not scheduled.')
    showToast('success', `${chosen.title} scheduled — first on ${formatDateDisplay(r.dueDate)}.`)
    setAdding(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">PM & inspection schedule</h3>
        </div>
        {!retired ? (
          <button
            type="button"
            onClick={() => open('pm')}
            className="btn btn-soft btn-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add a schedule
          </button>
        ) : null}
      </div>

      {retired ? <p className="text-slate-500">This asset is retired, so it has no schedules.</p> : null}

      {running.length === 0 && notScheduled.length === 0 && !retired ? (
        <p className="text-slate-500">No schedules yet. Add a PM or an inspection to start one.</p>
      ) : null}

      <ul className="space-y-2">
        {running.map(r => {
          const t = templateOf(r.templateId)
          return (
            <li key={`${r.kind}:${r.templateId}`} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
              <p className="font-semibold text-slate-800">{t?.title ?? 'Template removed'}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {kindLabel(r.kind)} · {t?.interval ?? '—'} · next {formatDateDisplay(r.dueDate)}
                {r.status !== 'Scheduled' ? ` · ${r.status}` : ''}
              </p>
            </li>
          )
        })}
        {!retired &&
          notScheduled.map(t => (
            <li key={t.id} className="p-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{t.title}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {kindLabel(kindOf(t))} · {t.interval ?? '—'} · Not scheduled
                </p>
              </div>
              <button
                type="button"
                onClick={() => open(kindOf(t), t.id)}
                className="btn btn-secondary btn-sm shrink-0"
              >
                Schedule
              </button>
            </li>
          ))}
      </ul>

      {adding ? (
        <Modal title="Add a schedule" onClose={() => !saving && setAdding(null)} preventClose={saving} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
          <h3 className="text-base font-bold text-slate-900">Add a schedule to {asset.name}</h3>

          <div className="flex gap-2">
            {(['pm', 'inspection'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setAdding({ kind: k, templateId: '', choice: choiceFor() })}
                className={`px-3 py-1.5 rounded-lg font-semibold border ${adding.kind === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                {k === 'pm' ? 'Preventive maintenance' : 'Inspection'}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="schedule-template" className="block font-semibold text-slate-700 mb-1">
              Template
            </label>
            <select
              id="schedule-template"
              value={adding.templateId}
              onChange={e => {
                setError('')
                setAdding({ ...adding, templateId: e.target.value, choice: choiceFor(templateOf(e.target.value)) })
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              <option value="">Choose a template…</option>
              {options.map(t => {
                const why = runningIds.has(t.id) ? 'already scheduled' : templateProblem(t) ? 'needs checklist items or an interval' : ''
                return (
                  <option key={t.id} value={t.id} disabled={!!why}>
                    {t.title} ({t.interval ?? '—'}){fromSub.includes(t.id) ? ' — for this sub-category' : ''}
                    {why ? ` — ${why}` : ''}
                  </option>
                )
              })}
            </select>
            {options.length === 0 ? <p className="text-[11px] text-slate-500 mt-1">No {kindLabel(adding.kind)} templates yet. Create one under Utility first.</p> : null}
          </div>

          {chosen ? (
            <div>
              <p className="font-semibold text-slate-700 mb-1">First {kindLabel(adding.kind) === 'PM' ? 'PM' : 'inspection'}</p>
              <FirstDatePicker
                name={chosen.title}
                value={adding.choice}
                onChange={choice => {
                  setError('')
                  setAdding({ ...adding, choice })
                }}
                interval={chosen.interval ?? ''}
                installationDate={asset.installationDate}
                today={today}
                disabled={saving}
              />
            </div>
          ) : null}

          <p className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{FIRST_SCHEDULE_WARNING}</span>
          </p>

          {error ? (
            <p role="alert" className="text-rose-600 font-medium">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setAdding(null)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !chosen}
              onClick={save}
              className="btn btn-primary"
            >
              {saving ? 'Scheduling…' : 'Start schedule'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
