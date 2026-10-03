import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WizardStepper } from './WizardStepper'

afterEach(cleanup)

const steps = [
  { number: 1, title: 'Basic Information' },
  { number: 2, title: 'Location' },
  { number: 3, title: 'Specification' },
  { number: 4, title: 'Documents' },
  { number: 5, title: 'Review' },
]

describe('WizardStepper', () => {
  it('ticks the steps done, marks the current one, and fills the line up to it', () => {
    render(<WizardStepper steps={steps} current={3} />)
    const items = screen.getByRole('list', { name: 'Progress' }).querySelectorAll('li')
    expect(items).toHaveLength(5)
    expect(screen.getAllByLabelText('Done')).toHaveLength(2)
    expect(items[2].getAttribute('aria-current')).toBe('step')
    // The connector into each step: blue up to the current step, grey after it.
    const lines = [...items].slice(1).map(li => li.querySelector('span[aria-hidden="true"]')!.className)
    expect(lines.map(c => c.includes('bg-blue-600'))).toEqual([true, true, false, false])
  })

  it('says which step this is for phones', () => {
    render(<WizardStepper steps={steps} current={2} />)
    expect(screen.getByText('Step 2 of 5')).toBeTruthy()
  })
})
