// v5: build assets (/_next/static/) are now NETWORK-FIRST. They're content-hashed
// (filename changes every build), so the old cache-first strategy could serve a
// STALE chunk that no longer matches the fresh HTML — the engine's JS then never
// loaded and a heavy page like /lab/celestial "wouldn't open" even though the
// server was fine. Bumping the name also PURGES the old fragile cache for every
// visitor on their next load (the activate handler deletes non-matching caches).
const CACHE_NAME = "portfolio-shell-v5"
const SHELL_ASSETS = ["/", "/offline.html", "/manifest.webmanifest", "/apple-touch-icon.png", "/icon.svg"]

// The UpdateToast's "Refresh" button posts this so a waiting worker activates
// immediately (controllerchange then reloads the page with fresh assets).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

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

  // For route navigation, prefer network and gracefully fall back to the cached
  // shell / offline page. Only cache a GOOD response (never a 4xx/5xx/opaque).
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(event.request)
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME)
            cache.put("/", fresh.clone())
          }
          return fresh
        } catch {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match("/")) || (await cache.match("/offline.html"))
        }
      })(),
    )
    return
  }

  // Build assets (/_next/static/) are content-HASHED → immutable. NETWORK-FIRST so
  // a deploy's fresh chunks always win; fall back to cache only when offline. This
  // is what prevents a stale cached chunk from breaking a page after a deploy.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(event.request)
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME)
            cache.put(event.request, fresh.clone())
          }
          return fresh
        } catch {
          const cached = await caches.match(event.request)
          return cached || new Response("", { status: 504, statusText: "Offline" })
        }
      })(),
    )
    return
  }

  // Other static assets (images, fonts, data): cache-first for fast repeat loads.
  // NEVER cache an error response (only response.ok), so a one-off failed fetch
  // can't get stuck in the cache.
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request)
      if (cached) return cached

      try {
        const response = await fetch(event.request)
        if (response && response.ok) {
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
