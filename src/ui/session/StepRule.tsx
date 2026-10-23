// Step 1: the rule («Uwaga») with up to 4 words of the gama; a tap on a word plays it (FR-12).
import { Legend } from '../Listen.tsx'
import { ReadingText } from '../text/ReadingText.tsx'
import { useKeys, useSectionAudio } from './common.tsx'
import type { SessionStepProps } from './Session.tsx'

export function StepRule({ exercise, done }: SessionStepProps) {
  const gama = exercise.sections.gama
  const audio = useSectionAudio(gama)
  useKeys({ Enter: done })
  const examples = exercise.ruleExamples
  // Each example as its own one-word «unit», so ReadingText shows them side by side.
  const section = {
    ...gama,
    units: examples.map((i) => ({ text: gama.words[i].t, words: [i, i] as [number, number], od: gama.words[i].od, do: gama.words[i].do })),
  }

  return (
    <div className="step" data-testid="stepRule">
      <div className="rule" lang="uk">
        {exercise.rule.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {examples.length > 0 && (
        <>
          <p className="meta">Торкніться слова, щоб почути його.</p>
          <Legend exercise={exercise} section="gama" />
          <div className="examples">
            <ReadingText
              section={section}
              kind="gama"
              current={audio.current}
              revealed={exercise.id === '10' ? 'all' : undefined}
              showSyllables={exercise.id === '11'}
              onTap={(i) => void audio.playWords(i, i)}
            />
          </div>
        </>
      )}
      {audio.error && <p className="notice">{audio.error}</p>}
      <div className="step-actions">
        <button type="button" className="button primary big" onClick={done} data-testid="next">Далі <kbd>Enter</kbd></button>
      </div>
    </div>
  )
}
