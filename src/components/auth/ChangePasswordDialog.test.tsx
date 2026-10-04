import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordDialog } from './ChangePasswordDialog'

type Result = { success: true } | { success: false; error: string; field?: 'current' | 'new' }
const changePassword = vi.fn(async (current: string, next: string): Promise<Result> => {
  void current
  void next
  return { success: true }
})
vi.mock('@/app/actions/auth', () => ({ changePassword: (c: string, n: string) => changePassword(c, n) }))
const toast = vi.fn()
vi.mock('@/lib/toast', () => ({ showToast: (...a: unknown[]) => toast(...a) }))

afterEach(() => {
  cleanup()
  changePassword.mockReset()
  toast.mockClear()
})

const fillAndSave = () => {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Old#Pass2025' } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Harbour#2026' } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Harbour#2026' } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('ChangePasswordDialog', () => {
  it('shows whose password it is, saves, confirms and closes', async () => {
    changePassword.mockResolvedValue({ success: true })
    const onClose = vi.fn()
    render(<ChangePasswordDialog email="admin@example.com" onClose={onClose} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('For admin@example.com')).toBeTruthy()
    fillAndSave()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(changePassword).toHaveBeenCalledWith('Old#Pass2025', 'Harbour#2026')
    expect(toast).toHaveBeenCalledWith('success', expect.stringContaining('Password changed'))
  })

  it('stays open with the reason when the current password is wrong', async () => {
    changePassword.mockResolvedValue({ success: false, field: 'current', error: 'That is not your current password.' })
    const onClose = vi.fn()
    render(<ChangePasswordDialog email="admin@example.com" onClose={onClose} />)
    fillAndSave()
    expect(await screen.findByText('That is not your current password.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('Cancel and the close button both close it', () => {
    const onClose = vi.fn()
    render(<ChangePasswordDialog email="admin@example.com" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
