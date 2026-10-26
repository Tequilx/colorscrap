// สคริปต์ dev ถ่ายภาพก่อน/หลังของข้อ 50 (a กรอบสีของวัน, b แถบกลับไประบาย, c คำบรรยายโพลารอยด์, e ป้ายปุ่ม, h รอยสีตกแต่ง) + วัดป้ายปุ่มที่หน้าจอ 375px
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/details50.mjs <before|after> [--url http://localhost:5199]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'after'
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = join('scripts/out/screens/details50', tag)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const open = async (viewport) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  await context.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#2F6B4F', likes: ['ทะเล', 'แมว'] })))
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return page
}
const app = (page, fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })
const log = []

let page = await open({ width: 1280, height: 800 })
// ภาพจริงของวันนี้ 2 ภาพ (ภาพล่าสุดเป็นสีน้ำเงินกับชมพู)
await page.evaluate(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const entries = pinia._s.get('entries')
  const { localDateStr } = await import('/src/lib/dates.js')
  const { markRaw } = await import('/node_modules/.vite/deps/vue.js')
  const mk = (hexes) => {
    const c = document.createElement('canvas')
    c.width = 1112; c.height = 612
    const g = c.getContext('2d')
    g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, 1112, 612)
    hexes.forEach((hex, i) => { for (let k = 0; k < 4; k++) { g.globalAlpha = 0.4; g.fillStyle = hex; g.beginPath(); g.ellipse(250 + i * 380 + k * 40, 200 + k * 60, 170, 120, k, 0, 7); g.fill() } })
    return new Promise((res) => c.toBlob(res, 'image/png'))
  }
  const date = localDateStr(new Date())
  for (const [i, hexes] of [[0, ['#E2688A', '#F1BE48']], [1, ['#5FA3C8', '#6E4FA0']]]) {
    const b = await mk(hexes)
    entries.entries.push({ id: `d50-${i}`, local_date: date, local_time: `23:${i}0`, emotion: i ? 'calm' : 'angry', emotions: ['calm'], intensity: 1, shifted: i === 1, colors: hexes.map((hex) => ({ hex, ratio: 0.5 })), image: markRaw(b), thumb: markRaw(b) })
  }
})
await app(page, (a) => a.go('cover'))
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, 'h-cover.png') })
await app(page, (a) => a.go('pick'))
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, 'h-pick.png') })
await app(page, (a) => { a.selection = { emotion: 'sad', intensity: 1 }; a.canvasDirty = true; a.go('paint') })
await page.waitForTimeout(3500)
await page.screenshot({ path: join(OUT, 'e-tray.png'), clip: { x: 260, y: 680, width: 760, height: 100 } })
await app(page, (a) => a.go('book'))
await page.waitForTimeout(3500)
await page.screenshot({ path: join(OUT, 'book.png') })
await page.screenshot({ path: join(OUT, 'b-strip.png'), clip: { x: 0, y: 130, width: 130, height: 540 } })
await page.screenshot({ path: join(OUT, 'a-frame.png'), clip: { x: 640, y: 70, width: 560, height: 190 } })
await page.screenshot({ path: join(OUT, 'c-captions.png'), clip: { x: 100, y: 60, width: 560, height: 360 } })
await page.context().close()

// ป้ายปุ่มที่หน้าจอ 375px: ต้องบรรทัดเดียวและไม่ล้นปุ่ม
page = await open({ width: 375, height: 667 })
await app(page, (a) => { a.selection = { emotion: 'sad', intensity: 1 }; a.canvasDirty = true; a.go('paint') })
await page.waitForTimeout(3500)
const m = await page.evaluate(() => [...document.querySelectorAll('[role=group][aria-label="เครื่องมือ"] button')].map((b) => {
  const t = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
  const r = document.createRange(); r.selectNodeContents(t)
  const rects = [...r.getClientRects()].filter((x) => x.width > 0)
  const bw = b.getBoundingClientRect()
  return { text: t.textContent.trim(), lines: new Set(rects.map((x) => Math.round(x.top))).size, textW: Math.round(Math.max(...rects.map((x) => x.right)) - Math.min(...rects.map((x) => x.left))), btnW: Math.round(bw.width), overflow: b.scrollWidth > b.clientWidth }
}))
log.push(JSON.stringify(m))
await page.screenshot({ path: join(OUT, 'e-tray-375.png') })
console.log(log.join('\n'))
await browser.close()
