// สคริปต์ dev ถ่ายภาพก่อน/หลังของข้อ 52 (a จานสี, b ข้อความปก, e คำบรรยายโพลารอยด์, f หน้าแรกของสมุด, g ปุ่มปรับแต่ง) + วัดกล่องปุ่มบนปกที่ 375px
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/details52.mjs <before|after> [--url http://localhost:5199]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'after'
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = join('scripts/out/screens/details52', tag)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const open = async (viewport, profile = true) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  if (profile) await context.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#2F6B4F', likes: ['ทะเล', 'แมว'] })))
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return page
}
const app = (page, fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })

let page = await open({ width: 1280, height: 800 }, false)
await page.screenshot({ path: join(OUT, 'f-hello.png'), clip: { x: 60, y: 60, width: 680, height: 380 } })
await page.context().close()

page = await open({ width: 1280, height: 800 })
await app(page, (a) => a.go('cover'))
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, 'b-cover-text.png'), clip: { x: 660, y: 250, width: 520, height: 300 } })
await page.screenshot({ path: join(OUT, 'g-topright.png'), clip: { x: 900, y: 0, width: 380, height: 140 } })
// รายการภาพของวันนี้: 4 ภาพมี "→ สดใสขึ้น" และอารมณ์ชื่อยาว
await page.evaluate(async () => {
  const entries = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries')
  const { localDateStr } = await import('/src/lib/dates.js')
  const date = localDateStr(new Date())
  ;[['excited', true], ['anxious', true]].forEach(([emotion, shifted], i) => entries.entries.push({ id: `d52-${i}`, local_date: date, local_time: `23:${i}0`, emotion, emotions: [emotion], intensity: 1, shifted, colors: [{ hex: '#E2688A', ratio: 0.5 }, { hex: '#F1BE48', ratio: 0.5 }] }))
})
await app(page, (a) => a.go('book'))
await page.waitForTimeout(3500)
await page.screenshot({ path: join(OUT, 'book.png') })
await page.screenshot({ path: join(OUT, 'e-captions.png'), clip: { x: 150, y: 90, width: 520, height: 500 } })
await page.screenshot({ path: join(OUT, 'a-palette.png'), clip: { x: 640, y: 60, width: 560, height: 260 } })
await page.context().close()

// 375px: กล่องปุ่มบนปกต้องไม่ชนกัน
page = await open({ width: 375, height: 667 })
await app(page, (a) => a.go('cover'))
await page.waitForTimeout(1500)
const boxes = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /เพลง|เสียง|ปรับแต่ง|ตั้งค่า/.test(b.getAttribute('aria-label') || '')).map((b) => { const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }))
const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))
console.log(JSON.stringify(boxes), 'overlap:', overlap)
await page.screenshot({ path: join(OUT, 'g-375.png'), clip: { x: 0, y: 200, width: 375, height: 120 } })
await browser.close()
