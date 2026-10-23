// Step 3: «Що прозвучало?» on the words of the gama; skipped with an explanation where letters differ but sound the same.
import { useKeys } from './common.tsx'
import { Quiz } from './Quiz.tsx'
import type { SessionStepProps } from './Session.tsx'

export function StepQuiz({ exercise, record, addHard, done }: SessionStepProps) {
  useKeys({ Enter: exercise.quizSkip ? done : undefined })
  if (exercise.quizSkip) {
    return (
      <div className="step" data-testid="stepQuiz">
        <p className="notice" data-testid="quizSkip">{exercise.quizSkip}</p>
        <div className="step-actions">
          <button type="button" className="button primary big" onClick={done} data-testid="next">Далі <kbd>Enter</kbd></button>
        </div>
      </div>
    )
  }
  return (
    <div className="step" data-testid="stepQuiz">
      <p className="lead">Послухайте слово й виберіть, як воно пишеться. Тут звук — саме завдання.</p>
      <Quiz
        tasks={exercise.quiz.map((item) => ({ exercise, item }))}
        onAnswer={(task, correct) => {
          void record({ kind: 'quiz', seconds: 3, correct: correct ? 1 : 0, total: 1, pair: task.item.pair })
          if (!correct) void addHard('gama', exercise.sections.gama.words[task.item.word].line, task.item.word)
        }}
        onDone={done}
      />
    </div>
  )
}
