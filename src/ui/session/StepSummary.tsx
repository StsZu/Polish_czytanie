// Step 7: «Легко / Важко / Не вийшло» and the result of the session (FR-18).
import { useState } from 'react'
import { useStore } from '../store.tsx'
import { LEVEL_NAME, LevelDots } from '../Today.tsx'
import { useKeys } from './common.tsx'
import type { SessionStepProps } from './Session.tsx'

const RATINGS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'Легко' },
  { value: 2, label: 'Важко' },
  { value: 3, label: 'Не вийшло' },
]

export function StepSummary({ exercise, record, stats, exit }: SessionStepProps) {
  const store = useStore()
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null)
  const rate = (value: 1 | 2 | 3) => {
    if (rating) return
    setRating(value)
    void record({ kind: 'rating', seconds: 0, rating: value })
  }
  useKeys({ '1': () => rate(1), '2': () => rate(2), '3': () => rate(3), Enter: rating ? exit : undefined })

  const best = stats.tempos.length ? Math.max(...stats.tempos) : null
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : null
  return (
    <div className="step" data-testid="stepSummary">
      <p className="lead">Як пройшла вправа?</p>
      <div className="options rating" role="group" aria-label="Самооцінка">
        {RATINGS.map((r) => (
          <button key={r.value} type="button" className={`option${rating === r.value ? ' right' : ''}`} onClick={() => rate(r.value)} disabled={rating !== null} data-testid={`rating-${r.value}`}>
            <kbd>{r.value}</kbd> {r.label}
          </button>
        ))}
      </div>
      <dl className="summary" data-testid="summary">
        {stats.coldWpm !== null && <div><dt>{stats.cold ? 'Темп перевірки' : 'Темп розминки'}</dt><dd>{stats.coldWpm} сл/хв</dd></div>}
        <div><dt>Найкращий темп</dt><dd>{best !== null ? `${best} сл/хв` : '—'} <span className="meta">ціль {exercise.targetWpm}</span></dd></div>
        <div><dt>Самоперевірка</dt><dd>{accuracy !== null ? `${accuracy} % правильно` : '—'}</dd></div>
        <div><dt>Нові важкі слова</dt><dd>{stats.newHard}</dd></div>
        <div><dt>Опанування</dt><dd><LevelDots level={store.levels[exercise.id]} /> {LEVEL_NAME[store.levels[exercise.id]]}</dd></div>
      </dl>
      {store.levels[exercise.id] < 3 && (
        <p className="meta">
          {store.levels[exercise.id] < 2
            ? `Рівень 2 — коли темп досягне ${exercise.targetWpm} сл/хв, а самоперевірка дасть ≥ 90 %.`
            : 'Рівень 3 — перевірка темпу на цілі щонайменше через 3 дні після першої сесії.'}
        </p>
      )}
      <div className="step-actions">
        <button type="button" className="button primary big" onClick={exit} disabled={!rating} data-testid="finishSession">Готово <kbd>Enter</kbd></button>
      </div>
    </div>
  )
}
