import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Word } from '../../src/contracts.ts'
import { flashStart, nextFlash, nextPacer, pacerStart, pacerWord } from '../../src/core/flash.ts'
import { AudioPlayer, MARGIN, rangeFor, wordAt } from '../../src/core/audio/player.ts'

const word = (od: number, d: number): Word => ({ t: 'x', od, do: d, line: 0, focus: [], stress: null, syl: null, s: 0, k: 1 })

describe('ranges and words', () => {
  it('a fragment sounds from od − 0.08 s to do + 0.08 s, inside the recording (SC-03)', () => {
    expect(rangeFor(0.755, 1.3, 36)).toEqual([0.755 - MARGIN, 1.3 + MARGIN])
    expect(rangeFor(0.02, 0.5, 36)).toEqual([0, 0.58])
    expect(rangeFor(35.9, 35.99, 36)).toEqual([35.82, 36])
  })

  it('finds the word that is sounding', () => {
    const words = [word(0, 0.6), word(0.75, 1.3), word(1.4, 2)]
    expect(wordAt(words, -0.1)).toBe(-1)
    expect(wordAt(words, 0.1)).toBe(0)
    expect(wordAt(words, 0.7)).toBe(0)
    expect(wordAt(words, 0.8)).toBe(1)
    expect(wordAt(words, 9)).toBe(2)
  })
})

/** A fake <audio> whose clock advances with the fake timers. */
class FakeAudio {
  currentTime = 0
  duration = 36
  paused = true
  playbackRate = 1
  src = ''
  preservesPitch = false
  private startedAt = 0
  private startedTime = 0
  private listeners: Record<string, (() => void)[]> = {}
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn) }
  removeEventListener(type: string, fn: () => void) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn) }
  play() {
    this.paused = false
    this.startedAt = Date.now()
    this.startedTime = this.currentTime
    return Promise.resolve()
  }
  pause() {
    this.sync()
    this.paused = true
  }
  sync() {
    if (!this.paused) this.currentTime = this.startedTime + ((Date.now() - this.startedAt) / 1000) * this.playbackRate
  }
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(Date.now()), 16) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stops within 0.05 s after the end of the range and reports the words', async () => {
    const audio = new FakeAudio()
    const p = new AudioPlayer(new Proxy(audio, { get: (t, k) => (k === 'currentTime' ? (t.sync(), t.currentTime) : Reflect.get(t, k)) }) as never)
    ;(p as unknown as { words: Word[]; duration: number }).words = [word(0, 0.6), word(0.75, 1.3), word(1.4, 2)]
    ;(p as unknown as { duration: number }).duration = 36
    const seen: number[] = []
    const done = p.playRange(0.75, 1.3, { onWord: (i) => seen.push(i) })
    await vi.advanceTimersByTimeAsync(2000)
    await done
    expect(audio.paused).toBe(true)
    expect(audio.currentTime).toBeGreaterThanOrEqual(1.3 + MARGIN - 0.001)
    expect(audio.currentTime).toBeLessThanOrEqual(1.3 + MARGIN + 0.05)
    expect(seen[0]).toBe(0)
    expect(seen).toContain(1)
    expect(p.plays).toBe(1)
  })

  it('respects the speed: at 0.7× the same range lasts longer, and stop() ends it at once', async () => {
    const audio = new FakeAudio()
    const p = new AudioPlayer(new Proxy(audio, { get: (t, k) => (k === 'currentTime' ? (t.sync(), t.currentTime) : Reflect.get(t, k)) }) as never)
    ;(p as unknown as { duration: number }).duration = 36
    p.rate = 0.7
    expect(p.rate).toBe(0.7)
    p.rate = 3
    expect(p.rate).toBe(1.2)
    p.rate = 0.7
    let finished = false
    void p.playRange(1, 2).then(() => { finished = true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(finished).toBe(false)
    p.stop()
    await vi.advanceTimersByTimeAsync(0)
    expect(finished).toBe(true)
    expect(audio.paused).toBe(true)
  })
})

describe('flash and pacer', () => {
  it('phrase time: 2.0 / 1.5 / 1.2 s, two «Так» → −20 %, «Ні» → +20 %, not under 0.5 s', () => {
    expect(flashStart(1).ms).toBe(2000)
    expect(flashStart(3).ms).toBe(1200)
    let s = flashStart(1)
    s = nextFlash(s, true)
    expect(s.ms).toBe(2000)
    s = nextFlash(s, true)
    expect(s.ms).toBe(1600)
    s = nextFlash(s, false)
    expect(s.ms).toBe(1920)
    let fast = { ms: 520, inRow: 1 }
    fast = nextFlash(fast, true)
    expect(fast.ms).toBe(500)
  })

  it('pacer: target − 10, three readings that kept up → +10 %', () => {
    let p = pacerStart(60)
    expect(p.wpm).toBe(50)
    p = nextPacer(p, 52)
    p = nextPacer(p, 50)
    expect(p.wpm).toBe(50)
    p = nextPacer(p, 55)
    expect(p.wpm).toBe(55)
    p = nextPacer(nextPacer(p, 40), 60)
    expect(p).toEqual({ wpm: 55, inRow: 1 })
    expect(pacerWord(0, 60)).toBe(-1)
    expect(pacerWord(1.5, 60)).toBe(1)
    expect(pacerWord(60, 100)).toBe(100)
  })
})
