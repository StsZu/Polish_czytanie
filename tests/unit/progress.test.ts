import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Attempt, HardItem } from '../../src/contracts.ts'
import { DEFAULT_SETTINGS } from '../../src/contracts.ts'
import { coldAllowed, dayAccuracy, practicedBefore, minutesThisWeek, readingPace, streak } from '../../src/core/progress/attempts.ts'
import { BackupError, createBackup, mergeBackup, parseBackup, replaceWith } from '../../src/core/progress/backup.ts'
import { addAttempt, allAttempts, allHard, clearAll, getSettings, putHard, replaceAll, resetConnection, storageError } from '../../src/core/progress/db.ts'
import { addDays, dayOf, daysBetween } from '../../src/core/progress/days.ts'
import { masteryLevel } from '../../src/core/progress/mastery.ts'
import { addMistake, answer, dueToday, hardKey } from '../../src/core/progress/srs.ts'
import { planToday } from '../../src/core/progress/today.ts'

const at = (day: string, kind: Attempt['kind'], extra: Partial<Attempt> = {}): Attempt =>
  ({ exercise: '07', day, at: `${day}T10:00:00.000Z`, kind, seconds: 30, ...extra })

describe('days', () => {
  it('uses the local calendar, also across midnight and month ends', () => {
    expect(dayOf(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22')
    expect(dayOf(new Date(2026, 9, 23, 0, 1))).toBe('2026-10-23')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-22', '2026-10-25')).toBe(3)
    // The night the clocks change is still one day.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('attempts', () => {
  it('cold reading only before anything else of the exercise that day', () => {
    expect(coldAllowed([], '07', '2026-10-22')).toBe(true)
    expect(coldAllowed([at('2026-10-21', 'shadow')], '07', '2026-10-22')).toBe(true)
    expect(coldAllowed([at('2026-10-22', 'listen')], '07', '2026-10-22')).toBe(false)
    expect(coldAllowed([at('2026-10-22', 'cold')], '07', '2026-10-22')).toBe(false)
    expect(coldAllowed([{ ...at('2026-10-22', 'tempo'), exercise: '08' }], '07', '2026-10-22')).toBe(true)
    expect(coldAllowed([at('2026-10-22', 'rating')], '07', '2026-10-22')).toBe(true)
  })

  it('the tempo check opens a session only after practice on an earlier day; listening alone does not count', () => {
    expect(practicedBefore([], '07', '2026-10-22')).toBe(false)
    expect(practicedBefore([at('2026-10-22', 'gama')], '07', '2026-10-22')).toBe(false)
    expect(practicedBefore([at('2026-10-21', 'listen')], '07', '2026-10-22')).toBe(false)
    expect(practicedBefore([at('2026-10-21', 'gama')], '07', '2026-10-22')).toBe(true)
    expect(practicedBefore([{ ...at('2026-10-21', 'gama'), exercise: '08' }], '07', '2026-10-22')).toBe(false)
  })

  it('level 1 comes with any session work, not only a cold reading', () => {
    expect(masteryLevel([at('2026-10-22', 'listen')], '07', 60)).toBe(0)
    expect(masteryLevel([at('2026-10-22', 'gama', { correct: 5, total: 5 })], '07', 60)).toBe(1)
  })

  it('pace: words per minute, too short or too fast is not saved', () => {
    expect(readingPace(60, 60)).toBe(60)
    expect(readingPace(60, 4)).toBeNull()
    expect(readingPace(212, 30)).toBeNull()
    expect(readingPace(212, 127)).toBe(100)
  })

  it('streak counts days in a row ending today or yesterday', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21']
    expect(streak(days.map((d) => at(d, 'cold')), '2026-10-22')).toBe(3)
    expect(streak(days.map((d) => at(d, 'cold')), '2026-10-23')).toBe(0)
    expect(streak([...days, '2026-10-22'].map((d) => at(d, 'cold')), '2026-10-22')).toBe(4)
    expect(streak([at('2026-10-22', 'legacy')], '2026-10-22')).toBe(0)
  })

  it('minutes of the week and accuracy of a day', () => {
    expect(minutesThisWeek([at('2026-10-22', 'cold', { seconds: 120 }), at('2026-10-10', 'cold', { seconds: 600 })], '2026-10-22')).toBe(2)
    const day = [at('2026-10-22', 'gama', { correct: 5, total: 6 }), at('2026-10-22', 'flash', { correct: 4, total: 4 })]
    expect(dayAccuracy(day, '07', '2026-10-22')).toBe(0.9)
    expect(dayAccuracy([], '07', '2026-10-22')).toBeNull()
  })
})

describe('mastery (FR-36)', () => {
  const target = 60
  it('0 without attempts, 1 after a cold reading', () => {
    expect(masteryLevel([], '07', target)).toBe(0)
    expect(masteryLevel([at('2026-10-22', 'cold', { wpm: 30 })], '07', target)).toBe(1)
    expect(masteryLevel([at('2026-10-22', 'legacy', { wpm: 90 })], '07', target)).toBe(0)
  })

  it('2 when the pace and the self-checks of one day reach the target', () => {
    const day = '2026-10-22'
    expect(masteryLevel([at(day, 'cold', { wpm: 40 }), at(day, 'tempo', { wpm: 65 }), at(day, 'gama', { correct: 9, total: 10 })], '07', target)).toBe(2)
    expect(masteryLevel([at(day, 'cold', { wpm: 40 }), at(day, 'tempo', { wpm: 65 }), at(day, 'gama', { correct: 8, total: 10 })], '07', target)).toBe(1)
  })

  it('never 3 in one day, even with 10 readings above the target (SC-05)', () => {
    const day = '2026-10-22'
    const many = Array.from({ length: 10 }, () => at(day, 'cold', { wpm: 120 }))
    expect(masteryLevel([...many, at(day, 'gama', { correct: 10, total: 10 })], '07', target)).toBe(2)
  })

  it('3 after a cold reading at the target ≥ 3 days after the first session, unless rated «Не вийшло»', () => {
    const first = [at('2026-10-20', 'cold', { wpm: 40 })]
    expect(masteryLevel([...first, at('2026-10-22', 'cold', { wpm: 70 })], '07', target)).toBe(1)
    expect(masteryLevel([...first, at('2026-10-23', 'cold', { wpm: 70 })], '07', target)).toBe(3)
    expect(masteryLevel([...first, at('2026-10-23', 'cold', { wpm: 70 }), at('2026-10-23', 'rating', { rating: 3 })], '07', target)).toBe(1)
    // A warm-up reading at the target is not cold.
    expect(masteryLevel([...first, at('2026-10-23', 'warmup', { wpm: 70 })], '07', target)).toBe(1)
  })
})

describe('hard words (SC-08)', () => {
  const base = { exercise: '07', section: 'gama' as const, unit: 0, word: 1, text: 'Kasia' }
  it('«Ні» → 1 day, «Так» → 1 / 3 / 7 / 14, three «Так» on 14 → learned', () => {
    let item = addMistake(undefined, base, '2026-10-22', 'n0')
    expect(item.key).toBe(hardKey('07', 'gama', 0, 1))
    expect(item.due).toBe('2026-10-23')
    item = answer(item, true, '2026-10-23', 'n1')
    expect([item.box, item.due]).toEqual([1, '2026-10-26'])
    item = answer(item, true, '2026-10-26', 'n2')
    expect([item.box, item.due]).toEqual([2, '2026-11-02'])
    item = answer(item, true, '2026-11-02', 'n3')
    expect([item.box, item.due]).toEqual([3, '2026-11-16'])
    item = answer(item, true, '2026-11-16', 'n4')
    item = answer(item, true, '2026-11-30', 'n5')
    expect(item.learned).toBe(false)
    item = answer(item, true, '2026-12-14', 'n6')
    expect(item.learned).toBe(true)
    const wrong = answer(item, false, '2026-12-28', 'n7')
    expect([wrong.box, wrong.due, wrong.streak14, wrong.learned]).toEqual([0, '2026-12-29', 0, false])
  })

  it('the same mistake again starts over but keeps the day it was first added', () => {
    const first = answer(addMistake(undefined, base, '2026-10-01', 'n0'), true, '2026-10-02', 'n1')
    const again = addMistake(first, base, '2026-10-05', 'n2')
    expect([again.box, again.due, again.added]).toEqual([0, '2026-10-06', '2026-10-01'])
  })

  it('today: due and not learned, at most 20, most overdue first', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ ...addMistake(undefined, { ...base, unit: i }, '2026-10-01', 'n'), due: addDays('2026-10-01', i % 5) }))
    const due = dueToday(items, '2026-10-03')
    expect(due).toHaveLength(15)
    expect(due[0].due).toBe('2026-10-01')
    expect(dueToday(items, '2026-12-01')).toHaveLength(20)
  })
})

