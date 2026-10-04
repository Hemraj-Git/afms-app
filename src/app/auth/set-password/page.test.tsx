import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SetPasswordPage from './page'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))

// The server actions: clearing the "password owed" marker, and signing out.
const finishPasswordSetup = vi.fn(async () => {})
const signOutAction = vi.fn(async () => {})
vi.mock('@/app/actions/auth', () => ({
  finishPasswordSetup: () => finishPasswordSetup(),
  signOutAction: () => signOutAction(),
}))
const clientSignOut = vi.fn(async () => ({ error: null }))

const updateUser = vi.fn(async (v: { password: string }) => {
  void v
  return { error: null as null | { message: string } }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (v: { password: string }) => updateUser(v),
      getUser: async () => ({ data: { user: { email: 'ravi@example.com' } } }),
      signOut: () => clientSignOut(),
    },
  },
}))

afterEach(() => {
  cleanup()
  push.mockClear()
  replace.mockClear()
  updateUser.mockClear()
  finishPasswordSetup.mockClear()
  signOutAction.mockClear()
  clientSignOut.mockClear()
})

const type = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } })
}
const submit = () => screen.getByRole('button', { name: /Set password/i }) as HTMLButtonElement
const met = () =>
  screen.getAllByRole('listitem').filter(li => li.getAttribute('data-met') === 'true').map(li => li.textContent?.replace(/\(done\)|\(not yet\)/, '').trim())

describe('Set password page', () => {
  it('lists the rules and ticks each off while typing', () => {
    render(<SetPasswordPage />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    type('harbour')
    expect(met()).toEqual(['A lowercase letter (a-z)'])
    type('Harbour2026')
    expect(met()).toEqual(['At least 8 characters', 'A lowercase letter (a-z)', 'An uppercase letter (A-Z)', 'A number (0-9)'])
    type('Harbour#2026')
    expect(met()).toHaveLength(5)
  })

  it('keeps the button off until every rule is met and both fields match', () => {
    render(<SetPasswordPage />)
    type('Harbour2026')
    expect(submit().disabled).toBe(true)
    type('Harbour#2026', 'Harbour#2025')
    expect(submit().disabled).toBe(true)
    expect(screen.getByText('Passwords do not match yet')).toBeTruthy()
    type('Harbour#2026')
    expect(screen.getByText('Passwords match')).toBeTruthy()
    expect(submit().disabled).toBe(false)
  })

  it('saves a good password and moves on', async () => {
    render(<SetPasswordPage />)
    type('Harbour#2026')
    fireEvent.click(submit())
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
    expect(updateUser).toHaveBeenCalledWith({ password: 'Harbour#2026' })
    // The app opens up only once the password is saved.
    expect(finishPasswordSetup).toHaveBeenCalledTimes(1)
  })

  it('stays on the page when the new password is the current one', async () => {
    updateUser.mockResolvedValueOnce({ error: { message: 'New password should be different from the old password.' } })
    render(<SetPasswordPage />)
    type('Harbour#2026')
    fireEvent.click(submit())
    expect((await screen.findByRole('alert')).textContent).toMatch(/That is your current password/)
    expect(finishPasswordSetup).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('can leave without changing anything: Cancel and sign out', async () => {
    render(<SetPasswordPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel and sign out' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(signOutAction).toHaveBeenCalledTimes(1)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('explains a refusal from Supabase in plain words', async () => {
    updateUser.mockResolvedValueOnce({ error: { message: 'Password is known to be weak and easy to guess, please choose a different one.' } })
    render(<SetPasswordPage />)
    type('Harbour#2026')
    fireEvent.click(submit())
    expect((await screen.findByRole('alert')).textContent).toMatch(/data breach|at least 8 characters/)
    expect(push).not.toHaveBeenCalled()
  })

  it('says whose password is being set', async () => {
    render(<SetPasswordPage />)
    expect(await screen.findByText('ravi@example.com')).toBeTruthy()
  })
})
