// content/teksty/*.md + content/audio/<voice>/* → public/data/cwiczenia.json + public/audio/<voice>-NN-section.<md5>.mp3.
// Every check failing stops the build. `--report` also writes build/report.md (session length, quiz size).
// `--tts-plan` only writes build/tts-plan.json: the text of every section and its pieces for scripts/audio.py.
//   node --experimental-strip-types scripts/data.ts [--report | --tts-plan]
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ContentFile, Exercise, Level, Section, SectionKey, Voice, VoiceAudio } from '../src/contracts.ts'
import { SECTIONS, TARGET_WPM } from '../src/contracts.ts'
import { buildSection, checkExercise, FIELDS, parseFile, ruleParagraphs, STRESS_ID, wordTimes, type Alignment, type RawSection } from '../src/core/content/parse.ts'
import { buildQuiz, focusGroups, focusSpans, QUIZ_SKIP, QUIZ_SKIP_TEXT, RULES, stressVowel } from '../src/core/content/focus.ts'
import { estimateSession, FLASH_START_MS } from '../src/core/content/estimate.ts'

const root = new URL('..', import.meta.url).pathname
const TEKSTY = join(root, 'content/teksty')
const AUDIO = join(root, 'content/audio')
const OUT_DATA = join(root, 'public/data/cwiczenia.json')
const OUT_AUDIO = join(root, 'public/audio')
const report = process.argv.includes('--report')
/** The first voice is the main one (scripts/audio.py makes the recordings). */
const VOICES: Voice[] = [{ id: 'alex', name: 'Alex' }, { id: 'beata', name: 'Beata' }]
const ttsPlan = process.argv.includes('--tts-plan')
const plan: { stem: string; level: number; kind: SectionKey; text: string; pieces: [number, number][] }[] = []

const md5 = (data: string | Buffer) => createHash('md5').update(data).digest('hex')
const errors: string[] = []
const warnings: string[] = []

if (!ttsPlan) {
  rmSync(OUT_AUDIO, { recursive: true, force: true })
  mkdirSync(OUT_AUDIO, { recursive: true })
  mkdirSync(join(root, 'public/data'), { recursive: true })
}

const files = readdirSync(TEKSTY).filter((f) => /^\d\d-.+\.md$/.test(f)).sort()
const exercises: Exercise[] = []
let allTexts = ''

for (const file of files) {
  const source = readFileSync(join(TEKSTY, file), 'utf8')
  allTexts += source
  const problems: string[] = []
  const fail = (list: string[]) => errors.push(...list.map((p) => `${file}: ${p}`))
  let parsed: ReturnType<typeof parseFile>
  try {
    parsed = parseFile(source)
  } catch (error) {
    fail([(error as Error).message])
    continue
  }
  const { meta, sections } = parsed
  for (const f of FIELDS) if (!(f in meta)) problems.push(`у шапці немає поля ${f}`)
  for (const s of [...SECTIONS, 'uwaga']) if (!(s in sections)) problems.push(`немає секції ${s}`)
  if (problems.length) {
    fail(problems)
    continue
  }
  const id = String(meta.id)
  const level = Number(meta.poziom) as Level
  const name = /^(\d\d)-(.+)\.md$/.exec(file)!
  if (name[1] !== id || name[2] !== meta.slug) problems.push(`ім'я файлу не відповідає id=${id} slug=${String(meta.slug)}`)

  const raw = {} as Record<SectionKey, RawSection>
  for (const key of SECTIONS) {
    try {
      raw[key] = buildSection(key, sections[key], id, problems)
    } catch (error) {
      problems.push(`${key}: ${(error as Error).message}`)
    }
  }
  if (problems.length) {
    fail(problems)
    continue
  }
  checkExercise(id, level, raw, problems, warnings)
  if (ttsPlan) {
    // Gama: every word on its own; pasaże: every line; utwór: every unit (sentence or dialogue line).
    for (const key of SECTIONS) {
      const { text, words, units } = raw[key]
      const pieces: [number, number][] = key === 'gama'
        ? words.map((w) => [w.s, w.k])
        : key === 'pasaze'
          ? units.map((u) => [u.s, u.k + 1])
          : units.map((u) => [u.s, u.k])
      plan.push({ stem: `${id}-${key}`, level, kind: key, text, pieces })
    }
    continue
  }

  const built = {} as Record<SectionKey, Section>
  for (const key of SECTIONS) {
    const stem = `${id}-${key}`
    const section = raw[key]
    const recorded: (VoiceAudio | null)[] = VOICES.map((voice) => {
      const mp3 = join(AUDIO, voice.id, `${stem}.mp3`)
      const alignPath = join(AUDIO, voice.id, `${stem}.align.json`)
      if (!existsSync(mp3) || !existsSync(alignPath)) {
        problems.push(`${voice.id}/${stem}: немає mp3 або align.json`)
        return null
      }
      const align = JSON.parse(readFileSync(alignPath, 'utf8')) as Alignment
      const times = wordTimes(section, align, `${voice.id}/${stem}`, problems)
      if (!times) return null
      for (const [i, t] of times.entries()) if (!(t.do > t.od)) problems.push(`${voice.id}/${stem}: слово ${section.words[i].t} без тривалості`)
      const data = readFileSync(mp3)
      const name = `${voice.id}-${stem}.${md5(data).slice(0, 8)}.mp3`
      copyFileSync(mp3, join(OUT_AUDIO, name))
      return {
        audio: `audio/${name}`,
        bytes: statSync(mp3).size,
        duration: Math.round(align.character_end_times_seconds.at(-1)! * 1000) / 1000,
        times: times.map((t) => [t.od, t.do]),
      }
    })
    const main = recorded[0]
    const alt: Record<string, VoiceAudio> = {}
    VOICES.forEach((voice, i) => {
      if (i && recorded[i]) alt[voice.id] = recorded[i]!
    })
    const words = section.words.map((w, i) => ({
      t: w.t,
      s: w.s,
      k: w.k,
      od: main?.times[i][0] ?? 0,
      do: main?.times[i][1] ?? 0,
      line: w.line,
      focus: focusSpans(id, w.t),
      stress: id === STRESS_ID ? w.marked : stressVowel(w.t),
      syl: w.syl,
    }))
    const units = section.units.map((u) => ({ text: u.text, words: u.words, od: words[u.words[0]].od, do: words[u.words[1]].do }))
    built[key] = { audio: main?.audio ?? null, bytes: main?.bytes ?? 0, duration: main?.duration ?? 0, alt, text: section.text, words, units }
  }

  const gama = built.gama.words
  const vocabulary = new Map(SECTIONS.flatMap((k) => built[k].words.map((w) => [w.t.toLowerCase(), w.t] as [string, string])).reverse())
  const hasSwaps = (RULES[id]?.swaps.length ?? 0) > 0
  const quiz = hasSwaps ? buildQuiz(id, gama.map((w) => w.t), vocabulary) : []
  const ruleExamples: number[] = []
  for (const [i, w] of gama.entries()) {
    if (ruleExamples.length >= 4) break
    const line = w.line
    if (ruleExamples.some((j) => gama[j].line === line)) continue
    if (w.focus.length || id === STRESS_ID || w.syl || !RULES[id]) ruleExamples.push(i)
  }

  if (problems.length) {
    fail(problems)
    continue
  }
  exercises.push({
    id,
    slug: String(meta.slug),
    title: String(meta.tytul),
    level,
    focus: (Array.isArray(meta.fokus) ? meta.fokus : [meta.fokus]).map(String),
    goal: String(meta.cel),
    rule: ruleParagraphs(sections.uwaga),
    minutes: Number(meta.czas_min),
    targetWpm: TARGET_WPM[level],
    focusGroups: focusGroups(id),
    sections: built,
    quiz,
    quizSkip: quiz.length ? null : QUIZ_SKIP[id] ?? QUIZ_SKIP_TEXT,
    ruleExamples,
  })
}

