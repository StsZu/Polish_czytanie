// What each exercise highlights in the text, where the stress falls, and which spellings the
// «Що прозвучало?» quiz offers next to the real word.

const VOWEL = 'aąeęioóuy'
const isVowel = (c: string | undefined) => c !== undefined && VOWEL.includes(c.toLowerCase())

interface Group { label: string; graphemes: string[] }
interface Rule { groups: Group[]; swaps: [string, string, string][] }

const SOFT_BEFORE_VOWEL = ['dzi', 'si', 'ci', 'zi', 'ni']

/** Highlight groups and quiz swaps [from, to, pair label] for exercises 01–09. */
export const RULES: Record<string, Rule> = {
  '01': { groups: [{ label: 'y', graphemes: ['y'] }, { label: 'c', graphemes: ['c'] }, { label: 'w', graphemes: ['w'] }, { label: 'j', graphemes: ['j'] }], swaps: [['y', 'i', 'i/y'], ['i', 'y', 'i/y']] },
  '02': { groups: [{ label: 'ł', graphemes: ['ł'] }, { label: 'l', graphemes: ['l'] }], swaps: [['ł', 'l', 'ł/l'], ['l', 'ł', 'ł/l']] },
  '03': { groups: [{ label: 'ó / u', graphemes: ['ó', 'u'] }, { label: 'h / ch', graphemes: ['ch', 'h'] }], swaps: [] },
  '04': { groups: [{ label: 'ę', graphemes: ['ę'] }, { label: 'ą', graphemes: ['ą'] }], swaps: [['ę', 'ą', 'ę/ą'], ['ą', 'ę', 'ę/ą']] },
  '05': {
    groups: [{ label: 'мʼякі', graphemes: ['dź', 'ś', 'ć', 'ź', 'ń', ...SOFT_BEFORE_VOWEL] }],
    swaps: [['ś', 's', 's/ś/sz'], ['ć', 'c', 'c/ć/cz'], ['ź', 'z', 'z/ź/ż'], ['ń', 'n', 'n/ń'], ['dź', 'dz', 'dz/dź/dż'],
      ['si', 's', 's/ś/sz'], ['ci', 'c', 'c/ć/cz'], ['zi', 'z', 'z/ź/ż'], ['ni', 'n', 'n/ń'], ['dzi', 'dz', 'dz/dź/dż'],
      ['ś', 'sz', 's/ś/sz'], ['ć', 'cz', 'c/ć/cz'], ['si', 'sz', 's/ś/sz'], ['ci', 'cz', 'c/ć/cz']],
  },
  '06': {
    groups: [{ label: 'шиплячі', graphemes: ['sz', 'cz', 'dż', 'rz', 'ż'] }],
    swaps: [['sz', 's', 's/ś/sz'], ['sz', 'ś', 's/ś/sz'], ['cz', 'c', 'c/ć/cz'], ['cz', 'ć', 'c/ć/cz'], ['ż', 'z', 'z/ź/ż'], ['ż', 'ź', 'z/ź/ż'],
      ['rz', 'z', 'z/ź/ż'], ['dż', 'dz', 'dz/dź/dż'], ['dż', 'dź', 'dz/dź/dż']],
  },
  '07': {
    groups: [
      { label: 'тверді: s c z dz', graphemes: ['dz', 's', 'c', 'z'] },
      { label: 'мʼякі: ś ć ź dź', graphemes: ['dź', 'ś', 'ć', 'ź', ...SOFT_BEFORE_VOWEL.filter((g) => g !== 'ni')] },
      { label: 'шиплячі: sz cz ż dż', graphemes: ['sz', 'cz', 'dż', 'rz', 'ż'] },
    ],
    swaps: [
      ['s', 'ś', 's/ś/sz'], ['s', 'sz', 's/ś/sz'], ['ś', 's', 's/ś/sz'], ['ś', 'sz', 's/ś/sz'], ['sz', 's', 's/ś/sz'], ['sz', 'ś', 's/ś/sz'],
      ['si', 's', 's/ś/sz'], ['si', 'sz', 's/ś/sz'],
      ['c', 'ć', 'c/ć/cz'], ['c', 'cz', 'c/ć/cz'], ['ć', 'c', 'c/ć/cz'], ['ć', 'cz', 'c/ć/cz'], ['cz', 'c', 'c/ć/cz'], ['cz', 'ć', 'c/ć/cz'],
      ['ci', 'c', 'c/ć/cz'], ['ci', 'cz', 'c/ć/cz'],
      ['z', 'ź', 'z/ź/ż'], ['z', 'ż', 'z/ź/ż'], ['ź', 'z', 'z/ź/ż'], ['ź', 'ż', 'z/ź/ż'], ['ż', 'z', 'z/ź/ż'], ['ż', 'ź', 'z/ź/ż'],
      ['zi', 'z', 'z/ź/ż'], ['zi', 'ż', 'z/ź/ż'],
      ['dz', 'dź', 'dz/dź/dż'], ['dz', 'dż', 'dz/dź/dż'], ['dź', 'dz', 'dz/dź/dż'], ['dż', 'dz', 'dz/dź/dż'], ['dzi', 'dz', 'dz/dź/dż'], ['dzi', 'dż', 'dz/dź/dż'],
    ],
  },
  '08': {
    groups: [{ label: 'збіги', graphemes: ['szcz', 'strz', 'chrz', 'trz', 'prz', 'źdź'] }],
    swaps: [['szcz', 'sc', 'szcz'], ['szcz', 'sz', 'szcz'], ['strz', 'str', 'strz'], ['trz', 'tr', 'trz'], ['prz', 'pr', 'prz'], ['chrz', 'chr', 'chrz'], ['źdź', 'zdz', 'źdź']],
  },
  '09': { groups: [{ label: 'оглушення / одзвінчення', graphemes: [] }], swaps: [] },
}

