import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordForm } from './ChangePasswordForm'

type Result = { success: true } | { success: false; error: string; field?: 'current' | 'new' }
const changePassword = vi.fn(async (current: string, next: string): Promise<Result> => {
  void current
  void next
  return { success: true }
})
vi.mock('@/app/actions/auth', () => ({ changePassword: (c: string, n: string) => changePassword(c, n) }))

afterEach(() => {
  cleanup()
  changePassword.mockClear()
})

const fill = (current: string, next: string, confirm = next) => {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } })
}
const submit = () => screen.getByRole('button', { name: 'Change password' }) as HTMLButtonElement

describe('ChangePasswordForm', () => {
  it('stays off until the current password is given and the new one meets every rule and matches', () => {
    render(<ChangePasswordForm onDone={() => {}} />)
    fill('', 'Harbour#2026')
    expect(submit().disabled).toBe(true)
    fill('Old#Pass2025', 'harbour2026')
    expect(submit().disabled).toBe(true)
    fill('Old#Pass2025', 'Harbour#2026', 'Harbour#2025')
    expect(submit().disabled).toBe(true)
    fill('Old#Pass2025', 'Harbour#2026')
    expect(submit().disabled).toBe(false)
  })

  it('shows the rules ticking off', () => {
    render(<ChangePasswordForm onDone={() => {}} />)
    fill('x', 'Harbour#2026')
    expect(screen.getAllByRole('listitem').filter(li => li.getAttribute('data-met') === 'true')).toHaveLength(5)
  })

  it('finishes when the password is changed', async () => {
    const onDone = vi.fn()
    render(<ChangePasswordForm onDone={onDone} />)
    fill('Old#Pass2025', 'Harbour#2026')
    fireEvent.click(submit())
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(changePassword).toHaveBeenCalledWith('Old#Pass2025', 'Harbour#2026')
  })

  it('puts a wrong current password under that field and stays open', async () => {
    changePassword.mockResolvedValueOnce({ success: false, field: 'current', error: 'That is not your current password.' })
    const onDone = vi.fn()
    render(<ChangePasswordForm onDone={onDone} />)
    fill('guess', 'Harbour#2026')
    fireEvent.click(submit())
    expect(await screen.findByText('That is not your current password.')).toBeTruthy()
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('offers Cancel when asked to', () => {
    const onCancel = vi.fn()
    render(<ChangePasswordForm onDone={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
