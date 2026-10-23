// The plan of the «Сьогодні» screen (FR-30).
import type { Attempt } from '../../contracts.ts'
import { daysBetween } from './days.ts'

export const REVIEW_AFTER_DAYS = 7

export interface TodayPlan {
  /** The first exercise by number that is not mastered; null when all 21 are. */
  next: string | null
  /** A mastered exercise not opened for the longest time, if it was ≥ 7 days ago. */
  review: string | null
  hardDue: number
}

export function planToday(ids: string[], levels: Record<string, number>, attempts: Attempt[], hardDue: number, today: string): TodayPlan {
  const next = ids.find((id) => (levels[id] ?? 0) < 3) ?? null
  const lastDay: Record<string, string> = {}
  for (const a of attempts) if (a.kind !== 'legacy' && (!lastDay[a.exercise] || a.day > lastDay[a.exercise])) lastDay[a.exercise] = a.day
  const review = ids
    .filter((id) => levels[id] === 3 && lastDay[id] && daysBetween(lastDay[id], today) >= REVIEW_AFTER_DAYS)
    .sort((a, b) => lastDay[a].localeCompare(lastDay[b]) || a.localeCompare(b))[0] ?? null
  return { next, review, hardDue }
}