/** Spellings that sound the same: a quiz option must never differ from the answer only by these. */
export const HOMOPHONES: [string, string][] = [['rz', 'ż'], ['ó', 'u'], ['ch', 'h']]

export function soundKey(word: string): string {
  let w = word.toLowerCase()
  for (const [a, b] of HOMOPHONES) w = w.split(a).join(b)
  return w
}

export const QUIZ_SKIP: Record<string, string> = {
  '03': 'У цій вправі літери різні, а звук однаковий: «ó» = «u», «h» = «ch». Розрізняти на слух нічого — різниця лише в написанні.',
  '09': 'Оглушення не видно на слух: «chleb» звучить як «chlep». Розрізняти на слух нічого — різниця лише в написанні.',
}
export const QUIZ_SKIP_TEXT = 'У цій вправі фокус — ритм, наголос і текст, а не окремі літери, тому кроку «Що прозвучало?» немає.'

interface Match { s: number; e: number; grapheme: string }

/**
 * Graphemes of `list` in the word, longest first, without overlaps. Soft «si/ci/zi/ni/dzi» are whole before a vowel;
 * with `softBeforeI`, before a consonant or at the end (leci, nic) the consonant alone is soft and the «i» is the vowel.
 */
function findGraphemes(word: string, list: string[], softBeforeI = false): Match[] {
  const lower = word.toLowerCase()
  const sorted = [...new Set(list)].sort((a, b) => b.length - a.length)
  const out: Match[] = []
  for (let i = 0; i < lower.length;) {
    const softI = softBeforeI ? sorted.find((x) => SOFT_BEFORE_VOWEL.includes(x) && lower.startsWith(x, i) && !isVowel(lower[i + x.length])) : undefined
    if (softI) {
      out.push({ s: i, e: i + softI.length - 1, grapheme: softI })
      i += softI.length - 1
      continue
    }
    const g = sorted.find((x) => lower.startsWith(x, i) && (!SOFT_BEFORE_VOWEL.includes(x) || isVowel(lower[i + x.length])))
    // A longer digraph that is not in the list still occupies its letters: in «chodzą» the «c» belongs to «ch».
    const digraph = segmentAt(lower, i)
    if (g && !(digraph.length > g.length && !sorted.includes(digraph))) {
      out.push({ s: i, e: i + g.length, grapheme: g })
      i += g.length
    } else {
      i += digraph.length
    }
  }
  return out
}

