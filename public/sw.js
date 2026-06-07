self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  // Basic pass-through SW enables installability checks while preserving live behavior.
  event.respondWith(fetch(event.request))
})
