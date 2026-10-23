// «Розрізнення»: «Що прозвучало?» over all exercises already started, one pair of sounds at a time (FR-33).
import { useMemo, useState } from 'react'
import { Quiz, type QuizTask } from '../session/Quiz.tsx'
import { useStore } from '../store.tsx'

const MAX_TASKS = 10

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function Discrimination() {
  const store = useStore()
  const started = useMemo(() => new Set(store.attempts.filter((a) => a.kind !== 'legacy').map((a) => a.exercise)), [store.attempts])
  const all: QuizTask[] = useMemo(() => store.content.exercises.filter((e) => started.has(e.id)).flatMap((e) => e.quiz.map((item) => ({ exercise: e, item }))), [store.content, started])
  const pairs = [...new Set(all.map((t) => t.item.pair))]
  const [pair, setPair] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<number | null>(null)

  const stats = (p: string) => {
    const list = store.attempts.filter((a) => a.kind === 'quiz' && a.pair === p)
    const correct = list.reduce((n, a) => n + (a.correct ?? 0), 0)
    return list.length ? `${Math.round((correct / list.length) * 100)} % з ${list.length}` : 'ще не було'
  }

  const tasks = pair
    ? all.filter((t) => t.item.pair === pair).sort((a, b) => hash(`${run}${a.item.answer}`) - hash(`${run}${b.item.answer}`)).slice(0, MAX_TASKS)
    : []

  return (
    <section data-testid="discrimination">
      <h1>Розрізнення</h1>
      <p className="meta">Звучить слово — виберіть, як воно пишеться. Слова — з уже початих вправ.</p>
      {!pairs.length && <p className="notice" data-testid="discriminationEmpty">Спершу пройдіть хоч одну вправу з кроком «Що прозвучало?» (01, 02, 04–08).</p>}
      {pairs.length > 0 && (
        <div className="chips" role="group" aria-label="Пара звуків">
          {pairs.map((p) => (
            <button key={p} type="button" className="chip-button" aria-pressed={pair === p} onClick={() => {
              setPair(p)
              setResult(null)
              setRun((r) => r + 1)
            }} data-testid={`pair-${p}`}>
              <strong lang="pl">{p}</strong> <span className="meta">{stats(p)}</span>
            </button>
          ))}
        </div>
      )}
      {pair && result === null && tasks.length > 0 && (
        <Quiz
          key={`${pair}-${run}`}
          tasks={tasks}
          onAnswer={(task, correct) => {
            void store.record(task.exercise.id, { kind: 'quiz', seconds: 3, correct: correct ? 1 : 0, total: 1, pair: task.item.pair })
            if (!correct) void store.addHard(task.exercise.id, 'gama', task.exercise.sections.gama.words[task.item.word].line, task.item.word)
          }}
          onDone={setResult}
        />
      )}
      {result !== null && (
        <div className="step-actions">
          <p className="result" data-testid="discriminationResult">Правильно {result} з {tasks.length}.</p>
          <button type="button" className="button primary" onClick={() => {
            setResult(null)
            setRun((r) => r + 1)
          }} data-testid="again">Ще раз</button>
        </div>
      )}
    </section>
  )
}
