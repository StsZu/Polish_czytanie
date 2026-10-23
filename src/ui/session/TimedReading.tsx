// Reading the utwór aloud on time: the text is hidden until «Почати», then a stopwatch runs until «Готово».
import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../../contracts.ts'
import { pacerWord } from '../../core/flash.ts'
import { ReadingText } from '../text/ReadingText.tsx'
import { formatTime, useKeys, useStopwatch } from './common.tsx'

export function TimedReading({ exercise, pacerWpm = null, marked, revealed, onTap, onLongPress, onFinish, startLabel = 'Почати', actions }: {
  exercise: Exercise
  /** The pacer highlights words at this pace; null — no pacer. */
  pacerWpm?: number | null
  marked?: ReadonlySet<number>
  revealed?: ReadonlySet<number>
  onTap?: (word: number) => void
  onLongPress?: (word: number) => void
  onFinish: (seconds: number) => void
  startLabel?: string
  /** More buttons next to «Готово» while reading. */
  actions?: React.ReactNode
}) {
  const watch = useStopwatch()
  const [pace, setPace] = useState(-1)
  const frame = useRef(0)
  const started = useRef(0)
  const section = exercise.sections.utwor

  useEffect(() => {
    if (!watch.running || !pacerWpm) return
    started.current = performance.now()
    const tick = () => {
      setPace(Math.min(section.words.length - 1, pacerWord((performance.now() - started.current) / 1000, pacerWpm)))
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [watch.running, pacerWpm, section.words.length])

  const start = () => watch.start()
  const finish = () => {
    const seconds = watch.stop()
    setPace(-1)
    onFinish(seconds)
  }
  useKeys({ Space: watch.running ? finish : start })

  return (
    <div className="timed">
      <div className="step-actions sticky">
        {watch.running
          ? <button type="button" className="button primary big" onClick={finish} data-testid="finish">Готово <kbd>пробіл</kbd></button>
          : <button type="button" className="button primary big" onClick={start} data-testid="start">{startLabel} <kbd>пробіл</kbd></button>}
        {watch.running && actions}
        <span className="timer" aria-live="off" data-testid="timer">{formatTime(watch.seconds)}</span>
        <span className="meta">{section.words.length} слів · ціль {exercise.targetWpm} сл/хв{pacerWpm ? ` · ведучий ${pacerWpm} сл/хв` : ''}</span>
      </div>
      {watch.running
        ? <ReadingText section={section} kind="utwor" pacer={pace} marked={marked} revealed={revealed} onTap={onTap} onLongPress={onLongPress} />
        : <div className="hidden-text" data-testid="hiddenText">Текст з'явиться після «{startLabel}». Читайте вголос, у звичному темпі, не зупиняючись на помилках.</div>}
    </div>
  )
}
