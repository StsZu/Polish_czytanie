// The text being read: words with highlighted focus letters, stress and syllables, the sounding word,
// the pacer, words marked as mistakes. Gama and pasaże are shown line by line, utwór as written.
import { useRef } from 'react'
import type { Section, SectionKey, Word as WordData } from '../../contracts.ts'

export type FocusLevel = 'full' | 'faint' | 'none'

export const FOCUS_BY_SECTION: Record<SectionKey, FocusLevel> = { gama: 'full', pasaze: 'faint', utwor: 'none' }

interface Props {
  section: Section
  kind: SectionKey
  focus?: FocusLevel
  /** Only these units (lines, sentences); all when omitted. */
  units?: number[]
  /** The word sounding now (karaoke) or the word the pacer is on. */
  current?: number
  pacer?: number
  /** The word the keyboard cursor is on (← →). */
  cursor?: number
  marked?: ReadonlySet<number>
  /** Words whose stress and syllables are shown (after a long press, or in exercises 10–11). */
  revealed?: ReadonlySet<number> | 'all'
  showSyllables?: boolean
  onTap?: (word: number) => void
  onLongPress?: (word: number) => void
  className?: string
}

const LONG_PRESS_MS = 500

function Word({ word, index, focus, current, pacer, cursor, marked, revealed, showSyllables, onTap, onLongPress }: {
  word: WordData; index: number; focus: FocusLevel; current: boolean; pacer: boolean; cursor: boolean; marked: boolean; revealed: boolean; showSyllables: boolean
  onTap?: (i: number) => void; onLongPress?: (i: number) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const long = useRef(false)
  const t = word.t
  // One class per character, then runs of equal classes: focus and stress may overlap.
  const classes = Array.from(t, () => '')
  if (focus !== 'none') for (const [s, e, g] of word.focus) for (let i = s; i < e; i++) classes[i] = `f f${g}`
  if (revealed && word.stress) for (let i = word.stress[0]; i < word.stress[1]; i++) classes[i] += ' stress'
  const runs: { text: string; cls: string }[] = []
  classes.forEach((cls, i) => {
    const last = runs[runs.length - 1]
    if (last && last.cls === cls) last.text += t[i]
    else runs.push({ text: t[i], cls })
  })
  let content: React.ReactNode = runs.map((r, i) => (r.cls ? <span key={i} className={r.cls}>{r.text}</span> : r.text))
  if ((showSyllables || revealed) && word.syl) content = word.syl.join('-')

  const interactive = !!(onTap || onLongPress)
  const down = () => {
    long.current = false
    if (onLongPress) timer.current = setTimeout(() => {
      long.current = true
      onLongPress(index)
    }, LONG_PRESS_MS)
  }
  const up = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (!long.current) onTap?.(index)
  }
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return (
    <span
      className={`w${current ? ' now' : ''}${pacer ? ' pace' : ''}${cursor ? ' cursor' : ''}${revealed ? ' revealed' : ''}${marked ? ' marked' : ''}${focus === 'faint' ? ' faint' : ''}`}
      data-i={index}
      data-testid="word"
      {...(interactive ? { onPointerDown: down, onPointerUp: up, onPointerLeave: cancel, onPointerCancel: cancel, onContextMenu: (e: React.MouseEvent) => e.preventDefault() } : {})}
    >
      {content}
    </span>
  )
}

export function ReadingText({ section, kind, focus = FOCUS_BY_SECTION[kind], units, current = -1, pacer = -1, cursor = -1, marked, revealed, showSyllables = false, onTap, onLongPress, className = '' }: Props) {
  const shown = units ?? section.units.map((_, i) => i)
  const word = (i: number) => (
    <Word
      key={i}
      word={section.words[i]}
      index={i}
      focus={focus}
      current={current === i}
      pacer={pacer === i}
      cursor={cursor === i}
      marked={marked?.has(i) ?? false}
      revealed={revealed === 'all' || (revealed?.has(i) ?? false)}
      showSyllables={showSyllables}
      onTap={onTap}
      onLongPress={onLongPress}
    />
  )

  if (kind === 'gama' || kind === 'pasaze') {
    return (
      <div className={`reading ${kind} ${className}`} data-testid="reading">
        {shown.map((u) => {
          const [a, b] = section.units[u].words
          const nodes: React.ReactNode[] = []
          for (let i = a; i <= b; i++) {
            if (i > a) {
              // Gama: a space between words (the commas were only for the speech synthesis). Pasaże: the text as written.
              nodes.push(kind === 'gama' ? ' ' : section.text.slice(section.words[i - 1].k, section.words[i].s))
            }
            nodes.push(word(i))
          }
          if (kind === 'pasaze') nodes.push(section.text.slice(section.words[b].k, section.text.indexOf('\n', section.words[b].k) >>> 0).replace(/\.$/, ''))
          return <p key={u} className="line" data-unit={u}>{nodes}</p>
        })}
      </div>
    )
  }

  // Utwór: paragraphs as in the text; the shown units keep their punctuation and dialogue dashes.
  const paragraphs: React.ReactNode[][] = [[]]
  let previousEnd = -1
  let previousUnit = -2
  for (const u of shown) {
    const [a, b] = section.units[u].words
    const unitStart = section.words[a].s
    let between: string
    if (u === previousUnit + 1) between = section.text.slice(previousEnd, unitStart)
    else {
      // A unit on its own (or after a gap): a new paragraph, with the dialogue dash of its line if it starts the line.
      if (previousUnit >= 0) paragraphs.push([])
      const lineStart = section.text.lastIndexOf('\n', unitStart) + 1
      const lead = section.text.slice(lineStart, unitStart)
      between = /^[—–\s]*$/.test(lead) ? lead : ''
    }
    previousUnit = u
    const pieces = between.split('\n')
    pieces.forEach((piece, j) => {
      if (j > 0) paragraphs.push([])
      if (piece) paragraphs[paragraphs.length - 1].push(piece)
    })
    for (let i = a; i <= b; i++) {
      if (i > a) paragraphs[paragraphs.length - 1].push(section.text.slice(section.words[i - 1].k, section.words[i].s))
      paragraphs[paragraphs.length - 1].push(word(i))
    }
    const lineEnd = section.text.indexOf('\n', section.words[b].k)
    const unitEnd = u + 1 < section.units.length ? section.words[section.units[u + 1].words[0]].s : section.text.length
    const tail = section.text.slice(section.words[b].k, Math.min(unitEnd, lineEnd < 0 ? section.text.length : lineEnd))
    const trimmed = tail.replace(/\s+$/, '')
    paragraphs[paragraphs.length - 1].push(trimmed)
    previousEnd = section.words[b].k + trimmed.length
  }
  return (
    <div className={`reading utwor ${className}`} data-testid="reading">
      {paragraphs.filter((p) => p.length).map((p, i) => <p key={i} className="para">{p}</p>)}
    </div>
  )
}
