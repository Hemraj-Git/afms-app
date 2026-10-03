// AFMS service worker: shows alerts pushed by the server (see
// supabase/functions/send-push) even when the app is closed, and opens the
// right page when one is tapped. It does not cache anything.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'AssetNXG alert', {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      vibrate: [120, 60, 120],
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Already open on that page: bring it forward.
      for (const client of windows) {
        if (client.url === target.href && 'focus' in client) return client.focus()
      }
      // The app is open on another page: reuse that window.
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && 'navigate' in client) {
          await client.focus()
          return client.navigate(target.href)
        }
      }
      return self.clients.openWindow(target.href)
    })()
  )
})
