// «Слухати текст»: the only screen where the recording plays before the reader's own attempt —
// to get to know a text. The sounding word is highlighted; a tap on a word plays it.
import { useEffect, useState } from 'react'
import type { Exercise, SectionKey } from '../contracts.ts'
import { SECTIONS } from '../contracts.ts'
import { prefetchExercise } from '../core/audio/cache.ts'
import { AudioUnavailable, player } from '../core/audio/player.ts'
import { FOCUS_BY_SECTION, ReadingText } from './text/ReadingText.tsx'

export const SECTION_LABEL: Record<SectionKey, string> = { gama: 'Гама', pasaze: 'Пасажі', utwor: 'Твір' }

export function Legend({ exercise, section }: { exercise: Exercise; section: SectionKey }) {
  if (!exercise.focusGroups.length || FOCUS_BY_SECTION[section] === 'none') return null
  return (
    <div className="legend" data-testid="legend">
      {exercise.focusGroups.map((label, g) => <span key={g} className={`f${g}`} style={{ background: `var(--f${g})` }}>{label}</span>)}
    </div>
  )
}

export function Listen({ exercise, onRecord }: { exercise: Exercise; onRecord?: (seconds: number) => void }) {
  const [section, setSection] = useState<SectionKey>('gama')
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data = exercise.sections[section]

  useEffect(() => () => player().stop(), [])
  useEffect(() => {
    void prefetchExercise(exercise)
  }, [exercise])
  useEffect(() => {
    player().stop()
    setCurrent(-1)
    setError(null)
  }, [section])

  const run = async (action: () => Promise<void>) => {
    const p = player()
    setError(null)
    try {
      await p.load(data)
      setPlaying(true)
      const started = performance.now()
      await action()
      onRecord?.((performance.now() - started) / 1000)
    } catch (e) {
      setError(e instanceof AudioUnavailable ? e.message : 'Не вдалося відтворити запис.')
    } finally {
      setPlaying(false)
      setCurrent(-1)
    }
  }

  const playAll = () => run(() => player().playSection({ onWord: setCurrent }))
  const playWord = (i: number) => {
    const w = data.words[i]
    void run(() => player().playRange(w.od, w.do, { onWord: () => setCurrent(i) }))
  }

  return (
    <section data-testid="listen">
      <div className="listen-bar">
        <div className="segmented" role="group" aria-label="Ступінь">
          {SECTIONS.map((k) => <button key={k} type="button" aria-pressed={section === k} onClick={() => setSection(k)} data-testid={`section-${k}`}>{SECTION_LABEL[k]}</button>)}
        </div>
        {playing
          ? <button type="button" className="button primary" onClick={() => player().stop()} data-testid="stop">Зупинити</button>
          : <button type="button" className="button primary" onClick={() => void playAll()} data-testid="playAll">Слухати</button>}
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      <Legend exercise={exercise} section={section} />
      <ReadingText
        section={data}
        kind={section}
        current={current}
        revealed={exercise.id === '10' && section === 'gama' ? 'all' : undefined}
        showSyllables={exercise.id === '11' && section === 'gama'}
        onTap={playWord}
      />
    </section>
  )
}
