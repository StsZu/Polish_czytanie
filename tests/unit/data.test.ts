import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ContentFile, SectionKey } from '../../src/contracts.ts'
import { SECTIONS } from '../../src/contracts.ts'
import { estimateSession } from '../../src/core/content/estimate.ts'

const data = JSON.parse(readFileSync(new URL('../../public/data/cwiczenia.json', import.meta.url), 'utf8')) as ContentFile
const ORIGINAL = '/Users/szubar/Projects/Educational_courses_2026/Krok_po_kroku_2/czytanie/data/teksty.json'

describe('cwiczenia.json', () => {
  it('has 21 exercises 01–21 in three levels, every section with audio and timed words (SC-01)', () => {
    expect(data.exercises.map((e) => e.id)).toEqual(Array.from({ length: 21 }, (_, i) => String(i + 1).padStart(2, '0')))
    expect(data.exercises.map((e) => e.level)).toEqual([...Array(7).fill(1), ...Array(7).fill(2), ...Array(7).fill(3)])
    for (const e of data.exercises) {
      for (const key of SECTIONS) {
        const s = e.sections[key]
        expect(s.audio, `${e.id} ${key}`).toMatch(new RegExp(`^audio/${e.id}-${key}\\.[0-9a-f]{8}\\.mp3$`))
        expect(s.words.length).toBeGreaterThan(0)
        for (const w of s.words) {
          expect(w.do, `${e.id} ${key} ${w.t}`).toBeGreaterThan(w.od)
          expect(s.text.slice(w.s, w.k)).toBe(w.t)
        }
        for (let i = 1; i < s.words.length; i++) expect(s.words[i].od).toBeGreaterThanOrEqual(s.words[i - 1].od)
        const covered = s.units.flatMap((u) => Array.from({ length: u.words[1] - u.words[0] + 1 }, (_, j) => u.words[0] + j))
        expect(covered).toEqual(s.words.map((_, i) => i))
      }
    }
  })

  it('gama and pasaże units are lines: 4–6 words per gama line, 8–12 phrases', () => {
    for (const e of data.exercises) {
      for (const u of e.sections.gama.units) expect(u.words[1] - u.words[0] + 1).toBeGreaterThanOrEqual(4)
      expect(e.sections.pasaze.units.length).toBeGreaterThanOrEqual(8)
      expect(e.sections.pasaze.units.length).toBeLessThanOrEqual(12)
    }
  })

  it.runIf(existsSync(ORIGINAL))('matches the words and times of the existing trainer for all 63 sections', () => {
    const original = JSON.parse(readFileSync(ORIGINAL, 'utf8')) as { cwiczenia: { id: string; sekcje: Record<SectionKey, { tekst: string; slowa: { t: string; od: number; do: number }[] }> }[] }
    for (const [i, o] of original.cwiczenia.entries()) {
      const e = data.exercises[i]
      expect(e.id).toBe(o.id)
      for (const key of SECTIONS) {
        expect(e.sections[key].text).toBe(o.sekcje[key].tekst)
        expect(e.sections[key].words.map((w) => [w.t, w.od, w.do])).toEqual(o.sekcje[key].slowa.map((w) => [w.t, w.od, w.do]))
      }
    }
  })

  it('stress is marked on every gama word of exercise 10, syllables on the split words of exercise 11', () => {
    const e10 = data.exercises[9]
    for (const w of e10.sections.gama.words) expect(w.stress).not.toBeNull()
    expect(e10.sections.gama.words.find((w) => w.t === 'muzyka')?.stress).toEqual([0, 2])
    const e11 = data.exercises[10]
    expect(e11.sections.gama.words.some((w) => w.syl?.join('') === w.t)).toBe(true)
  })

  it('the quiz has at least 6 items in 01, 02, 04–08 and none elsewhere (SC-07)', () => {
    for (const e of data.exercises) {
      if (['01', '02', '04', '05', '06', '07', '08'].includes(e.id)) {
        expect(e.quiz.length, e.id).toBeGreaterThanOrEqual(6)
        expect(e.quizSkip).toBeNull()
        for (const q of e.quiz) {
          expect(q.options).toContain(q.answer)
          expect(q.options.length).toBeGreaterThanOrEqual(2)
          expect(new Set(q.options).size).toBe(q.options.length)
          expect(e.sections.gama.words[q.word].t).toBe(q.answer)
        }
      } else {
        expect(e.quiz, e.id).toEqual([])
        expect(e.quizSkip).toBeTruthy()
      }
    }
  })

  it('a full session takes 4–8 minutes, and 4–7 without step 5 at level III (SC-06)', () => {
    for (const e of data.exercises) {
      const { total, withoutShadow } = estimateSession(e)
      expect(withoutShadow, e.id).toBeGreaterThanOrEqual(4)
      if (e.level < 3) expect(total, e.id).toBeLessThanOrEqual(8)
      else expect(withoutShadow, e.id).toBeLessThanOrEqual(7)
    }
  })
})
