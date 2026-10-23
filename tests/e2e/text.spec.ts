// T05 / T06: the reading text (focus, sizes, contrast, both themes) and the stop of a word fragment.
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

mkdirSync('build/visual', { recursive: true })

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

/** WCAG contrast of two computed colours `rgb(...)`; a translucent background is blended over the page background. */
const CONTRAST = `
  window.__contrast = (fg, bg, page) => {
    const parse = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
    const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
    const lum = ({ r, g, b }) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
    const base = parse(page)
    const back = blend(parse(bg), base)
    const a = lum(parse(fg)), b = lum(back)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }`

for (const theme of ['light', 'dark'] as const) {
  test(`reading text in the ${theme} theme: size, measure, contrast of every highlight (SC-14)`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.addInitScript(CONTRAST)
    await page.goto(`./?theme=${theme}#/sluchaj/07`)
    const reading = page.getByTestId('reading')
    await expect(reading.locator('.f0').first()).toBeVisible()
    const style = await reading.evaluate((el) => {
      const cs = getComputedStyle(el)
      const probe = document.createElement('span')
      probe.textContent = '0'.repeat(10)
      el.appendChild(probe)
      const ch = probe.getBoundingClientRect().width / 10
      probe.remove()
      return { size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize), widthInCh: el.getBoundingClientRect().width / ch }
    })
    expect(style.size).toBeGreaterThanOrEqual(22)
    expect(style.size).toBeLessThanOrEqual(30)
    expect(style.line).toBeGreaterThanOrEqual(1.6)
    expect(style.line).toBeLessThanOrEqual(1.8)
    expect(style.widthInCh).toBeLessThanOrEqual(65.5)
    for (const cls of ['f0', 'f1', 'f2']) {
      const ratio = await reading.locator(`.${cls}`).first().evaluate((el) => {
        const page = getComputedStyle(document.body).backgroundColor
        return (window as unknown as { __contrast: (a: string, b: string, c: string) => number }).__contrast(getComputedStyle(el).color, getComputedStyle(el).backgroundColor, page)
      })
      expect(ratio, cls).toBeGreaterThanOrEqual(4.5)
    }
    await noHorizontalScroll(page)
    await page.screenshot({ path: `build/visual/text-07-gama-${theme}-${info.project.name}.png`, fullPage: true })

    await page.getByTestId('section-pasaze').click()
    await expect(reading.locator('.faint').first()).toBeVisible()
    await page.screenshot({ path: `build/visual/text-07-pasaze-${theme}-${info.project.name}.png`, fullPage: true })

    await page.goto(`./?theme=${theme}#/sluchaj/21`)
    await page.getByTestId('section-utwor').click()
    await expect(reading.locator('.f')).toHaveCount(0)
    await expect(reading.locator('p.para').first()).toBeVisible()
    await noHorizontalScroll(page)
    await page.screenshot({ path: `build/visual/text-21-utwor-${theme}-${info.project.name}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('utwór keeps the punctuation and the dialogue lines of the text', async ({ page }) => {
  await page.goto('./#/sluchaj/07')
  await page.getByTestId('section-utwor').click()
  const text = await page.getByTestId('reading').innerText()
  expect(text).toContain('Kasia przy kasie płaci za kaszę. Cena niska, kasa czysta, ale ciemno. Czemu? Wieczór.')
  expect(text).toContain('— Koś trawę! — woła tata. — Trzeba wozić ziemię.')
  expect(text.split('\n').filter(Boolean)).toHaveLength(3)
})

test('exercise 10 shows the stress in the gama, exercise 11 the syllables', async ({ page }) => {
  await page.goto('./#/sluchaj/10')
  await expect(page.getByTestId('word').filter({ hasText: /^muzyka$/ }).first().locator('.stress')).toHaveText('mu')
  await expect(page.getByTestId('word').filter({ hasText: /^kobieta$/ }).first().locator('.stress')).toHaveText('bie')
  await page.goto('./#/sluchaj/11')
  await expect(page.getByTestId('reading')).toContainText('przed-sta-wi-ciel')
})

test.describe(() => {
  // The stop depends on timers of a loaded machine: one retry, and the measured time goes to the log.
  test.describe.configure({ retries: 1 })
test('a tapped word sounds from od − 0.08 to do + 0.08 s and stops ≤ 0.05 s after (SC-03)', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit')
  await page.addInitScript(() => {
    const w = window as unknown as { __pauses: number[]; __plays: number }
    w.__pauses = []
    w.__plays = 0
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      w.__plays++
      return play.call(this)
    }
    const pause = HTMLMediaElement.prototype.pause
    HTMLMediaElement.prototype.pause = function () {
      w.__pauses.push(this.currentTime)
      return pause.call(this)
    }
  })
  await page.goto('./#/sluchaj/07')
  const data = await page.evaluate(() => fetch('data/cwiczenia.json').then((r) => r.json()))
  const kasia = data.exercises[6].sections.gama.words[1]
  expect(kasia.t).toBe('Kasia')
  await page.getByTestId('word').nth(1).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pauses: number[] }).__pauses.length), { timeout: 10_000 }).toBeGreaterThan(0)
  const stoppedAt = await page.evaluate(() => (window as unknown as { __pauses: number[] }).__pauses.at(-1)!)
  console.log(`SC-03: Kasia ends at ${kasia.do + 0.08} s, stopped at ${stoppedAt.toFixed(3)} s`)
  expect(stoppedAt).toBeGreaterThanOrEqual(kasia.do + 0.08 - 0.01)
  expect(stoppedAt).toBeLessThanOrEqual(kasia.do + 0.08 + 0.05)
  expect(await page.evaluate(() => (window as unknown as { __plays: number }).__plays)).toBe(1)
})
})
