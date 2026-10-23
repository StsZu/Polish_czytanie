// What an attempt means: cold reading or warm-up, the pace of a reading, the streak and the time spent.
import type { Attempt, AttemptKind } from '../../contracts.ts'
import { addDays } from './days.ts'

/** Anything that lets the reader see or hear the text of an exercise; after it, a reading that day is no longer cold. */
const PRACTICE: AttemptKind[] = ['cold', 'warmup', 'tempo', 'gama', 'flash', 'quiz', 'shadow', 'listen', 'hard']

/** Whether step 0 today counts as cold reading: nothing of this exercise was read, heard or trained today (FR-11). */
export function coldAllowed(attempts: Attempt[], exercise: string, day: string): boolean {
  return !attempts.some((a) => a.exercise === exercise && a.day === day && PRACTICE.includes(a.kind))
}

/**
 * Whether the exercise was practised on an earlier day. The tempo check (step 0) opens a session only then:
 * reading an unknown text cold on the first day only frustrates a beginner.
 */
export function practicedBefore(attempts: Attempt[], exercise: string, day: string): boolean {
  return attempts.some((a) => a.exercise === exercise && a.day < day && PRACTICE.includes(a.kind) && a.kind !== 'listen')
}

export const MIN_SECONDS = 5
export const MAX_WPM = 300

/** Words per minute of a reading, or null when it is too short or impossibly fast to be a reading aloud. */
export function readingPace(words: number, seconds: number): number | null {
  if (seconds < MIN_SECONDS) return null
  const wpm = Math.round((words / seconds) * 60)
  return wpm > MAX_WPM ? null : wpm
}

/** Days in a row with any attempt, ending today or yesterday (a streak is not lost before the day is over). */
export function streak(attempts: Attempt[], today: string): number {
  const days = new Set(attempts.filter((a) => a.kind !== 'legacy').map((a) => a.day))
  let day = days.has(today) ? today : addDays(today, -1)
  let count = 0
  while (days.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

/** Minutes of practice in the 7 days ending today. */
export function minutesThisWeek(attempts: Attempt[], today: string): number {
  const from = addDays(today, -6)
  const seconds = attempts.filter((a) => a.day >= from && a.day <= today).reduce((n, a) => n + (a.seconds || 0), 0)
  return Math.round(seconds / 60)
}

/** Share of «correct» in self-checks (gama, flash, quiz) of one exercise on one day; null when there were none. */
export function dayAccuracy(attempts: Attempt[], exercise: string, day: string): number | null {
  let correct = 0
  let total = 0
  for (const a of attempts) {
    if (a.exercise !== exercise || a.day !== day || !['gama', 'flash', 'quiz'].includes(a.kind)) continue
    correct += a.correct ?? 0
    total += a.total ?? 0
  }
  return total ? correct / total : null
}

/** The latest cold pace of an exercise (cold reading or an unseen text), for the cards and the chart. */
export function lastColdPace(attempts: Attempt[], exercise: string): number | null {
  const cold = attempts.filter((a) => a.exercise === exercise && a.kind === 'cold' && typeof a.wpm === 'number')
  return cold.length ? cold[cold.length - 1].wpm! : null
}
