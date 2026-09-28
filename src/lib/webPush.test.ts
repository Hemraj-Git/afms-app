// @vitest-environment node
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
// The reference implementation used by the `web-push` package; only here to
// check our encryption independently.
import ece from 'http_ece'
import {
  b64urlDecode,
  b64urlEncode,
  buildPushRequest,
  encryptPayload,
  generateVapidKeys,
  vapidAuthorization,
} from '../../supabase/functions/send-push/webpush'
import { messageForNotification, messageForServiceRequest } from '../../supabase/functions/send-push/message'

// A browser's side of a subscription: its key pair and auth secret.
function browser() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return { ecdh, p256dh: b64urlEncode(ecdh.getPublicKey()), auth: b64urlEncode(auth), authBuf: auth }
}

describe('base64url', () => {
  it('round-trips bytes without padding or +/ characters', () => {
    const bytes = new Uint8Array([0, 251, 255, 62, 63, 1, 2])
    const text = b64urlEncode(bytes)
    expect(text).not.toMatch(/[+/=]/)
    expect(Array.from(b64urlDecode(text))).toEqual(Array.from(bytes))
  })
})

describe('encryptPayload (RFC 8291)', () => {
  it('produces a message the reference implementation can decrypt', async () => {
    const b = browser()
    const text = JSON.stringify({ title: 'Work assigned', body: 'WO-CR-2026-0007 · ₹ test ✓' })
    const body = await encryptPayload(new TextEncoder().encode(text), b.p256dh, b.auth)
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: b.ecdh, authSecret: b.auth })
    expect(plain.toString('utf8')).toBe(text)
  })

  it('writes the aes128gcm header: salt, 4096 record size, the sender key', async () => {
    const b = browser()
    const salt = new Uint8Array(16).fill(7)
    const body = await encryptPayload(new TextEncoder().encode('hi'), b.p256dh, b.auth, { salt })
    expect(Array.from(body.slice(0, 16))).toEqual(Array.from(salt))
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(body[21]).toBe(4) // uncompressed point
    // header 86 + 'hi' + delimiter + 16-byte tag
    expect(body.length).toBe(86 + 2 + 1 + 16)
  })

  it('uses a fresh key and salt each time', async () => {
    const b = browser()
    const one = await encryptPayload(new TextEncoder().encode('x'), b.p256dh, b.auth)
    const two = await encryptPayload(new TextEncoder().encode('x'), b.p256dh, b.auth)
    expect(b64urlEncode(one)).not.toBe(b64urlEncode(two))
  })

  it('refuses bad keys and oversized messages', async () => {
    const b = browser()
    await expect(encryptPayload(new Uint8Array(1), 'AAAA', b.auth)).rejects.toThrow('p256dh')
    await expect(encryptPayload(new Uint8Array(1), b.p256dh, 'AAAA')).rejects.toThrow('auth')
    await expect(encryptPayload(new Uint8Array(5000), b.p256dh, b.auth)).rejects.toThrow('too large')
  })
})

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push service origin that verifies with the public key', async () => {
    const keys = await generateVapidKeys()
    expect(b64urlDecode(keys.publicKey)).toHaveLength(65)
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, 'mailto:ops@example.com', 1_000_000)
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
    expect(m).not.toBeNull()
    const [, h, c, s, k] = m!
    expect(k).toBe(keys.publicKey)
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_000_000 + 12 * 3600,
      sub: 'mailto:ops@example.com',
    })
    const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: keys.privateJwk.x!, y: keys.privateJwk.y! }, format: 'jwk' })
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))
    expect(ok).toBe(true)
  })
})

describe('buildPushRequest', () => {
  it('sets the headers push services require and an encrypted JSON body', async () => {
    const b = browser()
    const keys = await generateVapidKeys()
    const msg = { title: 'T', body: 'B', url: '/mobile', tag: 'n-1' }
    const req = await buildPushRequest({ endpoint: 'https://push.example.com/x', p256dh: b.p256dh, auth: b.auth }, msg, keys, 'mailto:a@b.c', { topic: 'n-1:abc' })
    expect(req.url).toBe('https://push.example.com/x')
    expect(req.init.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
      Topic: 'n-1abc',
    })
    expect(req.init.headers.Authorization).toMatch(/^vapid t=/)
    const plain = ece.decrypt(Buffer.from(req.init.body), { version: 'aes128gcm', privateKey: b.ecdh, authSecret: b.auth })
    expect(JSON.parse(plain.toString())).toEqual(msg)
  })
})

describe('push messages', () => {
  it('links Admins to the desktop page for the alert, everyone else to the field app', () => {
    const n = { id: 'n1', type: 'outside_repair_sent', title: 'Sent for outside repair: OSR-2026-0001', body: 'Motherboard' }
    expect(messageForNotification(n, 'Admin')).toEqual({
      title: 'Sent for outside repair: OSR-2026-0001',
      body: 'Motherboard',
      url: '/maintenance/outside-repairs',
      tag: 'n-n1',
    })
    expect(messageForNotification(n, 'Technician').url).toBe('/mobile')
    expect(messageForNotification({ ...n, type: 'unknown', body: null }, 'Admin')).toMatchObject({ url: '/dashboard', body: '' })
  })

  it('describes a new service request and opens it on the Service Requests page', () => {
    expect(
      messageForServiceRequest({ id: 's1', ticket_id: 'SR-2026-0012', title: 'AC not cooling', priority: 'High', requested_by_name: 'Asha' })
    ).toEqual({
      title: 'New service request: SR-2026-0012',
      body: 'AC not cooling (High) · Asha',
      url: '/service-requests?q=SR-2026-0012',
      tag: 'sr-s1',
    })
  })
})
