import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfirmHost } from './ConfirmHost'
import { confirmAction } from '@/lib/confirm'

afterEach(cleanup)

describe('confirmAction + ConfirmHost', () => {
  it('asks in the page and answers yes on the confirm button', async () => {
    render(<ConfirmHost />)
    let answer: Promise<boolean>
    act(() => {
      answer = confirmAction('Delete room "Lab 1"?')
    })
    const dialog = screen.getByRole('dialog', { name: 'Please confirm' })
    expect(dialog.textContent).toContain('Delete room "Lab 1"?')
    // Focus starts on the safe choice.
    expect(document.activeElement?.textContent).toBe('Cancel')
    fireEvent.click(screen.getByText('Delete'))
    await expect(answer!).resolves.toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('answers no on Cancel and on Escape', async () => {
    render(<ConfirmHost />)
    let first: Promise<boolean>
    act(() => {
      first = confirmAction('Delete?')
    })
    fireEvent.click(screen.getByText('Cancel'))
    await expect(first!).resolves.toBe(false)

    let second: Promise<boolean>
    act(() => {
      second = confirmAction('Delete again?')
    })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await expect(second!).resolves.toBe(false)
  })

  it('uses custom labels', async () => {
    render(<ConfirmHost />)
    let answer: Promise<boolean>
    act(() => {
      answer = confirmAction('Cancel reservation?', { confirmLabel: 'Cancel reservation', cancelLabel: 'Keep it' })
    })
    fireEvent.click(screen.getByText('Keep it'))
    await expect(answer!).resolves.toBe(false)
  })

  it('a second question answers the first with no', async () => {
    render(<ConfirmHost />)
    let first: Promise<boolean>
    let second: Promise<boolean>
    act(() => {
      first = confirmAction('One?')
      second = confirmAction('Two?')
    })
    await expect(first!).resolves.toBe(false)
    expect(screen.getByRole('dialog').textContent).toContain('Two?')
    fireEvent.click(screen.getByText('Delete'))
    await expect(second!).resolves.toBe(true)
  })
})
