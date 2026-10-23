// «Підручник»: 21 cards in three levels with the mastery, the last cold pace and whether the audio is on the device (FR-31).
// «Виконати вправу» opens the session, «Слухати» the recordings, «Окремий крок» any one step.
import { useEffect, useState } from 'react'
import type { Level } from '../contracts.ts'
import { cachedExercises } from '../core/audio/cache.ts'
import { lastColdPace } from '../core/progress/attempts.ts'
import { sessionHref } from './router.ts'
import { STEP_TITLES } from './session/Session.tsx'
import { useStore } from './store.tsx'
import { LevelDots } from './Today.tsx'

export const LEVEL_TITLE: Record<Level, string> = { 1: 'I — Літери й звуки', 2: 'II — Слова й ритм', 3: 'III — Речення й тексти' }

export function Exercises() {
  const store = useStore()
  const [cached, setCached] = useState<Set<string>>(new Set())
  useEffect(() => {
    void cachedExercises(store.content.exercises).then(setCached)
  }, [store.content])

  return (
    <section data-testid="exercises">
      <h1>Підручник</h1>
      {([1, 2, 3] as Level[]).map((level) => (
        <section key={level}>
          <h2 className="level-head">{LEVEL_TITLE[level]} <span className="meta">· ціль {store.content.exercises.find((e) => e.level === level)?.targetWpm} сл/хв</span></h2>
          <div className="cards">
            {store.content.exercises.filter((e) => e.level === level).map((e) => {
              const pace = lastColdPace(store.attempts, e.id)
              return (
                <div key={e.id} className="card" data-testid={`card-${e.id}`}>
                  <div className="card-main">
                    <span className="num">{e.id}</span>
                    <span className="title" lang="pl">{e.title}</span>
                    <span className="meta">{e.focus.join(' · ')}</span>
                    <span className="row">
                      <LevelDots level={store.levels[e.id]} />
                      <span className="meta">{pace !== null ? `${pace} сл/хв` : 'ще не читали'}</span>
                      <span className="meta">{cached.has(e.id) ? '· аудіо на пристрої' : ''}</span>
                    </span>
                  </div>
                  <div className="card-actions">
                    <a className="button primary" href={sessionHref(e.id)} data-testid={`open-${e.id}`}>Виконати вправу</a>
                    <a className="button" href={`#/sluchaj/${e.id}`} aria-label={`Слухати текст вправи ${e.id}`} data-testid={`listen-${e.id}`}>Слухати</a>
                  </div>
                  <details className="card-steps">
                    <summary data-testid={`steps-${e.id}`}>Окремий крок</summary>
                    <ol>
                      {STEP_TITLES.map((title, i) => <li key={i}><a href={sessionHref(e.id, i)} data-testid={`step-${e.id}-${i}`}>{title}</a></li>)}
                    </ol>
                  </details>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </section>
  )
}
