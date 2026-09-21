import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useNewItemAlert } from './useNewItemAlert'

afterEach(cleanup)

function setup(initial: { ids: string[]; ready: boolean }) {
  const onNew = vi.fn()
  const view = renderHook((p: { ids: string[]; ready: boolean }) => useNewItemAlert(p.ids, p.ready, onNew), { initialProps: initial })
  return { onNew, ...view }
}

describe('useNewItemAlert', () => {
  it('says nothing about what was already there when the data loaded', () => {
    const { onNew } = setup({ ids: ['a', 'b'], ready: true })
    expect(onNew).not.toHaveBeenCalled()
  })

  it('says nothing while the data is still loading, and treats what arrives with it as existing', () => {
    const { onNew, rerender } = setup({ ids: [], ready: false })
    rerender({ ids: ['a', 'b'], ready: false })
    rerender({ ids: ['a', 'b'], ready: true })
    expect(onNew).not.toHaveBeenCalled()
  })

  it('alerts once when a new item appears afterwards', () => {
    const { onNew, rerender } = setup({ ids: ['a'], ready: true })
    rerender({ ids: ['b', 'a'], ready: true })
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('alerts once, not per item, when several arrive together', () => {
    const { onNew, rerender } = setup({ ids: ['a'], ready: true })
    rerender({ ids: ['a', 'b', 'c', 'd'], ready: true })
    expect(onNew).toHaveBeenCalledTimes(1)
  })

  it('does not alert again for the same item, or when items are removed', () => {
    const { onNew, rerender } = setup({ ids: ['a'], ready: true })
    rerender({ ids: ['a', 'b'], ready: true })
    rerender({ ids: ['a', 'b'], ready: true })
    rerender({ ids: ['a'], ready: true })
    rerender({ ids: ['a', 'b'], ready: true }) // b came back: already known, not new
    expect(onNew).toHaveBeenCalledTimes(1)
  })
})
