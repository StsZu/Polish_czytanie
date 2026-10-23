// content/teksty/NN-slug.md → exercise sections. A port of Krok_po_kroku_2/scripts/build_czytanie.py:
// the text built here is exactly the text that was sent to speech synthesis, so the character offsets
// match the character timings in NN-<section>.align.json.
import type { Level, SectionKey } from '../../contracts.ts'

export const SECTION_HEADINGS: Record<string, SectionKey | 'uwaga'> = { Gama: 'gama', 'Pasaże': 'pasaze', 'Utwór': 'utwor', Uwaga: 'uwaga' }
export const FIELDS = ['id', 'slug', 'tytul', 'poziom', 'fokus', 'cel', 'czas_min'] as const
export const UTWOR_WORDS: Record<Level, [number, number]> = { 1: [40, 60], 2: [60, 90], 3: [100, 220] }
export const STRESS_ID = '10'
export const SYLLABLES_ID = '11'
export const COVERAGE_MIN = 80

const WORD = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu
const SENTENCE_END = /(?:(?<=[.?!…])|(?<=[.?!…][”"»)]))\s+(?![a-ząćęłńóśźż])/gu
const DIALOG = /^[—–]\s/

export interface Meta {
  id: string
  slug: string
  tytul: string
  poziom: number
  fokus: string[]
  cel: string
  czas_min: number
}

export interface RawWord {
  t: string
  s: number
  k: number
  line: number
  /** From `**` markup (exercise 10). */
  marked: [number, number] | null
  syl: string[] | null
}

export interface RawUnit { text: string; s: number; k: number; words: [number, number] }

export interface RawSection { text: string; words: RawWord[]; units: RawUnit[] }

function yamlValue(raw: string): string | number | (string | number)[] {
  const v = raw.trim()
  if (v.startsWith('[') && v.endsWith(']')) {
    return (v.slice(1, -1).match(/"[^"]*"|'[^']*'|[^,\s][^,]*/g) ?? []).map((x) => yamlValue(x) as string)
  }
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) return v.slice(1, -1)
  if (/^-?\d+$/.test(v)) return Number(v)
  return v
}

export function parseFile(source: string): { meta: Record<string, unknown>; sections: Record<string, string> } {
  const body = source.replace(/^﻿/, '')
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(body)
  if (!front) throw new Error('немає YAML-шапки')
  const meta: Record<string, unknown> = {}
  for (const line of front[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon < 0) throw new Error(`рядок шапки без «:» — ${JSON.stringify(line)}`)
    meta[line.slice(0, colon).trim()] = yamlValue(line.slice(colon + 1))
  }
  const sections: Record<string, string[]> = {}
  let current: string | null = null
  for (const line of body.slice(front[0].length).split('\n')) {
    const heading = /^##\s+(\S.*?)\s*$/.exec(line)
    if (heading) {
      const key = SECTION_HEADINGS[heading[1]]
      if (!key) throw new Error(`невідома секція «## ${heading[1]}»`)
      if (sections[key]) throw new Error(`секція «## ${heading[1]}» двічі`)
      current = key
      sections[key] = []
    } else if (current) {
      sections[current].push(line)
    } else if (line.trim()) {
      throw new Error(`текст поза секціями — ${JSON.stringify(line.trim().slice(0, 40))}`)
    }
  }
  return { meta, sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join('\n')])) }
}

/** Removes `**` and (exercise 11 only) syllable hyphens; returns the clean line, stress ranges and cut positions. */
function cleanLine(raw: string, id: string): { clean: string; stress: [number, number][]; cuts: Set<number> } {
  const line = raw.split(/\s+/).filter(Boolean).join(' ')
  let clean = ''
  const stress: [number, number][] = []
  const cuts = new Set<number>()
  let open: number | null = null
  for (let i = 0; i < line.length;) {
    if (line.startsWith('**', i)) {
      if (open === null) open = clean.length
      else {
        stress.push([open, clean.length])
        open = null
      }
      i += 2
      continue
    }
    const c = line[i]
    if (c === '-' && id === SYLLABLES_ID && /[\p{L}\p{N}]/u.test(clean.at(-1) ?? '') && /[\p{L}\p{N}]/u.test(line[i + 1] ?? '')) {
      cuts.add(clean.length)
      i += 1
      continue
    }
    clean += c
    i += 1
  }
  if (open !== null) throw new Error(`незакрите ** у рядку ${JSON.stringify(line)}`)
  return { clean, stress, cuts }
}

