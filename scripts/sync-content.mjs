// One-off copy of the author's texts and recordings from the Krok po kroku 2 course into content/.
// After the copy, content/ is the source of truth; SOURCE.md5 records what was copied.
//   node scripts/sync-content.mjs [--from <czytanie dir>]
//   node scripts/sync-content.mjs --md5-only
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT = '/Users/szubar/Projects/Educational_courses_2026/Krok_po_kroku_2/czytanie'
const argFrom = process.argv.indexOf('--from')
const from = argFrom > 0 ? process.argv[argFrom + 1] : DEFAULT
const root = new URL('..', import.meta.url).pathname

const md5 = (file) => createHash('md5').update(readFileSync(file)).digest('hex')

// --md5-only: after an approved edit in content/, record the new state without copying anything.
if (process.argv.includes('--md5-only')) {
  const lines = ['teksty', 'audio'].flatMap((dir) => readdirSync(join(root, 'content', dir)).filter((f) => !f.startsWith('.')).sort().map((f) => `${md5(join(root, 'content', dir, f))}  ${dir}/${f}`))
  writeFileSync(join(root, 'content', 'SOURCE.md5'), `${lines.join('\n')}\n`)
  console.log(`content/SOURCE.md5: ${lines.length} файлів`)
  process.exit(0)
}

if (!existsSync(join(from, 'teksty'))) {
  console.error(`Немає ${join(from, 'teksty')}`)
  process.exit(1)
}

const lines = []
for (const [dir, pattern] of [['teksty', /^\d\d-[a-z-]+\.md$/], ['audio', /^\d\d-(gama|pasaze|utwor)\.(mp3|align\.json)$/]]) {
  const target = join(root, 'content', dir)
  mkdirSync(target, { recursive: true })
  const files = readdirSync(join(from, dir)).filter((f) => pattern.test(f)).sort()
  for (const file of files) {
    copyFileSync(join(from, dir, file), join(target, file))
    lines.push(`${md5(join(target, file))}  ${dir}/${file}`)
  }
  console.log(`${dir}: ${files.length}`)
}
writeFileSync(join(root, 'content', 'SOURCE.md5'), `${lines.join('\n')}\n`)
console.log(`content/SOURCE.md5: ${lines.length} файлів`)
