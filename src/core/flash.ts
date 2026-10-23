// Step 4: how long a phrase stays on the screen (FR-15), and the pacer of step 6 (FR-17).
import type { Level } from '../contracts.ts'

export const FLASH_START: Record<Level, number> = { 1: 2000, 2: 1500, 3: 1200 }
export const FLASH_MIN = 500
export const FLASH_MAX = 4000

export interface FlashState { ms: number; inRow: number }

export const flashStart = (level: Level): FlashState => ({ ms: FLASH_START[level], inRow: 0 })

/** Two «Так» in a row → 20 % shorter (not under 0.5 s); «Ні» → 20 % longer. */
export function nextFlash(state: FlashState, correct: boolean): FlashState {
  if (!correct) return { ms: Math.min(FLASH_MAX, Math.round(state.ms * 1.2)), inRow: 0 }
  const inRow = state.inRow + 1
  return inRow >= 2 ? { ms: Math.max(FLASH_MIN, Math.round(state.ms * 0.8)), inRow: 0 } : { ms: state.ms, inRow }
}

export interface PacerState { wpm: number; inRow: number }

/** The pacer starts 10 words a minute under the target. */
export const pacerStart = (target: number): PacerState => ({ wpm: target - 10, inRow: 0 })

/** Three readings in a row that kept up with the pacer → 10 % faster. */
export function nextPacer(state: PacerState, readerWpm: number): PacerState {
  if (readerWpm < state.wpm) return { wpm: state.wpm, inRow: 0 }
  const inRow = state.inRow + 1
  return inRow >= 3 ? { wpm: Math.round(state.wpm * 1.1), inRow: 0 } : { wpm: state.wpm, inRow }
}

/** Index of the word the pacer is on after `seconds`, -1 before the first. */
export const pacerWord = (seconds: number, wpm: number) => (seconds <= 0 ? -1 : Math.floor((seconds * wpm) / 60))
