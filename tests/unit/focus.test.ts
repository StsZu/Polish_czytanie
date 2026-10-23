import { describe, expect, it } from 'vitest'
import { buildQuiz, focusSpans, HOMOPHONES, nuclei, orthography, RULES, soundKey, stressVowel, variants } from '../../src/core/content/focus.ts'

const marked = (id: string, w: string) => {
  let out = ''
  let p = 0
  for (const [s, e] of focusSpans(id, w)) {
    out += `${w.slice(p, s)}[${w.slice(s, e)}]`
    p = e
  }
  return out + w.slice(p)
}

describe('focus', () => {
  it('highlights the three rows in exercise 07 with their own group', () => {
    expect(focusSpans('07', 'Kasia')).toEqual([[2, 4, 1]])
    expect(focusSpans('07', 'kasza')).toEqual([[2, 4, 2]])
    expect(focusSpans('07', 'kasa')).toEqual([[2, 3, 0]])
    expect(marked('07', 'dzień')).toBe('[dzi]eń')
    expect(marked('07', 'chodzą')).toBe('cho[dz]ą')
  })

  it('takes digraphs whole: «sz» is not «s», «ch» is not «c»', () => {
    expect(marked('06', 'szkoła')).toBe('[sz]koła')
    expect(marked('06', 'rzeka')).toBe('[rz]eka')
    expect(marked('05', 'siostra')).toBe('[si]ostra')
    expect(marked('05', 'nic')).toBe('[n]ic')
    expect(marked('07', 'leci')).toBe('le[c]i')
    expect(focusSpans('07', 'leci')[0][2]).toBe(1)
    expect(marked('07', 'dzieci')).toBe('[dzi]e[c]i')
  })

  it('marks devoicing and voicing in exercise 09', () => {
    expect(marked('09', 'chleb')).toBe('chle[b]')
    expect(marked('09', 'wódka')).toBe('wó[d]ka')
    expect(marked('09', 'twój')).toBe('t[w]ój')
    expect(marked('09', 'prośba')).toBe('pro[ś]ba')
    expect(marked('09', 'także')).toBe('ta[k]że')
    expect(marked('09', 'woda')).toBe('woda')
  })

  it('finds no focus in exercises without letter rules', () => {
    expect(focusSpans('15', 'czy')).toEqual([])
  })
})

describe('stress', () => {
  const upper = (w: string) => {
    const s = stressVowel(w)
    return s ? w.slice(0, s[0]) + w.slice(s[0], s[1]).toUpperCase() + w.slice(s[1]) : w
  }
  it('falls on the penultimate syllable; «i» before a vowel is not a syllable', () => {
    expect(upper('sobota')).toBe('sobOta')
    expect(upper('Kasia')).toBe('KAsia')
    expect(upper('wcześnie')).toBe('wczEśnie')
    expect(upper('dom')).toBe('dom')
    expect(nuclei('ciocia')).toHaveLength(2)
  })
  it('knows the antepenultimate exceptions', () => {
    expect(upper('muzyka')).toBe('mUzyka')
    expect(upper('byliśmy')).toBe('bYliśmy')
    expect(upper('uniwersytet')).toBe('uniwErsytet')
    expect(upper('muzyk')).toBe('mUzyk')
  })
})

describe('quiz variants', () => {
  it('never offers a homophone of the answer', () => {
    for (const id of Object.keys(RULES)) {
      for (const word of ['rzeka', 'góra', 'herbata', 'może', 'morze', 'chleb', 'kasza', 'żaba', 'dżem', 'szczotka', 'ręka', 'łapa', 'ryba']) {
        for (const v of variants(id, word)) expect(soundKey(v.spelling), `${id} ${word} → ${v.spelling}`).not.toBe(soundKey(word))
      }
    }
    expect(HOMOPHONES).toContainEqual(['rz', 'ż'])
  })

  it('does not swap «rz» for «ż», «ó» for «u» or «h» for «ch»', () => {
    expect(variants('06', 'rzeka').map((v) => v.spelling)).not.toContain('żeka')
    expect(variants('03', 'góra')).toEqual([])
    expect(variants('09', 'chleb')).toEqual([])
  })

  it('keeps Polish spelling: soft before a vowel with «i», «y» after hushing consonants', () => {
    expect(orthography('kaśa')).toBe('kasia')
    expect(orthography('źaba')).toBe('ziaba')
    expect(orthography('śynka')).toBe('sinka')
    expect(orthography('leczi')).toBe('leczy')
    expect(variants('07', 'leci').map((v) => v.spelling)).toContain('leczy')
    expect(variants('07', 'chodzą').map((v) => v.spelling)).not.toContain('czhodzą')
  })

  it('prefers real words of the exercise and keeps their spelling', () => {
    const vocabulary = new Map([['kasa', 'kasa'], ['kasia', 'Kasia'], ['kasza', 'kasza']])
    const [item] = buildQuiz('07', ['kasa'], vocabulary)
    expect([...item.options].sort()).toEqual(['Kasia', 'kasa', 'kasza'])
  })

  it('is the same on every build', () => {
    const vocabulary = new Map<string, string>()
    expect(buildQuiz('02', ['łapa', 'mały', 'lampa'], vocabulary)).toEqual(buildQuiz('02', ['łapa', 'mały', 'lampa'], vocabulary))
  })
})
