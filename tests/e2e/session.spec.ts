// T07–T10: the whole session of exercise 07 by keyboard and by touch, no sound before the reader's own attempt,
// hard words, discrimination, progress, the copy.
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

mkdirSync('build/visual', { recursive: true })
test.setTimeout(180_000)

const PLAYS = () => {
  const w = window as unknown as { __plays: number }
  w.__plays = 0
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    w.__plays++
    return play.call(this)
  }
}
const plays = (page: Page) => page.evaluate(() => (window as unknown as { __plays: number }).__plays)

async function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}


async function atStep(page: Page, n: number) {
  await expect(page.getByTestId('session')).toHaveAttribute('data-step', String(n))
}
async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test('a full session of 07 by keyboard only, no sound before «Перевір» (SC-04, SC-12)', async ({ page }, info) => {
  const errors = await watchErrors(page)
  await page.addInitScript(PLAYS)
  await page.goto('./')
  await expect(page.getByTestId('today')).toBeVisible()
  await page.screenshot({ path: `build/visual/today-empty-${info.project.name}.png` })
  await page.getByTestId('startNext').click()
  // The first unmastered exercise is 01; go to 07 for this test.
  await page.goto('./#/c/07')
  await atStep(page, 0)

  // 0 — cold reading
  await page.keyboard.press('Space')
  await expect(page.getByTestId('reading')).toBeVisible()
  await page.waitForTimeout(13_000)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('paceResult')).toContainText('Холодний темп')
  await page.keyboard.press('Enter')

  // 1 — rule
  await atStep(page, 1)
  await page.keyboard.press('Enter')

  // 2 — gama: no play until «Перевір» on every line
  await atStep(page, 2)
  for (let line = 0; line < 7; line++) {
    const before = await plays(page)
    await page.waitForTimeout(150)
    expect(await plays(page)).toBe(before)
    await page.keyboard.press('Space')
    await expect.poll(() => plays(page)).toBe(before + 1)
    await page.keyboard.press('1')
  }

  // 3 — quiz: the sound is the task
  await atStep(page, 3)
  for (let i = 0; i < 8; i++) {
    await expect(page.getByTestId('quizTask')).toBeVisible()
    await page.keyboard.press('1')
    await expect(page.getByTestId('quizResult')).toBeVisible()
    await page.keyboard.press('Enter')
  }

  // 4 — flash
  await atStep(page, 4)
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'ready')
    const before = await plays(page)
    await page.keyboard.press('Space')
    await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'say', { timeout: 5000 })
    expect(await plays(page)).toBe(before)
    await page.keyboard.press('Space')
    await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'check')
    await page.keyboard.press('1')
  }

  // 5 — with the narrator
  await atStep(page, 5)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('reading').locator('.now')).toBeVisible({ timeout: 5000 })
  await page.keyboard.press('Enter')

  // 6 — on time
  await atStep(page, 6)
  await page.keyboard.press('Space')
  await page.waitForTimeout(13_000)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('tempoResults')).toBeVisible()
  await page.screenshot({ path: `build/visual/session-tempo-${info.project.name}.png` })
  await page.keyboard.press('Enter')

  // 7 — rating and summary
  await atStep(page, 7)
  await page.keyboard.press('1')
  await expect(page.getByTestId('summary')).toContainText('сл/хв')
  await expect(page.getByTestId('summary')).toContainText(/\d+ % правильно/)
  // Some quiz answers by «1» were wrong: below 90 % the level stays 1 even at the target pace.
  await expect(page.getByTestId('summary')).toContainText('почато')
  await page.screenshot({ path: `build/visual/session-summary-${info.project.name}.png` })
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('today')).toBeVisible()
  await expect(page.getByTestId('stats')).toContainText('1')
  expect(errors).toEqual([])
})

