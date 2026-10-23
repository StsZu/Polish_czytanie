// Step 0, the tempo check: the utwór read cold on a later day, before any practice of that day (FR-11).
// Its pace is the honest measure: whether the skill stayed overnight.
import { useState } from 'react'
import { readingPace } from '../../core/progress/attempts.ts'
import { TimedReading } from './TimedReading.tsx'
import { useKeys } from './common.tsx'
import type { SessionStepProps } from './Session.tsx'

export function PaceResult({ wpm, target, label }: { wpm: number | null; target: number; label: string }) {
  if (wpm === null) return <p className="notice" data-testid="paceResult">Спроба не зарахована: вона коротша за 5 с або швидша за 300 слів за хвилину.</p>
  const ok = wpm >= target
  return (
    <p className={`result ${ok ? 'good' : ''}`} data-testid="paceResult">
      {label}: <strong>{wpm} сл/хв</strong> · ціль {target} сл/хв{ok ? ' — ціль досягнуто.' : ` — ще ${target - wpm} сл/хв до цілі.`}
    </p>
  )
}

export function StepCold({ exercise, record, done, coldToday }: SessionStepProps) {
  const [result, setResult] = useState<{ wpm: number | null } | null>(null)
  const words = exercise.sections.utwor.words.length
  useKeys({ Enter: result ? done : undefined })

  const finish = (seconds: number) => {
    const wpm = readingPace(words, seconds)
    setResult({ wpm })
    if (wpm !== null) void record({ kind: coldToday ? 'cold' : 'warmup', seconds, wpm })
  }

  return (
    <div className="step" data-testid="stepCold">
      <p className="lead">
        {coldToday
          ? 'Ви вже тренували цей твір раніше. Прочитайте його вголос без підготовки, до будь-якого тренування сьогодні: за цим темпом видно, чи навичка лишилася з учора.'
          : 'Це розминка: вправу сьогодні вже читали чи слухали або ще не тренували в інші дні. Темп піде в історію, але не як перевірка.'}
        {!coldToday && <span className="chip" data-testid="warmup">розминка</span>}
      </p>
      {result
        ? (
          <>
            <PaceResult wpm={result.wpm} target={exercise.targetWpm} label={coldToday ? 'Темп перевірки' : 'Темп розминки'} />
            <div className="step-actions">
              <button type="button" className="button primary big" onClick={done} data-testid="next">Далі <kbd>Enter</kbd></button>
              <button type="button" className="button" onClick={() => setResult(null)} data-testid="again">Ще раз</button>
            </div>
          </>
        )
        : <TimedReading exercise={exercise} onFinish={finish} />}
    </div>
  )
}