describe('today plan', () => {
  it('next unmastered exercise and a review after 7 days', () => {
    const ids = ['01', '02', '03']
    const attempts = [{ ...at('2026-10-10', 'cold'), exercise: '01' }, { ...at('2026-10-20', 'cold'), exercise: '02' }]
    expect(planToday(ids, { '01': 3, '02': 3 }, attempts, 4, '2026-10-22')).toEqual({ next: '03', review: '01', hardDue: 4 })
    expect(planToday(ids, { '01': 3, '02': 3, '03': 3 }, attempts, 0, '2026-10-15').review).toBeNull()
  })
})

describe('backup (SC-11)', () => {
  const hard: HardItem = { ...addMistake(undefined, { exercise: '07', section: 'gama', unit: 0, word: 1, text: 'Kasia' }, '2026-10-22', '2026-10-22T10:00:00Z') }
  const data = { attempts: [{ ...at('2026-10-22', 'cold', { wpm: 50 }), id: 1 }], hard: [hard], sessions: [], settings: { ...DEFAULT_SETTINGS, fontPx: 26, voice: 'beata' } }

  it('round-trips through JSON', () => {
    const file = JSON.stringify(createBackup(data))
    const parsed = parseBackup(file)
    expect(parsed.kind).toBe('backup')
    if (parsed.kind === 'backup') expect(replaceWith(parsed.data)).toEqual(data)
  })

  it('lists every problem of a damaged file', () => {
    const bad = { app: 'polish-czytanie', version: 1, attempts: [{ exercise: '7', day: '22.10', at: 'x', kind: 'nope', seconds: -1 }, 5], hard: [{}], settings: { fontPx: 99, voice: 5 } }
    try {
      parseBackup(JSON.stringify(bad))
      expect.unreachable()
    } catch (error) {
      const problems = (error as BackupError).problems
      expect(problems).toContain('Спроба 1: поле «exercise» має бути номером вправи на кшталт «07».')
      expect(problems).toContain('Спроба 1: поле «day» має бути датою РРРР-ММ-ДД.')
      expect(problems).toContain('Спроба 1: невідомий вид спроби «nope».')
      expect(problems).toContain('Спроба 2: має бути об\'єкт.')
      expect(problems.some((p) => p.startsWith('Важке слово 1:'))).toBe(true)
      expect(problems).toContain('Налаштування «fontPx» має бути 22–30.')
      expect(problems).toContain('Налаштування «voice» має бути назвою голосу (латиницею).')
    }
    expect(() => parseBackup('{')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"other"}')).toThrow(/polish-czytanie/)
  })

  it('reads the export of the old trainer as history', () => {
    const legacy = { wersja: 1, eksport: '2026-09-11T08:00:00', postep: { '07': { proby: [{ data: '2026-09-10T21:15:00', sekcja: 'utwor', tryb: 'czytam', tempo: 55, czas: 70, samoocena: 3 }] } }, streak: {}, ustawienia: {} }
    const parsed = parseBackup(JSON.stringify(legacy))
    expect(parsed).toEqual({ kind: 'legacy', attempts: [expect.objectContaining({ exercise: '07', day: '2026-09-10', kind: 'legacy', wpm: 55, seconds: 70 })] })
  })

  it('merge adds new attempts once and keeps the newer hard word', () => {
    const newer = { ...hard, box: 2 as const, updated: '2026-10-25T10:00:00Z' }
    const merged = mergeBackup(data, { attempts: [...data.attempts, at('2026-10-23', 'cold')], hard: [newer] })
    expect(merged.attempts).toHaveLength(2)
    expect(merged.hard[0].box).toBe(2)
    expect(mergeBackup(data, { attempts: [], hard: [{ ...hard, box: 3, updated: '2020-01-01' }] }).hard[0].box).toBe(0)
  })
})

describe('IndexedDB', () => {
  beforeEach(async () => {
    resetConnection()
    await clearAll()
  })

  it('stores attempts, hard words and settings, and replaces all in one go', async () => {
    await addAttempt(at('2026-10-22', 'cold', { wpm: 50 }))
    await putHard(addMistake(undefined, { exercise: '07', section: 'gama', unit: 0, word: 1, text: 'Kasia' }, '2026-10-22', 'n'))
    expect(await allAttempts()).toHaveLength(1)
    expect(await allHard()).toHaveLength(1)
    expect((await getSettings()).fontPx).toBe(24)
    await replaceAll({ attempts: [], hard: [], sessions: [], settings: { ...DEFAULT_SETTINGS, fontPx: 28 } })
    expect(await allAttempts()).toHaveLength(0)
    expect((await getSettings()).fontPx).toBe(28)
  })

  it('reports a full disk in Ukrainian', () => {
    const error = storageError(new DOMException('full', 'QuotaExceededError'))
    expect(error.quota).toBe(true)
    expect(error.message).toMatch(/^Недостатньо місця/)
  })
})
