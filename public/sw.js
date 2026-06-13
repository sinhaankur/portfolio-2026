const CACHE_NAME = "portfolio-shell-v3"
const SHELL_ASSETS = ["/", "/offline.html", "/manifest.webmanifest", "/apple-touch-icon.png", "/icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(SHELL_ASSETS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // For route navigation, prefer network and gracefully fallback to cached shell/offline page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(event.request)
          const cache = await caches.open(CACHE_NAME)
          cache.put("/", fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match("/")) || (await cache.match("/offline.html"))
        }
      })(),
    )
    return
  }

  // Static assets: cache-first for faster repeat loads on mobile.
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request)
      if (cached) return cached

      try {
        const response = await fetch(event.request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          cache.put(event.request, response.clone())
        }
        return response
      } catch {
        return new Response("", { status: 504, statusText: "Offline" })
      }
    })(),
  )
})
