// How long a full session of an exercise takes (SC-06), from the recordings and the target pace.
import type { Exercise, Level } from '../../contracts.ts'

/** Phrase display time at the start of step 4, by level. */
export const FLASH_START_MS: Record<Level, number> = { 1: 2000, 2: 1500, 3: 1200 }
const READ_PAUSE = 3

export function estimateSession(e: Exercise): { total: number; withoutShadow: number } {
  const { gama, pasaze, utwor } = e.sections
  const wordLength = (i: number) => gama.words[i].do - gama.words[i].od
  const rule = e.ruleExamples.reduce((n, i) => n + wordLength(i) + 2, 0)
  const gamaStep = gama.duration + READ_PAUSE * gama.units.length
  const quiz = e.quiz.reduce((n, q) => n + wordLength(q.word) + READ_PAUSE, 0)
  const flash = pasaze.duration + pasaze.units.length * (READ_PAUSE + FLASH_START_MS[e.level] / 1000)
  const shadow = utwor.duration
  const reading = (utwor.words.length / e.targetWpm) * 60 * 2
  const seconds = rule + gamaStep + quiz + flash + shadow + reading
  return { total: seconds / 60, withoutShadow: (seconds - shadow) / 60 }
}
