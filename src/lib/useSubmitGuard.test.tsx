import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSubmitGuard } from './useSubmitGuard'

describe('useSubmitGuard', () => {
  it('runs a slow submit once, however many times it is pressed', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSubmitGuard())
    let release!: () => void
    const save = vi.fn((_e: { preventDefault: () => void }) => new Promise<void>(r => (release = r)))
    const submit = result.current.guard(save)
    const preventDefault = vi.fn()

    let first!: Promise<void>
    act(() => {
      first = submit({ preventDefault })
      void submit({ preventDefault })
      void submit({ preventDefault })
    })
    expect(save).toHaveBeenCalledTimes(1)
    // The blocked presses still stop the browser's own form submit.
    expect(preventDefault).toHaveBeenCalledTimes(2)

    await act(async () => {
      release()
      await first
    })
    // Still locked for the short cooldown after it finishes ...
    await act(async () => void (await submit({ preventDefault })))
    expect(save).toHaveBeenCalledTimes(1)
    // ... then free again.
    act(() => void vi.advanceTimersByTime(700))
    await act(async () => {
      const again = submit({ preventDefault })
      release()
      await again
    })
    expect(save).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