interface Token { t: string; s: number; k: number; marked: [number, number][]; syl: string[] | null }

function tokens(clean: string, stress: [number, number][], cuts: Set<number>): Token[] {
  const out: Token[] = []
  for (const m of clean.matchAll(WORD)) {
    const s = m.index
    const k = s + m[0].length
    const marked = stress.filter(([x, y]) => s <= x && y <= k).map(([x, y]) => [x - s, y - s] as [number, number])
    const at = [...cuts].filter((p) => s < p && p < k).map((p) => p - s).sort((a, b) => a - b)
    const syl = at.length ? [0, ...at].map((x, i) => m[0].slice(x, [...at, m[0].length][i])) : null
    out.push({ t: m[0], s, k, marked, syl })
  }
  return out
}

export function buildSection(name: SectionKey, raw: string, id: string, problems: string[]): RawSection {
  const lines = raw.split('\n').filter((l) => l.trim())
  const parts: string[] = []
  const words: RawWord[] = []
  const units: RawUnit[] = []
  let base = 0
  lines.forEach((rawLine, nr) => {
    const { clean, stress, cuts } = cleanLine(rawLine, id)
    if (stress.length && id !== STRESS_ID) problems.push(`${name}: розмітка ** поза вправою ${STRESS_ID} — ${JSON.stringify(clean.slice(0, 40))}`)
    let toks = tokens(clean, stress, cuts)
    let line: string
    if (name === 'gama') {
      // Words joined by ", ", every line ends with a full stop: this is how it was read.
      line = ''
      toks = toks.map((tok, j) => {
        if (j) line += ', '
        const s = line.length
        line += tok.t
        return { ...tok, s, k: s + tok.t.length }
      })
      line += '.'
      if (toks.length < 4 || toks.length > 6) problems.push(`gama, рядок ${nr + 1}: ${toks.length} слів, має бути 4–6`)
    } else if (name === 'pasaze') {
      line = /[.?!]$/.test(clean) ? clean : `${clean}.`
    } else {
      line = clean
    }
    const first = words.length
    for (const tok of toks) {
      if (tok.marked.length > 1) problems.push(`${name}: кілька наголосів у слові ${JSON.stringify(tok.t)}`)
      words.push({ t: tok.t, s: base + tok.s, k: base + tok.k, line: nr, marked: tok.marked[0] ?? null, syl: tok.syl })
    }
    if (name === 'gama' || name === 'pasaze') {
      if (toks.length) units.push({ text: line.replace(/\.$/, ''), s: base, k: base + line.length - 1, words: [first, words.length - 1] })
    } else {
      const pieces: [number, number][] = []
      if (DIALOG.test(line)) pieces.push([0, line.length])
      else {
        let start = 0
        for (const m of line.matchAll(SENTENCE_END)) {
          pieces.push([start, m.index])
          start = m.index + m[0].length
        }
        pieces.push([start, line.length])
      }
      for (const [a, b] of pieces) {
        const idx: number[] = []
        for (let i = first; i < words.length; i++) if (base + a <= words[i].s && words[i].k <= base + b) idx.push(i)
        if (!idx.length) continue
        const text = line.slice(a, b).trim()
        const s = base + a + line.slice(a, b).indexOf(text)
        units.push({ text, s, k: s + text.length, words: [idx[0], idx[idx.length - 1]] })
      }
    }
    parts.push(line)
    base += line.length + 1
  })
  const text = parts.join('\n')
  for (const w of words) if (text.slice(w.s, w.k) !== w.t) throw new Error(`${name}: зсув слова ${w.t}`)
  if (name === 'utwor') for (const u of units) if (text.slice(u.s, u.k) !== u.text) throw new Error(`${name}: зсув одиниці ${u.text}`)
  // In the units of utwór every word belongs to exactly one unit; their line is the unit.
  if (name === 'utwor') units.forEach((u, i) => { for (let w = u.words[0]; w <= u.words[1]; w++) words[w].line = i })
  return { text, words, units }
}

