// One-off copy of the author's texts from the Krok po kroku 2 course into content/teksty (the recordings are made
// by scripts/audio.py into content/audio/<voice>/). content/ is the source of truth; SOURCE.md5 records its state.
//   node scripts/sync-content.mjs [--from <czytanie dir>]
//   node scripts/sync-content.mjs --md5-only
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const DEFAULT = '/Users/szubar/Projects/Educational_courses_2026/Krok_po_kroku_2/czytanie'
const argFrom = process.argv.indexOf('--from')
const from = argFrom > 0 ? process.argv[argFrom + 1] : DEFAULT
const root = new URL('..', import.meta.url).pathname

const md5 = (file) => createHash('md5').update(readFileSync(file)).digest('hex')
const listFiles = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => !d.name.startsWith('.'))
  .flatMap((d) => (d.isDirectory() ? listFiles(join(dir, d.name)) : [join(dir, d.name)]))
const record = () => {
  const base = join(root, 'content')
  const lines = ['teksty', 'audio'].flatMap((dir) => listFiles(join(base, dir))).map((f) => relative(base, f)).sort().map((f) => `${md5(join(base, f))}  ${f}`)
  writeFileSync(join(base, 'SOURCE.md5'), `${lines.join('\n')}\n`)
  console.log(`content/SOURCE.md5: ${lines.length} файлів`)
}

// --md5-only: after an approved edit in content/, record the new state without copying anything.
if (process.argv.includes('--md5-only')) {
  record()
  process.exit(0)
}

if (!existsSync(join(from, 'teksty'))) {
  console.error(`Немає ${join(from, 'teksty')}`)
  process.exit(1)
}

const target = join(root, 'content', 'teksty')
mkdirSync(target, { recursive: true })
const files = readdirSync(join(from, 'teksty')).filter((f) => /^\d\d-[a-z-]+\.md$/.test(f)).sort()
for (const file of files) copyFileSync(join(from, 'teksty', file), join(target, file))
console.log(`teksty: ${files.length}`)
record()