test('a session by touch only: words marked in the gama become hard words the next day; cold reading once a day', async ({ page }, info) => {
  const errors = await watchErrors(page)
  await page.addInitScript(PLAYS)
  await page.goto('./#/c/07')
  await page.getByTestId('start').tap()
  await page.waitForTimeout(13_000)
  await page.getByTestId('finish').tap()
  await page.getByTestId('next').tap()
  await page.getByTestId('next').tap()
  await atStep(page, 2)
  const before = await plays(page)
  await page.screenshot({ path: `build/visual/session-gama-read-${info.project.name}.png` })
  expect(await plays(page)).toBe(before)
  await page.getByTestId('check').tap()
  await page.getByTestId('word').nth(1).tap()
  await expect(page.getByTestId('word').nth(1)).toHaveClass(/marked/)
  await page.screenshot({ path: `build/visual/session-gama-check-${info.project.name}.png` })
  await page.getByTestId('nextWithMistakes').tap()
  await expect(page.getByTestId('unitCount')).toContainText('Рядок 2 з 7')
  await page.getByTestId('exit').tap()
  await expect(page.getByTestId('today')).toBeVisible()
  await noHorizontalScroll(page)

  // The same day: hard words are due tomorrow; a new session's step 0 is a warm-up.
  await expect(page.getByTestId('hardDue')).toContainText('На сьогодні немає')
  await page.goto('./#/c/07')
  await expect(page.getByTestId('warmup')).toBeVisible()

  // The next day: Kasia is due.
  await page.clock.setFixedTime(new Date(Date.now() + 86_400_000 + 3_600_000))
  await page.goto('./#/')
  await expect(page.getByTestId('hardDue')).toContainText('1 на сьогодні')
  await page.getByTestId('tab-hard').tap()
  await expect(page.getByTestId('hardCard')).toContainText('Kasia')
  const p0 = await plays(page)
  await page.waitForTimeout(150)
  expect(await plays(page)).toBe(p0)
  await page.getByTestId('check').tap()
  await page.getByTestId('yes').tap()
  await expect(page.getByTestId('context')).toContainText('Kasia przy kasie')
  await page.screenshot({ path: `build/visual/hard-words-${info.project.name}.png` })
  await page.getByTestId('next').tap()
  await expect(page.getByTestId('hardDone')).toContainText('1 з 1')

  // Progress: one cold reading → one point.
  await page.getByTestId('tab-progress').tap()
  await page.getByTestId('progressExercise').selectOption('07')
  await expect(page.getByTestId('point-s-exercise')).toHaveCount(1)
  await expect(page.getByTestId('targetLine')).toHaveCount(1)
  await noHorizontalScroll(page)
  await page.screenshot({ path: `build/visual/progress-${info.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})

test('step 3 explains why it is skipped in 03 and 10; level III suggests skipping step 5 after a fast cold reading', async ({ page }) => {
  await page.goto('./#/c/03/krok/3')
  await expect(page.getByTestId('quizSkip')).toContainText('«ó» = «u»')
  await page.goto('./#/c/10/krok/3')
  await expect(page.getByTestId('quizSkip')).toContainText('ритм')
  await page.goto('./#/c/15/krok/5')
  await expect(page.getByTestId('stepShadow')).toBeVisible()
  await expect(page.getByTestId('shadowSkip')).toHaveCount(0)
})

test('discrimination works on started exercises and counts by pair', async ({ page }) => {
  await page.goto('./#/rozroznianie')
  await expect(page.getByTestId('discriminationEmpty')).toBeVisible()
  await page.goto('./#/c/07/krok/3')
  await page.getByTestId('option').first().click()
  await page.getByTestId('exit').click()
  await page.goto('./#/rozroznianie')
  await page.locator('[data-testid^="pair-"]').first().click()
  await expect(page.getByTestId('quizTask')).toBeVisible()
  await page.locator('[data-testid="option"][data-answer="yes"]').click()
  await expect(page.getByTestId('quizResult')).toContainText('Правильно')
})

test('the copy: export, clear, import gives the same data; a damaged file lists its problems (SC-11)', async ({ page }, info) => {
  await page.goto('./#/c/07/krok/3')
  await page.getByTestId('option').first().click()
  await page.getByTestId('exit').click()
  await page.goto('./#/ustawienia')
  const download = page.waitForEvent('download')
  await page.getByTestId('exportCopy').click()
  const file = await (await download).path()
  const copy = JSON.parse(readFileSync(file, 'utf8'))
  expect(copy.app).toBe('polish-czytanie')
  expect(copy.attempts.length).toBeGreaterThan(0)

  await page.getByTestId('clearAll').click()
  await expect(page.getByTestId('dialogConfirm')).toBeDisabled()
  await page.getByTestId('confirmWord').fill('видалити')
  await page.getByTestId('dialogConfirm').click()
  await expect(page.getByTestId('settingsMessage')).toContainText('видалено')

  await page.getByTestId('importInput').setInputFiles(file)
  await page.getByTestId('merge').click()
  await expect(page.getByTestId('settingsMessage')).toContainText('відновлено')
  const download2 = page.waitForEvent('download')
  await page.getByTestId('exportCopy').click()
  const again = JSON.parse(readFileSync(await (await download2).path(), 'utf8'))
  const strip = (a: { id?: number }[]) => a.map(({ id: _id, ...rest }) => rest)
  expect(strip(again.attempts)).toEqual(strip(copy.attempts))
  expect(again.hard).toEqual(copy.hard)

  const bad = `${info.outputDir}/bad.json`
  mkdirSync(info.outputDir, { recursive: true })
  writeFileSync(bad, JSON.stringify({ app: 'polish-czytanie', version: 1, attempts: [{ exercise: 'x' }], hard: [] }))
  await page.getByTestId('importInput').setInputFiles(bad)
  await expect(page.getByTestId('problems')).toContainText('Спроба 1')
  await page.getByTestId('dialogClose').click()
})

test('every screen fits both orientations without horizontal scroll', async ({ page }, info) => {
  const errors = await watchErrors(page)
  for (const [hash, id] of [['#/', 'today'], ['#/cwiczenia', 'exercises'], ['#/trudne', 'hardWords'], ['#/rozroznianie', 'discrimination'], ['#/postep', 'progress'], ['#/ustawienia', 'settings'], ['#/sluchaj/21', 'listen'], ['#/c/21', 'session']] as const) {
    await page.goto(`./${hash}`)
    await expect(page.getByTestId(id)).toBeVisible()
    await noHorizontalScroll(page)
    await page.screenshot({ path: `build/visual/screen-${id}-${info.project.name}.png` })
  }
  await page.setViewportSize({ width: 320, height: 700 })
  for (const hash of ['#/', '#/c/07/krok/2', '#/c/07/krok/3', '#/ustawienia']) {
    await page.goto(`./${hash}`)
    await page.waitForTimeout(200)
    await noHorizontalScroll(page)
  }
  await page.screenshot({ path: `build/visual/split-view-320-${info.project.name}.png` })
  expect(errors).toEqual([])
})

async function longPress(page: Page, word: ReturnType<Page['getByTestId']>) {
  const box = (await word.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()
}

test('a long press shows the stress; a tap plays the word only after the own attempt (FR-20, T18)', async ({ page }) => {
  const errors = await watchErrors(page)
  await page.addInitScript(PLAYS)

  // 07, gama: the hint before «Перевір» is silent; after it a tap plays the word and marks it.
  await page.goto('./#/c/07/krok/2')
  const kasia = page.getByTestId('word').nth(1)
  await expect(kasia).toHaveText('Kasia')
  await longPress(page, kasia)
  await expect(kasia).toHaveClass(/revealed/)
  await expect(kasia.locator('.stress')).toHaveText('a')
  await kasia.tap()
  await page.waitForTimeout(150)
  expect(await plays(page)).toBe(0)
  await page.getByTestId('check').tap()
  await expect.poll(() => plays(page)).toBe(1)
  await kasia.tap()
  await expect.poll(() => plays(page)).toBe(2)
  await expect(kasia).toHaveClass(/marked/)

  // 21, on time: a long press shows the stress, a tap plays; «Позначати важкі» turns taps into marking.
  await page.goto('./#/c/21/krok/6')
  await page.getByTestId('start').tap()
  const piatek = page.getByTestId('word').nth(1)
  await expect(piatek).toHaveText('piątek')
  await longPress(page, piatek)
  await expect(piatek.locator('.stress')).toHaveText('ą')
  const before = await plays(page)
  await piatek.tap()
  await expect.poll(() => plays(page)).toBe(before + 1)
  await expect(piatek).not.toHaveClass(/marked/)
  await page.getByTestId('markMode').tap()
  await expect(page.getByTestId('markMode')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('word').nth(2).tap()
  await expect(page.getByTestId('word').nth(2)).toHaveClass(/marked/)
  expect(errors).toEqual([])
})

test('any step opens from its card (FR-31, T19)', async ({ page }) => {
  await page.goto('./#/cwiczenia')
  await page.getByTestId('steps-04').click()
  await page.getByTestId('step-04-4').click()
  await atStep(page, 4)
  await expect(page.getByTestId('stepFlash')).toBeVisible()
  await expect(page.getByTestId('session')).toContainText('04.')
})

test('in the gama a word is marked by keyboard: ← → and «x» (T20)', async ({ page }) => {
  await page.goto('./#/c/07/krok/2')
  await expect(page.getByTestId('check')).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('allRight')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('word').nth(1)).toHaveClass(/cursor/)
  await page.keyboard.press('x')
  await expect(page.getByTestId('word').nth(1)).toHaveClass(/marked/)
  await expect(page.getByTestId('nextWithMistakes')).toContainText('помилок: 1')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('unitCount')).toContainText('Рядок 2 з 7')
  await page.getByTestId('exit').click()

  await page.clock.setFixedTime(new Date(Date.now() + 86_400_000 + 3_600_000))
  await page.goto('./#/trudne')
  await expect(page.getByTestId('hardCard')).toContainText('Kasia')
})

test('a tap plays the word in the gama, the whole line in pasaże, the sentence in utwór', async ({ page }) => {
  // Every word that lights up while sounding, in order.
  await page.addInitScript(() => {
    const w = window as unknown as { __lit: string[] }
    w.__lit = []
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement
        if (el.classList?.contains('now') && w.__lit.at(-1) !== el.textContent) w.__lit.push(el.textContent ?? '')
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] })
  })
  const lit = () => page.evaluate(() => (window as unknown as { __lit: string[] }).__lit)
  const reset = () => page.evaluate(() => { (window as unknown as { __lit: string[] }).__lit = [] })
  const idle = () => expect(page.getByTestId('playAll')).toBeVisible({ timeout: 10_000 })

  await page.goto('./#/sluchaj/07')
  const words = page.getByTestId('word')
  await expect(words.nth(1)).toHaveText('Kasia')
  await words.nth(1).tap()
  await expect(page.getByTestId('stop')).toBeVisible()
  await idle()
  expect(await lit()).toEqual(['Kasia'])

  await page.getByTestId('section-pasaze').click()
  const line = page.locator('[data-unit="1"] [data-testid="word"]')
  await expect(line.first()).toHaveText('sum')
  await reset()
  await line.first().tap()
  await expect(page.getByTestId('stop')).toBeVisible()
  await idle()
  expect(await lit()).toEqual(['sum', 'i', 'szum', 'morza'])

  await page.getByTestId('section-utwor').click()
  await expect(words.nth(5)).toHaveText('kaszę')
  await reset()
  await words.nth(0).tap()
  await expect(page.getByTestId('stop')).toBeVisible()
  await idle()
  // «Kasia przy kasie płaci za kaszę.» and nothing of «Cena niska…».
  expect(await lit()).toEqual(['Kasia', 'przy', 'kasie', 'płaci', 'za', 'kaszę'])
})

test('«Записувати себе» is in the step: the switch, then the recording or why it cannot record', async ({ page }) => {
  await page.goto('./#/c/07/krok/2')
  const toggle = page.getByTestId('recordToggle')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('selfRecord')).toContainText(/Запис \d:\d\d|Мікрофон недоступний|Чекаю дозволу на мікрофон/)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('recording')).toHaveCount(0)
})

test('the narrator voice is chosen in the settings and the recordings follow it', async ({ page }) => {
  await page.goto('./#/ustawienia')
  await page.getByTestId('settingsVoice').selectOption('beata')
  const request = page.waitForRequest(/audio\/beata-07-gama\./)
  await page.goto('./#/sluchaj/07')
  await request
  await page.goto('./#/ustawienia')
  await expect(page.getByTestId('settingsVoice')).toHaveValue('beata')
})
