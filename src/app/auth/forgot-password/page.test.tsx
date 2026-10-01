import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from './page'

// The server action always answers success, whether or not the address has an
// account, so the page cannot be used to test which emails are registered.
const requestPasswordReset = vi.fn(async (email: string) => {
  void email
  return { success: true as const }
})
vi.mock('@/app/actions/auth', () => ({ requestPasswordReset: (email: string) => requestPasswordReset(email) }))

afterEach(() => {
  cleanup()
  requestPasswordReset.mockClear()
})

const send = async (email: string) => {
  fireEvent.change(screen.getByPlaceholderText(/@/), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /Send Reset Link/i }))
  return screen.findByRole('status')
}

describe('Forgot password page', () => {
  it('names the address and says what to do if nothing arrives', async () => {
    render(<ForgotPasswordPage />)
    const status = await send(' ravi@example.com ')
    // An email field trims surrounding spaces itself, as browsers do.
    expect(requestPasswordReset).toHaveBeenCalledWith('ravi@example.com')
    expect(status.textContent).toContain('Check your email')
    expect(status.textContent).toContain('ravi@example.com belongs to a staff account')
    expect(screen.getByText(/spam or junk folder/)).toBeTruthy()
    expect(screen.getByText(/ask your administrator/i)).toBeTruthy()
  })

  it('gives an unregistered address exactly the same answer as a registered one', async () => {
    render(<ForgotPasswordPage />)
    const known = (await send('admin@example.com')).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    const unknown = (await send('nobody-here@example.com')).textContent
    expect(unknown?.replace('nobody-here@example.com', 'X')).toBe(known?.replace('admin@example.com', 'X'))
    expect(unknown).not.toMatch(/not registered|no account|does not exist/i)
  })

  it('goes back to the form to try another address', async () => {
    render(<ForgotPasswordPage />)
    await send('ravi@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeTruthy())
  })
})
