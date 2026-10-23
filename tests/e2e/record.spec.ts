// «Запис себе» with a fake microphone: count-in, level meter, «Стоп», then «Я», «Диктор», «Я → Диктор» (FR-19).
import { expect, test } from '@playwright/test'

test('«Запис»: three clicks, then recording with the level; «Перевір» stops it; «Я» plays and shows it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./#/c/07/krok/2')
  await expect(page.getByTestId('record')).toBeVisible()
  await page.keyboard.press('r')
  await expect(page.getByTestId('countin')).toBeVisible()
  await expect(page.locator('.countin .beat.on').first()).toBeVisible()
  await expect(page.getByTestId('recording')).toBeVisible({ timeout: 3000 })
  await expect.poll(async () => Number(await page.getByTestId('meter').getAttribute('aria-valuenow')), { timeout: 5000 }).toBeGreaterThan(0)
  await expect(page.getByTestId('recording')).toContainText('Запис 0:01', { timeout: 3000 })
  await page.screenshot({ path: 'build/visual/record-recording.png' })

  await page.getByTestId('check').click()
  await expect(page.getByTestId('recording')).toHaveCount(0)
  const mine = page.getByTestId('playMine')
  await expect(mine).toBeVisible()
  await expect(page.getByTestId('playDictor')).toBeVisible()
  await expect(page.getByTestId('playBoth')).toBeVisible()
  await mine.click()
  await expect(mine).toHaveAttribute('aria-pressed', 'true')
  await expect(mine).toHaveAttribute('aria-pressed', 'false', { timeout: 10_000 })
  await page.keyboard.press('b')
  await expect(page.getByTestId('playBoth')).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: 'build/visual/record-compare.png' })
  expect(errors).toEqual([])
})

test('in the flash step the phrase appears on the silent beat and is recorded', async ({ page }) => {
  await page.goto('./#/c/07/krok/4')
  await page.getByTestId('record').click()
  await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'showing', { timeout: 4000 })
  await expect(page.getByTestId('recording')).toBeVisible()
  await expect(page.getByTestId('stepFlash')).toHaveAttribute('data-phase', 'say', { timeout: 5000 })
  await page.getByTestId('check').click()
  await expect(page.getByTestId('playMine')).toBeVisible()
})
