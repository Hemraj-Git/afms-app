import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SetPasswordPage from './page'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const updateUser = vi.fn(async (v: { password: string }) => {
  void v
  return { error: null as null | { message: string } }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (v: { password: string }) => updateUser(v),
      getUser: async () => ({ data: { user: { email: 'ravi@example.com' } } }),
    },
  },
}))

afterEach(() => {
  cleanup()
  push.mockClear()
  updateUser.mockClear()
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
