import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BottomNav, CheckpointCard, ConfirmSheet, FilterChips, PhotoCapture, PRIORITY, PriorityPill, RequestStatusPill, Timeline, Toggle, WORK_STATUS,
  homeTab, navForRole, specFor, type FieldRole,
} from '.'
import { ClipboardCheck } from 'lucide-react'

afterEach(cleanup)

describe('navigation per role', () => {
  const tabs = (role: FieldRole) => {
    const { left, right } = navForRole(role)
    return [...left.map(t => t.tab), 'Scan', ...right.map(t => t.tab)]
  }

  it('gives each role at most five items with Scan in the centre', () => {
    expect(tabs('Technician')).toEqual(['Tasks', 'Inspections', 'Scan', 'Requests', 'Profile'])
    expect(tabs('Housekeeping')).toEqual(['Cleaning', 'Inspections', 'Scan', 'Requests', 'Profile'])
    expect(tabs('Faculty')).toEqual(['Inspections', 'Scan', 'Requests', 'Profile'])
    expect(tabs('Guest')).toEqual(['Requests', 'Scan', 'Profile'])
  })

  it('opens each role on its own work', () => {
    expect(homeTab('Technician')).toBe('Tasks')
    expect(homeTab('Housekeeping')).toBe('Cleaning')
    expect(homeTab('Faculty')).toBe('Inspections')
    expect(homeTab('Guest')).toBe('Scan')
  })

  it('marks the open tab, counts open work, and reports taps', () => {
    const onChange = vi.fn()
    render(<BottomNav role="Technician" active="Tasks" onChange={onChange} badges={{ Tasks: 7 }} />)
    expect(screen.getByRole('button', { name: /Tasks/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /Tasks/ }).textContent).toContain('7 open')
    fireEvent.click(screen.getByRole('button', { name: 'Scan QR code' }))
    expect(onChange).toHaveBeenCalledWith('Scan')
  })
})

describe('pills', () => {
  it('pairs every value with an icon and a word', () => {
    for (const table of [PRIORITY, WORK_STATUS]) for (const spec of Object.values(table)) {
      expect(spec.label).toBeTruthy()
      expect(spec.icon).toBeTruthy()
    }
    render(<PriorityPill value="Critical" />)
    expect(screen.getByText('Critical')).toBeTruthy()
  })

  it('shows an unknown value as it is instead of breaking', () => {
    expect(specFor(PRIORITY, 'Urgent').label).toBe('Urgent')
    expect(specFor(PRIORITY, undefined).label).toBe('—')
    render(<RequestStatusPill value="On hold" />)
    expect(screen.getByText('On hold')).toBeTruthy()
  })
})

describe('controls', () => {
  it('filter chips say which one is on', () => {
    const onChange = vi.fn()
    render(<FilterChips label="Filter" value="all" onChange={onChange} chips={[{ value: 'all', label: 'All', count: 7 }, { value: 'pm', label: 'Preventive', count: 3 }]} />)
    expect(screen.getByRole('button', { name: /All/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Preventive/ }))
    expect(onChange).toHaveBeenCalledWith('pm')
  })

  it('a toggle is a switch that reports its state', () => {
    const onChange = vi.fn()
    render(<Toggle label="Sound for new alerts" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Sound for new alerts' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('a checkpoint shows which result is chosen', () => {
    const onResult = vi.fn()
    render(<CheckpointCard number={3} label="Hose free of cracks" result="Fail" onResult={onResult} />)
    expect(screen.getByRole('button', { name: /FAIL/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /PASS/ }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: /PASS/ }))
    expect(onResult).toHaveBeenCalledWith('Pass')
  })
})

describe('photo capture', () => {
  it('walks through empty, uploading, uploaded and failed', () => {
    const onTake = vi.fn()
    const onRetry = vi.fn()
    const { rerender } = render(<PhotoCapture label="Before cleaning photo" state={{ status: 'empty' }} required onTake={onTake} />)
    expect(screen.getByText('Required')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Before cleaning photo/ }))
    expect(onTake).toHaveBeenCalled()

    rerender(<PhotoCapture label="Before cleaning photo" state={{ status: 'uploading', percent: 64 }} onTake={onTake} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('64')

    rerender(<PhotoCapture label="Before cleaning photo" state={{ status: 'uploaded', at: '10:42' }} onTake={onTake} />)
    expect(screen.getByText(/Uploaded · 10:42/)).toBeTruthy()

    rerender(<PhotoCapture label="Before cleaning photo" state={{ status: 'failed' }} onTake={onTake} onRetry={onRetry} />)
    expect(screen.getByText(/kept on phone/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('timeline and confirmation', () => {
  it('says which steps are done, now and to come', () => {
    render(
      <Timeline
        steps={[
          { title: 'Sent out', state: 'done' },
          { title: 'At vendor', state: 'current' },
          { title: 'Received back', state: 'upcoming' },
        ]}
      />,
    )
    expect(screen.getByText('(done)', { exact: false })).toBeTruthy()
    expect(screen.getByText('(now)', { exact: false })).toBeTruthy()
    expect(screen.getByText('(not yet)', { exact: false })).toBeTruthy()
  })

  it('a confirmation starts on Cancel, so Enter does not confirm by accident', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmSheet title="Sign out?" body="You will need your password." icon={ClipboardCheck} confirmLabel="Sign out" onConfirm={onConfirm} onCancel={onCancel} />)
    expect(document.activeElement?.textContent).toBe('Cancel')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
