// send-push: delivers AFMS alerts to browsers/phones with Web Push.
//
//   GET  -> { publicKey }  the VAPID key browsers subscribe with (created on first use)
//   POST { kind: 'notification' | 'service_request', id }
//        -> sends that alert once to its recipients' devices
//
// Called by the database (migration 0044, via pg_net) whenever a notification
// row or a service request is inserted. It trusts nothing in the request but
// the id: it loads the row itself, claims it once (pushed_at / push_sent_at)
// and only while it is fresh, so deploying it without JWT verification is safe.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildPushRequest, generateVapidKeys, type VapidKeys } from './webpush.ts'
import { messageForNotification, messageForServiceRequest, type PushMessage } from './message.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const FRESH_MS = 10 * 60 * 1000
const PUSH_HOST = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)\//

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Config {
  keys: VapidKeys
  subject: string
}

async function loadConfig(): Promise<Config> {
  const functionsUrl = `${SUPABASE_URL}/functions/v1`
  let { data, error } = await db.from('push_config').select('*').maybeSingle()
  if (error) throw error
  if (!data) {
    const keys = await generateVapidKeys()
    // Two first callers at once: the second insert is ignored and both read the winner.
    const ins = await db
      .from('push_config')
      .upsert(
        { id: true, vapid_public_key: keys.publicKey, vapid_private_jwk: keys.privateJwk, functions_url: functionsUrl },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    if (ins.error) throw ins.error
    ;({ data, error } = await db.from('push_config').select('*').single())
    if (error) throw error
  } else if (data.functions_url !== functionsUrl) {
    await db.from('push_config').update({ functions_url: functionsUrl }).eq('id', true)
  }
  return {
    keys: { publicKey: data.vapid_public_key, privateJwk: data.vapid_private_jwk },
    subject: data.subject || SUPABASE_URL,
  }
}

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Delivery {
  sub: Subscription
  message: PushMessage
}

async function deliver(config: Config, deliveries: Delivery[]) {
  let sent = 0
  let removed = 0
  let failed = 0
  await Promise.all(
    deliveries.map(async ({ sub, message }) => {
      if (!PUSH_HOST.test(sub.endpoint)) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
        removed++
        return
      }
      try {
        const req = await buildPushRequest(sub, message, config.keys, config.subject, { topic: message.tag })
        const res = await fetch(req.url, req.init)
        await res.body?.cancel()
        if (res.ok) {
          sent++
          await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id)
        } else if (res.status === 404 || res.status === 410) {
          // The browser unsubscribed or the subscription expired.
          removed++
          await db.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          failed++
          console.warn('push rejected', res.status, new URL(sub.endpoint).host)
          const { data } = await db.from('push_subscriptions').select('failure_count').eq('id', sub.id).maybeSingle()
          const failures = (data?.failure_count ?? 0) + 1
          // A device that keeps refusing is dropped; turning alerts on again re-adds it.
          if (failures >= 5) await db.from('push_subscriptions').delete().eq('id', sub.id)
          else await db.from('push_subscriptions').update({ failure_count: failures }).eq('id', sub.id)
        }
      } catch (e) {
        failed++
        console.error('push failed', new URL(sub.endpoint).host, e instanceof Error ? e.message : e)
      }
    })
  )
  return { sent, removed, failed }
}

async function sendNotification(config: Config, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { sent: 0, skipped: 'bad id' }
  const freshSince = new Date(Date.now() - FRESH_MS).toISOString()
  const { data: n, error } = await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pushed_at', null)
    .gte('created_at', freshSince)
    .select('id, user_id, type, title, body')
    .maybeSingle()
  if (error) throw error
  if (!n) return { sent: 0, skipped: 'unknown, already sent or too old' }

  const [{ data: profile }, { data: subs }] = await Promise.all([
    db.from('profiles').select('role').eq('id', n.user_id).maybeSingle(),
    db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id),
  ])
  const message = messageForNotification(n, profile?.role ?? '')
  return deliver(config, (subs ?? []).map(sub => ({ sub, message })))
}

async function sendServiceRequest(config: Config, id: string) {
  const freshSince = new Date(Date.now() - FRESH_MS).toISOString()
  const { data: r, error } = await db
    .from('service_requests')
    .update({ push_sent_at: new Date().toISOString() })
    .eq('id', id)
    .is('push_sent_at', null)
    .gte('push_queued_at', freshSince)
    .select('id, ticket_id, title, priority, requested_by_name, requested_by_user_id')
    .maybeSingle()
  if (error) throw error
  if (!r) return { sent: 0, skipped: 'unknown, already sent or too old' }

  const { data: admins } = await db.from('profiles').select('id').eq('role', 'Admin')
  const adminIds = (admins ?? []).map(a => a.id).filter(aid => aid !== r.requested_by_user_id)
  if (adminIds.length === 0) return { sent: 0 }
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', adminIds)
  const message = messageForServiceRequest(r)
  return deliver(config, (subs ?? []).map(sub => ({ sub, message })))
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const config = await loadConfig()
    if (req.method === 'GET') return json({ publicKey: config.keys.publicKey })
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const body = await req.json().catch(() => null)
    const kind = body?.kind
    const id = typeof body?.id === 'string' && body.id.length <= 100 ? body.id : null
    if (!id || (kind !== 'notification' && kind !== 'service_request')) return json({ error: 'Bad request' }, 400)

    const result = kind === 'notification' ? await sendNotification(config, id) : await sendServiceRequest(config, id)
    return json(result)
  } catch (e) {
    console.error('send-push error', e instanceof Error ? e.message : e)
    return json({ error: 'Push failed' }, 500)
  }
})
