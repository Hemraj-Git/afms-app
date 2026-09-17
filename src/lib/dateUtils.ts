// Shared date/time helpers.
//
// getLocalDateStr must be used anywhere a "calendar date" marker (YYYY-MM-DD)
// is needed for a real, local, human's day -- NOT `new Date().toISOString()
// .split('T')[0]`, which serializes the UTC calendar date. For any positive
// UTC-offset timezone (this app targets IST, UTC+5:30), that produces
// yesterday's date for the ~5.5 hours between local midnight and 05:30 local
// time. See supabase/migrations/0006_server_side_auto_checkout.sql for the
// server-side (Postgres, `at time zone 'Asia/Kolkata'`) equivalent of this
// same fix -- this is the client-side counterpart.
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Display formatters -- the app-wide standard is DD-MM-YYYY for dates and
// h:mm AM/PM (no leading zero on the hour, no seconds) for times. Before
// these existed, ~50 render sites across the app each formatted dates/times
// independently (raw ISO dumps, browser-default toLocaleDateString/
// toLocaleString, bespoke options objects), producing at least 7 different
// visible formats -- including some fields that visibly changed format
// depending on whether a record was freshly created this session or
// reloaded from Supabase. Use these for every displayed data-field date/
// time (created/due/uploaded/completed/dismissed dates, SLA deadlines,
// etc.) -- not for decorative captions (e.g. a "Thursday, September 17"
// style header) or the CSV export, which intentionally stays ISO for
// unambiguous re-import and sortable filenames.

export function formatDateDisplay(value?: string | Date | null): string {
  if (!value) return '—'
  // A plain YYYY-MM-DD DATE-column value is formatted via string
  // manipulation only, never re-parsed through `new Date(...)` -- that
  // parses as UTC midnight, and reading local components back can roll
  // the day backward/forward depending on the viewer's timezone offset.
  // Same care as getLocalDateStr() above.
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return '—'
  const d = String(date.getDate()).padStart(2, '0')
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}-${mo}-${date.getFullYear()}`
}

export function formatTimeDisplay(value?: string | Date | null): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDateTimeDisplay(value?: string | Date | null): string {
  if (!value) return '—'
  return `${formatDateDisplay(value)}, ${formatTimeDisplay(value)}`
}

export type DaysRemaining = { label: string; variant: 'neutral' | 'info' | 'warning' | 'danger' }

// Days remaining until a YYYY-MM-DD due date, with both sides' time-of-day
// zeroed out first so "today" always compares as 0 days remaining regardless
// of what time of day it currently is.
export function calculateDaysRemaining(dueDateStr?: string): DaysRemaining {
  if (!dueDateStr || dueDateStr === 'Not Scheduled') {
    return { label: 'No Schedule', variant: 'neutral' }
  }
  const due = new Date(dueDateStr)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays > 1) {
    return { label: `In ${diffDays} Days`, variant: diffDays <= 7 ? 'warning' : 'info' }
  } else if (diffDays === 1) {
    return { label: 'In 1 Day', variant: 'warning' }
  } else if (diffDays === 0) {
    return { label: 'Due Today', variant: 'warning' }
  } else {
    const overdueDays = Math.abs(diffDays)
    return { label: `${overdueDays} Day${overdueDays === 1 ? '' : 's'} Overdue`, variant: 'danger' }
  }
}
