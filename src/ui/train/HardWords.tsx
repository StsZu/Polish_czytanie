// «Важкі слова»: what did not come out returns on its day — read it, then «Перевір», then «Так / Ні» (FR-32).
import { useMemo, useState } from 'react'
import type { Exercise, HardItem, Section } from '../../contracts.ts'
import { dayOf } from '../../core/progress/days.ts'
import { dueToday } from '../../core/progress/srs.ts'
import { PlayButton, useKeys, useSectionAudio } from '../session/common.tsx'
import { useStore } from '../store.tsx'
import { ReadingText } from '../text/ReadingText.tsx'

/** The utwór sentence where the word occurs, for the context under the card. */
export function contextUnit(e: Exercise, item: HardItem): number | null {
  const utwor = e.sections.utwor
  if (item.section === 'utwor') return item.unit
  const words = item.word === null
    ? e.sections[item.section].words.slice(e.sections[item.section].units[item.unit].words[0], e.sections[item.section].units[item.unit].words[1] + 1).map((w) => w.t.toLowerCase())
    : [e.sections[item.section].words[item.word].t.toLowerCase()]
  const unit = utwor.units.findIndex((u) => words.every((w) => utwor.words.slice(u.words[0], u.words[1] + 1).some((x) => x.t.toLowerCase() === w)))
  return unit >= 0 ? unit : null
}

function oneWord(section: Section, word: number): Section {
  const w = section.words[word]
  return { ...section, units: [{ text: w.t, words: [word, word], od: w.od, do: w.do }] }
}

function Card({ e, item, onAnswer }: { e: Exercise; item: HardItem; onAnswer: (correct: boolean) => void }) {
  const section = e.sections[item.section]
  const audio = useSectionAudio(section)
  const context = contextUnit(e, item)
  const contextAudio = useSectionAudio(e.sections.utwor)
  const [checked, setChecked] = useState(false)
  const [answered, setAnswered] = useState<boolean | null>(null)
  const play = () => (item.word === null ? audio.playUnit(item.unit, 'card') : audio.playWords(item.word, item.word, 'card'))
  const check = () => {
    setChecked(true)
    void play()
  }
  const answer = (correct: boolean) => {
    if (answered !== null) return
    setAnswered(correct)
    onAnswer(correct)
  }
  useKeys({
    Space: !checked ? check : () => void play(),
    '1': checked && answered === null ? () => answer(true) : undefined,
    '2': checked && answered === null ? () => answer(false) : undefined,
  })
  const display = item.word === null ? section : oneWord(section, item.word)
  const kind = item.section === 'utwor' && item.word === null ? 'utwor' : item.section === 'pasaze' && item.word === null ? 'pasaze' : 'gama'
  return (
    <div className="focus-card hard-card" data-testid="hardCard">
      <p className="meta" lang="pl">{e.id}. {e.title}</p>
      <ReadingText section={display} kind={kind} units={[item.word === null ? item.unit : 0]} focus="none" current={checked ? audio.current : -1} />
      {audio.error && <p className="notice">{audio.error}</p>}
      <div className="step-actions">
        {!checked && <button type="button" className="button primary big" onClick={check} data-testid="check">Перевір <kbd>пробіл</kbd></button>}
        {checked && answered === null && (
          <>
            <button type="button" className="button primary big" onClick={() => answer(true)} data-testid="yes">Так <kbd>1</kbd></button>
            <button type="button" className="button big" onClick={() => answer(false)} data-testid="no">Ні <kbd>2</kbd></button>
            <PlayButton playing={audio.playingFrom('card')} onPlay={() => void play()} onStop={audio.stop} hint="пробіл" testId="again">Ще раз</PlayButton>
          </>
        )}
      </div>
      {answered !== null && context !== null && (
        <div className="context" data-testid="context">
          <p className="meta">У тексті:</p>
          <ReadingText section={e.sections.utwor} kind="utwor" units={[context]} current={contextAudio.current} />
          <PlayButton playing={contextAudio.playingFrom('context')} onPlay={() => void contextAudio.playUnit(context, 'context')} onStop={contextAudio.stop} testId="playContext">Слухати речення</PlayButton>
        </div>
      )}
    </div>
  )
}

export function HardWords() {
  const store = useStore()
  const today = dayOf()
  // The cards of this visit are fixed when the screen opens: an answered card does not jump back into the list.
  const [cards] = useState(() => dueToday(store.hard, today))
  const [index, setIndex] = useState(0)
  const [right, setRight] = useState(0)
  const [answered, setAnswered] = useState(false)
  const totals = useMemo(() => ({
    open: store.hard.filter((h) => !h.learned).length,
    learned: store.hard.filter((h) => h.learned).length,
  }), [store.hard])

  const item = cards[index]
  const e = item ? store.exercise(item.exercise) : undefined
  const next = () => {
    setAnswered(false)
    setIndex(index + 1)
  }
  useKeys({ Enter: answered ? next : undefined })

  return (
    <section data-testid="hardWords">
      <h1>Важкі слова</h1>
      <p className="meta">Слова й фрази, які не вийшли в сесіях, повертаються через 1, 3, 7 і 14 днів; після трьох «Так» на 14 днях слово вивчене. Усього: {totals.open} у роботі, {totals.learned} вивчених.</p>
      {!cards.length && <p className="notice" data-testid="hardEmpty">На сьогодні важких слів немає.</p>}
      {item && e && (
        <>
          <p className="meta" data-testid="unitCount">Картка {index + 1} з {cards.length} · правильно {right}</p>
          <Card key={item.key} e={e} item={item} onAnswer={(correct) => {
            if (correct) setRight((r) => r + 1)
            void store.answerHard(item, correct)
            void store.record(e.id, { kind: 'hard', seconds: 5, correct: correct ? 1 : 0, total: 1 })
            setAnswered(true)
          }} />
          {answered && (
            <div className="step-actions">
              <button type="button" className="button primary big" onClick={next} data-testid="next">{index < cards.length - 1 ? 'Далі' : 'Готово'} <kbd>Enter</kbd></button>
            </div>
          )}
        </>
      )}
      {cards.length > 0 && index >= cards.length && <p className="notice" data-testid="hardDone">Готово: {right} з {cards.length} правильно. Наступні картки — у свій день.</p>}
    </section>
  )
}
