self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Ebright CRM', {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { link: data.link ?? '/crm/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const link = e.notification.data?.link ?? '/crm/dashboard'
      for (const client of clientList) {
        if (client.url.includes(link) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(link)
    })
  )
})
