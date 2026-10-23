// Parts shared by the steps: keys, the recording of a section, «Запис себе», reading with a timer.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Section } from '../../contracts.ts'
import { AudioUnavailable, player } from '../../core/audio/player.ts'
import { SelfRecorder } from '../../core/audio/recorder.ts'

/**
 * Keys of a step. Space and Enter on a focused button or field keep their own meaning (the browser clicks the
 * button), so a key never acts twice.
 */
export function useKeys(map: Record<string, (() => void) | undefined | false>) {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if ((event.key === ' ' || event.key === 'Enter') && (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA')) return
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && event.key.length === 1) return
      if (document.querySelector('[data-testid="dialog"]')) return
      const name = event.key === ' ' ? 'Space' : event.key
      const action = ref.current[name]
      if (action) {
        event.preventDefault()
        action()
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
}

export const NO_AUDIO = 'Немає запису: аудіо цієї вправи ще не завантажено, а інтернету немає. Цей крок можна пропустити.'

/** The recording of one section: plays ranges and tells which word is sounding. */
export function useSectionAudio(section: Section) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => () => player().stop(), [])
  useEffect(() => {
    player().load(section).catch((e: unknown) => setError(e instanceof AudioUnavailable ? NO_AUDIO : 'Не вдалося завантажити запис.'))
  }, [section])

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null)
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

  const playWords = useCallback((first: number, last: number) => run(() =>
    player().playRange(section.words[first].od, section.words[last].do, { onWord: (i) => setCurrent(Math.max(first, Math.min(last, i))) })), [run, section])
  const playUnit = useCallback((u: number) => playWords(section.units[u].words[0], section.units[u].words[1]), [playWords, section])
  const playAll = useCallback((from = 0) => run(() => player().playSection({ from, onWord: setCurrent })), [run])

  return { playing, current, error, playWords, playUnit, playAll, stop: () => player().stop() }
}

/**
 * Help on touch (FR-20): a long press shows the stress of a word (and its syllables, where the author gave them);
 * a tap on a word shown this way plays it, but only once the reader's own attempt is done.
 */
export function useWordHelp(audio: { playWords: (first: number, last: number) => Promise<void> }, canPlay: boolean) {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set())
  const reveal = useCallback((i: number) => setRevealed((r) => (r.has(i) ? r : new Set(r).add(i))), [])
  const tap = (i: number) => {
    if (!canPlay || !revealed.has(i)) return false
    void audio.playWords(i, i)
    return true
  }
  return { revealed, reveal, tap }
}

/** «Запис себе»: records while the reader reads, then «Я» plays it back. Only in memory. */
export function useSelfRecording(enabled: boolean) {
  const recorder = useRef<SelfRecorder | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const active = enabled && SelfRecorder.supported() && !denied

  useEffect(() => () => recorder.current?.release(), [])

  const start = useCallback(async () => {
    setUrl(null)
    if (!active) return
    try {
      recorder.current ??= new SelfRecorder()
      await recorder.current.start()
    } catch {
      setDenied(true)
    }
  }, [active])

  const stop = useCallback(async () => {
    if (!recorder.current) return
    setUrl(await recorder.current.stop())
  }, [])

  const playMine = useCallback(() => {
    if (!url) return
    audio.current ??= new Audio()
    audio.current.src = url
    void audio.current.play().catch(() => {})
  }, [url])

  return { active, denied, url, start, stop, playMine }
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
