// The JSON copy of the progress (FR-41) and the export of the old czytanie/ trainer (FR-42).
import type { Attempt, AttemptKind, BackupFile, HardItem, SessionRecord, Settings } from '../../contracts.ts'
import { DEFAULT_SETTINGS } from '../../contracts.ts'
import { dayOf, isDay } from './days.ts'

export class BackupError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'))
  }
}

export function createBackup(data: { attempts: Attempt[]; hard: HardItem[]; sessions: SessionRecord[]; settings: Settings }, now = new Date()): BackupFile {
  return { app: 'polish-czytanie', version: 1, exportedAt: now.toISOString(), ...data }
}

const KINDS: AttemptKind[] = ['cold', 'warmup', 'tempo', 'gama', 'flash', 'quiz', 'hard', 'shadow', 'listen', 'rating', 'unseen', 'legacy']
const EXERCISE = /^\d\d$|^n\d\d$/
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optionalNumber = (v: unknown) => v === undefined || isNumber(v)

function checkAttempt(a: unknown, where: string, problems: string[]): a is Attempt {
  if (!isObject(a)) {
    problems.push(`${where}: має бути об'єкт.`)
    return false
  }
  const before = problems.length
  if (typeof a.exercise !== 'string' || !EXERCISE.test(a.exercise)) problems.push(`${where}: поле «exercise» має бути номером вправи на кшталт «07».`)
  if (!isDay(a.day)) problems.push(`${where}: поле «day» має бути датою РРРР-ММ-ДД.`)
  if (typeof a.at !== 'string' || Number.isNaN(Date.parse(a.at))) problems.push(`${where}: поле «at» має бути датою й часом.`)
  if (!KINDS.includes(a.kind as AttemptKind)) problems.push(`${where}: невідомий вид спроби «${String(a.kind)}».`)
  if (!isNumber(a.seconds) || a.seconds < 0) problems.push(`${where}: поле «seconds» має бути невід'ємним числом.`)
  for (const f of ['wpm', 'correct', 'total', 'flashMs', 'id']) if (!optionalNumber(a[f])) problems.push(`${where}: поле «${f}» має бути числом.`)
  if (a.rating !== undefined && ![1, 2, 3].includes(a.rating as number)) problems.push(`${where}: поле «rating» має бути 1, 2 або 3.`)
  return problems.length === before
}

function checkHard(h: unknown, where: string, problems: string[]): h is HardItem {
  if (!isObject(h)) {
    problems.push(`${where}: має бути об'єкт.`)
    return false
  }
  const before = problems.length
  if (typeof h.key !== 'string' || !h.key) problems.push(`${where}: немає поля «key».`)
  if (typeof h.exercise !== 'string' || !EXERCISE.test(h.exercise)) problems.push(`${where}: поле «exercise» має бути номером вправи.`)
  if (!['gama', 'pasaze', 'utwor'].includes(h.section as string)) problems.push(`${where}: поле «section» має бути gama, pasaze або utwor.`)
  if (!Number.isInteger(h.unit)) problems.push(`${where}: поле «unit» має бути цілим числом.`)
  if (h.word !== null && !Number.isInteger(h.word)) problems.push(`${where}: поле «word» має бути цілим числом або null.`)
  if (typeof h.text !== 'string') problems.push(`${where}: поле «text» має бути рядком.`)
  if (![0, 1, 2, 3].includes(h.box as number)) problems.push(`${where}: поле «box» має бути 0–3.`)
  if (!isDay(h.due)) problems.push(`${where}: поле «due» має бути датою РРРР-ММ-ДД.`)
  if (!Number.isInteger(h.streak14)) problems.push(`${where}: поле «streak14» має бути цілим числом.`)
  if (typeof h.learned !== 'boolean') problems.push(`${where}: поле «learned» має бути true або false.`)
  return problems.length === before
}

function checkSettings(s: unknown, problems: string[]): Partial<Settings> {
  if (s === undefined) return {}
  if (!isObject(s)) {
    problems.push('Поле «settings» має бути об\'єктом.')
    return {}
  }
  const out: Partial<Settings> = {}
  if (s.fontPx !== undefined) isNumber(s.fontPx) && s.fontPx >= 22 && s.fontPx <= 30 ? (out.fontPx = s.fontPx) : problems.push('Налаштування «fontPx» має бути 22–30.')
  if (s.theme !== undefined) ['system', 'light', 'dark'].includes(s.theme as string) ? (out.theme = s.theme as Settings['theme']) : problems.push('Налаштування «theme» має бути system, light або dark.')
  if (s.rate !== undefined) isNumber(s.rate) && s.rate >= 0.5 && s.rate <= 1.5 ? (out.rate = s.rate) : problems.push('Налаштування «rate» має бути 0,5–1,5.')
  for (const f of ['pacer', 'recordSelf'] as const) if (s[f] !== undefined) typeof s[f] === 'boolean' ? (out[f] = s[f] as boolean) : problems.push(`Налаштування «${f}» має бути true або false.`)
  if (s.voice !== undefined) typeof s.voice === 'string' && /^[a-z]{1,20}$/.test(s.voice) ? (out.voice = s.voice) : problems.push('Налаштування «voice» має бути назвою голосу (латиницею).')
  if (s.pacerByLevel !== undefined) {
    const ok = isObject(s.pacerByLevel) && Object.entries(s.pacerByLevel).every(([k, v]) => ['1', '2', '3'].includes(k) && isObject(v) && isNumber(v.wpm) && isNumber(v.inRow))
    if (ok) out.pacerByLevel = s.pacerByLevel as Settings['pacerByLevel']
    else problems.push('Налаштування «pacerByLevel» має бути {рівень: {wpm, inRow}}.')
  }
  return out
}