if (ttsPlan) {
  mkdirSync(join(root, 'build'), { recursive: true })
  writeFileSync(join(root, 'build/tts-plan.json'), JSON.stringify(plan, null, 1))
  console.log(`→ build/tts-plan.json: ${plan.length} секцій, ${plan.reduce((n, p) => n + p.pieces.length, 0)} шматків`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  process.exit(errors.length ? 1 : 0)
}

const ids = exercises.map((e) => e.id)
const expected = Array.from({ length: 21 }, (_, i) => String(i + 1).padStart(2, '0'))
const missing = expected.filter((id) => !ids.includes(id))
if (missing.length) errors.push(`немає вправ ${missing.join(', ')} — ${ids.length} з 21`)
const extra = ids.filter((id) => !expected.includes(id))
if (extra.length) errors.push(`зайві id: ${extra.join(', ')}`)

const content: ContentFile = { version: 1, voices: VOICES, built: new Date().toISOString().slice(0, 19), textsMd5: md5(allTexts), exercises }
writeFileSync(OUT_DATA, JSON.stringify(content))

const rows = exercises.map((e) => ({ e, est: estimateSession(e) }))
const table = [
  '| № | Вправа | Рівень | Сесія, хв | Без кроку 5, хв | «Що прозвучало?» | Аудіо, МБ |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(({ e, est }) => `| ${e.id} | ${e.title} | ${e.level} | ${est.total.toFixed(1)} | ${est.withoutShadow.toFixed(1)} | ${e.quiz.length} | ${(SECTIONS.reduce((n, k) => n + e.sections[k].bytes, 0) / 1048576).toFixed(1)} |`),
].join('\n')
console.log(table)
if (report) {
  mkdirSync(join(root, 'build'), { recursive: true })
  const outOfRange = rows.filter(({ est }) => est.total < 4 || est.total > 8).map(({ e }) => e.id)
  writeFileSync(join(root, 'build/report.md'), `# Звіт даних\n\nЗібрано: ${content.built}. Тексти md5: \`${content.textsMd5}\`.\n\n` +
    `Тривалість сесії — оцінка: правило (звук прикладів + 2 с) + гама (звук + 3 с на рядок) + «Що прозвучало?» (звук слова + 3 с) + ` +
    `пасажі (звук + 3 с + показ ${Object.values(FLASH_START_MS).join(' / ')} мс на фразу) + твір із диктором (звук) + холодне читання й одна спроба на темп (слова / ціль × 2).\n\n` +
    `${table}\n\nПоза 4–8 хв: ${outOfRange.length ? outOfRange.join(', ') : 'немає'}.\n`)
  console.log('→ build/report.md')
}
const audioBytes = exercises.reduce((n, e) => n + SECTIONS.reduce((m, k) => m + e.sections[k].bytes + Object.values(e.sections[k].alt).reduce((a, v) => a + v.bytes, 0), 0), 0)
console.log(`→ public/data/cwiczenia.json: ${exercises.length} вправ, ${(statSync(OUT_DATA).size / 1024).toFixed(0)} КБ; аудіо ${(audioBytes / 1048576).toFixed(1)} МБ`)
console.log(`помилок: ${errors.length} · попереджень: ${warnings.length}`)
for (const e of errors) console.error(`  ✗ ${e}`)
for (const w of warnings) console.log(`  · ${w}`)
process.exit(errors.length ? 1 : 0)