/** The letter or digraph that starts at `i`: «dzi» and the soft «si / ci / zi / ni» only before a vowel. */
function segmentAt(lower: string, i: number): string {
  return SEGMENTS.find((x) => lower.startsWith(x, i) && (!SOFT_BEFORE_VOWEL.includes(x) || isVowel(lower[i + x.length]))) ?? lower[i]
}

const VOICED = ['b', 'd', 'g', 'w', 'z', 'ż', 'rz', 'ź', 'dz', 'dź', 'dż']
const VOICELESS = ['p', 't', 'k', 'f', 's', 'ś', 'sz', 'c', 'ć', 'cz', 'ch', 'h']
const SEGMENTS = ['dzi', 'dź', 'dż', 'dz', 'sz', 'cz', 'rz', 'ch', 'si', 'ci', 'zi', 'ni']

/** Exercise 09: voiced consonants read voiceless (end of word, before a voiceless one, «w» / «rz» after one) and the reverse (`prośba`, `także`). */
function devoicing(word: string): [number, number][] {
  const lower = word.toLowerCase()
  const seg: { s: number; e: number; g: string }[] = []
  for (let i = 0; i < lower.length;) {
    const g = segmentAt(lower, i)
    const core = ['si', 'ci', 'zi'].includes(g) ? ({ si: 'ś', ci: 'ć', zi: 'ź' } as Record<string, string>)[g] : g === 'dzi' ? 'dź' : g
    seg.push({ s: i, e: i + g.length, g: core })
    i += g.length
  }
  const out: [number, number][] = []
  seg.forEach((x, i) => {
    const next = seg[i + 1]
    const prev = seg[i - 1]
    const voiced = VOICED.includes(x.g)
    if (voiced && !next) out.push([x.s, x.e])
    else if (voiced && next && VOICELESS.includes(next.g) && x.g !== 'w' && x.g !== 'rz') out.push([x.s, x.e])
    else if ((x.g === 'w' || x.g === 'rz') && prev && VOICELESS.includes(prev.g)) out.push([x.s, x.e])
    else if (VOICELESS.includes(x.g) && next && VOICED.includes(next.g) && next.g !== 'w' && next.g !== 'rz') out.push([x.s, x.e])
  })
  return out
}

export function focusSpans(id: string, word: string): [number, number, number][] {
  if (id === '09') return devoicing(word).map(([s, e]) => [s, e, 0])
  const rule = RULES[id]
  if (!rule) return []
  const all = rule.groups.flatMap((g) => g.graphemes)
  return findGraphemes(word, all, true).map((m) => [m.s, m.e, rule.groups.findIndex((g) => g.graphemes.includes(m.grapheme))])
}

export function focusGroups(id: string): string[] {
  return RULES[id]?.groups.map((g) => g.label) ?? []
}

const STRESS_ANTEPENULT = /(liśmy|łyśmy|liście|łyście|byśmy|byście)$/
const STRESS_EXCEPTIONS: Record<string, number> = {
  // Index of the stressed vowel nucleus counted from the end (1 = last, 2 = penultimate, 3 = antepenultimate).
  uniwersytet: 3, czterysta: 3, siedemset: 3, osiemset: 3, dziewięćset: 3, rzeczpospolita: 3,
}

/** Vowel nuclei of a word: «i» before another vowel only softens the consonant and is not a nucleus. */
export function nuclei(word: string): [number, number][] {
  const lower = word.toLowerCase()
  const out: [number, number][] = []
  for (let i = 0; i < lower.length; i++) {
    if (!isVowel(lower[i])) continue
    if (lower[i] === 'i' && isVowel(lower[i + 1]) && i > 0 && !isVowel(lower[i - 1])) continue
    if (lower[i] === 'u' && lower[i - 1] === 'a' && out.length && out[out.length - 1][1] === i) continue
    out.push([i, i + 1])
  }
  return out
}

