// «Прогрес»: the cold pace by day, the levels of the 21 exercises, the discrimination by pair, the hard words (FR-35).
import { useMemo, useState } from 'react'
import type { Attempt } from '../../contracts.ts'
import { dayOf } from '../../core/progress/days.ts'
import { dueToday } from '../../core/progress/srs.ts'
import { LEVEL_TITLE } from '../Exercises.tsx'
import { useStore } from '../store.tsx'
import { LevelDots } from '../Today.tsx'
import { Chart, type Point } from './Chart.tsx'

function coldByDay(attempts: Attempt[], ids: Set<string>): Point[] {
  const days = new Map<string, number[]>()
  for (const a of attempts) if (a.kind === 'cold' && ids.has(a.exercise) && a.wpm) days.set(a.day, [...(days.get(a.day) ?? []), a.wpm])
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, value: Math.round(v.reduce((s, x) => s + x, 0) / v.length) }))
}

export function Progress() {
  const store = useStore()
  const practiced = store.attempts.filter((a) => a.kind === 'cold').at(-1)?.exercise ?? store.content.exercises[0].id
  const [id, setId] = useState(practiced)
  const e = store.exercise(id)!
  const levelIds = useMemo(() => new Set(store.content.exercises.filter((x) => x.level === e.level).map((x) => x.id)), [store.content, e.level])
  const pairs = useMemo(() => {
    const out = new Map<string, { correct: number; total: number }>()
    for (const a of store.attempts) {
      if (a.kind !== 'quiz' || !a.pair) continue
      const p = out.get(a.pair) ?? { correct: 0, total: 0 }
      out.set(a.pair, { correct: p.correct + (a.correct ?? 0), total: p.total + (a.total ?? 0) })
    }
    return [...out.entries()]
  }, [store.attempts])
  const today = dayOf()

  return (
    <section data-testid="progress">
      <h1>Прогрес</h1>
      <h2>Холодний темп</h2>
      <label className="field">
        <span className="meta">Вправа</span>
        <select value={id} onChange={(ev) => setId(ev.currentTarget.value)} data-testid="progressExercise">
          {store.content.exercises.map((x) => <option key={x.id} value={x.id}>{x.id}. {x.title}</option>)}
        </select>
      </label>
      <Chart
        label={`Холодний темп вправи ${e.id} і середній по рівню ${e.level}`}
        target={e.targetWpm}
        series={[
          { name: `Вправа ${e.id}`, points: coldByDay(store.attempts, new Set([e.id])), className: 's-exercise' },
          { name: `Рівень ${e.level}, середній`, points: coldByDay(store.attempts, levelIds), className: 's-level' },
        ]}
      />

      <h2>Опанування</h2>
      {([1, 2, 3] as const).map((level) => (
        <div key={level} className="levels-row">
          <span className="meta">{LEVEL_TITLE[level]}</span>
          <span className="levels">
            {store.content.exercises.filter((x) => x.level === level).map((x) => (
              <a key={x.id} href={`#/c/${x.id}`} className="level-chip" title={x.title}>{x.id} <LevelDots level={store.levels[x.id]} /></a>
            ))}
          </span>
        </div>
      ))}

      <h2>Розрізнення за парами</h2>
      {pairs.length
        ? (
          <table className="table" data-testid="pairsTable">
            <thead><tr><th>Пара</th><th>Правильно</th><th>Завдань</th></tr></thead>
            <tbody>{pairs.map(([p, s]) => <tr key={p}><td lang="pl">{p}</td><td>{Math.round((s.correct / s.total) * 100)} %</td><td>{s.total}</td></tr>)}</tbody>
          </table>
        )
        : <p className="meta">Ще не було.</p>}

      <h2>Важкі слова</h2>
      <p data-testid="hardCounts">На сьогодні: {dueToday(store.hard, today).length} · у роботі: {store.hard.filter((h) => !h.learned).length} · вивчені: {store.hard.filter((h) => h.learned).length}</p>
    </section>
  )
}
