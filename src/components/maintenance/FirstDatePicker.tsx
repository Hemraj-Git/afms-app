'use client'

import { firstDueDate, latestFirstDate, type FirstScheduleMode } from '@/lib/firstSchedule'
import { formatDateDisplay } from '@/lib/dateUtils'

export interface FirstDateChoice {
  mode: FirstScheduleMode
  /** For mode 'date' (YYYY-MM-DD). */
  date?: string
}

// How the first job of a schedule gets its date: one interval after the
// installation date (only while that is still ahead), one interval after
// today, or a date picked by hand. Each option shows the date it gives.
// installationDate is left out where it differs per asset (scheduling many).
export function FirstDatePicker({
  name,
  value,
  onChange,
  interval,
  installationDate,
  today,
  disabled = false,
}: {
  name: string
  value: FirstDateChoice
  onChange: (next: FirstDateChoice) => void
  interval: string
  installationDate?: string | null
  today: string
  disabled?: boolean
}) {
  const fromInstall = installationDate !== undefined ? firstDueDate('installation', { installationDate, interval, today }) : null
  const fromToday = firstDueDate('today', { installationDate, interval, today })
  const picked = value.mode === 'date' ? firstDueDate('date', { installationDate, interval, customDate: value.date, today }) : null

  const option = (mode: FirstScheduleMode, label: string, result: ReturnType<typeof firstDueDate> | null) => {
    const off = disabled || (mode !== 'date' && !!result && 'error' in result)
    return (
      <label className={`flex items-start gap-2 ${off ? 'opacity-60' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={name}
          className="mt-0.5"
          checked={value.mode === mode}
          disabled={off}
          onChange={() => onChange({ mode, date: mode === 'date' ? value.date : undefined })}
        />
        <span>
          <span className="font-semibold text-slate-700">{label}</span>
          {mode !== 'date' && result ? (
            'date' in result ? (
              <span className="text-slate-500"> — {formatDateDisplay(result.date)}</span>
            ) : (
              <span className="block text-[11px] text-slate-400">{result.error}</span>
            )
          ) : null}
        </span>
      </label>
    )
  }

  return (
    <div className="space-y-1.5 text-xs">
      {fromInstall ? option('installation', 'From the installation date', fromInstall) : null}
      {option('today', 'From today', fromToday)}
      {option('date', 'Pick the date', null)}
      {value.mode === 'date' ? (
        <div className="pl-6 space-y-1">
          <input
            type="date"
            aria-label={`First date: ${name}`}
            value={value.date ?? ''}
            min={today}
            max={latestFirstDate(today)}
            disabled={disabled}
            onChange={e => onChange({ mode: 'date', date: e.target.value })}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20"
          />
          {picked && 'error' in picked && value.date ? <p className="text-[11px] text-rose-600">{picked.error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
