import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  del: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/supabase/typed', () => ({
  db: {
    rpc: h.rpc,
    from: () => ({ delete: () => ({ eq: h.eq }) }),
    functions: { invoke: vi.fn() },
  },
}))

import { base64UrlToBytes, disablePush, enablePush, getPushState, pushSupport, type PushEnv } from './push'

// A 65-byte key like the server's, base64url.
const KEY = 'B' + 'A'.repeat(86)

function fakeSub(endpoint = 'https://fcm.googleapis.com/fcm/send/abc', key = base64UrlToBytes(KEY)) {
  return {
    endpoint,
    options: { applicationServerKey: key.buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  }
}

function makeEnv({
  permission = 'default' as NotificationPermission,
  grant = 'granted' as NotificationPermission,
  existing = null as ReturnType<typeof fakeSub> | null,
  supported = true,
  ua = 'Mozilla/5.0 (Windows NT 10.0)',
  standalone = false,
} = {}) {
  let sub = existing
  const pushManager = {
    getSubscription: vi.fn(async () => sub),
    subscribe: vi.fn(async () => (sub = fakeSub())),
  }
  const reg = { pushManager }
  const Notification = { permission, requestPermission: vi.fn(async () => grant) }
  const navigator = {
    userAgent: ua,
    platform: 'Win32',
    maxTouchPoints: 0,
    ...(supported
      ? {
          serviceWorker: {
            register: vi.fn(async () => reg),
            ready: Promise.resolve(reg),
            getRegistration: vi.fn(async () => (sub ? reg : undefined)),
          },
        }
      : {}),
  }
  const window = {
    ...(supported ? { PushManager: function () {}, Notification } : {}),
    matchMedia: () => ({ matches: standalone }),
  }
  return { env: { navigator, window } as unknown as PushEnv, pushManager, Notification, current: () => sub }
}

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null })
  h.eq.mockReset().mockResolvedValue({ error: null })
})

describe('pushSupport / getPushState', () => {
  it('says unsupported, or "add to Home Screen" on an iPhone browser tab', async () => {
    expect(pushSupport(makeEnv({ supported: false }).env)).toBe('unsupported')
    const iphone = makeEnv({ supported: false, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
    expect(await getPushState(iphone.env)).toBe('needs-install')
  })

  it('reports blocked, off and on', async () => {
    expect(await getPushState(makeEnv({ permission: 'denied' }).env)).toBe('denied')
    expect(await getPushState(makeEnv({ permission: 'default' }).env)).toBe('off')
    expect(await getPushState(makeEnv({ permission: 'granted' }).env)).toBe('off')
    expect(await getPushState(makeEnv({ permission: 'granted', existing: fakeSub() }).env)).toBe('on')
  })
})

describe('enablePush', () => {
  it('asks permission, subscribes with the server key and saves the device', async () => {
    const t = makeEnv()
    expect(await enablePush(t.env, async () => KEY)).toBe('on')
    expect(t.Notification.requestPermission).toHaveBeenCalled()
    const opts = (t.pushManager.subscribe.mock.calls[0] as unknown as [PushSubscriptionOptionsInit])[0]
    expect(opts.userVisibleOnly).toBe(true)
    expect(Array.from(opts.applicationServerKey as Uint8Array)).toEqual(Array.from(base64UrlToBytes(KEY)))
    expect(h.rpc).toHaveBeenCalledWith('register_push_subscription', {
      p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p_p256dh: 'P'.repeat(87),
      p_auth: 'A'.repeat(22),
      p_user_agent: 'Mozilla/5.0 (Windows NT 10.0)',
    })
  })

  it('stops if the person blocks or dismisses the permission prompt', async () => {
    expect(await enablePush(makeEnv({ grant: 'denied' }).env, async () => KEY)).toBe('denied')
    expect(await enablePush(makeEnv({ grant: 'default' }).env, async () => KEY)).toBe('off')
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('reuses a subscription made with the same key, replaces one made with another', async () => {
    const same = makeEnv({ existing: fakeSub() })
    await enablePush(same.env, async () => KEY)
    expect(same.pushManager.subscribe).not.toHaveBeenCalled()

    const old = fakeSub('https://fcm.googleapis.com/fcm/send/old', base64UrlToBytes('B' + 'Q'.repeat(86)))
    const other = makeEnv({ existing: old })
    await enablePush(other.env, async () => KEY)
    expect(old.unsubscribe).toHaveBeenCalled()
    expect(other.pushManager.subscribe).toHaveBeenCalled()
  })

  it('undoes the browser subscription when the server refuses it', async () => {
    h.rpc.mockResolvedValue({ error: { message: "This browser's push service is not supported" } })
    const t = makeEnv()
    await expect(enablePush(t.env, async () => KEY)).rejects.toThrow('not supported')
    expect(t.current()!.unsubscribe).toHaveBeenCalled()
  })
})

describe('disablePush', () => {
  it('removes the device from the server, then unsubscribes', async () => {
    const sub = fakeSub()
    const t = makeEnv({ permission: 'granted', existing: sub })
    expect(await disablePush(t.env)).toBe('off')
    expect(h.eq).toHaveBeenCalledWith('endpoint', sub.endpoint)
    expect(sub.unsubscribe).toHaveBeenCalled()
  })

  it('does nothing when this device never subscribed', async () => {
    expect(await disablePush(makeEnv({ permission: 'granted' }).env)).toBe('off')
    expect(h.eq).not.toHaveBeenCalled()
  })
})
