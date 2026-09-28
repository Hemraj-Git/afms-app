import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldError, INVALID, focusFirstError, invalidProps } from './FormField'
import { serviceRequestSchema, type ServiceRequestForm } from '@/lib/validation/forms'

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// Wired exactly like the Create Service Request form.
function RequestForm({ onSave }: { onSave: (v: ServiceRequestForm) => void }) {
  const ref = useRef<HTMLFormElement>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<ServiceRequestForm>({
    resolver: zodResolver(serviceRequestSchema),
    defaultValues: { title: '', description: '', type: 'Maintenance', roomId: '', assetId: '', priority: 'Medium' },
    mode: 'onTouched',
  })
  return (
    <form ref={ref} noValidate onSubmit={e => handleSubmit(onSave, () => focusFirstError(ref.current))(e)}>
      <label htmlFor="t">Title</label>
      <input id="t" {...register('title')} {...invalidProps('t', errors.title?.message)} className={INVALID} />
      <FieldError id="t-error" message={errors.title?.message} />
      <label htmlFor="r">Room</label>
      <select id="r" {...register('roomId')} {...invalidProps('r', errors.roomId?.message)}>
        <option value="">Choose…</option>
        <option value="r1">Lab</option>
      </select>
      <FieldError id="r-error" message={errors.roomId?.message} />
      <select aria-label="Asset" {...register('assetId')}>
        <option value="">Choose…</option>
        <option value="a1">Chiller</option>
      </select>
      <FieldError message={errors.assetId?.message} />
      <button type="submit">Save</button>
    </form>
  )
}

describe('inline form errors', () => {
  it('shows every problem under its field, marks the fields, and focuses the first', async () => {
    const onSave = vi.fn()
    render(<RequestForm onSave={onSave} />)
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(3))
    expect(onSave).not.toHaveBeenCalled()
    const title = screen.getByLabelText('Title')
    expect(title.getAttribute('aria-invalid')).toBe('true')
    // The message is tied to the field for screen readers.
    expect(title.getAttribute('aria-describedby')).toBe('t-error')
    expect(document.getElementById('t-error')?.textContent).toBe('Enter title.')
    expect(screen.getByText('Choose the room or area.')).toBeTruthy()
    expect(screen.getByText('Choose the asset that needs attention.')).toBeTruthy()
    expect(document.activeElement).toBe(title)
  })

  it('clears a message once the field is fixed, and saves when all are', async () => {
    const onSave = vi.fn()
    render(<RequestForm onSave={onSave} />)
    fireEvent.click(screen.getByText('Save'))
    await screen.findByText('Enter title.')

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'AC not cooling' } })
    await waitFor(() => expect(screen.queryByText('Enter title.')).toBeNull())
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('false')

    fireEvent.change(screen.getByLabelText('Room'), { target: { value: 'r1' } })
    fireEvent.change(screen.getByLabelText('Asset'), { target: { value: 'a1' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'AC not cooling', roomId: 'r1', assetId: 'a1' })
  })
})
