'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { useAFMS } from '@/context/AFMSContext'
import { Modal } from '@/components/ui/Modal'
import { formatDateDisplay, getLocalDateStr } from '@/lib/dateUtils'
import { addIntervalToDate } from '@/lib/idGenerator'
import { scheduleGaps, templateProblem, type ScheduleGap, type ScheduleKind, type ScheduleResult } from '@/lib/assetSchedules'
import { FIRST_SCHEDULE_WARNING, firstDueDate, latestFirstDate } from '@/lib/firstSchedule'

const kindWord = (k: ScheduleKind) => (k === 'pm' ? 'PM' : 'inspection')

// Pass one of these (a stable array), so the list is only worked out again when the data changes.
export const PM_ONLY: readonly ScheduleKind[] = ['pm']
export const INSPECTIONS_ONLY: readonly ScheduleKind[] = ['inspection']
export const PM_AND_INSPECTIONS: readonly ScheduleKind[] = ['pm', 'inspection']

/** The gaps of one or both kinds, optionally for one sub-category. */
export function useScheduleGaps(kinds: readonly ScheduleKind[], subCategoryId?: string): ScheduleGap[] {
  const { assets, subCategories, checklistTemplates, workOrders, inspections } = useAFMS()
  return useMemo(() => {
    const lists = {
      assets: subCategoryId ? assets.filter(a => a.subCategoryId === subCategoryId) : assets,
      subCategories,
      templates: checklistTemplates,
      workOrders,
      inspections,
    }
    return kinds.flatMap(k => scheduleGaps(k, lists))
  }, [assets, subCategories, checklistTemplates, workOrders, inspections, subCategoryId, kinds])
}