export type ParsedBackup =
  | { kind: 'backup'; data: BackupFile }
  | { kind: 'legacy'; attempts: Attempt[] }

/** Reads a copy file; every problem of the structure is listed, and nothing is returned until there are none. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError(['Це не JSON: файл пошкоджений або це інший файл.'])
  }
  if (!isObject(json)) throw new BackupError(['Файл має містити об\'єкт JSON.'])
  if (json.wersja === 1 || json.czytanie === 1) return { kind: 'legacy', attempts: parseLegacy(json) }
  const problems: string[] = []
  if (json.app !== 'polish-czytanie') problems.push('Це не копія Czytanie: поле «app» має бути «polish-czytanie».')
  if (json.version !== 1) problems.push(`Невідома версія копії: ${String(json.version)}. Оновіть програму.`)
  if (!Array.isArray(json.attempts)) problems.push('Поле «attempts» має бути списком.')
  if (!Array.isArray(json.hard)) problems.push('Поле «hard» має бути списком.')
  if (json.sessions !== undefined && !Array.isArray(json.sessions)) problems.push('Поле «sessions» має бути списком.')
  if (problems.length) throw new BackupError(problems)
  const attempts = (json.attempts as unknown[]).filter((a, i) => checkAttempt(a, `Спроба ${i + 1}`, problems)) as Attempt[]
  const hard = (json.hard as unknown[]).filter((h, i) => checkHard(h, `Важке слово ${i + 1}`, problems)) as HardItem[]
  const sessions = ((json.sessions as unknown[] | undefined) ?? []).filter((s, i) => {
    const ok = isObject(s) && typeof s.id === 'string' && typeof s.exercise === 'string' && isDay(s.day) && Array.isArray(s.stepsDone)
    if (!ok) problems.push(`Сесія ${i + 1}: потрібні поля «id», «exercise», «day», «stepsDone».`)
    return ok
  }) as SessionRecord[]
  const settings = checkSettings(json.settings, problems)
  if (problems.length) throw new BackupError(problems)
  return { kind: 'backup', data: { app: 'polish-czytanie', version: 1, exportedAt: String(json.exportedAt ?? ''), attempts, hard, sessions, settings } }
}

/** The export of the old trainer: `{ wersja: 1, eksport, postep: { NN: { proby: [...] } }, streak, ustawienia }`. */
function parseLegacy(json: Record<string, unknown>): Attempt[] {
  if (!isObject(json.postep)) throw new BackupError(['У файлі старого тренажера немає поля «postep».'])
  const out: Attempt[] = []
  for (const [exercise, entry] of Object.entries(json.postep)) {
    if (!/^\d\d$/.test(exercise) || !isObject(entry) || !Array.isArray(entry.proby)) continue
    for (const p of entry.proby) {
      if (!isObject(p) || typeof p.data !== 'string') continue
      const date = new Date(p.data.endsWith('Z') ? p.data : p.data.replace(' ', 'T'))
      if (Number.isNaN(date.getTime())) continue
      out.push({
        exercise,
        day: dayOf(date),
        at: date.toISOString(),
        kind: 'legacy',
        seconds: isNumber(p.czas) ? p.czas : 0,
        ...(isNumber(p.tempo) ? { wpm: p.tempo } : {}),
      })
    }
  }
  return out
}

const attemptKey = (a: Attempt) => `${a.exercise}|${a.at}|${a.kind}`

/** Adds what is not on the device yet; a hard word in both keeps the version changed last. */
export function mergeBackup(
  device: { attempts: Attempt[]; hard: HardItem[]; sessions: SessionRecord[]; settings: Settings },
  file: { attempts: Attempt[]; hard?: HardItem[]; sessions?: SessionRecord[] },
) {
  const seen = new Set(device.attempts.map(attemptKey))
  const attempts = [...device.attempts, ...file.attempts.filter((a) => !seen.has(attemptKey(a))).map(({ id: _id, ...a }) => a)]
  const hard = new Map(device.hard.map((h) => [h.key, h]))
  for (const h of file.hard ?? []) {
    const mine = hard.get(h.key)
    if (!mine || (h.updated ?? '') > (mine.updated ?? '')) hard.set(h.key, h)
  }
  const sessions = new Map(device.sessions.map((s) => [s.id, s]))
  for (const s of file.sessions ?? []) if (!sessions.has(s.id)) sessions.set(s.id, s)
  return { attempts, hard: [...hard.values()], sessions: [...sessions.values()], settings: device.settings }
}

export function replaceWith(file: BackupFile) {
  return { attempts: file.attempts, hard: file.hard, sessions: file.sessions, settings: { ...DEFAULT_SETTINGS, ...file.settings } }
}
