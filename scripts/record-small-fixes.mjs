// สคริปต์ dev (ข้อ 64): ภาพก่อน/หลังของ (a) ปฏิทินไม่มีคำอธิบายใต้ปฏิทิน (b) คำบรรยายโพลารอยด์ 14 px (สั้น / ยาวสุด / ยาวแล้วมีป้าย "ใหม่")
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/record-small-fixes.mjs <before|after> [--url http://localhost:5199]
// ภาพลง scripts/out/screens/small-fixes/<ชื่อรอบ>-*.png
import { mkdirSync } from 'node:fs'
const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = 'scripts/out/screens/small-fixes'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage()
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
await page.goto(base + '/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
const S = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`
// วันทดสอบ: คำบรรยายสั้น (สงบ) + ยาวสุด (อารมณ์เปลี่ยน + สดใสขึ้น) + ยาวพร้อมป้าย "ใหม่"
await page.evaluate(`(() => {
  const e = ${S('entries')}
  const colors = [{ hex: '#5FA3C8', ratio: 0.6 }, { hex: '#F1BE48', ratio: 0.4 }]
  e.addEntry({ emotions: ['anxious', 'tired'], intensity: 1, shifted: true, colors })
})()`)
await page.evaluate(`${S('app')}.go('book')`)
await page.waitForTimeout(2500)
const left = { x: 134, y: 80, width: 506, height: 640 }
await page.screenshot({ path: `${OUT}/${tag}-b-polaroids.png`, clip: left })
const caps = await page.evaluate(() => [...document.querySelectorAll('figcaption')].map((f) => ({ text: f.innerText.replace(/\n/g, ' ⏎ '), fs: getComputedStyle(f).fontSize, h: f.closest('figure')?.getBoundingClientRect().height })))
console.log(JSON.stringify(caps))
await page.click('[data-cal-tab]', { position: { x: 42, y: 14 } })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/${tag}-a-calendar.png`, clip: { x: 640, y: 60, width: 520, height: 600 } })
await browser.close()
