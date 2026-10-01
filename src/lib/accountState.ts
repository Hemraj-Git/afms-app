// Whether a staff account can actually be used yet.
//
// An Admin's invite creates the account and its profile at once, so the person
// shows up everywhere -- the Users list, the "assign to" dropdowns -- before
// they have opened the email and set a password. Until then they cannot sign in,
// and work given to them is never done. "Invite pending" is exactly that: the
// account came from an invite and has never been signed into.
//
// Not covered: someone who opened the invite link (which signs them in once)
// but closed the page before setting a password. They read as active; "Forgot
// password?" gets them in.

export type AccountState = 'active' | 'invite-pending'

export interface AccountStatus {
  id: string
  state: AccountState
  invitedAt?: string
  lastSignInAt?: string
}

// The fields of a Supabase auth user this needs.
export interface AuthUserFacts {
  id: string
  invited_at?: string | null
  last_sign_in_at?: string | null
  is_anonymous?: boolean
}

export function accountStateOf(u: AuthUserFacts): AccountState {
  return u.invited_at && !u.last_sign_in_at ? 'invite-pending' : 'active'
}

export function toAccountStatus(u: AuthUserFacts): AccountStatus {
  return {
    id: u.id,
    state: accountStateOf(u),
    invitedAt: u.invited_at ?? undefined,
    lastSignInAt: u.last_sign_in_at ?? undefined,
  }
}

// For an "assign to" dropdown: people who can sign in first, then the ones
// still waiting on their invite (shown, but not selectable).
export function orderForAssignment<T extends { id: string }>(people: T[], isPending: (id: string) => boolean): T[] {
  return [...people.filter(p => !isPending(p.id)), ...people.filter(p => isPending(p.id))]
}

// The person a dropdown should start on: the first one who can sign in.
export function firstAssignableId<T extends { id: string }>(people: T[], isPending: (id: string) => boolean): string {
  return people.find(p => !isPending(p.id))?.id ?? ''
}

export const PENDING_SUFFIX = ' - invite not accepted yet'
