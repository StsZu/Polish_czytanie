// Step 4: a phrase shows for a moment and disappears; the reader says it, then «Перевір» plays it (FR-15).
// The display time adapts: two «Так» in a row → shorter, «Ні» → longer. One glance takes in more of the phrase.
import { useEffect, useRef, useState } from 'react'
import { flashStart, nextFlash } from '../../core/flash.ts'
import { ReadingText } from '../text/ReadingText.tsx'
import { PlayButton, useKeys, useSectionAudio, useSelfRecording, useWordHelp } from './common.tsx'
import { SelfRecord } from './SelfRecord.tsx'
import type { SessionStepProps } from './Session.tsx'

type Phase = 'ready' | 'showing' | 'say' | 'check'

export function StepFlash({ exercise, record, addHard, done }: SessionStepProps) {
  const pasaze = exercise.sections.pasaze
  const audio = useSectionAudio(pasaze)
  const rec = useSelfRecording()
  const [unit, setUnit] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [flash, setFlash] = useState(() => flashStart(exercise.level))
  const help = useWordHelp(audio, phase === 'check', pasaze, 'pasaze')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const started = useRef(0)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const show = () => {
    setPhase('showing')
    started.current = performance.now()
    timer.current = setTimeout(() => setPhase('say'), flash.ms)
  }
  const check = () => {
    void rec.stop()
    setPhase('check')
    void audio.playUnit(unit, 'check')
  }
  const again = () => void audio.playUnit(unit, 'again')
  const answer = (correct: boolean) => {
    void record({ kind: 'flash', seconds: (performance.now() - started.current) / 1000, correct: correct ? 1 : 0, total: 1, flashMs: flash.ms })
    if (!correct) void addHard('pasaze', unit, null)
    setFlash(nextFlash(flash, correct))
    if (unit === pasaze.units.length - 1) {
      done()
      return
    }
    setUnit(unit + 1)
    setPhase('ready')
  }

  useKeys({
    Space: phase === 'ready' ? show : phase === 'say' ? check : phase === 'check' ? again : undefined,
    '1': phase === 'check' ? () => answer(true) : undefined,
    '2': phase === 'check' ? () => answer(false) : undefined,
  })

  return (
    <div className="step" data-testid="stepFlash" data-phase={phase}>
      <p className="lead">
        {phase === 'ready' && 'Фраза з\'явиться на мить. Охопіть її одним поглядом і скажіть уголос.'}
        {phase === 'showing' && 'Читайте…'}
        {phase === 'say' && 'Скажіть фразу вголос, потім «Перевір».'}
        {phase === 'check' && 'Так прозвучало правильно. Вийшло?'}
      </p>
      <p className="meta" data-testid="unitCount">Фраза {unit + 1} з {pasaze.units.length} · показ {(flash.ms / 1000).toFixed(1)} с</p>
      <div className="focus-card flash-card" key={unit}>
        {phase === 'showing' || phase === 'check'
          ? <ReadingText section={pasaze} kind="pasaze" units={[unit]} current={phase === 'check' ? audio.current : -1} revealed={help.revealed} onTap={phase === 'check' ? help.tap : undefined} onLongPress={phase === 'check' ? help.reveal : undefined} />
          : <div className="flash-placeholder" aria-hidden="true">{phase === 'say' ? '…' : ''}</div>}
      </div>
      <SelfRecord
        rec={rec}
        canRecord={phase === 'ready'}
        canCompare={phase === 'check'}
        onRecordStart={show}
        dictor={{ play: (source) => void audio.playUnit(unit, source), playingFrom: audio.playingFrom, stop: audio.stop }}
      />
      {audio.error && <p className="notice">{audio.error}</p>}
      <div className="step-actions sticky">
        {phase === 'ready' && <button type="button" className="button primary big" onClick={show} data-testid="show">Показати <kbd>пробіл</kbd></button>}
        {phase === 'say' && <button type="button" className="button primary big" onClick={check} data-testid="check">Перевір <kbd>пробіл</kbd></button>}
        {phase === 'check' && (
          <>
            <button type="button" className="button primary big" onClick={() => answer(true)} data-testid="yes">Так <kbd>1</kbd></button>
            <button type="button" className="button big" onClick={() => answer(false)} data-testid="no">Ні <kbd>2</kbd></button>
            <PlayButton playing={audio.playingFrom('again') || audio.playingFrom('check')} onPlay={again} onStop={audio.stop} hint="пробіл" testId="again">Ще раз</PlayButton>
          </>
        )}
      </div>
    </div>
  )
}
