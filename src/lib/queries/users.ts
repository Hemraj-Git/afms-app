import type { QueryClient } from '@tanstack/react-query'
import { deleteUserAccount, updateUserProfile } from '@/app/actions/users'
import type { TableRow } from '@/lib/supabase/typed'
import type { UserProfile, UserRole } from '@/types/afms'
import { defineList } from './entity'

export function mapProfileRow(p: TableRow<'profiles'>): UserProfile {
  return {
    id: p.id,
    email: p.email ?? '',
    fullName: p.full_name,
    role: (p.role as UserRole) || 'Faculty',
    department: p.department || '',
    phone: p.phone || '',
    createdAt: p.created_at || undefined,
  }
}

// The people list. What a person can see is decided by row-level security: staff
// read every profile, a Guest only their own row. Oldest first, so the order is
// stable between loads.
const users = defineList<UserProfile, 'profiles'>({
  table: 'profiles',
  orderBy: 'created_at',
  fromRow: mapProfileRow,
})

export const userKeys = { list: users.key }
export function useUsers(userId: string, enabled: boolean) {
  const { items, ...query } = users.useList(userId, enabled)
  return { ...query, users: items }
}

// Edits and deletes of another person go through Admin-verified Server Actions
// (the browser client can't do them: RLS only lets a user update their own row and
// there is no delete policy), so these mutations call those actions, show the
// change at once, and undo it with a toast if the action refuses.
export function useUpdateUser(userId: string) {
  return users.useWrite<{ id: string; changes: Partial<UserProfile> }>(
    userId,
    'Update user',
    async ({ id, changes }) => {
      const result = await updateUserProfile({
        id,
        fullName: changes.fullName,
        role: changes.role,
        department: changes.department,
        phone: changes.phone,
      })
      if (!result.success) throw new Error(result.error)
    },
    // The id and the email (the login identity, kept in Supabase Auth) never change here.
    (list, { id, changes }) => list.map(u => (u.id === id ? { ...u, ...changes, id: u.id, email: u.email } : u))
  )
}

export function useDeleteUser(userId: string) {
  return users.useWrite<string>(
    userId,
    'Delete user',
    async id => {
      const result = await deleteUserAccount(id)
      if (!result.success) throw new Error(result.error)
    },
    (list, id) => list.filter(u => u.id !== id)
  )
}

// A person just invited through the invite Server Action (which created their
// account and profile): show them at once, then re-read to pick up the stored row.
export function addInvitedUserToCache(qc: QueryClient, userId: string, profile: UserProfile) {
  qc.setQueryData<UserProfile[]>(userKeys.list(userId), list => {
    const current = list ?? []
    return current.some(u => u.id === profile.id) ? current : [...current, profile]
  })
  qc.invalidateQueries({ queryKey: userKeys.list(userId) })
}
