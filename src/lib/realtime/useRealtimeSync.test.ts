import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for the Supabase client: records what the hook registers and lets
// the test play the server's part (status changes and change events).
const h = vi.hoisted(() => {
  type Listener = { filter: { event: string; table: string; filter?: string }; cb: (payload: unknown) => void }
  class FakeChannel {
    listeners: Listener[] = []
    statusCb: ((status: string) => void) | null = null
    constructor(public name: string) {}
    on(_type: string, filter: Listener['filter'], cb: Listener['cb']) {
      this.listeners.push({ filter, cb })
      return this
    }
    subscribe(cb: (status: string) => void) {
      this.statusCb = cb
      return this
    }
    status(s: string) {
      this.statusCb?.(s)
    }
    fire(table: string, payload: unknown = {}) {
      this.listeners.filter(l => l.filter.table === table).forEach(l => l.cb(payload))
    }
  }
  return {
    FakeChannel,
    channels: [] as InstanceType<typeof FakeChannel>[],
    removed: [] as InstanceType<typeof FakeChannel>[],
    setAuth: vi.fn(),
    session: { access_token: 'token-1' } as { access_token: string } | null,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: h.session } }) },
    realtime: { setAuth: h.setAuth },
    channel: (name: string) => {
      const ch = new h.FakeChannel(name)
      h.channels.push(ch)
      return ch
    },
    removeChannel: async (ch: InstanceType<typeof h.FakeChannel>) => {
      h.removed.push(ch)
    },
  },
}))

import { useRealtimeSync, type RealtimeHandlers } from './useRealtimeSync'

function makeHandlers(): RealtimeHandlers {
  return {
    refetchWorkOrders: vi.fn(),
    refetchServiceRequests: vi.fn(),
    refetchInspections: vi.fn(),
    refetchNotifications: vi.fn(),
    refetchRooms: vi.fn(),
    refetchRoomAccessLogs: vi.fn(),
    refetchAssets: vi.fn(),
    refetchAssetActivityLogs: vi.fn(),
    onNotification: vi.fn(),
  }
}

const staff = { enabled: true, userId: 'u1', role: 'Technician', email: 't@x.test' }
const guest = { enabled: true, userId: 'g1', role: 'Guest', email: 'g@x.test' }

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

