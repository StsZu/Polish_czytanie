// «Що прозвучало?»: a word sounds, the reader picks its spelling among 2–3 (FR-14). Used in step 3 and in
// the separate «Розрізнення» training.
import { useEffect, useState } from 'react'
import type { Exercise, QuizItem } from '../../contracts.ts'
import { useKeys, useSectionAudio } from './common.tsx'

export interface QuizTask { exercise: Exercise; item: QuizItem }

function Task({ task, onAnswer, onNext, last }: { task: QuizTask; onAnswer: (correct: boolean) => void; onNext: () => void; last: boolean }) {
  const gama = task.exercise.sections.gama
  const audio = useSectionAudio(gama)
  const [picked, setPicked] = useState<string | null>(null)
  const word = task.item.word
  const play = () => void audio.playWords(word, word)

  useEffect(() => {
    play()
  }, [task])

  const pick = (option: string) => {
    if (picked) return
    setPicked(option)
    onAnswer(option === task.item.answer)
  }
  const keys: Record<string, () => void> = { Space: play }
  task.item.options.forEach((o, i) => {
    keys[String(i + 1)] = () => pick(o)
  })
  if (picked) keys.Enter = onNext
  useKeys(keys)

  const correct = picked === task.item.answer
  return (
    <div className="quiz" data-testid="quizTask">
      <button type="button" className="button big listen" onClick={play} data-testid="quizPlay">Слухати ще <kbd>пробіл</kbd></button>
      <div className="options" role="group" aria-label="Як це пишеться?">
        {task.item.options.map((o, i) => (
          <button
            key={o}
            type="button"
            lang="pl"
            className={`option${picked && o === task.item.answer ? ' right' : ''}${picked === o && !correct ? ' wrong' : ''}`}
            onClick={() => pick(o)}
            disabled={picked !== null}
            data-testid="option"
            data-answer={o === task.item.answer ? 'yes' : undefined}
          >
            <kbd>{i + 1}</kbd> {o}
          </button>
        ))}
      </div>
      {audio.error && <p className="notice">{audio.error}</p>}
      {picked && (
        <div className="step-actions">
          <p className={`result ${correct ? 'good' : ''}`} data-testid="quizResult" role="status">
            {correct ? 'Правильно.' : <>Прозвучало <strong lang="pl">{task.item.answer}</strong>. Слово додано до важких.</>}
          </p>
          <button type="button" className="button primary big" onClick={onNext} data-testid="next">{last ? 'Готово' : 'Далі'} <kbd>Enter</kbd></button>
        </div>
      )}
    </div>
  )
}

export function Quiz({ tasks, onAnswer, onDone }: { tasks: QuizTask[]; onAnswer: (task: QuizTask, correct: boolean) => void; onDone: (correct: number) => void }) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const task = tasks[index]
  return (
    <>
      <p className="meta" data-testid="unitCount">Завдання {index + 1} з {tasks.length} · правильно {correct}</p>
      <Task
        key={index}
        task={task}
        last={index === tasks.length - 1}
        onAnswer={(ok) => {
          if (ok) setCorrect((c) => c + 1)
          onAnswer(task, ok)
        }}
        onNext={() => (index < tasks.length - 1 ? setIndex(index + 1) : onDone(correct))}
      />
    </>
  )
}
