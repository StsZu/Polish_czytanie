// Recordings in Cache Storage: cached when an exercise is first opened, or all at once for offline use.
// The file names carry their content hash, so a cached file is never stale and survives app updates.
import type { Exercise } from '../../contracts.ts'
import { SECTIONS } from '../../contracts.ts'

export const AUDIO_CACHE = 'audio-v1'

const absolute = (path: string) => new URL(path, document.baseURI).href

async function open(): Promise<Cache | null> {
  try {
    return 'caches' in globalThis ? await caches.open(AUDIO_CACHE) : null
  } catch {
    return null
  }
}

/** The recording from the cache, or from the network (then it is cached); null when neither works. */
export async function audioResponse(path: string): Promise<Response | null> {
  const url = absolute(path)
  const cache = await open()
  const cached = await cache?.match(url)
  if (cached) return cached
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    await cache?.put(url, response.clone()).catch(() => {})
    return response
  } catch {
    return null
  }
}

export const exerciseAudio = (e: Exercise) => SECTIONS.map((k) => e.sections[k].audio).filter((p): p is string => p !== null)
export const exerciseBytes = (e: Exercise) => SECTIONS.reduce((n, k) => n + e.sections[k].bytes, 0)

/** Caches the three recordings of an exercise when it is opened, so its session works without internet later. */
export async function prefetchExercise(e: Exercise): Promise<boolean> {
  const results = await Promise.all(exerciseAudio(e).map((p) => audioResponse(p)))
  return results.every((r) => r !== null)
}

/** Ids of the exercises whose three recordings are all in the cache. */
export async function cachedExercises(exercises: Exercise[]): Promise<Set<string>> {
  const cache = await open()
  if (!cache) return new Set()
  const keys = new Set((await cache.keys()).map((r) => r.url))
  return new Set(exercises.filter((e) => exerciseAudio(e).every((p) => keys.has(absolute(p)))).map((e) => e.id))
}

export interface DownloadProgress { doneBytes: number; totalBytes: number; failed: string[] }

/** Downloads every recording that is not cached yet, reporting progress in bytes. */
export async function downloadAll(exercises: Exercise[], onProgress: (p: DownloadProgress) => void): Promise<DownloadProgress> {
  const cache = await open()
  const progress: DownloadProgress = { doneBytes: 0, totalBytes: 0, failed: [] }
  if (!cache) return { ...progress, failed: ['Cache Storage недоступне'] }
  const keys = new Set((await cache.keys()).map((r) => r.url))
  const items = exercises.flatMap((e) => SECTIONS.map((k) => e.sections[k]).filter((s) => s.audio && !keys.has(absolute(s.audio))))
  progress.totalBytes = items.reduce((n, s) => n + s.bytes, 0)
  onProgress({ ...progress })
  for (const s of items) {
    try {
      const response = await fetch(absolute(s.audio!))
      if (!response.ok) throw new Error(String(response.status))
      await cache.put(absolute(s.audio!), response)
    } catch {
      progress.failed.push(s.audio!)
    }
    progress.doneBytes += s.bytes
    onProgress({ ...progress, failed: [...progress.failed] })
  }
  return progress
}

/** Removes cached recordings that the current data no longer uses (an old version of a recording). */
export async function pruneAudio(exercises: Exercise[]): Promise<number> {
  const cache = await open()
  if (!cache) return 0
  const valid = new Set(exercises.flatMap(exerciseAudio).map(absolute))
  let removed = 0
  for (const request of await cache.keys()) {
    if (!valid.has(request.url)) {
      await cache.delete(request)
      removed++
    }
  }
  return removed
}

export async function clearAudio(): Promise<void> {
  try {
    await caches.delete(AUDIO_CACHE)
  } catch {
    // Nothing cached.
  }
}
