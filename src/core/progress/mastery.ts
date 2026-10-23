// Mastery level 0–3 of an exercise (FR-36). Computed from the whole history, so it never goes down.
import type { Attempt } from '../../contracts.ts'
import { dayAccuracy } from './attempts.ts'
import { daysBetween } from './days.ts'

export const ACCURACY_MIN = 0.9
export const DAYS_BEFORE_LEVEL_3 = 3

/**
 * 0 — no session; 1 — a cold reading; 2 — on some day the best pace reached the target and the self-checks
 * of that day were ≥ 90 % right; 3 — a cold reading at the target on a day ≥ 3 calendar days after the first
 * session, and that day's self-rating was not «Не вийшло».
 */
export function masteryLevel(all: Attempt[], exercise: string, target: number): 0 | 1 | 2 | 3 {
  const attempts = all.filter((a) => a.exercise === exercise && a.kind !== 'legacy')
  if (!attempts.length) return 0
  const first = attempts.reduce((min, a) => (a.day < min ? a.day : min), attempts[0].day)
  const days = [...new Set(attempts.map((a) => a.day))]

  const level3 = attempts.some((a) =>
    a.kind === 'cold' && (a.wpm ?? 0) >= target && daysBetween(first, a.day) >= DAYS_BEFORE_LEVEL_3 &&
    !attempts.some((r) => r.day === a.day && r.kind === 'rating' && r.rating === 3))
  if (level3) return 3

  const level2 = days.some((day) => {
    const best = Math.max(0, ...attempts.filter((a) => a.day === day && (a.kind === 'tempo' || a.kind === 'cold')).map((a) => a.wpm ?? 0))
    const accuracy = dayAccuracy(attempts, exercise, day)
    return best >= target && accuracy !== null && accuracy >= ACCURACY_MIN
  })
  if (level2) return 2

  return attempts.some((a) => a.kind === 'cold' || a.kind === 'warmup') ? 1 : 0
}
