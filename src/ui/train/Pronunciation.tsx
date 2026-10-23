// «Перевірка вимови» (for the author): every gama word in both voices; a tap plays it, «✗» marks it as wrong.
// The marks stay in this browser; «Скопіювати список» gives the list for re-recording (content/vymova.json).
import { useMemo, useState } from 'react'
import type { Exercise } from '../../contracts.ts'
import { PlayButton, useSectionAudio } from '../session/common.tsx'
import { useStore } from '../store.tsx'

const KEY = 'polish-czytanie:wymowa'

type Marks = Record<string, string[]>

function loadMarks(): Marks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Marks
  } catch {
    return {}
  }
}

function saveMarks(marks: Marks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks))
  } catch {
    // Private mode: the marks live until the page is closed.
  }
}

function ExerciseWords({ exercise, marked, onToggle }: { exercise: Exercise; marked: ReadonlySet<string>; onToggle: (word: string) => void }) {
  const gama = exercise.sections.gama
  const audio = useSectionAudio(gama)
  // Each word once per exercise, in the order of the gama.
  const words = useMemo(() => {
    const seen = new Map<string, number>()
    gama.words.forEach((w, i) => seen.has(w.t.toLowerCase()) || seen.set(w.t.toLowerCase(), i))
    return [...seen.entries()]
  }, [gama])
  return (
    <section className="wymowa-ex">
      <h2 lang="pl">{exercise.id}. {exercise.title}</h2>
      <div className="wymowa-words">
        {words.map(([word, i]) => (
          <span key={word} className={`wymowa-word${marked.has(word) ? ' bad' : ''}`}>
            <PlayButton playing={audio.playingFrom(word)} onPlay={() => void audio.playWords(i, i, word)} onStop={audio.stop} testId={`say-${word}`}>
              <span lang="pl">{gama.words[i].t}</span>
            </PlayButton>
            <button type="button" className="button icon" aria-pressed={marked.has(word)} aria-label={`${word}: звучить неправильно`} onClick={() => onToggle(word)} data-testid={`bad-${word}`}>✗</button>
          </span>
        ))}
      </div>
    </section>
  )
}

export function Pronunciation() {
  const store = useStore()
  const [voice, setVoice] = useState(store.settings.voice)
  const [marks, setMarks] = useState<Marks>(loadMarks)
  const [copied, setCopied] = useState(false)
  const content = useMemo(() => store.content.exercises.map((e) => store.exerciseIn(voice, e.id) ?? e), [voice])
  const marked = new Set(marks[voice] ?? [])
  const total = Object.values(marks).reduce((n, l) => n + l.length, 0)
  const list = store.content.voices.map((v) => `${v.name}: ${(marks[v.id] ?? []).join(', ') || '—'}`).join('\n')

  const toggle = (word: string) => {
    const next = { ...marks, [voice]: marked.has(word) ? [...marked].filter((w) => w !== word) : [...marked, word] }
    setMarks(next)
    saveMarks(next)
    setCopied(false)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section data-testid="pronunciation">
      <div className="screen-head">
        <a className="button icon" href="#/ustawienia" aria-label="Назад до налаштувань">←</a>
        <h1>Перевірка вимови</h1>
      </div>
      <p className="meta">Усі слова гами. Дотик — послухати, «✗» — звучить неправильно. Позначки лишаються в цьому браузері; «Скопіювати список» дає перелік для перезапису.</p>
      <div className="row sticky-bar">
        <span className="segmented" role="group" aria-label="Голос">
          {store.content.voices.map((v) => <button key={v.id} type="button" aria-pressed={voice === v.id} onClick={() => setVoice(v.id)} data-testid={`wymowa-${v.id}`}>{v.name}</button>)}
        </span>
        <button type="button" className="button primary" onClick={() => void copy()} disabled={!total} data-testid="copyList">Скопіювати список ({total})</button>
        {copied && <span className="meta" role="status">Скопійовано.</span>}
      </div>
      <pre className="wymowa-list" data-testid="wymowaList">{list}</pre>
      {content.map((e) => <ExerciseWords key={`${voice}-${e.id}`} exercise={e} marked={marked} onToggle={toggle} />)}
    </section>
  )
}
