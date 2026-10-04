// An invite or password-reset link signs the person in (that is how Supabase
// proves they own the email) before they have chosen a password. Until they
// do, they must stay on Set password: /auth/confirm sets this cookie, the
// proxy keeps them on /auth/* while it is there, and saving a password,
// signing in with one, or signing out clears it.

export const PASSWORD_SETUP_COOKIE = 'afms_set_password'

export const PASSWORD_SETUP_PATH = '/auth/set-password'

/** The pages a person may see while they still owe a new password. */
export const isPasswordSetupPath = (pathname: string) => pathname === '/auth' || pathname.startsWith('/auth/')

export const passwordSetupCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // As long as the email link itself lasts (EMAIL_LINK_VALID_HOURS).
  maxAge: 12 * 60 * 60,
}
