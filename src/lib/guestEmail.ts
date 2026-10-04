// Guest sign-in takes a self-reported email. A staff member's email is refused
// there: it would put a guest under a staff address (the Admin's guest list,
// requests "from" that person), and staff have their own password sign-in.

export const STAFF_EMAIL_FOR_GUEST =
  'This email belongs to a staff account. Use Staff sign in with your password instead.'

/** The email as stored and compared: trimmed and lower-case. */
export const normaliseGuestEmail = (email: string) => email.trim().toLowerCase()

/**
 * The email as an exact, case-insensitive ILIKE pattern: %, _ and \ are
 * wildcards there, so they are escaped (john_doe@x.com must not match
 * johnxdoe@x.com).
 */
export const exactIlikePattern = (value: string) => value.replace(/[\\%_]/g, ch => `\\${ch}`)
