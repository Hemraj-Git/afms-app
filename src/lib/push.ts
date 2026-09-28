'use client'

import { db } from '@/lib/supabase/typed'

// Alerts when the app is closed (Web Push). This browser registers the service
// worker (public/sw.js), subscribes with the server's public key (from the
// send-push Edge Function) and saves the subscription for the signed-in user.
// The database then pushes every new alert for that user (migration 0044).

export type PushState =
  | 'unsupported' // this browser can't receive push
  | 'needs-install' // iPhone/iPad: works only from the Home Screen app
  | 'denied' // the person blocked notifications for this site
  | 'off'
  | 'on'

export interface PushEnv {
  navigator: Navigator
  window: Window & typeof globalThis
}

const browserEnv = (): PushEnv => ({ navigator, window })

const isIos = (nav: Navigator) =>
  /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)

const isStandalone = (env: PushEnv) =>
  env.window.matchMedia?.('(display-mode: standalone)').matches ||
  (env.navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(env: PushEnv = browserEnv()): 'supported' | 'unsupported' | 'needs-install' {
  const supported = 'serviceWorker' in env.navigator && 'PushManager' in env.window && 'Notification' in env.window
  if (supported) return 'supported'
  return isIos(env.navigator) && !isStandalone(env) ? 'needs-install' : 'unsupported'
}

async function currentSubscription(env: PushEnv): Promise<PushSubscription | null> {
  const reg = await env.navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function getPushState(env: PushEnv = browserEnv()): Promise<PushState> {
  const support = pushSupport(env)
  if (support !== 'supported') return support
  const permission = env.window.Notification.permission
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'
  return (await currentSubscription(env)) ? 'on' : 'off'
}

export function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const sameBytes = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i])

async function serverPublicKey(): Promise<string> {
  const { data, error } = await db.functions.invoke<{ publicKey?: string }>('send-push', { method: 'GET' })
  if (error || !data?.publicKey) throw new Error('Could not reach the alert service. Please try again.')
  return data.publicKey
}

// Asks permission (must follow a tap), subscribes and saves the device.
export async function enablePush(env: PushEnv = browserEnv(), getKey = serverPublicKey): Promise<PushState> {
  const support = pushSupport(env)
  if (support !== 'supported') return support

  const permission = await env.window.Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'

  const reg = await env.navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await env.navigator.serviceWorker.ready
  const key = base64UrlToBytes(await getKey())

  let sub = await reg.pushManager.getSubscription()
  // Subscribed earlier with a different server key (another environment): start over.
  if (sub && !sameBytes(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })

  const json = sub.toJSON()
  const { error } = await db.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: env.navigator.userAgent,
  })
  if (error) {
    await sub.unsubscribe().catch(() => {})
    throw new Error(error.message)
  }
  return 'on'
}

// Stops alerts on this device: removes it from the server, then unsubscribes.
export async function disablePush(env: PushEnv = browserEnv()): Promise<PushState> {
  const support = pushSupport(env)
  if (support !== 'supported') return support
  const sub = await currentSubscription(env)
  if (sub) {
    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return env.window.Notification.permission === 'denied' ? 'denied' : 'off'
}

// On sign-out: this device must stop receiving the previous user's alerts.
// Never throws; sign-out continues whatever happens here.
export async function forgetPushDevice(env?: PushEnv): Promise<void> {
  try {
    if (typeof window === 'undefined') return
    await disablePush(env ?? browserEnv())
  } catch {
    /* offline or no push support: nothing to forget */
  }
}
