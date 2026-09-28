// Web Push with nothing but WebCrypto, so the same code runs in the Supabase
// Edge Function (Deno) and in the Node tests:
//   - VAPID (RFC 8292): an ES256-signed JWT that identifies this server to the
//     browser's push service.
//   - Message encryption (RFC 8291, "aes128gcm"): only the subscribed browser
//     can read the payload.
// No Deno-only or Node-only APIs in this file.

const enc = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// A fresh ArrayBuffer holding exactly these bytes (what WebCrypto wants).
const ab = (u: Uint8Array): ArrayBuffer => u.slice().buffer as ArrayBuffer

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ab(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ab(data)))
}

// ---------- VAPID keys ----------

export interface VapidKeys {
  // Uncompressed P-256 point (65 bytes), base64url: what the browser's
  // pushManager.subscribe() takes as applicationServerKey.
  publicKey: string
  privateJwk: JsonWebKey
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64urlEncode(raw), privateJwk }
}

// `Authorization` header value for one push service. The JWT's audience is the
// push service's origin; it is valid for 12 hours (the maximum allowed is 24).
export async function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  subject: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: subject }))
  )
  const signingInput = `${header}.${claims}`
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto's ECDSA signature is already the raw r||s form JWS uses.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, ab(enc.encode(signingInput))))
  return `vapid t=${signingInput}.${b64urlEncode(sig)}, k=${keys.publicKey}`
}

// ---------- Payload encryption (RFC 8291) ----------

export interface EncryptOptions {
  // Only for tests: fix the random parts to reproduce a known result.
  salt?: Uint8Array
  serverKeys?: CryptoKeyPair
}

const RECORD_SIZE = 4096

export async function encryptPayload(
  payload: Uint8Array,
  p256dh: string,
  auth: string,
  opts: EncryptOptions = {}
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(p256dh)
  const authSecret = b64urlDecode(auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Bad p256dh key')
  if (authSecret.length !== 16) throw new Error('Bad auth secret')
  // One record of at most 4096 bytes: content + 1 delimiter byte + 16 tag bytes.
  if (payload.length > RECORD_SIZE - 17) throw new Error('Payload too large')

  const serverKeys =
    opts.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', ab(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as EcdhKeyDeriveParams, serverKeys.privateKey, 256)
  )

  // IKM = HKDF(salt = auth, ikm = ecdh, info = "WebPush: info\0" || ua_public || as_public, 32)
  const prkKey = await hmac(authSecret, ecdhSecret)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]))
  const ikm = await hmac(prkKey, keyInfo)

  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)

  const aesKey = await crypto.subtle.importKey('raw', ab(cek), { name: 'AES-GCM' }, false, ['encrypt'])
  // 0x02 marks the last (and only) record; no padding.
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(nonce) }, aesKey, ab(concat(payload, new Uint8Array([2]))))
  )

  // Header: salt(16) | record size (uint32) | key id length (1) | key id = as_public(65)
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushRequest {
  url: string
  init: { method: 'POST'; headers: Record<string, string>; body: Uint8Array }
}

// Everything needed to POST one message to one browser.
export async function buildPushRequest(
  sub: PushSubscriptionKeys,
  message: unknown,
  keys: VapidKeys,
  subject: string,
  { ttlSeconds = 24 * 3600, urgency = 'high' as 'very-low' | 'low' | 'normal' | 'high', topic }: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string } = {}
): Promise<PushRequest> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth)
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(sub.endpoint, keys, subject),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttlSeconds),
    Urgency: urgency,
  }
  // A newer message with the same topic replaces an undelivered older one.
  if (topic) headers.Topic = topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
  return { url: sub.endpoint, init: { method: 'POST', headers, body } }
}
