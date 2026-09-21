import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/types/afms'

const h = vi.hoisted(() => ({
  updateResult: { success: true } as { success: true } | { success: false; error: string },
  deleteResult: { success: true } as { success: true } | { success: false; error: string },
  updateCalls: [] as unknown[],
  deleteCalls: [] as string[],
}))

vi.mock('@/app/actions/users', () => ({
  updateUserProfile: async (input: unknown) => {
    h.updateCalls.push(input)
    return h.updateResult
  },
  deleteUserAccount: async (id: string) => {
    h.deleteCalls.push(id)
    return h.deleteResult
  },
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: { from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }) },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ showToast: toast }))

import { addInvitedUserToCache, mapProfileRow, useDeleteUser, useUpdateUser, userKeys } from './users'

const person = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'p1', email: 'a@x.test', fullName: 'Ann', role: 'Technician', department: 'Ops', phone: '1', ...over,
})

beforeEach(() => {
  h.updateResult = { success: true }
  h.deleteResult = { success: true }
  h.updateCalls = []
  h.deleteCalls = []
  toast.mockClear()
})
afterEach(cleanup)

function setup(initial: UserProfile[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(userKeys.list('me'), initial)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper, list: () => client.getQueryData<UserProfile[]>(userKeys.list('me')) }
}

describe('profile mapping', () => {
  it('fills blanks and defaults the role', () => {
    expect(mapProfileRow({ id: 'p', email: null, full_name: 'Ann', role: '', department: null, phone: null, created_at: '2026-01-01' })).toEqual({
      id: 'p', email: '', fullName: 'Ann', role: 'Faculty', department: '', phone: '', createdAt: '2026-01-01',
    })
  })
})

describe('editing a user', () => {
  it('sends the editable fields to the Admin action and shows the change at once', async () => {
    const { wrapper, list } = setup([person()])
    const { result } = renderHook(() => useUpdateUser('me'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', changes: { fullName: 'Ann B', role: 'Housekeeping', department: 'HK', phone: '9' } })
    })
    expect(h.updateCalls[0]).toEqual({ id: 'p1', fullName: 'Ann B', role: 'Housekeeping', department: 'HK', phone: '9' })
    expect(list()?.[0]).toMatchObject({ fullName: 'Ann B', role: 'Housekeeping' })
  })

  it('a refused edit is undone and reported with the reason', async () => {
    const { wrapper, list } = setup([person()])
    h.updateResult = { success: false, error: 'You cannot remove your own Admin role.' }
    const { result } = renderHook(() => useUpdateUser('me'), { wrapper })
    act(() => result.current.mutate({ id: 'p1', changes: { role: 'Faculty' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(list()?.[0].role).toBe('Technician')
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Update user failed and was undone: You cannot remove your own Admin role.'))
  })

  it('the id and email never change, even if a caller passes them', async () => {
    const { wrapper, list } = setup([person()])
    const { result } = renderHook(() => useUpdateUser('me'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', changes: { fullName: 'New', email: 'hack@x.test', id: 'other' } })
    })
    expect(list()?.[0]).toMatchObject({ id: 'p1', email: 'a@x.test', fullName: 'New' })
  })
})

describe('deleting a user', () => {
  it('removes them at once and calls the Admin action', async () => {
    const { wrapper, list } = setup([person(), person({ id: 'p2', email: 'b@x.test' })])
    const { result } = renderHook(() => useDeleteUser('me'), { wrapper })
    await act(async () => { await result.current.mutateAsync('p1') })
    expect(h.deleteCalls).toEqual(['p1'])
    expect(list()?.map(u => u.id)).toEqual(['p2'])
  })

  it('a refused delete puts them back and says why', async () => {
    const { wrapper, list } = setup([person(), person({ id: 'p2', email: 'b@x.test' })])
    h.deleteResult = { success: false, error: 'This user has raised service requests.' }
    const { result } = renderHook(() => useDeleteUser('me'), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync('p1')).rejects.toThrow('raised service requests')
    })
    expect(list()?.map(u => u.id)).toEqual(['p1', 'p2'])
    expect(toast).toHaveBeenCalledWith('error', expect.stringContaining('Delete user failed and was undone'))
  })
})

describe('inviting a user', () => {
  it('shows the new person at once, once, and re-reads the list', () => {
    const { client, list } = setup([person()])
    const spy = vi.spyOn(client, 'invalidateQueries')
    const invited = person({ id: 'p9', email: 'new@x.test' })
    addInvitedUserToCache(client, 'me', invited)
    addInvitedUserToCache(client, 'me', invited)
    expect(list()?.map(u => u.id)).toEqual(['p1', 'p9'])
    expect(spy).toHaveBeenCalledWith({ queryKey: userKeys.list('me') })
  })
})
