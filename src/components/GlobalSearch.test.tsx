import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalSearch } from './GlobalSearch'
import { SEARCH_PREFILL_EVENT, useSearchPrefill } from '@/lib/useSearchPrefill'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('@/context/AFMSContext', () => ({
  useAFMS: () => ({
    assets: [
      { id: 'a1', assetId: 'AST-2026-0001', name: 'Chiller Unit', roomId: 'r1', status: 'Operational' },
      { id: 'a2', assetId: 'AST-2026-0002', name: 'Chiller Pump', roomId: 'r1', status: 'Operational' },
    ],
    workOrders: [],
    serviceRequests: [{ id: 's1', ticketId: 'SR-2026-0012', title: 'AC not cooling', requestedBy: 'Asha', status: 'Open', priority: 'High' }],
    inspections: [],
    outsideRepairs: [],
    rooms: [{ id: 'r1', name: 'Bridge Simulator', roomNumber: '101', type: 'Lab', status: 'Available' }],
    inventoryItems: [],
    vendors: [],
    users: [],
  }),
}))

beforeEach(() => {
  // jsdom has no layout, so no scrollIntoView; browsers all do.
  Element.prototype.scrollIntoView = vi.fn()
  push.mockReset()
  window.history.replaceState(null, '', '/dashboard')
})
afterEach(cleanup)

const openWithShortcut = () => fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

describe('GlobalSearch', () => {
  it('opens with Ctrl+K and closes with Escape', () => {
    render(<GlobalSearch />)
    expect(screen.queryByRole('combobox')).toBeNull()
    openWithShortcut()
    const input = screen.getByRole('combobox')
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('opens from the header button too', () => {
    render(<GlobalSearch />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('shows grouped results and opens the highlighted one with Enter', () => {
    render(<GlobalSearch />)
    openWithShortcut()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'chiller' } })
    expect(screen.getByRole('group', { name: 'Assets' })).toBeTruthy()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    // Equal matches are listed by name: Chiller Pump, then Chiller Unit.
    expect(options.map(o => o.textContent)).toEqual([expect.stringContaining('Chiller Pump'), expect.stringContaining('Chiller Unit')])
    expect(options[0].getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // wraps round
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(push).toHaveBeenCalledWith('/assets/AST-2026-0001')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('says so when nothing matches', () => {
    render(<GlobalSearch />)
    openWithShortcut()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nothing-like-this' } })
    expect(screen.getByText(/No matches for/)).toBeTruthy()
  })

  it('fills the search on the page already open instead of only changing the URL', () => {
    window.history.replaceState(null, '', '/service-requests')
    const heard = vi.fn()
    window.addEventListener(SEARCH_PREFILL_EVENT, heard)
    render(<GlobalSearch />)
    openWithShortcut()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SR-2026-0012' } })
    fireEvent.click(screen.getByRole('option'))
    expect(push).toHaveBeenCalledWith('/service-requests?q=SR-2026-0012')
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({ pathname: '/service-requests', q: 'SR-2026-0012' })
    window.removeEventListener(SEARCH_PREFILL_EVENT, heard)
  })
})

describe('useSearchPrefill', () => {
  it('applies ?q= once on mount', () => {
    window.history.replaceState(null, '', '/assets?q=AST-2026-0001')
    const apply = vi.fn()
    renderHook(() => useSearchPrefill(apply))
    expect(apply).toHaveBeenCalledWith('AST-2026-0001')
  })

  it('does nothing without ?q=, and hears the palette only for its own page', () => {
    window.history.replaceState(null, '', '/assets')
    const apply = vi.fn()
    renderHook(() => useSearchPrefill(apply))
    expect(apply).not.toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new CustomEvent(SEARCH_PREFILL_EVENT, { detail: { pathname: '/inventory', q: 'x' } }))
      window.dispatchEvent(new CustomEvent(SEARCH_PREFILL_EVENT, { detail: { pathname: '/assets', q: 'pump' } }))
    })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith('pump')
  })
})
