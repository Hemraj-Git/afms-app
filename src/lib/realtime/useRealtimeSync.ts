'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Live updates over Supabase Realtime, "light" version: an event only says
// "this table changed", and the handler refetches that table. Row-level
// security decides which events a client receives, so a technician only hears
// about their own work orders and a guest only about their own tickets.

export type RealtimeStatus = 'off' | 'connecting' | 'live' | 'reconnecting'

export interface NotificationRow {
  id: string
  type: string
  title: string
  body?: string | null
  ref_table?: string | null
  ref_id?: string | null
  is_read?: boolean | null
  created_at: string
}

export interface RealtimeHandlers {
  refetchWorkOrders: () => void
  refetchServiceRequests: () => void
  refetchInspections: () => void
  refetchNotifications: () => void
  onNotification: (row: NotificationRow) => void
}

interface Options {
  enabled: boolean
  userId: string
  role: string
  email: string
  handlers: RealtimeHandlers
}

type Table = 'work_orders' | 'service_requests' | 'inspections' | 'notifications'

// A burst of changes (an asset that schedules several work orders at once)
// should cost one refetch, not one per row.
const DEBOUNCE_MS = 300
// Realtime doesn't replay missed events, and phones throttle background
// websockets anyway. Past this long hidden we drop the connection and catch up
// with a refetch when the app comes back.
const HIDDEN_DISCONNECT_MS = 30_000

export function useRealtimeSync({ enabled, userId, role, email, handlers }: Options): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('off')

  // Handlers change identity every render; keep the subscription itself stable.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  const isGuest = role === 'Guest'
  // A guest is matched to their tickets by email; without one there is nothing to listen for.
  const active = enabled && Boolean(userId) && !(isGuest && !email)

  useEffect(() => {
    if (!active) return

    let disposed = false
    let channel: RealtimeChannel | null = null
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null
    const debounceTimers = new Map<Table, ReturnType<typeof setTimeout>>()

    const runRefetch = (table: Table) => {
      const h = handlersRef.current
      if (table === 'work_orders') h.refetchWorkOrders()
      else if (table === 'service_requests') h.refetchServiceRequests()
      else if (table === 'inspections') h.refetchInspections()
      else h.refetchNotifications()
    }

    const schedule = (table: Table) => {
      const pending = debounceTimers.get(table)
      if (pending) clearTimeout(pending)
      debounceTimers.set(
        table,
        setTimeout(() => {
          debounceTimers.delete(table)
          if (!disposed) runRefetch(table)
        }, DEBOUNCE_MS)
      )
    }

    const tables: Table[] = isGuest
      ? ['service_requests']
      : ['work_orders', 'service_requests', 'inspections', 'notifications']
    const refetchAll = () => tables.forEach(schedule)

    const unsubscribe = () => {
      const current = channel
      channel = null
      if (current) supabase.removeChannel(current).catch(() => {})
    }

    const subscribe = async () => {
      if (channel || disposed) return
      setStatus('connecting')

      // Hand the socket the current access token explicitly rather than
      // relying on the client having noticed a cookie-based session set by a
      // Server Action (guest and staff sign-in both happen there).
      const { data: { session } } = await supabase.auth.getSession()
      if (disposed || channel) return
      if (!session) {
        setStatus('off')
        return
      }
      supabase.realtime.setAuth(session.access_token)

      const ch = supabase.channel(`live:${userId}`)

      if (isGuest) {
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'service_requests', filter: `requested_by_email=eq.${email}` },
          () => schedule('service_requests')
        )
      } else {
        ch.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          payload => {
            const row = payload.new as NotificationRow
            handlersRef.current.onNotification(row)
            // The notification says what changed for this user; refresh it now
            // instead of waiting for the table's own event.
            if (row.type === 'wo_assigned') schedule('work_orders')
            else if (row.type === 'inspection_assigned') schedule('inspections')
          }
        )
        ;(['work_orders', 'service_requests', 'inspections'] as const).forEach(table => {
          ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule(table))
        })
      }

      channel = ch
      ch.subscribe(state => {
        if (disposed || channel !== ch) return
        if (state === 'SUBSCRIBED') {
          setStatus('live')
          // Whatever happened before (re)connecting was never delivered.
          refetchAll()
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          // The client retries on its own and re-emits SUBSCRIBED, which
          // refetches above. Never throw from here.
          console.warn(`Realtime ${state}; will catch up on reconnect.`)
          setStatus('reconnecting')
        } else if (state === 'CLOSED') {
          setStatus('reconnecting')
        }
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimer) clearTimeout(hiddenTimer)
        hiddenTimer = setTimeout(() => {
          hiddenTimer = null
          unsubscribe()
          setStatus('off')
        }, HIDDEN_DISCONNECT_MS)
      } else {
        if (hiddenTimer) {
          clearTimeout(hiddenTimer)
          hiddenTimer = null
        }
        if (channel) {
          // Short absence: still connected, but a throttled background socket
          // may have dropped events, and notifications were never refreshed.
          schedule(isGuest ? 'service_requests' : 'notifications')
        } else {
          subscribe() // refetches on SUBSCRIBED
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    if (document.visibilityState !== 'hidden') subscribe()

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (hiddenTimer) clearTimeout(hiddenTimer)
      debounceTimers.forEach(clearTimeout)
      debounceTimers.clear()
      unsubscribe()
      setStatus('off')
    }
  }, [active, userId, email, isGuest])

  return active ? status : 'off'
}
