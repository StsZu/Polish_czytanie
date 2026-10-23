/* Service worker: precaches the app shell and the texts; recordings are cached on demand in audio-v1. */
const PRECACHE = __PRECACHE__
/** Recordings of this version, relative to the scope; any other file in audio-v1 is an old version. */
const AUDIO = __AUDIO__
const CACHE = 'shell-__VERSION__'
const AUDIO_CACHE = 'audio-v1'

self.addEventListener('install', (event) => {
  // A new version waits until the page asks it to take over («Оновити»), so a session in progress is not cut off.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  const current = new Set(AUDIO.map((path) => new URL(path, self.registration.scope).href))
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => caches.open(AUDIO_CACHE))
      .then((cache) => cache.keys().then((requests) => Promise.all(requests.filter((r) => !current.has(r.url)).map((r) => cache.delete(r)))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // The page itself always comes from the cache of this version: the new version arrives through «Оновити».
    event.respondWith(caches.match('./', { cacheName: CACHE }).then((cached) => cached || fetch(request)))
    return
  }
  if (url.pathname.includes('/audio/')) {
    // The app fetches recordings itself and keeps them in audio-v1; here a cached one is served without the network.
    event.respondWith(caches.match(request, { cacheName: AUDIO_CACHE }).then((cached) => cached || fetch(request)))
    return
  }
  event.respondWith(caches.match(request, { ignoreSearch: true, cacheName: CACHE }).then((cached) => cached || fetch(request)))
})
