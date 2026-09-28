import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFormCheck } from './useFormCheck'
import { nameSchema } from '@/lib/validation/forms'

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// Wired like the Category modal.
function CategoryForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  const v = useFormCheck(nameSchema('Category name'), { name }, 'cat')
  return (
    <form
      noValidate
      onSubmit={e => {
        e.preventDefault()
        if (!v.check()) return
        onSave(name)
      }}
    >
      <label htmlFor="n">Name</label>
      <input id="n" value={name} onChange={e => setName(e.target.value)} {...v.props('name')} />
      {v.error('name')}
      <button type="submit">Save</button>
      <button type="button" onClick={() => v.reset()}>Reset</button>
    </form>
  )
}

describe('useFormCheck', () => {
  it('shows nothing until the first save attempt', () => {
    render(<CategoryForm onSave={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('false')
  })

  it('blocks the save, explains under the field and focuses it', async () => {
    const onSave = vi.fn()
    render(<CategoryForm onSave={onSave} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).not.toHaveBeenCalled()
    const input = screen.getByLabelText('Name')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('cat-name-error')
    expect(screen.getByRole('alert').textContent).toBe('Enter category name.')
    // Focus moves on the next frame, after the message is on screen.
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('clears the message as soon as the field is fixed, then saves', () => {
    const onSave = vi.fn()
    render(<CategoryForm onSave={onSave} />)
    fireEvent.click(screen.getByText('Save'))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'HVAC' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith('HVAC')
  })

  it('reset hides the messages (a form opened afresh starts clean)', () => {
    render(<CategoryForm onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('Save'))
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByText('Reset'))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
