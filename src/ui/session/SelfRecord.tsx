// «Запис себе» in a step (FR-19): «Запис» → three clicks and a silent beat → recording with the level of the
// microphone → «Стоп» (or «Перевір»). Then «Я», «Диктор» and «Я → Диктор» to compare.
import { useState } from 'react'
import { formatTime, PlayButton, useKeys, useSelfRecording } from './common.tsx'

export function SelfRecord({ rec, canRecord, canCompare, onRecordStart, dictor }: {
  rec: ReturnType<typeof useSelfRecording>
  /** «Запис» can be started now. */
  canRecord: boolean
  /** «Я / Диктор / Я → Диктор» are offered (after «Перевір»). */
  canCompare: boolean
  /** Runs on the silent beat, when the reader starts. */
  onRecordStart?: () => void
  dictor: { play: (source: string) => void; playingFrom: (source: string) => boolean; stop: () => void }
}) {
  const [both, setBoth] = useState(false)
  const compare = canCompare && rec.url !== null && rec.phase === 'idle'
  const start = () => void rec.record(onRecordStart)
  const playBoth = () => {
    setBoth(true)
    rec.playMine(() => {
      dictor.play('both')
      setBoth(false)
    })
  }
  const stopAll = () => {
    rec.stopMine()
    dictor.stop()
    setBoth(false)
  }

  useKeys({
    KeyR: rec.phase === 'idle' ? (canRecord ? start : undefined) : () => void rec.stop(),
    KeyM: compare ? () => (rec.mine && !both ? rec.stopMine() : rec.playMine()) : undefined,
    KeyD: compare ? () => (dictor.playingFrom('dictor') ? dictor.stop() : dictor.play('dictor')) : undefined,
    KeyB: compare ? () => ((both && rec.mine) || dictor.playingFrom('both') ? stopAll() : playBoth()) : undefined,
  })

  if (rec.denied) {
    return <p className="meta self-record" data-testid="selfRecord">Мікрофон недоступний: дозвольте його для цього сайту в налаштуваннях Safari, щоб записувати себе.</p>
  }
  return (
    <div className="self-record" data-testid="selfRecord">
      {rec.phase === 'idle' && canRecord && (
        <button type="button" className="button rec-button" onClick={start} data-testid="record">
          <span className="rec-dot" aria-hidden="true" />Запис <kbd>R</kbd>
        </button>
      )}
      {rec.phase === 'asking' && (
        <>
          <span className="meta" data-testid="micAsking">Чекаю дозволу на мікрофон…</span>
          <button type="button" className="button" onClick={() => void rec.stop()} data-testid="recordCancel">Скасувати <kbd>R</kbd></button>
        </>
      )}
      {rec.phase === 'countin' && (
        <>
          <span className="countin" role="status" aria-label={rec.beat < 4 ? `Відлік ${rec.beat}` : 'Читайте'} data-testid="countin">
            {[1, 2, 3].map((n) => <span key={n} className={`beat${rec.beat >= n ? ' on' : ''}`}>{n}</span>)}
            <span className="meta">{rec.beat >= 3 ? 'читайте на наступний такт' : 'приготуйтеся'}</span>
          </span>
          <button type="button" className="button" onClick={() => void rec.stop()} data-testid="recordCancel">Скасувати <kbd>R</kbd></button>
        </>
      )}
      {rec.phase === 'recording' && (
        <>
          <button type="button" className="button rec-button recording" onClick={() => void rec.stop()} data-testid="recordStop">
            <span className="rec-square" aria-hidden="true" />Стоп <kbd>R</kbd>
          </button>
          <span className="meter" role="meter" aria-label="Рівень мікрофона" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.level * 100)} data-testid="meter">
            <span style={{ transform: `scaleX(${Math.max(0.03, rec.level)})` }} />
          </span>
          <span className="rec-time" data-testid="recording">Запис {formatTime(rec.seconds)}</span>
        </>
      )}
      {compare && (
        <span className="compare" role="group" aria-label="Порівняти">
          <PlayButton playing={rec.mine && !both} onPlay={() => rec.playMine()} onStop={rec.stopMine} hint="M" testId="playMine">Я</PlayButton>
          <PlayButton playing={dictor.playingFrom('dictor')} onPlay={() => dictor.play('dictor')} onStop={dictor.stop} hint="D" testId="playDictor">Диктор</PlayButton>
          <PlayButton playing={(both && rec.mine) || dictor.playingFrom('both')} onPlay={playBoth} onStop={stopAll} hint="B" testId="playBoth">Я → Диктор</PlayButton>
        </span>
      )}
      {rec.phase === 'idle' && canRecord && !rec.url && <span className="meta">Три клацання — і на четвертий такт читайте. Запис не зберігається й нікуди не надсилається.</span>}
    </div>
  )
}
