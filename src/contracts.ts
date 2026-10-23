// Shared types: the data built by scripts/data.ts, the progress in IndexedDB and the session steps.

export type Level = 1 | 2 | 3
export type SectionKey = 'gama' | 'pasaze' | 'utwor'
export const SECTIONS: SectionKey[] = ['gama', 'pasaze', 'utwor']
export const TARGET_WPM: Record<Level, 60 | 80 | 100> = { 1: 60, 2: 80, 3: 100 }

/** A highlighted grapheme: [start, end) in `Word.t` and the index of its group in `Exercise.focusGroups`. */
export type FocusSpan = [start: number, end: number, group: number]

export interface Word {
  /** The word without markup: "przedstawiciel". */
  t: string
  /** Seconds in the section's recording. */
  od: number
  do: number
  /** Gama and pasaże: the line of the md file; utwór: the unit. */
  line: number
  focus: FocusSpan[]
  /** The stressed syllable as [start, end) in `t`: marked in exercise 10, by the penultimate rule elsewhere. */
  stress: [number, number] | null
  /** Syllables, only where the author split the word (exercise 11). */
  syl: string[] | null
  /** [s, k) in `Section.text`. */
  s: number
  k: number
}

export interface Unit {
  text: string
  /** First and last index in `Section.words`. */
  words: [number, number]
  od: number
  do: number
}

export interface Section {
  /** Path relative to the base, with the content hash in the name; null when there is no recording. */
  audio: string | null
  bytes: number
  duration: number
  /** Exactly the text sent to speech synthesis: gama words joined by ", ", lines ended by "."; utwór as written. */
  text: string
  words: Word[]
  units: Unit[]
}

export interface QuizItem {
  /** Index in `sections.gama.words`. */
  word: number
  answer: string
  /** The answer and one or two other spellings, in display order. */
  options: string[]
  /** Label of the focus group the swap belongs to: "s/ś/sz". */
  pair: string
}

export interface Exercise {
  id: string
  slug: string
  title: string
  level: Level
  focus: string[]
  goal: string
  /** Paragraphs of «Uwaga». */
  rule: string[]
  minutes: number
  targetWpm: 60 | 80 | 100
  /** Labels of the highlight colours used by `Word.focus`. */
  focusGroups: string[]
  sections: Record<SectionKey, Section>
  quiz: QuizItem[]
  /** Why step 3 is skipped in this exercise; null when there are quiz items. */
  quizSkip: string | null
  /** Up to 4 indexes in `sections.gama.words` shown with the rule. */
  ruleExamples: number[]
}

export interface ContentFile {
  version: 1
  built: string
  textsMd5: string
  exercises: Exercise[]
}

// Progress (IndexedDB)

export type AttemptKind =
  | 'cold' | 'warmup' | 'tempo' | 'gama' | 'flash' | 'quiz' | 'hard' | 'shadow' | 'listen' | 'rating' | 'unseen' | 'legacy'

export interface Attempt {
  id?: number
  exercise: string
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  at: string
  kind: AttemptKind
  seconds: number
  wpm?: number
  correct?: number
  total?: number
  flashMs?: number
  rating?: 1 | 2 | 3
  pair?: string
}

export type NewAttempt = Omit<Attempt, 'id' | 'exercise' | 'day' | 'at'>

export interface HardItem {
  /** `${exercise}:${section}:${unit}:${word ?? '-'}` */
  key: string
  exercise: string
  section: SectionKey
  unit: number
  word: number | null
  text: string
  /** Index in the interval list 1 / 3 / 7 / 14 days. */
  box: 0 | 1 | 2 | 3
  due: string
  /** «Так» answers in a row on the 14-day interval. */
  streak14: number
  learned: boolean
  added: string
  updated: string
}

export interface SessionRecord {
  id: string
  exercise: string
  day: string
  started: string
  finished?: string
  stepsDone: number[]
}

export interface Settings {
  fontPx: number
  theme: 'system' | 'light' | 'dark'
  rate: number
  pacer: boolean
  recordSelf: boolean
  /** Pace of the pacer by level (FR-17); missing → target − 10. */
  pacerByLevel: Partial<Record<Level, { wpm: number; inRow: number }>>
}

export const DEFAULT_SETTINGS: Settings = { fontPx: 24, theme: 'system', rate: 1, pacer: false, recordSelf: false, pacerByLevel: {} }

export interface BackupFile {
  app: 'polish-czytanie'
  version: 1
  exportedAt: string
  attempts: Attempt[]
  hard: HardItem[]
  sessions: SessionRecord[]
  settings: Partial<Settings>
}

// Audio

export interface Player {
  load(section: Section): Promise<void>
  playRange(od: number, do_: number, opts?: { margin?: number; onWord?: (index: number) => void }): Promise<void>
  playSection(opts?: { from?: number; onWord?: (index: number) => void }): Promise<void>
  stop(): void
  rate: number
}

// Session

export interface StepProps {
  exercise: Exercise
  player: Player
  record(attempt: NewAttempt): Promise<void>
  addHard(section: SectionKey, unit: number, word: number | null): Promise<void>
  done(): void
}
