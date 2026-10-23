// Parts shared by the steps: keys, the recording of a section, buttons that play, «Запис себе», reading with a timer.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Section, SectionKey } from '../../contracts.ts'
import { AudioUnavailable, player } from '../../core/audio/player.ts'
import { countIn, SelfRecorder } from '../../core/audio/recorder.ts'

/**
 * Keys of a step or a screen. Names: `event.key` ("Space", "Enter", "1", "ArrowLeft", "?") or the physical key
 * ("KeyR", "KeyX" — the same on the Ukrainian and the Latin layout); with Shift "Shift+ArrowLeft", "Shift+Slash";
 * with Alt (Option) "Alt+Digit1". Space and Enter on a focused button or field keep their own meaning (the browser
 * clicks the button), so a key never acts twice.
 */
export function useKeys(map: Record<string, (() => void) | undefined | false>) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if ((event.key === ' ' || event.key === 'Enter') && (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')) return
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && (event.key.length === 1 || event.key.startsWith('Arrow'))) return
      if (document.querySelector('[data-testid="dialog"]')) return
      const base = event.key === ' ' ? 'Space' : event.key
      const names = event.altKey
        ? [`Alt+${event.code}`]
        : event.shiftKey
          ? [`Shift+${event.code}`, ...(base.startsWith('Arrow') ? [] : [base])]
          : [base, event.code]
      for (const name of names) {
        const action = ref.current[name]
        if (action) {
          event.preventDefault()
          action()
          return
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
}

/**
 * A button that plays something: pressed while it sounds («Грає…» and a moving bar), a tap then stops it.
 */
export function PlayButton({ playing, onPlay, onStop, children, hint, testId, primary = false, big = false }: {
  playing: boolean
  onPlay: () => void
  onStop: () => void
  children: ReactNode
  hint?: string
  testId?: string
  primary?: boolean
  big?: boolean
}) {
  return (
    <button
      type="button"
      className={`button play${primary ? ' primary' : ''}${big ? ' big' : ''}${playing ? ' playing' : ''}`}
      aria-pressed={playing}
      onClick={playing ? onStop : onPlay}
      data-testid={testId}
    >
      {playing && <span className="bars" aria-hidden="true"><i /><i /><i /></span>}
      {children}{playing && <span className="sr-only"> — грає, торкніться, щоб зупинити</span>}
      {hint && <kbd>{hint}</kbd>}
    </button>
  )
}

export const NO_AUDIO = 'Немає запису: аудіо цієї вправи ще не завантажено, а інтернету немає. Цей крок можна пропустити.'

/** The recording of one section: plays ranges and tells which word is sounding. */
export function useSectionAudio(section: Section) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('')
  useEffect(() => () => player().stop(), [])
  useEffect(() => {
    player().load(section).catch((e: unknown) => setError(e instanceof AudioUnavailable ? NO_AUDIO : 'Не вдалося завантажити запис.'))
  }, [section])

  const run = useCallback(async (action: () => Promise<void>, from = '') => {
    setError(null)
    setSource(from)
    try {
      await player().load(section)
      setPlaying(true)
      await action()
    } catch (e) {
      setError(e instanceof AudioUnavailable ? NO_AUDIO : 'Не вдалося відтворити запис.')
    } finally {
      setPlaying(false)
      setCurrent(-1)
    }
  }, [section])

  // `source` names the button that started the sound, so only that button shows «Грає…».
  const playWords = useCallback((first: number, last: number, source = '') => run(() =>
    player().playRange(section.words[first].od, section.words[last].do, { onWord: (i) => setCurrent(Math.max(first, Math.min(last, i))) }), source), [run, section])
  const playUnit = useCallback((u: number, source = '') => playWords(section.units[u].words[0], section.units[u].words[1], source), [playWords, section])
  const playAll = useCallback((from = 0) => run(() => player().playSection({ from, onWord: setCurrent })), [run])
  const playingFrom = (from: string) => playing && source === from

  return { playing, playingFrom, current, error, playWords, playUnit, playAll, stop: () => player().stop() }
}

/** What a tap on a word plays: in the gama the word, in pasaże its line, in utwór its sentence. */
export function tapRange(section: Section, kind: SectionKey, word: number): [number, number] {
  return kind === 'gama' ? [word, word] : section.units[section.words[word].line].words
}

/**
 * Help on touch (FR-20): a long press shows the stress of a word (and its syllables, where the author gave them);
 * a tap on a word shown this way plays it (its line, its sentence — `tapRange`), but only once the reader's own
 * attempt is done.
 */
export function useWordHelp(audio: { playWords: (first: number, last: number) => Promise<void> }, canPlay: boolean, section: Section, kind: SectionKey) {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set())
  const reveal = useCallback((i: number) => setRevealed((r) => (r.has(i) ? r : new Set(r).add(i))), [])
  const tap = (i: number) => {
    if (!canPlay || !revealed.has(i)) return false
    void audio.playWords(...tapRange(section, kind, i))
    return true
  }
  return { revealed, reveal, tap }
}

