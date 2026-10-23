// A session of one exercise: steps 0–7 with «Назад / Пропустити / Вийти» and the steps as buttons, saved as it goes
// (FR-10). Step 0, the tempo check, opens the session only when the exercise was practised on an earlier day and
// nothing of it was read or heard today; otherwise the session starts with the rule.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise, NewAttempt, SectionKey, SessionRecord, StepProps } from '../../contracts.ts'
import { prefetchExercise } from '../../core/audio/cache.ts'
import { player } from '../../core/audio/player.ts'
import { coldAllowed, practicedBefore } from '../../core/progress/attempts.ts'
import { dayOf } from '../../core/progress/days.ts'
import { useStore } from '../store.tsx'
import { useKeys } from './common.tsx'
import { StepCold } from './StepCold.tsx'
import { StepFlash } from './StepFlash.tsx'
import { StepGama } from './StepGama.tsx'
import { StepQuiz } from './StepQuiz.tsx'
import { StepRule } from './StepRule.tsx'
import { StepShadow } from './StepShadow.tsx'
import { StepSummary } from './StepSummary.tsx'
import { StepTempo } from './StepTempo.tsx'

export const STEP_TITLES = [
  'Перевірка темпу',
  'Правило',
  'Гама: прочитай — перевір',
  'Що прозвучало?',
  'Пасажі: миттєве читання',
  'Твір разом із диктором',
  'Твір на темп',
  'Самооцінка й підсумок',
]

export interface SessionStats {
  cold: boolean
  coldWpm: number | null
  tempos: number[]
  correct: number
  total: number
  newHard: number
  seconds: number
}

export interface SessionStepProps extends StepProps {
  stats: SessionStats
  /** Step 0 records a cold reading only when the exercise was practised before and nothing of it was read or heard today. */
  coldToday: boolean
  /** Leaves the session to the «Сьогодні» screen. */
  exit: () => void
}

const STEPS = [StepCold, StepRule, StepGama, StepQuiz, StepFlash, StepShadow, StepTempo, StepSummary]

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

export function Session({ exercise, startStep }: { exercise: Exercise; startStep: number | null }) {
  const store = useStore()
  // Fixed when the session starts: the steps of this session must not turn its own cold reading into a warm-up.
  const [coldToday] = useState(() => coldAllowed(store.attempts, exercise.id, dayOf()) && practicedBefore(store.attempts, exercise.id, dayOf()))
  const [step, setStep] = useState(() => startStep ?? (coldToday ? 0 : 1))
  const [stats, setStats] = useState<SessionStats>({ cold: coldToday, coldWpm: null, tempos: [], correct: 0, total: 0, newHard: 0, seconds: 0 })
  const session = useRef<SessionRecord>({ id: newId(), exercise: exercise.id, day: dayOf(), started: new Date().toISOString(), stepsDone: [] })
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [step])
  useEffect(() => () => player().stop(), [])
  useEffect(() => {
    void prefetchExercise(exercise)
  }, [exercise])

  const record = useCallback(async (a: NewAttempt) => {
    setStats((s) => ({
      ...s,
      coldWpm: a.kind === 'cold' || a.kind === 'warmup' ? a.wpm ?? s.coldWpm : s.coldWpm,
      tempos: a.kind === 'tempo' && a.wpm ? [...s.tempos, a.wpm] : s.tempos,
      correct: s.correct + (['gama', 'flash', 'quiz'].includes(a.kind) ? a.correct ?? 0 : 0),
      total: s.total + (['gama', 'flash', 'quiz'].includes(a.kind) ? a.total ?? 0 : 0),
      seconds: s.seconds + (a.seconds || 0),
    }))
    await store.record(exercise.id, a)
  }, [store, exercise.id])

  const addHard = useCallback(async (section: SectionKey, unit: number, word: number | null) => {
    setStats((s) => ({ ...s, newHard: s.newHard + 1 }))
    await store.addHard(exercise.id, section, unit, word)
  }, [store, exercise.id])

  const save = useCallback((finished = false) => {
    void store.saveSession({ ...session.current, ...(finished ? { finished: new Date().toISOString() } : {}) })
  }, [store])

  const exit = useCallback(() => {
    player().stop()
    save(step === STEPS.length - 1)
    location.hash = '#/'
  }, [save, step])

  const done = useCallback(() => {
    player().stop()
    if (!session.current.stepsDone.includes(step)) session.current.stepsDone = [...session.current.stepsDone, step]
    save()
    if (step < STEPS.length - 1) setStep(step + 1)
    else exit()
  }, [step, save, exit])

  const go = useCallback((to: number) => {
    player().stop()
    if (to >= 0 && to < STEPS.length) setStep(to)
  }, [])
  const skip = () => go(step + 1)
  const back = () => go(step - 1)

  useKeys({
    Escape: () => {
      if (player().playing) player().stop()
      else exit()
    },
    'Shift+ArrowLeft': step > 0 ? back : undefined,
    'Shift+ArrowRight': step < STEPS.length - 1 ? skip : undefined,
  })

  const Step = STEPS[step]
  return (
    <section className="session" data-testid="session" data-step={step}>
      <header className="session-head">
        <button type="button" className="button" onClick={exit} data-testid="exit">Вийти</button>
        <div className="session-title">
          <span className="meta" lang="pl">{exercise.id}. {exercise.title}</span>
          <h1 ref={heading} tabIndex={-1} data-testid="stepTitle">{STEP_TITLES[step]}</h1>
        </div>
        <span className="meta step-count" data-testid="stepCount">Крок {step + 1} з {STEPS.length}</span>
        <span className="step-nav">
          <button type="button" className="button" onClick={back} disabled={step === 0} data-testid="back">‹ Назад <kbd>⇧←</kbd></button>
          {step < STEPS.length - 1 && <button type="button" className="button" onClick={skip} data-testid="skip">Пропустити › <kbd>⇧→</kbd></button>}
        </span>
      </header>
      <ol className="progress-steps" aria-label="Кроки вправи">
        {STEPS.map((_, i) => (
          <li key={i}>
            <button
              type="button"
              className={i < step ? 'past' : i === step ? 'now' : ''}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`Крок ${i + 1}: ${STEP_TITLES[i]}`}
              title={STEP_TITLES[i]}
              onClick={() => go(i)}
              data-testid={`goStep-${i}`}
            />
          </li>
        ))}
      </ol>
      <Step
        key={step}
        exercise={exercise}
        player={player()}
        record={record}
        addHard={addHard}
        done={done}
        stats={stats}
        coldToday={coldToday}
        exit={exit}
      />
    </section>
  )
}