/** The stressed vowel: penultimate nucleus, antepenultimate for -yka / -ika nouns, -liśmy / -byśmy forms and a few numerals. */
export function stressVowel(word: string): [number, number] | null {
  const n = nuclei(word)
  if (n.length < 2) return null
  const lower = word.toLowerCase()
  let fromEnd = STRESS_EXCEPTIONS[lower] ?? 2
  if (n.length >= 3 && (STRESS_ANTEPENULT.test(lower) || /^(muzyk|matematyk|fizyk|gramatyk|polityk|republik|technik|logik|botanik|informatyk)[aiięąo]/.test(lower))) fromEnd = 3
  return n[Math.max(0, n.length - fromEnd)]
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function matchCase(original: string, replacement: string): string {
  return original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement
}

export interface Variant { spelling: string; pair: string }

const SOFT_LETTER: Record<string, string> = { 'ś': 's', 'ć': 'c', 'ź': 'z', 'ń': 'n', 'dź': 'dz' }

/**
 * Polish spelling after a swap: a soft consonant before a vowel is written with «i» (ś + a → sia, ź + i → zi, ś + y → si),
 * and after «sz cz rz ż dż» the vowel is «y», never «i» (lecz + i → leczy).
 */
export function orthography(word: string): string {
  return word
    .replace(/(dź|ś|ć|ź|ń)([aąeęioóuy])/g, (_, soft: string, vowel: string) => `${SOFT_LETTER[soft]}i${vowel === 'i' || vowel === 'y' ? '' : vowel}`)
    .replace(/(sz|cz|rz|dż|ż)i(?![aąeęoóu])/g, '$1y')
}

/** Every single-swap spelling of `word` that sounds different from it. */
export function variants(id: string, word: string): Variant[] {
  const rule = RULES[id]
  if (!rule) return []
  const lower = word.toLowerCase()
  const froms = [...new Set(rule.swaps.map(([from]) => from))]
  const matches = findGraphemes(word, froms)
  const out: Variant[] = []
  for (const m of matches) {
    for (const [from, to, pair] of rule.swaps) {
      if (from !== m.grapheme) continue
      // In exercise 01 an «i» before a vowel only softens the consonant (pies): it is not the vowel «i».
      if (from === 'i' && isVowel(lower[m.e])) continue
      const next = orthography(lower.slice(0, m.s) + to + lower.slice(m.e))
      if (soundKey(next) === soundKey(lower)) continue
      const spelling = matchCase(word, next)
      if (spelling !== word && !out.some((v) => v.spelling === spelling)) out.push({ spelling, pair })
    }
  }
  return out
}

export interface QuizDraft { word: number; answer: string; options: string[]; pair: string }

/**
 * Up to `max` quiz items from the gama words. Real words of the same exercise that are a variant come first
 * (a true minimal pair: kasa / Kasia / kasza); the order is fixed by a hash, so every build gives the same quiz.
 */
export function buildQuiz(id: string, gama: string[], vocabulary: Map<string, string>, max = 8): QuizDraft[] {
  const items: QuizDraft[] = []
  const used = new Set<string>()
  gama.forEach((answer, word) => {
    const key = answer.toLowerCase()
    if (used.has(key)) return
    const all = variants(id, answer)
    if (!all.length) return
    used.add(key)
    // A real word keeps its own spelling (Kasia, not kasia).
    const real = all.filter((v) => vocabulary.has(v.spelling.toLowerCase())).map((v) => ({ ...v, spelling: vocabulary.get(v.spelling.toLowerCase())! }))
    const rest = all.filter((v) => !vocabulary.has(v.spelling.toLowerCase())).sort((a, b) => hash(answer + a.spelling) - hash(answer + b.spelling))
    const picked = [...real, ...rest].slice(0, 2)
    const options = [answer, ...picked.map((v) => v.spelling)].sort((a, b) => hash(id + a) - hash(id + b))
    items.push({ word, answer, options, pair: picked[0].pair })
  })
  // Spread over the whole gama instead of taking its first lines.
  if (items.length <= max) return items
  const step = items.length / max
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)])
}