export type RecordPhase = 'idle' | 'asking' | 'countin' | 'recording'

/**
 * «Запис себе» (FR-19): «Запис» asks for the microphone once, counts in (three clicks and a silent beat), then
 * records until «Стоп» or «Перевір». The level of the microphone and the time are shown meanwhile. «Я» plays the
 * recording back; it is kept only in memory.
 */
export function useSelfRecording() {
  const recorder = useRef<SelfRecorder | null>(null)
  const abort = useRef<AbortController | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [phase, setPhase] = useState<RecordPhase>('idle')
  const [beat, setBeat] = useState(0)
  const [level, setLevel] = useState(0)
  const [since, setSince] = useState(0)
  const [now, setNow] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [denied, setDenied] = useState(!SelfRecorder.supported())
  const [mine, setMine] = useState(false)

  useEffect(() => () => {
    abort.current?.abort()
    audio.current?.pause()
    recorder.current?.release()
  }, [])
  // The level meter and the clock while recording.
  useEffect(() => {
    if (phase !== 'recording') return
    let frame = 0
    const tick = () => {
      // Rises at once, falls slowly: easy to follow, like a level meter on a recorder.
      const now = recorder.current?.level() ?? 0
      setLevel((l) => Math.max(now, l * 0.93))
      setNow(performance.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  /** Count-in, then recording; `onStart` runs on the silent beat (the flash step shows its phrase then). */
  const record = useCallback(async (onStart?: () => void) => {
    if (denied || phase !== 'idle') return
    audio.current?.pause()
    setMine(false)
    setUrl(null)
    abort.current = new AbortController()
    const signal = abort.current.signal
    setPhase('asking')
    try {
      recorder.current ??= new SelfRecorder()
      await recorder.current.open()
    } catch {
      setDenied(true)
      setPhase('idle')
      return
    }
    if (signal.aborted) return
    setBeat(0)
    setPhase('countin')
    if (!(await countIn(setBeat, signal))) return
    recorder.current.start()
    const t = performance.now()
    setSince(t)
    setNow(t)
    setPhase('recording')
    onStart?.()
  }, [denied, phase])

  /** Stops the recording (or the count-in); after it «Я» is ready. */
  const stop = useCallback(async () => {
    if (phase === 'asking' || phase === 'countin') {
      abort.current?.abort()
      setPhase('idle')
      return
    }
    if (phase !== 'recording' || !recorder.current) return
    setPhase('idle')
    setLevel(0)
    setUrl(await recorder.current.stop())
  }, [phase])

  /** Plays the reader's recording; `then` runs when it has finished (for «Я → Диктор»). */
  const playMine = useCallback((then?: () => void) => {
    if (!url) return
    player().stop()
    audio.current ??= new Audio()
    audio.current.src = url
    audio.current.onended = () => {
      setMine(false)
      then?.()
    }
    setMine(true)
    void audio.current.play().catch(() => setMine(false))
  }, [url])
  const stopMine = useCallback(() => {
    audio.current?.pause()
    setMine(false)
  }, [])

  return { phase, beat, level, seconds: phase === 'recording' ? Math.max(0, (now - since) / 1000) : 0, url, denied, mine, record, stop, playMine, stopMine }
}

export function useStopwatch() {
  const [started, setStarted] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (started === null) return
    const id = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(id)
  }, [started])
  return {
    running: started !== null,
    seconds: started === null ? 0 : Math.max(0, (now - started) / 1000),
    start: () => {
      const t = performance.now()
      setStarted(t)
      setNow(t)
    },
    stop: () => {
      const seconds = started === null ? 0 : (performance.now() - started) / 1000
      setStarted(null)
      return seconds
    },
  }
}

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
