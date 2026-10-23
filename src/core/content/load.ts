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

/** The content as recorded by `voice`: its recordings and word times in place of the main voice's. */
export function withVoice(content: ContentFile, voice: string): ContentFile {
  if (!content.voices.some((v, i) => i > 0 && v.id === voice)) return content
  return {
    ...content,
    exercises: content.exercises.map((e) => ({
      ...e,
      sections: Object.fromEntries(Object.entries(e.sections).map(([key, s]) => {
        const v = s.alt[voice]
        if (!v) return [key, s]
        const words = s.words.map((w, i) => ({ ...w, od: v.times[i][0], do: v.times[i][1] }))
        const units = s.units.map((u) => ({ ...u, od: words[u.words[0]].od, do: words[u.words[1]].do }))
        return [key, { ...s, audio: v.audio, bytes: v.bytes, duration: v.duration, words, units }]
      })) as typeof e.sections,
    })),
  }
}
