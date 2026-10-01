import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listAccountStatuses } from '@/app/actions/users'
import type { AccountStatus } from '@/lib/accountState'

// Which staff accounts are still waiting on their invite (see accountState.ts).
// Admin screens only: the answer comes from the sign-in accounts, which only
// the server can read. If it cannot be read, nobody is treated as pending, so
// the screens behave exactly as they did before this existed.
export const accountStatusKeys = { list: (userId: string) => ['account-status', userId] as const }

const NONE: AccountStatus[] = []

export function useAccountStatuses(userId: string, isAdmin: boolean) {
  const query = useQuery({
    queryKey: accountStatusKeys.list(userId),
    queryFn: async () => {
      const result = await listAccountStatuses()
      if (!result.success) throw new Error(result.error)
      return result.statuses
    },
    enabled: isAdmin && userId !== 'guest',
    // People accept invites in their own time; a minute old is fine, and
    // refocusing the tab reads it again.
    staleTime: 60_000,
  })
  const statuses = query.data ?? NONE
  const byId = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses])
  const isPending = useCallback((id: string) => byId.get(id)?.state === 'invite-pending', [byId])
  return { ...query, byId, isPending }
}
