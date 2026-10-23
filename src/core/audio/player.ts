// One audio element for the whole app. The recording is played from a Blob URL: Safari cannot seek in
// <audio> when the service worker answers a Range request with the whole file, and a Blob URL avoids it.
import type { Player, Section, Word } from '../../contracts.ts'
import { audioResponse } from './cache.ts'

export const MARGIN = 0.08
/** Below this many seconds before the end, a timer stops the sound instead of the next frame. */
const TIMER_WINDOW = 0.25

export class AudioUnavailable extends Error {
  constructor() {
    super('Немає запису: аудіо ще не завантажено, а інтернету немає.')
  }
}

/** The played range of a word or a unit: a margin on both sides, inside the recording. */
export function rangeFor(od: number, do_: number, duration: number, margin = MARGIN): [number, number] {
  return [Math.max(0, od - margin), Math.min(duration || Number.POSITIVE_INFINITY, do_ + margin)]
}

/** Index of the word sounding at time `t` (the last word that has started), -1 before the first. */
export function wordAt(words: Word[], t: number): number {
  let lo = 0
  let hi = words.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].od <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}

type AudioLike = Pick<HTMLAudioElement, 'currentTime' | 'duration' | 'paused' | 'play' | 'pause' | 'addEventListener' | 'removeEventListener' | 'src' | 'playbackRate'> & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }

export class AudioPlayer implements Player {
  private audio: AudioLike
  private url: string | null = null
  private path: string | null = null
  private words: Word[] = []
  private duration = 0
  private finish: (() => void) | null = null
  private frame = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private rateValue = 1
  /** Number of `play()` calls, for the tests of «no sound before the reader's own attempt». */
  plays = 0

  constructor(audio?: AudioLike) {
    this.audio = audio ?? new Audio()
    this.audio.preservesPitch = true
    this.audio.webkitPreservesPitch = true
  }

  get rate() {
    return this.rateValue
  }

  set rate(value: number) {
    this.rateValue = Math.min(1.2, Math.max(0.6, value))
    this.audio.playbackRate = this.rateValue
  }

  get loaded() {
    return this.path
  }

  /** Whether a range or a section is sounding now. */
  get playing() {
    return this.finish !== null
  }

  async load(section: Section): Promise<void> {
    if (!section.audio) throw new AudioUnavailable()
    this.words = section.words
    this.duration = section.duration
    if (this.path === section.audio) return
    this.stop()
    const response = await audioResponse(section.audio)
    if (!response) throw new AudioUnavailable()
    const blob = await response.blob()
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(new Blob([blob], { type: 'audio/mpeg' }))
    this.path = section.audio
    this.audio.src = this.url
  }

  playRange(od: number, do_: number, opts: { margin?: number; onWord?: (index: number) => void } = {}): Promise<void> {
    const [start, end] = rangeFor(od, do_, this.duration, opts.margin)
    return this.run(start, end, opts.onWord)
  }

  playSection(opts: { from?: number; onWord?: (index: number) => void } = {}): Promise<void> {
    return this.run(opts.from ?? 0, this.duration || Number.POSITIVE_INFINITY, opts.onWord)
  }

  stop() {
    cancelAnimationFrame(this.frame)
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.audio.paused) this.audio.pause()
    const finish = this.finish
    this.finish = null
    finish?.()
  }

  private run(start: number, end: number, onWord?: (index: number) => void): Promise<void> {
    this.stop()
    return new Promise<void>((resolve, reject) => {
      const audio = this.audio
      let lastWord = -2
      const done = () => {
        audio.removeEventListener('ended', ended)
        resolve()
      }
      const ended = () => this.stop()
      this.finish = done
      audio.addEventListener('ended', ended)
      audio.playbackRate = this.rateValue
      audio.currentTime = start
      const tick = () => {
        if (this.finish !== done) return
        const t = audio.currentTime
        if (onWord) {
          const w = wordAt(this.words, t)
          if (w !== lastWord) {
            lastWord = w
            onWord(w)
          }
        }
        const left = (end - t) / this.rateValue
        if (left <= 0) return this.stop()
        if (left <= TIMER_WINDOW && !this.timer) {
          this.timer = setTimeout(() => {
            if (this.finish !== done) return
            // The timer runs on the page clock; if the sound stalled (decoding, a busy device), it is not at the end yet.
            if (audio.currentTime >= end - 0.005) this.stop()
            else this.timer = null
          }, left * 1000)
        }
        this.frame = requestAnimationFrame(tick)
      }
      this.plays++
      audio.play().then(() => {
        this.frame = requestAnimationFrame(tick)
      }, (error: unknown) => {
        this.finish = null
        audio.removeEventListener('ended', ended)
        reject(error)
      })
    })
  }
}

let shared: AudioPlayer | null = null

export function player(): AudioPlayer {
  shared ??= new AudioPlayer()
  return shared
}
