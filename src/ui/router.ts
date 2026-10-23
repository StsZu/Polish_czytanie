// Screens by URL hash: #/ (Підручник; #/cwiczenia too), #/dzis, #/c/07, #/c/07/krok/3, #/sluchaj/07, #/trudne, #/rozroznianie,
// #/postep, #/ustawienia.

export type Route =
  | { name: 'today' }
  | { name: 'exercises' }
  /** `step` is null when the session chooses where to start. */
  | { name: 'session'; id: string; step: number | null }
  | { name: 'listen'; id: string }
  | { name: 'hard' }
  | { name: 'discrimination' }
  | { name: 'progress' }
  | { name: 'settings' }

export function route(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  let m = /^\/c\/(\d\d)(?:\/krok\/([0-7]))?$/.exec(path)
  if (m) return { name: 'session', id: m[1], step: m[2] ? Number(m[2]) : null }
  m = /^\/sluchaj\/(\d\d)$/.exec(path)
  if (m) return { name: 'listen', id: m[1] }
  const simple: Record<string, Route> = {
    '/cwiczenia': { name: 'exercises' },
    '/dzis': { name: 'today' },
    '/trudne': { name: 'hard' },
    '/rozroznianie': { name: 'discrimination' },
    '/postep': { name: 'progress' },
    '/ustawienia': { name: 'settings' },
  }
  return simple[path] ?? { name: 'exercises' }
}

export const sessionHref = (id: string, step?: number) => (step === undefined ? `#/c/${id}` : `#/c/${id}/krok/${step}`)
