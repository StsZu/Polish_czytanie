// Step 5: reading the utwór together with the narrator, word by word (FR-16). At level III it is skipped
// by default when the cold pace already reached the target: the session stays within 7 minutes.
import { useState } from 'react'
import { ReadingText } from '../text/ReadingText.tsx'
import { useStore } from '../store.tsx'
import { useKeys, useSectionAudio, useWordHelp } from './common.tsx'
import type { SessionStepProps } from './Session.tsx'

const RATES = [0.7, 0.8, 0.9, 1, 1.1, 1.2]

export function StepShadow({ exercise, record, done, stats, player }: SessionStepProps) {
  const store = useStore()
  const utwor = exercise.sections.utwor
  const audio = useSectionAudio(utwor)
  const help = useWordHelp(audio, true)
  const suggestSkip = exercise.level === 3 && stats.coldWpm !== null && stats.coldWpm >= exercise.targetWpm
  const [forced, setForced] = useState(false)
  const [started, setStarted] = useState<number | null>(null)

  const setRate = (rate: number) => {
    player.rate = rate
    void store.updateSettings({ rate })
  }
  const play = async (from = 0) => {
    player.rate = store.settings.rate
    const t = performance.now()
    setStarted(t)
    await audio.playAll(from)
    void record({ kind: 'shadow', seconds: (performance.now() - t) / 1000 })
  }
  const finish = () => {
    audio.stop()
    done()
  }
  useKeys({
    Space: audio.playing ? audio.stop : () => void play(),
    Enter: finish,
  })

  if (suggestSkip && !forced) {
    return (
      <div className="step" data-testid="stepShadow">
        <p className="notice" data-testid="shadowSkip">Холодний темп ({stats.coldWpm} сл/хв) уже досягнув цілі, тож читання з диктором можна пропустити й одразу читати на темп.</p>
        <div className="step-actions">
          <button type="button" className="button primary big" onClick={done} data-testid="next">Далі <kbd>Enter</kbd></button>
          <button type="button" className="button" onClick={() => setForced(true)} data-testid="shadowAnyway">Усе одно читати з диктором</button>
        </div>
      </div>
    )
  }

  return (
    <div className="step" data-testid="stepShadow">
      <p className="lead">Читайте вголос разом із диктором, тримаючись підсвіченого слова. Дотик до слова — почати з нього, довге натискання — наголос.</p>
      <div className="step-actions sticky">
        {audio.playing
          ? <button type="button" className="button primary big" onClick={audio.stop} data-testid="stop">Пауза <kbd>пробіл</kbd></button>
          : <button type="button" className="button primary big" onClick={() => void play()} data-testid="play">{started ? 'Ще раз' : 'Почати'} <kbd>пробіл</kbd></button>}
        <label className="rate">
          <span className="meta">Швидкість</span>
          <select value={store.settings.rate} onChange={(e) => setRate(Number(e.currentTarget.value))} data-testid="rate">
            {RATES.map((r) => <option key={r} value={r}>{r.toFixed(1).replace('.', ',')}×</option>)}
          </select>
        </label>
        <button type="button" className="button" onClick={finish} data-testid="next">Далі <kbd>Enter</kbd></button>
      </div>
      {audio.error && <p className="notice">{audio.error}</p>}
      <ReadingText section={utwor} kind="utwor" current={audio.current} revealed={help.revealed} onLongPress={help.reveal} onTap={(i) => help.tap(i) || void play(Math.max(0, utwor.words[i].od - 0.05))} />
    </div>
  )
}
