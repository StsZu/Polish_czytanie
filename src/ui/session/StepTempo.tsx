// Step 6: the utwór alone on time, up to 3 readings, the pace of each next to the target (FR-17).
// The pacer highlights words at a steady pace and speeds up by 10 % after three readings that kept up.
// «Позначати важкі» turns taps into marking hard words; otherwise a long press shows the stress (FR-20).
import { useState } from 'react'
import { nextPacer, pacerStart } from '../../core/flash.ts'
import { readingPace } from '../../core/progress/attempts.ts'
import { useStore } from '../store.tsx'
import { useKeys, useSectionAudio, useWordHelp } from './common.tsx'
import { PaceResult } from './StepCold.tsx'
import { TimedReading } from './TimedReading.tsx'
import type { SessionStepProps } from './Session.tsx'

export const MAX_TEMPO = 3

export function StepTempo({ exercise, record, addHard, done }: SessionStepProps) {
  const store = useStore()
  const utwor = exercise.sections.utwor
  const [results, setResults] = useState<(number | null)[]>([])
  const [reading, setReading] = useState(true)
  const [marked, setMarked] = useState<Set<number>>(new Set())
  const [marking, setMarking] = useState(false)
  const audio = useSectionAudio(utwor)
  const help = useWordHelp(audio, true)
  const pacer = store.settings.pacerByLevel[exercise.level] ?? pacerStart(exercise.targetWpm)
  const finishedAll = results.length >= MAX_TEMPO

  const finish = (seconds: number) => {
    const wpm = readingPace(utwor.words.length, seconds)
    setResults((r) => [...r, wpm])
    setReading(false)
    if (wpm === null) return
    void record({ kind: 'tempo', seconds, wpm })
    if (store.settings.pacer) void store.updateSettings({ pacerByLevel: { ...store.settings.pacerByLevel, [exercise.level]: nextPacer(pacer, wpm) } })
  }
  const mark = (i: number) => {
    if (marked.has(i)) return
    setMarked(new Set(marked).add(i))
    void addHard('utwor', utwor.words[i].line, i)
  }

  useKeys({ Enter: !reading ? done : undefined })

  const best = Math.max(0, ...results.filter((r): r is number => r !== null))
  return (
    <div className="step" data-testid="stepTempo">
      <p className="lead">Прочитайте твір сам, уголос, у темпі. До {MAX_TEMPO} спроб поспіль — кожна має бути трохи швидшою. Довге натискання на слово показує наголос, дотик після цього — звучання. «Позначати важкі» — дотик додає слово до важких.</p>
      <label className="toggle">
        <input type="checkbox" checked={store.settings.pacer} onChange={(e) => void store.updateSettings({ pacer: e.currentTarget.checked })} data-testid="pacerToggle" />
        <span>Ведучий: підсвітка йде з темпом {pacer.wpm} сл/хв</span>
      </label>
      {results.length > 0 && (
        <ol className="attempts" data-testid="tempoResults">
          {results.map((r, i) => <li key={i}>{r === null ? 'не зараховано' : `${r} сл/хв`}{r !== null && r === best && results.length > 1 ? ' — найкраща' : ''}</li>)}
        </ol>
      )}
      {reading
        ? <TimedReading
            exercise={exercise}
            pacerWpm={store.settings.pacer ? pacer.wpm : null}
            marked={marked}
            revealed={help.revealed}
            onTap={(i) => (marking ? mark(i) : help.tap(i))}
            onLongPress={help.reveal}
            onFinish={finish}
            startLabel={results.length ? `Спроба ${results.length + 1}` : 'Почати'}
            actions={<button type="button" className="button" aria-pressed={marking} onClick={() => setMarking(!marking)} data-testid="markMode">{marking ? 'Позначаю важкі' : 'Позначати важкі'}</button>}
          />
        : (
          <>
            <PaceResult wpm={results[results.length - 1]} target={exercise.targetWpm} label={`Спроба ${results.length}`} />
            <div className="step-actions">
              <button type="button" className="button primary big" onClick={done} data-testid="next">Далі <kbd>Enter</kbd></button>
              {!finishedAll && <button type="button" className="button" onClick={() => setReading(true)} data-testid="again">Ще спроба</button>}
            </div>
          </>
        )}
    </div>
  )
}
