// The date of the first PM job or inspection when a schedule is added to an
// asset. The same rule as schedule_asset_maintenance() (migration 0053), which
// checks it again: this only shows the Admin the date before they confirm.
// Every later job follows the template interval after each completion.

import { addIntervalToDate } from '@/lib/idGenerator'

export type FirstScheduleMode = 'installation' | 'today' | 'date'

export const FIRST_SCHEDULE_WARNING =
  "First dates can't be changed after they are set. Later dates follow each template's interval after every completion."

// Dates as YYYY-MM-DD (or DD-MM-YYYY, as some older rows are stored).
const toIso = (v?: string | null): string | null => {
  if (!v) return null
  const s = v.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
const shown = (iso: string) => iso.split('-').reverse().join('-')

/** The latest first date allowed: two years ahead, to catch a mistyped year. */
export const latestFirstDate = (today: string) => {
  const [y, m, d] = today.split('-')
  const day = y && m === '02' && d === '29' ? '28' : d
  return `${Number(y) + 2}-${m}-${day}`
}

export type FirstDue = { date: string } | { error: string }

export function firstDueDate(
  mode: FirstScheduleMode,
  { installationDate, interval, customDate, today }: { installationDate?: string | null; interval: string; customDate?: string; today: string },
): FirstDue {
  const install = toIso(installationDate)
  let due: string | null
  if (mode === 'installation') {
    if (!install) return { error: 'The asset has no installation date — pick a date or count from today' }
    due = addIntervalToDate(install, interval)
    if (due < today) return { error: 'Installed too long ago — pick a date or count from today' }
  } else if (mode === 'today') {
    due = addIntervalToDate(today, interval)
  } else {
    due = toIso(customDate)
    if (!due) return { error: 'Pick the date of the first job' }
    if (due < today) return { error: "The first date can't be in the past" }
  }
  if (due > latestFirstDate(today)) return { error: "The first date can't be more than 2 years ahead" }
  if (install && due < install) return { error: `The first date can't be before the installation date (${shown(install)})` }
  return { date: due }
}

/** The option to start with: the installation date when it still lies ahead, else today. */
export const defaultFirstMode = (installationDate: string | null | undefined, interval: string, today: string): FirstScheduleMode =>
  'date' in firstDueDate('installation', { installationDate, interval, today }) ? 'installation' : 'today'
