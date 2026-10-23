// «Важкі слова»: a word or phrase that did not come out returns after 1, 3, 7 and 14 days (FR-32).
import type { HardItem, SectionKey } from '../../contracts.ts'
import { addDays } from './days.ts'

export const INTERVALS = [1, 3, 7, 14] as const
export const LEARNED_AFTER = 3
export const SESSION_LIMIT = 20

export const hardKey = (exercise: string, section: SectionKey, unit: number, word: number | null) =>
  `${exercise}:${section}:${unit}:${word ?? '-'}`

/** A new mistake, or the same one again: back to the first interval, due tomorrow. */
export function addMistake(existing: HardItem | undefined, item: Omit<HardItem, 'key' | 'box' | 'due' | 'streak14' | 'learned' | 'added' | 'updated'>, today: string, now: string): HardItem {
  return {
    ...item,
    key: hardKey(item.exercise, item.section, item.unit, item.word),
    box: 0,
    due: addDays(today, INTERVALS[0]),
    streak14: 0,
    learned: false,
    added: existing?.added ?? today,
    updated: now,
  }
}

/** «Так» moves to the next interval; on the 14-day interval it counts towards «вивчене». «Ні» starts over. */
export function answer(item: HardItem, correct: boolean, today: string, now: string): HardItem {
  if (!correct) return { ...item, box: 0, due: addDays(today, INTERVALS[0]), streak14: 0, learned: false, updated: now }
  if (item.box === 3) {
    const streak14 = item.streak14 + 1
    return { ...item, streak14, learned: streak14 >= LEARNED_AFTER, due: addDays(today, INTERVALS[3]), updated: now }
  }
  const box = (item.box + 1) as HardItem['box']
  return { ...item, box, due: addDays(today, INTERVALS[box]), updated: now }
}

/** Cards for today: due and not learned, the most overdue first, at most 20. */
export function dueToday(items: HardItem[], today: string, limit = SESSION_LIMIT): HardItem[] {
  return items
    .filter((i) => !i.learned && i.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || a.added.localeCompare(b.added) || a.key.localeCompare(b.key))
    .slice(0, limit)
}
