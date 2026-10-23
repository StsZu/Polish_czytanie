// The built texts: fetched once from data/cwiczenia.json (precached by the service worker).
import type { ContentFile } from '../../contracts.ts'

let content: Promise<ContentFile> | null = null

export function loadContent(): Promise<ContentFile> {
  content ??= fetch(`${import.meta.env.BASE_URL}data/cwiczenia.json`).then((r) => {
    if (!r.ok) throw new Error(`Не вдалося завантажити тексти (${r.status}).`)
    return r.json() as Promise<ContentFile>
  }).catch((error: unknown) => {
    content = null
    throw error
  })
  return content
}
