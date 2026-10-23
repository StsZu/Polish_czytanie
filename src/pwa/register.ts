// Service worker registration and the «Доступна нова версія» notice.
type Listener = (waiting: boolean) => void

let waitingWorker: ServiceWorker | null = null
const listeners = new Set<Listener>()

function setWaiting(worker: ServiceWorker | null) {
  waitingWorker = worker
  for (const listener of listeners) listener(worker !== null)
}

export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener)
  listener(waitingWorker !== null)
  return () => listeners.delete(listener)
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const base = import.meta.env.BASE_URL
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((registration) => {
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker)
      })
    }
    if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting)
    track(registration.installing)
    registration.addEventListener('updatefound', () => track(registration.installing))
    // A long-open app on the iPad looks for a new version when it comes back to the screen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update().catch(() => {})
    })
  }).catch(() => {})
}

/**
 * Switches to the waiting version. `beforeReload` saves the session in progress; the progress lives in IndexedDB,
 * which the service worker does not touch, so nothing is lost.
 */
export async function applyUpdate(beforeReload: () => Promise<void>) {
  const worker = waitingWorker
  if (!worker) return
  await beforeReload().catch(() => {})
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
  worker.postMessage('skipWaiting')
}
