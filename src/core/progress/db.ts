// IndexedDB: attempts, hard words, sessions and settings. Audio lives in Cache Storage, not here.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Attempt, HardItem, SessionRecord, Settings } from '../../contracts.ts'
import { DEFAULT_SETTINGS } from '../../contracts.ts'

const DB_NAME = 'polish-czytanie'
/** Raise with a new `upgrade` step; existing data is never cleared on an upgrade. */
const DB_VERSION = 1

interface Schema extends DBSchema {
  attempts: { key: number; value: Attempt; indexes: { exercise: string; day: string } }
  hard: { key: string; value: HardItem; indexes: { due: string } }
  sessions: { key: string; value: SessionRecord; indexes: { exercise: string } }
  settings: { key: string; value: unknown }
}

export class StorageError extends Error {
  constructor(message: string, readonly quota: boolean) {
    super(message)
  }
}

let database: Promise<IDBPDatabase<Schema>> | null = null

function db(): Promise<IDBPDatabase<Schema>> {
  database ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const attempts = d.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true })
        attempts.createIndex('exercise', 'exercise')
        attempts.createIndex('day', 'day')
        d.createObjectStore('hard', { keyPath: 'key' }).createIndex('due', 'due')
        d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('exercise', 'exercise')
        d.createObjectStore('settings')
      }
    },
    blocking() {
      // Another tab opened a newer version of the database: let it upgrade.
      void database?.then((d) => d.close())
      database = null
    },
  })
  return database
}

export function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const name = error instanceof DOMException || error instanceof Error ? error.name : ''
  if (name === 'QuotaExceededError') {
    return new StorageError('Недостатньо місця на пристрої: прогрес не збережено. Звільніть місце або видаліть завантажене аудіо в налаштуваннях.', true)
  }
  return new StorageError(`Не вдалося зберегти прогрес на пристрої${error instanceof Error && error.message ? `: ${error.message}` : ''}.`, false)
}

async function write<T>(action: (d: IDBPDatabase<Schema>) => Promise<T>): Promise<T> {
  try {
    return await action(await db())
  } catch (error) {
    throw storageError(error)
  }
}

export async function allAttempts(): Promise<Attempt[]> {
  return (await db()).getAll('attempts')
}

export function addAttempt(attempt: Attempt): Promise<number> {
  return write((d) => d.add('attempts', attempt))
}

export async function allHard(): Promise<HardItem[]> {
  return (await db()).getAll('hard')
}

export async function getHard(key: string): Promise<HardItem | undefined> {
  return (await db()).get('hard', key)
}

export function putHard(item: HardItem): Promise<void> {
  return write(async (d) => {
    await d.put('hard', item)
  })
}

export async function allSessions(): Promise<SessionRecord[]> {
  return (await db()).getAll('sessions')
}

export function putSession(session: SessionRecord): Promise<void> {
  return write(async (d) => {
    await d.put('sessions', session)
  })
}

export async function getSettings(): Promise<Settings> {
  const stored = (await (await db()).get('settings', 'settings')) as Partial<Settings> | undefined
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function putSettings(settings: Settings): Promise<void> {
  return write(async (d) => {
    await d.put('settings', settings, 'settings')
  })
}

/** Replaces everything in one transaction: either all of it is written or nothing changes. */
export function replaceAll(data: { attempts: Attempt[]; hard: HardItem[]; sessions: SessionRecord[]; settings: Settings }): Promise<void> {
  return write(async (d) => {
    const tx = d.transaction(['attempts', 'hard', 'sessions', 'settings'], 'readwrite')
    await Promise.all([tx.objectStore('attempts').clear(), tx.objectStore('hard').clear(), tx.objectStore('sessions').clear()])
    await Promise.all([
      ...data.attempts.map((a) => tx.objectStore('attempts').put(a)),
      ...data.hard.map((h) => tx.objectStore('hard').put(h)),
      ...data.sessions.map((s) => tx.objectStore('sessions').put(s)),
      tx.objectStore('settings').put(data.settings, 'settings'),
    ])
    await tx.done
  })
}

export function clearAll(): Promise<void> {
  return write(async (d) => {
    const tx = d.transaction(['attempts', 'hard', 'sessions', 'settings'], 'readwrite')
    await Promise.all([...(['attempts', 'hard', 'sessions', 'settings'] as const).map((s) => tx.objectStore(s).clear()), tx.done])
  })
}

/** Asks the browser not to clear the data under storage pressure (Safari may still refuse). */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // Not supported: the data stays, only without the guarantee.
  }
}

/** For tests: forget the open connection. */
export function resetConnection() {
  void database?.then((d) => d.close())
  database = null
}
