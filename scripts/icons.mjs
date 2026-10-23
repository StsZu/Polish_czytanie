// Renders the app icon (an SVG drawn here) to the PNG sizes of the manifest and the Home Screen with Playwright.
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const icon = (padding) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#9c2f22"/>
  <g transform="translate(${padding} ${padding}) scale(${(512 - 2 * padding) / 512})">
    <rect x="86" y="96" width="340" height="320" rx="28" fill="#fffdf8"/>
    <rect x="128" y="150" width="112" height="112" rx="18" fill="#c8e1ff"/>
    <text x="184" y="240" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="104" fill="#1d1b18">cz</text>
    <text x="244" y="240" text-anchor="start" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="104" fill="#1d1b18">y</text>
    <rect x="128" y="300" width="256" height="18" rx="9" fill="#d8d0c3"/>
    <rect x="128" y="340" width="190" height="18" rx="9" fill="#d8d0c3"/>
    <rect x="128" y="276" width="112" height="8" rx="4" fill="#9c2f22"/>
  </g>
</svg>`

const outputs = [
  ['public/apple-touch-icon.png', 180, 0],
  ['public/icons/icon-192.png', 192, 0],
  ['public/icons/icon-512.png', 512, 0],
  // Maskable: the drawing inside the 80 % safe zone.
  ['public/icons/icon-maskable-512.png', 512, 64],
]

mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, padding] of outputs) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0">${icon(padding).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`)
  await page.locator('svg').screenshot({ path: file, omitBackground: false })
  console.log(file)
}
await browser.close()
