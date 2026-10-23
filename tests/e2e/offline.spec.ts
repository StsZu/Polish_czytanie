// T11: the GitHub Pages build under /Polish_czytanie/ — manifest, service worker scope, a whole session of 07
// without internet (SC-09), and an update that keeps the progress and the downloaded audio (SC-10).
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

test.setTimeout(240_000)
const swFile = new URL('../../dist-pages/sw.js', import.meta.url)

const audioKeys = (page: Page) => page.evaluate(async () => (await (await caches.open('audio-v1')).keys()).map((r) => new URL(r.url).pathname))
const counts = (page: Page) => page.evaluate(() => new Promise<{ attempts: number; hard: number }>((resolve, reject) => {
  const open = indexedDB.open('polish-czytanie')
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const tx = open.result.transaction(['attempts', 'hard'])
    const a = tx.objectStore('attempts').count()
    const h = tx.objectStore('hard').count()
    tx.oncomplete = () => {
      resolve({ attempts: a.result, hard: h.result })
      open.result.close()
    }
  }
}))

test('manifest and service worker under /Polish_czytanie/, a whole session offline, an update without losing anything', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('./')
  const manifest = await (await page.request.get('manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ start_url: '/Polish_czytanie/', scope: '/Polish_czytanie/', id: '/Polish_czytanie/', display: 'standalone', lang: 'uk', name: 'Czytanie' })
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status()).toBe(200)
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe('http://localhost:4281/Polish_czytanie/')
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // Opening the exercise caches its three recordings.
  await page.goto('./#/c/07')
  await expect.poll(async () => (await audioKeys(page)).filter((p) => p.includes('/audio/alex-07-')).length, { timeout: 30_000 }).toBe(3)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('session')).toBeVisible()
  // The first session starts with the rule: the tempo check comes on later days.
  await expect(page.getByTestId('session')).toHaveAttribute('data-step', '1')
  // 1 — rule: a word sounds from the cache
  await page.getByTestId('word').first().click()
  await expect(page.locator('.notice')).toHaveCount(0)
  await page.getByTestId('next').click()
  // 2 — gama: the first line marked, the rest right
  await page.getByTestId('check').click()
  await expect(page.getByTestId('reading').locator('.now')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('word').nth(1).click()
  await page.getByTestId('nextWithMistakes').click()
  for (let i = 1; i < 7; i++) {
    await page.getByTestId('check').click()
    await page.getByTestId('allRight').click()
  }
  // 3 — quiz
  for (let i = 0; i < 8; i++) {
    await page.locator('[data-testid="option"][data-answer="yes"]').click()
    await page.getByTestId('next').click()
  }
  // 4 — flash
  for (let i = 0; i < 12; i++) {
    await page.getByTestId('show').click()
    await page.getByTestId('check').click({ timeout: 5000 })
    await page.getByTestId('yes').click()
  }
  // 5 — with the narrator
  await page.getByTestId('play').click()
  await expect(page.getByTestId('reading').locator('.now')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('next').last().click()
  // 6 — on time
  await page.getByTestId('start').click()
  await page.waitForTimeout(13_000)
  await page.getByTestId('finish').click()
  await page.getByTestId('next').click()
  // 7 — rating
  await page.getByTestId('rating-1').click()
  await page.getByTestId('finishSession').click()
  await expect(page.getByTestId('exercises')).toBeVisible()
  await expect(page.locator('.notice:has-text("Немає запису")')).toHaveCount(0)
  for (const tab of ['today', 'hard', 'discrimination', 'progress', 'settings', 'exercises']) {
    await page.getByTestId(`tab-${tab}`).click()
    await expect(page.locator('main')).not.toBeEmpty()
  }
  const before = await counts(page)
  expect(before.attempts).toBeGreaterThan(25)
  expect(before.hard).toBe(1)
  await context.setOffline(false)

  // A new version on the server: the notice appears, «Оновити» reloads, progress and audio are still there.
  const original = readFileSync(swFile, 'utf8')
  try {
    writeFileSync(swFile, `${original}\n// next version\n`)
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update())
    await expect(page.getByTestId('updateBanner')).toBeVisible({ timeout: 15_000 })
    await Promise.all([page.waitForEvent('load'), page.getByTestId('applyUpdate').click()])
  } finally {
    writeFileSync(swFile, original)
  }
  await expect(page.getByTestId('updateBanner')).toHaveCount(0)
  expect(await counts(page)).toEqual(before)
  expect((await audioKeys(page)).filter((p) => p.includes('/audio/alex-07-'))).toHaveLength(3)
  await page.getByTestId('tab-exercises').click()
  await expect(page.getByTestId('card-07')).toContainText('аудіо на пристрої')
  expect(errors).toEqual([])
})

test('«Завантажити все аудіо» puts all 63 recordings on the device', async ({ page }) => {
  await page.goto('./#/ustawienia')
  await expect(page.getByTestId('audioState')).toContainText('0 з 21')
  await page.getByTestId('downloadAll').click()
  await expect(page.getByTestId('downloadDone')).toContainText('Усе аудіо на пристрої', { timeout: 120_000 })
  await expect(page.getByTestId('audioState')).toContainText('21 з 21')
  expect(await audioKeys(page)).toHaveLength(63)
})
