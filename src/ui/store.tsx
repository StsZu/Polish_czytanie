// The app state: texts, progress in memory and in IndexedDB. Writes are queued: when one fails (a full disk),
// it stays in the queue and is written again by «Спробувати ще», so nothing done is lost.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Attempt, ContentFile, Exercise, HardItem, NewAttempt, SectionKey, SessionRecord, Settings } from '../contracts.ts'
import { DEFAULT_SETTINGS } from '../contracts.ts'
import { loadContent } from '../core/content/load.ts'
import * as db from '../core/progress/db.ts'
import { dayOf } from '../core/progress/days.ts'
import { masteryLevel } from '../core/progress/mastery.ts'
import { addMistake, answer, hardKey } from '../core/progress/srs.ts'

export interface Store {
  content: ContentFile
  exercise(id: string): Exercise | undefined
  attempts: Attempt[]
  hard: HardItem[]
  sessions: SessionRecord[]
  settings: Settings
  levels: Record<string, 0 | 1 | 2 | 3>
  saveError: string | null
  retrySave(): void
  record(exercise: string, attempt: NewAttempt): Promise<void>
  addHard(exercise: string, section: SectionKey, unit: number, word: number | null): Promise<void>
  answerHard(item: HardItem, correct: boolean): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<void>
  saveSession(session: SessionRecord): Promise<void>
  /** Re-reads everything from IndexedDB (after a restore from a copy). */
  reload(): Promise<void>
  /** Writes what is still queued; used before an update reloads the page. */
  flush(): Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}

export function hardText(e: Exercise, section: SectionKey, unit: number, word: number | null): string {
  const s = e.sections[section]
  return word === null ? s.units[unit].text : s.words[word].t
}

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: (error: string | null) => ReactNode }) {
  const [content, setContent] = useState<ContentFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [hard, setHard] = useState<HardItem[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saveError, setSaveError] = useState<string | null>(null)
  const queue = useRef<(() => Promise<unknown>)[]>([])
  const running = useRef<Promise<void> | null>(null)

  const load = useCallback(async () => {
    const [a, h, s, st] = await Promise.all([db.allAttempts(), db.allHard(), db.allSessions(), db.getSettings()])
    setAttempts(a)
    setHard(h)
    setSessions(s)
    setSettings(st)
  }, [])

  useEffect(() => {
    Promise.all([loadContent(), load()]).then(([c]) => setContent(c), (e: Error) => setError(e.message))
    void db.requestPersistence()
  }, [load])

  const drain = useCallback((): Promise<void> => {
    running.current ??= (async () => {
      while (queue.current.length) {
        try {
          await queue.current[0]()
          queue.current.shift()
        } catch (e) {
          setSaveError(db.storageError(e).message)
          break
        }
      }
      if (!queue.current.length) setSaveError(null)
      running.current = null
    })()
    return running.current
  }, [])

  const enqueue = useCallback((write: () => Promise<unknown>) => {
    queue.current.push(write)
    return drain()
  }, [drain])

  const record = useCallback((exercise: string, a: NewAttempt) => {
    const now = new Date()
    const attempt: Attempt = { ...a, exercise, day: dayOf(now), at: now.toISOString() }
    setAttempts((list) => [...list, attempt])
    return enqueue(async () => {
      if (attempt.id === undefined) attempt.id = await db.addAttempt({ ...attempt })
    })
  }, [enqueue])

  const hardRef = useRef(hard)
  hardRef.current = hard
  const contentRef = useRef(content)
  contentRef.current = content

  const putHard = useCallback((item: HardItem) => {
    setHard((list) => [...list.filter((h) => h.key !== item.key), item])
    return enqueue(() => db.putHard(item))
  }, [enqueue])

  const addHard = useCallback((exercise: string, section: SectionKey, unit: number, word: number | null) => {
    const e = contentRef.current?.exercises.find((x) => x.id === exercise)
    if (!e) return Promise.resolve()
    const existing = hardRef.current.find((h) => h.key === hardKey(exercise, section, unit, word))
    return putHard(addMistake(existing, { exercise, section, unit, word, text: hardText(e, section, unit, word) }, dayOf(), new Date().toISOString()))
  }, [putHard])

  const answerHard = useCallback((item: HardItem, correct: boolean) => putHard(answer(item, correct, dayOf(), new Date().toISOString())), [putHard])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    return enqueue(() => db.putSettings(next))
  }, [enqueue])

  const saveSession = useCallback((session: SessionRecord) => {
    setSessions((list) => [...list.filter((s) => s.id !== session.id), session])
    return enqueue(() => db.putSession(session))
  }, [enqueue])

  const levels = useMemo(() => {
    const out: Record<string, 0 | 1 | 2 | 3> = {}
    for (const e of content?.exercises ?? []) out[e.id] = masteryLevel(attempts, e.id, e.targetWpm)
    return out
  }, [attempts, content])

  const value = useMemo<Store | null>(() => content && {
    content,
    exercise: (id: string) => content.exercises.find((e) => e.id === id),
    attempts,
    hard,
    sessions,
    settings,
    levels,
    saveError,
    retrySave: () => void drain(),
    record,
    addHard,
    answerHard,
    updateSettings,
    saveSession,
    reload: load,
    flush: drain,
  }, [content, attempts, hard, sessions, settings, levels, saveError, drain, record, addHard, answerHard, updateSettings, saveSession, load])

  if (!value) return <>{fallback(error)}</>
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
