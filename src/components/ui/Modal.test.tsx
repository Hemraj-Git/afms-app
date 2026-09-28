import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

afterEach(cleanup)

function Screen({ onClose = vi.fn(), preventClose = false, closeOnOverlayClick = false }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal
          title="Assign technician"
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          preventClose={preventClose}
          closeOnOverlayClick={closeOnOverlayClick}
          className="panel-x"
        >
          <h3>Assign technician</h3>
          <input aria-label="Remarks" />
          <button onClick={() => setOpen(false)}>Cancel</button>
        </Modal>
      )}
    </div>
  )
}

describe('Modal', () => {
  it('is a labelled dialog that keeps the screen’s own panel classes', () => {
    render(<Screen />)
    fireEvent.click(screen.getByText('Open'))
    const dialog = screen.getByRole('dialog', { name: 'Assign technician' })
    expect(dialog.className).toContain('panel-x')
    // Focus goes to the dialog itself, not the first field (no phone keyboard).
    expect(document.activeElement).toBe(dialog)
  })

  it('closes with Escape', () => {
    const onClose = vi.fn()
    render(<Screen onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores Escape while saving', () => {
    const onClose = vi.fn()
    render(<Screen onClose={onClose} preventClose />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('does not close on a click outside unless allowed', () => {
    const onClose = vi.fn()
    render(<Screen onClose={onClose} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.pointerDown(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('still closes through the screen’s own buttons', () => {
    render(<Screen />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
