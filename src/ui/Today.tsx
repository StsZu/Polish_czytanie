// «Сьогодні»: what to do now — the next exercise, a review, the hard words, the streak (FR-30).
import type { Exercise } from '../contracts.ts'
import { lastColdPace, minutesThisWeek, streak } from '../core/progress/attempts.ts'
import { dayOf } from '../core/progress/days.ts'
import { dueToday } from '../core/progress/srs.ts'
import { planToday } from '../core/progress/today.ts'
import { sessionHref } from './router.ts'
import { useStore } from './store.tsx'

export function LevelDots({ level }: { level: number }) {
  return (
    <span className="dots" role="img" aria-label={`Опанування ${level} з 3`} data-testid="level">
      {[1, 2, 3].map((i) => <span key={i} className={i <= level ? 'dot on' : 'dot'} />)}
    </span>
  )
}

export const LEVEL_NAME = ['не почато', 'почато', 'темп досягнуто', 'опановано']

function Suggestion({ e, kind }: { e: Exercise; kind: 'next' | 'review' }) {
  const store = useStore()
  const pace = lastColdPace(store.attempts, e.id)
  return (
    <a className="suggestion" href={sessionHref(e.id)} data-testid={kind === 'next' ? 'startNext' : 'startReview'}>
      <span className="label">{kind === 'next' ? 'Вправа на сьогодні' : 'Повторення (давно не відкривали)'}</span>
      <span className="title" lang="pl">{e.id}. {e.title}</span>
      <span className="meta">{e.focus.join(' · ')} · ~{e.minutes} хв · ціль {e.targetWpm} сл/хв{pace !== null ? ` · останній холодний темп ${pace}` : ''}</span>
      <span className="row"><LevelDots level={store.levels[e.id]} /> <span className="meta">{LEVEL_NAME[store.levels[e.id]]}</span></span>
    </a>
  )
}

export function Today() {
  const store = useStore()
  const today = dayOf()
  const due = dueToday(store.hard, today).length
  const plan = planToday(store.content.exercises.map((e) => e.id), store.levels, store.attempts, due, today)
  const next = plan.next ? store.exercise(plan.next) : undefined
  const review = plan.review ? store.exercise(plan.review) : undefined
  const mastered = Object.values(store.levels).filter((l) => l === 3).length
  const days = streak(store.attempts, today)

  return (
    <section data-testid="today">
      <h1>Сьогодні</h1>
      <div className="stats" data-testid="stats">
        <div><strong>{days}</strong><span>{days === 1 ? 'день поспіль' : 'днів поспіль'}</span></div>
        <div><strong>{minutesThisWeek(store.attempts, today)}</strong><span>хв за тиждень</span></div>
        <div><strong>{mastered} / 21</strong><span>опановано</span></div>
      </div>
      <div className="plan">
        {next ? <Suggestion e={next} kind="next" /> : <p className="notice">Усі 21 вправа опановані. Повертайтеся до них раз на тиждень.</p>}
        {review && <Suggestion e={review} kind="review" />}
        <a className={`suggestion small${due ? '' : ' quiet'}`} href="#/trudne" data-testid="hardDue">
          <span className="label">Важкі слова</span>
          <span className="title">{due ? `${due} на сьогодні` : 'На сьогодні немає'}</span>
          <span className="meta">Слова й фрази, які не вийшли, повертаються через 1, 3, 7 і 14 днів.</span>
        </a>
      </div>
      <p className="meta tip">Читайте вголос. Спершу сам — потім перевірка на слух. П'ять хвилин щодня дають більше, ніж година раз на тиждень.</p>
    </section>
  )
}