// Assets whose sub-category has a PM or inspection template they don't run
// yet (e.g. loaded before the templates existed). The Admin ticks them and
// starts the schedules in one go: from today, or from a picked date.
export function ScheduleGapsPanel({ kinds, subCategoryId, onClose }: { kinds: readonly ScheduleKind[]; subCategoryId?: string; onClose: () => void }) {
  const { scheduleMaintenance, subCategories, rooms } = useAFMS()
  const gaps = useScheduleGaps(kinds, subCategoryId)
  const [today] = useState(getLocalDateStr)
  // Ticked: "assetId:templateId". All the schedulable ones to start with.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(gaps.filter(g => !templateProblem(g.template)).map(g => `${g.asset.id}:${g.template.id}`)))
  const [mode, setMode] = useState<'today' | 'date'>('today')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<{ scheduled: number; skipped: { name: string; template: string; reason: string }[] } | null>(null)

  const groups = useMemo(() => {
    const byTemplate = new Map<string, ScheduleGap[]>()
    for (const g of gaps) byTemplate.set(g.template.id, [...(byTemplate.get(g.template.id) ?? []), g])
    return [...byTemplate.values()].sort((a, b) => a[0].template.title.localeCompare(b[0].template.title))
  }, [gaps])

  const key = (g: ScheduleGap) => `${g.asset.id}:${g.template.id}`
  const toggle = (keys: string[], on: boolean) =>
    setPicked(prev => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })
  const chosen = gaps.filter(g => picked.has(key(g)) && !templateProblem(g.template))
  const subName = subCategoryId ? subCategories.find(s => s.id === subCategoryId)?.name : undefined

  const run = async () => {
    setError('')
    if (chosen.length === 0) return setError('Tick at least one asset.')
    if (mode === 'date') {
      const check = firstDueDate('date', { interval: '', customDate: date, today })
      if ('error' in check) return setError(check.error)
    }
    setSaving(true)
    let scheduled = 0
    const skipped: { name: string; template: string; reason: string }[] = []
    for (const group of groups) {
      const ids = group.filter(g => picked.has(key(g))).map(g => g.asset.id)
      if (!ids.length || templateProblem(group[0].template)) continue
      const res: ScheduleResult[] | null = await scheduleMaintenance(ids, group[0].template.id, mode, mode === 'date' ? date : undefined)
      if (!res) {
        skipped.push(...ids.map(id => ({ name: group.find(g => g.asset.id === id)!.asset.name, template: group[0].template.title, reason: 'Not saved' })))
        continue
      }
      for (const r of res) {
        if (r.status === 'scheduled') scheduled++
        else skipped.push({ name: group.find(g => g.asset.id === r.assetId)?.asset.name ?? r.assetId, template: group[0].template.title, reason: r.reason ?? '' })
      }
    }
    setSaving(false)
    setOutcome({ scheduled, skipped })
  }

  return (
    <Modal
      title="Not scheduled"
      onClose={() => !saving && onClose()}
      preventClose={saving}
      className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-blue-600" />
        <h3 className="text-base font-bold text-slate-900">
          Not scheduled{subName ? ` — ${subName}` : ''} ({kinds.map(kindWord).join(' & ')})
        </h3>
      </div>

      {outcome ? (
        <div className="space-y-3">
          <p className="font-semibold text-slate-800">
            {outcome.scheduled} scheduled{outcome.skipped.length ? `, ${outcome.skipped.length} skipped` : ''}.
          </p>
          {outcome.skipped.length ? (
            <ul className="space-y-1 text-slate-600">
              {outcome.skipped.map((s, i) => (
                <li key={i}>
                  {s.name} — {s.template}: <span className="text-rose-600">{s.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="space-y-3">
          <p className="text-slate-600">Every asset runs the templates of its sub-category.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-slate-500">These assets belong to a sub-category with the template, but don&apos;t run it yet. Tick the ones to start.</p>

          <div className="space-y-3">
            {groups.map(group => {
              const t = group[0].template
              const problem = templateProblem(t)
              const keys = group.map(key)
              const all = keys.every(k => picked.has(k))
              const firstFromToday = t.interval ? formatDateDisplay(addIntervalToDate(today, t.interval)) : '—'
              return (
                <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <label className={`flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 ${problem ? '' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={!problem && all} disabled={!!problem} onChange={e => toggle(keys, e.target.checked)} aria-label={`All for ${t.title}`} />
                    <span className="font-bold text-slate-800">{t.title}</span>
                    <span className="text-slate-500">
                      {t.type === 'Inspection' ? 'Inspection' : 'PM'} · {t.interval ?? '—'} · {group.length} asset{group.length === 1 ? '' : 's'}
                    </span>
                    {!problem && mode === 'today' ? <span className="ml-auto text-slate-500">first on {firstFromToday}</span> : null}
                  </label>
                  {problem ? <p className="px-3 py-2 text-amber-700">{problem}</p> : null}
                  <ul className="divide-y divide-slate-100">
                    {group.map(g => (
                      <li key={key(g)}>
                        <label className={`flex items-center gap-2 px-3 py-1.5 ${problem ? 'opacity-50' : 'cursor-pointer'}`}>
                          <input type="checkbox" checked={!problem && picked.has(key(g))} disabled={!!problem} onChange={e => toggle([key(g)], e.target.checked)} aria-label={`${g.asset.name} — ${t.title}`} />
                          <span className="font-mono text-slate-500">{g.asset.assetId}</span>
                          <span className="text-slate-800">{g.asset.name}</span>
                          <span className="ml-auto text-slate-400">{rooms.find(r => r.id === g.asset.roomId)?.name ?? ''}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-slate-700">First date</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="gaps-first" checked={mode === 'today'} onChange={() => setMode('today')} />
              <span>From today — one interval after today, for each template</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="gaps-first" checked={mode === 'date'} onChange={() => setMode('date')} />
              <span>Pick the date — the first job of every ticked asset on that date</span>
            </label>
            {mode === 'date' ? (
              <input
                type="date"
                aria-label="First date for all"
                value={date}
                min={today}
                max={latestFirstDate(today)}
                onChange={e => setDate(e.target.value)}
                className="ml-6 px-3 py-1.5 border border-slate-200 rounded-lg"
              />
            ) : null}
            <p className="text-[11px] text-slate-400">An asset whose installation date is after the first date is skipped, with the reason.</p>
          </div>

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
            <button type="button" disabled={saving} onClick={onClose} className="btn btn-secondary">
              Later
            </button>
            <button type="button" disabled={saving || chosen.length === 0} onClick={run} className="btn btn-primary">
              {saving ? 'Scheduling…' : `Schedule selected (${chosen.length})`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** "N assets … not scheduled — Review" on the Preventive / Inspections pages. */
export function ScheduleGapsBanner({ kind }: { kind: ScheduleKind }) {
  const kinds = kind === 'pm' ? PM_ONLY : INSPECTIONS_ONLY
  const gaps = useScheduleGaps(kinds)
  const [open, setOpen] = useState(false)
  const assetCount = new Set(gaps.map(g => g.asset.id)).size
  if (gaps.length === 0 && !open) return null
  return (
    <>
      {gaps.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <p>
            <b>
              {assetCount} asset{assetCount === 1 ? '' : 's'}
            </b>{' '}
            {assetCount === 1 ? 'has' : 'have'} {kindWord(kind)} templates on {assetCount === 1 ? 'its' : 'their'} sub-category but no {kindWord(kind)} schedule ({gaps.length} not
            scheduled).
          </p>
          <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm shrink-0">
            Review & schedule
          </button>
        </div>
      ) : null}
      {open ? <ScheduleGapsPanel kinds={kinds} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