// Lets the hook's awaited getSession() resolve.
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0) })
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  h.channels.length = 0
  h.removed.length = 0
  h.setAuth.mockClear()
  h.session = { access_token: 'token-1' }
  setVisibility('visible')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useRealtimeSync — staff', () => {
  it('subscribes with the session token and listens to the eight tables', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    expect(h.setAuth).toHaveBeenCalledWith('token-1')
    expect(h.channels).toHaveLength(1)
    const [ch] = h.channels
    expect(ch.name).toBe('live:u1')
    const notif = ch.listeners.find(l => l.filter.table === 'notifications')
    expect(notif?.filter).toMatchObject({ event: 'INSERT', filter: 'user_id=eq.u1' })
    expect(ch.listeners.map(l => l.filter.table).sort()).toEqual(
      ['asset_activity_logs', 'assets', 'inspections', 'notifications', 'room_access_logs', 'rooms', 'service_requests', 'work_orders']
    )
  })

  it('refetches everything once connected, since earlier events were never delivered', async () => {
    const handlers = makeHandlers()
    const { result } = renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()
    expect(result.current).toBe('connecting')

    act(() => h.channels[0].status('SUBSCRIBED'))
    expect(result.current).toBe('live')
    await advance(300)

    expect(handlers.refetchWorkOrders).toHaveBeenCalledTimes(1)
    expect(handlers.refetchServiceRequests).toHaveBeenCalledTimes(1)
    expect(handlers.refetchInspections).toHaveBeenCalledTimes(1)
    expect(handlers.refetchNotifications).toHaveBeenCalledTimes(1)
    expect(handlers.refetchRooms).toHaveBeenCalledTimes(1)
    expect(handlers.refetchRoomAccessLogs).toHaveBeenCalledTimes(1)
    expect(handlers.refetchAssets).toHaveBeenCalledTimes(1)
    expect(handlers.refetchAssetActivityLogs).toHaveBeenCalledTimes(1)
  })

  it('an asset or timeline change refreshes only that table (asset status goes live)', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    act(() => {
      h.channels[0].fire('assets')
      h.channels[0].fire('assets')
      h.channels[0].fire('asset_activity_logs')
    })
    await advance(300)
    expect(handlers.refetchAssets).toHaveBeenCalledTimes(1)
    expect(handlers.refetchAssetActivityLogs).toHaveBeenCalledTimes(1)
    expect(handlers.refetchWorkOrders).not.toHaveBeenCalled()
    expect(handlers.refetchRooms).not.toHaveBeenCalled()
  })

  it('a room or access-log change refreshes only that table (live occupancy)', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    act(() => {
      h.channels[0].fire('rooms')
      h.channels[0].fire('rooms')
      h.channels[0].fire('room_access_logs')
    })
    await advance(300)
    expect(handlers.refetchRooms).toHaveBeenCalledTimes(1)
    expect(handlers.refetchRoomAccessLogs).toHaveBeenCalledTimes(1)
    expect(handlers.refetchWorkOrders).not.toHaveBeenCalled()
    expect(handlers.refetchServiceRequests).not.toHaveBeenCalled()
  })

  it('collapses a burst of changes to one refetch', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    act(() => {
      for (let i = 0; i < 6; i++) h.channels[0].fire('work_orders')
    })
    await advance(299)
    expect(handlers.refetchWorkOrders).not.toHaveBeenCalled()
    await advance(1)
    expect(handlers.refetchWorkOrders).toHaveBeenCalledTimes(1)
    expect(handlers.refetchServiceRequests).not.toHaveBeenCalled()
  })

  it('hands a new notification to the handler and refreshes the list it points at', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    const row = { id: 'n1', type: 'wo_assigned', title: 'New work order', created_at: 'now' }
    act(() => h.channels[0].fire('notifications', { new: row }))
    expect(handlers.onNotification).toHaveBeenCalledWith(row)
    await advance(300)
    expect(handlers.refetchWorkOrders).toHaveBeenCalledTimes(1)
    expect(handlers.refetchInspections).not.toHaveBeenCalled()

    act(() => h.channels[0].fire('notifications', { new: { ...row, id: 'n2', type: 'inspection_assigned' } }))
    await advance(300)
    expect(handlers.refetchInspections).toHaveBeenCalledTimes(1)
  })

  it('removes the channel and cancels pending refetches on unmount', async () => {
    const handlers = makeHandlers()
    const { unmount } = renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()
    act(() => h.channels[0].fire('work_orders'))

    unmount()
    expect(h.removed).toEqual([h.channels[0]])
    await advance(1000)
    expect(handlers.refetchWorkOrders).not.toHaveBeenCalled()
  })

  it('does nothing while disabled or before a user id is known, and subscribes once enabled', async () => {
    const handlers = makeHandlers()
    const { result, rerender } = renderHook((p: { enabled: boolean }) => useRealtimeSync({ ...staff, ...p, handlers }), {
      initialProps: { enabled: false },
    })
    await flush()
    expect(h.channels).toHaveLength(0)
    expect(result.current).toBe('off')

    rerender({ enabled: true })
    await flush()
    expect(h.channels).toHaveLength(1)
  })

  it('stays off without a session', async () => {
    h.session = null
    const { result } = renderHook(() => useRealtimeSync({ ...staff, handlers: makeHandlers() }))
    await flush()
    expect(h.channels).toHaveLength(0)
    expect(result.current).toBe('off')
  })

  it('reports reconnecting on an error and catches up when the client reconnects', async () => {
    const handlers = makeHandlers()
    const { result } = renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    act(() => h.channels[0].status('CHANNEL_ERROR'))
    expect(result.current).toBe('reconnecting')
    act(() => h.channels[0].status('SUBSCRIBED'))
    await advance(300)
    expect(result.current).toBe('live')
    expect(handlers.refetchWorkOrders).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('useRealtimeSync — guest', () => {
  it('listens only to service requests for their own email', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...guest, handlers }))
    await flush()

    const [ch] = h.channels
    expect(ch.listeners).toHaveLength(1) // guests never subscribe to rooms, access logs or assets
    expect(ch.listeners[0].filter).toMatchObject({
      event: '*', table: 'service_requests', filter: 'requested_by_email=eq.g@x.test',
    })

    act(() => ch.status('SUBSCRIBED'))
    await advance(300)
    expect(handlers.refetchServiceRequests).toHaveBeenCalledTimes(1)
    expect(handlers.refetchWorkOrders).not.toHaveBeenCalled()
    expect(handlers.refetchNotifications).not.toHaveBeenCalled()
  })

  it('does not subscribe without an email', async () => {
    renderHook(() => useRealtimeSync({ ...guest, email: '', handlers: makeHandlers() }))
    await flush()
    expect(h.channels).toHaveLength(0)
  })
})

describe('useRealtimeSync — visibility', () => {
  it('keeps the channel through a short absence but refreshes notifications on return', async () => {
    const handlers = makeHandlers()
    renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()

    setVisibility('hidden')
    await advance(10_000)
    setVisibility('visible')
    await advance(300)

    expect(h.channels).toHaveLength(1)
    expect(h.removed).toHaveLength(0)
    expect(handlers.refetchNotifications).toHaveBeenCalledTimes(1)
  })

  it('drops the channel after 30s hidden and resubscribes with a refetch on return', async () => {
    const handlers = makeHandlers()
    const { result } = renderHook(() => useRealtimeSync({ ...staff, handlers }))
    await flush()
    act(() => h.channels[0].status('SUBSCRIBED'))
    await advance(300)
    vi.mocked(handlers.refetchWorkOrders).mockClear()

    setVisibility('hidden')
    await advance(30_000)
    expect(h.removed).toEqual([h.channels[0]])
    expect(result.current).toBe('off')

    setVisibility('visible')
    await flush()
    expect(h.channels).toHaveLength(2)
    act(() => h.channels[1].status('SUBSCRIBED'))
    await advance(300)
    expect(handlers.refetchWorkOrders).toHaveBeenCalledTimes(1)
  })
})
