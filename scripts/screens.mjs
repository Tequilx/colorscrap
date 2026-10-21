// สคริปต์ dev ถ่ายภาพทุกหน้าของแอป (mock mode) ที่ 1280×800 ลง scripts/out/screens/<งาน>/ + contact-sheet.png
// ใช้ซ้ำกับรอบ overview: รอ document.fonts.ready ก่อนถ่ายทุกภาพ (ไม่บล็อกฟอนต์ ต้องมีเน็ตเพื่อให้ได้ Mali จริง)
//
// วิธีใช้ (ต้องมี Playwright ติดตั้งนอกโปรเจกต์ ไม่ได้อยู่ใน package.json):
//   1) เปิดเซิร์ฟเวอร์:  npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/node_modules/playwright-core/index.mjs node scripts/screens.mjs <งาน> [--query "time=night"] [--url http://localhost:5199] [--only 06,08]
// ภาพลง scripts/out/screens/<งาน>[-<query>]/ (git-ignored)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const task = args.find((a) => !a.startsWith('--')) || 'screens'
const opt = (n, f) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : f }
const base = opt('url', 'http://localhost:5199')
const query = opt('query', '')
const only = opt('only', '')?.split(',').filter(Boolean)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(root, 'scripts/out/screens', task + (query ? '-' + query.replace(/[^\w=]+/g, '_') : ''))
mkdirSync(OUT, { recursive: true })
const URL = `${base}/${query ? '?' + query : ''}`

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const log = []

const fontsReady = (page) => page.evaluate(async () => {
  await Promise.all([
    document.fonts.load('16px Mali', 'ก่ะ สมุด'), document.fonts.load('600 16px Mali', 'ก่ะ สมุด'), document.fonts.load('700 16px Mali', 'ก่ะ สมุด'),
    document.fonts.load('400 16px "IBM Plex Sans Thai Looped"', 'ก่ะ สมุด'), document.fonts.load('500 16px "IBM Plex Sans Thai Looped"', 'ก่ะ สมุด'), document.fonts.load('600 16px "IBM Plex Sans Thai Looped"', 'ก่ะ สมุด'),
  ])
  await document.fonts.ready
})
let n = 0
const shot = async (page, name, wait = 600) => {
  n++
  const id = String(n).padStart(2, '0')
  if (only?.length && !only.includes(id)) return
  await page.waitForTimeout(wait)
  await fontsReady(page)
  const ok = await page.evaluate(() => document.fonts.check('16px Mali', 'ก') && document.fonts.check('400 16px "IBM Plex Sans Thai Looped"', 'ก'))
  log.push(`${id}-${name}: fonts ${ok ? 'OK' : 'ไม่ครบ!'}`)
  await page.screenshot({ path: `${OUT}/${id}-${name}.png` })
}
const app = (page, fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })

const newPage = async (withProfile) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (withProfile) await context.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล', 'แมว'] })))
  const page = await context.newPage()
  page.on('pageerror', (e) => log.push('pageerror: ' + e.message))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  return page
}

let page = await newPage(false)
await shot(page, 'hello-ผู้ใช้ใหม่')
await page.context().close()

page = await newPage(true)
await shot(page, 'cover', 1200)
await app(page, (a) => a.openSettings())
await shot(page, 'hello-แก้ไขโปรไฟล์', 1200)
await app(page, (a) => a.go('cover'))
await page.waitForTimeout(800)
await app(page, (a) => a.go('pick'))
await shot(page, 'pick', 1000)
await app(page, (a) => { a.selection = { emotion: 'sad', intensity: 1 } })
await shot(page, 'pick-เลือกเศร้า', 900)
await app(page, (a) => { a.canvasDirty = true; a.go('paint') })
await shot(page, 'paint-ผ้าใบเปล่า', 1500)
await app(page, (a) => a.go('pick'))
await page.waitForTimeout(900)
await app(page, (a) => { a.canvasDirty = false; a.newSheet?.(); a.go('paint') })
await page.waitForTimeout(500)
await shot(page, 'paint-ระหว่างสาดสี', 100)
await page.waitForTimeout(3500)
await shot(page, 'paint-หลังสาดสี', 200)
await app(page, (a) => { a.warmNote = 'open' })
await shot(page, 'paint-โน้ตชวนแต้มแสง', 900)
await app(page, (a) => a.pickTool('warm'))
await page.mouse.click(520, 400)
await page.waitForTimeout(2200)
await shot(page, 'paint-แต้มแสงบาน', 300)
await app(page, (a) => a.go('cover'))
await page.waitForTimeout(900)
await app(page, (a) => a.go('pick'))
await page.waitForTimeout(1000)
await page.getByText('เริ่มระบาย').first().click()
await shot(page, 'pick-ถามระบายต่อหรือแผ่นใหม่', 700)
await page.getByText('ระบายต่อแผ่นเดิม').first().click()
await page.waitForTimeout(1500)
await app(page, (a) => { a.saveToBook() })
await page.waitForTimeout(650)
await shot(page, 'save-ระหว่างบันทึก', 0)
await page.waitForTimeout(2400)
await shot(page, 'saved-การ์ดหลังบันทึก', 1000)
await app(page, (a) => a.go('book'))
await shot(page, 'book-วันนี้', 2200)
await page.evaluate(() => {
  const p = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const e = p._s.get('entries'); const a = p._s.get('app')
  const d = e.dates.find((x) => e.entriesOfDay(x).length > 4)
  if (d) a.openDay(d)
})
await shot(page, 'book-วันที่มีแผ่นแทรก', 1500)
await app(page, (a) => a.openPhoto('mock-4'))
await shot(page, 'photo-ดูภาพเดี่ยว', 1800)
await page.context().close()
console.log(log.join('\n'))
await browser.close()

// contact sheet (5 คอลัมน์)
const files = readdirSync(OUT).filter((f) => /^\d\d-.*\.png$/.test(f)).sort()
const b2 = await chromium.launch({ channel: 'chrome' })
const p2 = await b2.newPage()
const imgs = files.map((f) => ({ name: f.replace('.png', ''), src: 'data:image/png;base64,' + readFileSync(join(OUT, f)).toString('base64') }))
const sheet = await p2.evaluate(async (imgs) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(imgs.map((m) => load(m.src)))
  const cols = 5, cw = 400, ch = 250, lab = 34, pad = 10
  const rows = Math.ceil(L.length / cols)
  const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
  L.forEach((img, k) => { const cx = pad + (k % cols) * (cw + pad), cy = pad + Math.floor(k / cols) * (ch + lab + pad); x.fillStyle = '#000'; x.font = '15px sans-serif'; x.fillText(imgs[k].name, cx, cy + 20); x.drawImage(img, cx, cy + lab - 6, cw, ch); x.strokeStyle = '#bbb'; x.strokeRect(cx, cy + lab - 6, cw, ch) })
  return c.toDataURL('image/png')
}, imgs)
writeFileSync(join(OUT, 'contact-sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'))
await b2.close()
console.log('contact sheet:', join(OUT, 'contact-sheet.png'))