export function ruleParagraphs(raw: string): string[] {
  return raw.trim().split(/\n\s*\n/).map((p) => p.split(/\s+/).filter(Boolean).join(' ')).filter(Boolean)
}

export interface Alignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** Word times from the character alignment; null and a problem when the recording does not match the text. */
export function wordTimes(section: RawSection, align: Alignment, stem: string, problems: string[]): { od: number; do: number }[] | null {
  const chars = align.characters.join('')
  if (chars !== section.text) {
    let i = 0
    while (i < Math.min(chars.length, section.text.length) && chars[i] === section.text[i]) i++
    problems.push(`${stem}: текст align.json розійшовся з md на позиції ${i} (${JSON.stringify(chars.slice(i, i + 15))} ≠ ${JSON.stringify(section.text.slice(i, i + 15))})`)
    return null
  }
  const start = align.character_start_times_seconds
  const end = align.character_end_times_seconds
  if (start.length !== chars.length || end.length !== chars.length) {
    problems.push(`${stem}: довжина часів ≠ кількості символів`)
    return null
  }
  const round = (x: number) => Math.round(x * 1000) / 1000
  return section.words.map((w) => ({ od: round(start[w.s]), do: round(end[w.k - 1]) }))
}

/** The checks of KONCEPCJA.md for one exercise. */
export function checkExercise(id: string, level: number, s: Record<SectionKey, RawSection>, problems: string[], warnings: string[]) {
  const [lo, hi] = id === SYLLABLES_ID ? [24, 32] : [24, 36]
  if (s.gama.words.length < lo || s.gama.words.length > hi) problems.push(`gama: ${s.gama.words.length} слів, має бути ${lo}–${hi}`)
  if (s.pasaze.units.length < 8 || s.pasaze.units.length > 12) problems.push(`pasaze: ${s.pasaze.units.length} рядків, має бути 8–12`)
  const range = UTWOR_WORDS[level as Level]
  if (!range) problems.push(`poziom ${level} поза 1–3`)
  else if (s.utwor.words.length < range[0] || s.utwor.words.length > range[1]) problems.push(`utwor: ${s.utwor.words.length} слів, для рівня ${level} має бути ${range[0]}–${range[1]}`)
  if (id === STRESS_ID) for (const w of s.gama.words) if (!w.marked) problems.push(`gama: слово без наголосу — ${w.t}`)
  if (id === SYLLABLES_ID) {
    s.gama.words.forEach((w, i) => {
      if (w.syl && s.gama.words[i + 1]?.t.toLowerCase() !== w.t.toLowerCase()) problems.push(`gama: за ${w.syl.join('-')} має йти те саме слово разом`)
    })
  }
  const utwor = s.utwor.words.map((w) => w.t.toLowerCase())
  if (level === 3) {
    const set = new Set(utwor)
    for (const w of s.gama.words) if (!set.has(w.t.toLowerCase())) problems.push(`gama: слова ${w.t} немає в utwor`)
    for (const u of s.pasaze.units) {
      const phrase = s.pasaze.words.slice(u.words[0], u.words[1] + 1).map((w) => w.t.toLowerCase())
      const found = utwor.some((_, i) => phrase.every((p, j) => utwor[i + j] === p))
      if (!found) problems.push(`pasaze: фрази ${JSON.stringify(u.text)} немає в utwor`)
    }
  } else {
    const other = new Set([...utwor, ...s.pasaze.words.map((w) => w.t.toLowerCase())])
    const gama = [...new Set(s.gama.words.map((w) => w.t.toLowerCase()))]
    const missing = gama.filter((w) => !other.has(w))
    const pct = Math.round((100 * (gama.length - missing.length)) / gama.length)
    if (pct < COVERAGE_MIN) warnings.push(`gama: покриття ${pct}% < ${COVERAGE_MIN}% — немає в pasaze/utwor: ${missing.join(', ')}`)
  }
}
