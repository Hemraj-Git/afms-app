// The sign-in rules, as set in the Supabase dashboard (Authentication ->
// Providers -> Email). Supabase enforces them; these copies only let the
// screens explain them up front instead of after a failed attempt. If the
// dashboard changes, change them here too.

// Minimum password length.
export const PASSWORD_MIN_LENGTH = 8

// The characters Supabase counts as a "symbol" for its
// "lowercase, uppercase letters, digits and symbols" requirement. Anything
// else (a space, an accented letter, a currency sign) does not count.
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"

export interface PasswordRule {
  id: 'length' | 'lower' | 'upper' | 'digit' | 'symbol'
  label: string
  met: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: p => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', label: 'A lowercase letter (a-z)', met: p => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter (A-Z)', met: p => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number (0-9)', met: p => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A symbol, such as ! @ # $ % & *', met: p => [...p].some(ch => PASSWORD_SYMBOLS.includes(ch)) },
]

export const passwordMeetsPolicy = (password: string): boolean => PASSWORD_RULES.every(r => r.met(password))

// Supabase's own refusals, in plain words. Its messages name the rule in
// developer terms ("Password should contain at least one character of each:
// abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, ...").
export function friendlyPasswordError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('different from the old password')) return 'Choose a password you have not used for this account before.'
  if (m.includes('pwned') || m.includes('leaked') || m.includes('known to be weak') || m.includes('data breach')) {
    return 'This password has appeared in a data breach elsewhere, so it is not safe. Choose a different one.'
  }
  if (m.includes('at least one character of each') || m.includes('weak') || m.includes('should be at least')) {
    return `The password needs at least ${PASSWORD_MIN_LENGTH} characters, with a lowercase letter, an uppercase letter, a number and a symbol.`
  }
  // Supabase's "Secure password change": an older sign-in must be renewed first.
  if (m.includes('reauthenticat')) return 'For your security, sign out and sign in again, then change the password.'
  if (m.includes('session') || m.includes('jwt') || m.includes('not authenticated') || m.includes('auth session missing')) {
    return 'This link has expired. Ask for a new one from the sign-in page ("Forgot password?").'
  }
  return message
}

// How long the link in an invite or password-reset email works ("Email OTP
// Expiration" in Supabase: 43,200 seconds).
export const EMAIL_LINK_VALID_HOURS = 12
