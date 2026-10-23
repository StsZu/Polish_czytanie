// Step 2: a gama line is read aloud first; only «Перевір» plays it. Then the words that did not come out
// are tapped (or picked with ← → and «x») and go to the hard words (FR-13).
import { useState } from 'react'
import { Legend } from '../Listen.tsx'
import { ReadingText } from '../text/ReadingText.tsx'
import { PlayButton, useKeys, useSectionAudio, useSelfRecording, useWordHelp } from './common.tsx'
import { SelfRecord } from './SelfRecord.tsx'
import type { SessionStepProps } from './Session.tsx'

export function StepGama({ exercise, record, addHard, done }: SessionStepProps) {
  const gama = exercise.sections.gama
  const audio = useSectionAudio(gama)
  const rec = useSelfRecording()
  const [unit, setUnit] = useState(0)
  const [checked, setChecked] = useState(false)
  const [marked, setMarked] = useState<Set<number>>(new Set())
  const [cursor, setCursor] = useState(-1)
  const help = useWordHelp(audio, checked, gama, 'gama')
  const [shownAt, setShownAt] = useState(() => performance.now())
  const [first, last] = gama.units[unit].words
  const lastUnit = unit === gama.units.length - 1

  const check = () => {
    void rec.stop()
    setChecked(true)
    void audio.playUnit(unit, 'check')
  }
  const again = () => void audio.playUnit(unit, 'again')

  const next = () => {
    const total = last - first + 1
    void record({ kind: 'gama', seconds: (performance.now() - shownAt) / 1000, correct: total - marked.size, total })
    for (const w of marked) void addHard('gama', unit, w)
    if (lastUnit) {
      done()
      return
    }
    setUnit(unit + 1)
    setChecked(false)
    setMarked(new Set())
    setCursor(-1)
    setShownAt(performance.now())
  }

  const allRight = () => {
    setMarked(new Set())
    next()
  }

  const toggle = (i: number) => {
    if (!checked) return
    setMarked((m) => {
      const n = new Set(m)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }

  const tap = (i: number) => {
    help.tap(i)
    toggle(i)
  }
  const markCursor = checked && cursor >= 0 ? () => toggle(cursor) : undefined

  useKeys({
    Space: !checked ? check : again,
    '1': checked ? allRight : undefined,
    Enter: checked ? next : undefined,
    ArrowRight: checked ? () => setCursor(cursor < 0 ? first : Math.min(last, cursor + 1)) : undefined,
    ArrowLeft: checked ? () => setCursor(cursor < 0 ? last : Math.max(first, cursor - 1)) : undefined,
    KeyX: markCursor,
    '2': markCursor,
  })

  return (
    <div className="step" data-testid="stepGama">
      <p className="lead">
        {checked
          ? 'Слухайте й порівнюйте. Торкніться слів, які у вас вийшли інакше (або ← → і «x»), — вони повернуться у «Важких словах».'
          : 'Прочитайте рядок уголос. Потім «Перевір» — і почуєте, як правильно.'}
      </p>
      <p className="meta" data-testid="unitCount">Рядок {unit + 1} з {gama.units.length}</p>
      <Legend exercise={exercise} section="gama" />
      <div className="focus-card" key={unit}>
        <ReadingText
          section={gama}
          kind="gama"
          units={[unit]}
          current={checked ? audio.current : -1}
          cursor={checked ? cursor : -1}
          marked={marked}
          revealed={exercise.id === '10' ? 'all' : help.revealed}
          showSyllables={exercise.id === '11'}
          onTap={checked ? tap : undefined}
          onLongPress={help.reveal}
        />
      </div>
      <SelfRecord
        rec={rec}
        canRecord={!checked}
        canCompare={checked}
        dictor={{ play: (source) => void audio.playUnit(unit, source), playingFrom: audio.playingFrom, stop: audio.stop }}
      />
      {audio.error && <p className="notice">{audio.error}</p>}
      <div className="step-actions sticky">
        {!checked
          ? <button type="button" className="button primary big" onClick={check} data-testid="check">Перевір <kbd>пробіл</kbd></button>
          : (
            <>
              <button type="button" className="button primary big" onClick={allRight} data-testid="allRight">Усе правильно <kbd>1</kbd></button>
              <button type="button" className="button big" onClick={next} disabled={marked.size === 0} data-testid="nextWithMistakes">
                {marked.size ? `Далі, помилок: ${marked.size}` : 'Позначте слова з помилками'} <kbd>Enter</kbd>
              </button>
              <PlayButton playing={audio.playingFrom('again') || audio.playingFrom('check')} onPlay={again} onStop={audio.stop} hint="пробіл" testId="again">Ще раз</PlayButton>
            </>
          )}
      </div>
    </div>
  )
}
