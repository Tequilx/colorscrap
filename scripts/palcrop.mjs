// สคริปต์ dev ตรวจชิ้นสีของวัน (ข้อ 49): ใส่ภาพระบายสังเคราะห์ 7 วัน (เต็มหน้า / สีน้อยพื้นขาวเยอะ / หลายสี ฯลฯ) ลง store แล้วถ่ายกรอบ "สีของวัน" + การ์ดวัน
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/palcrop.mjs <before|after> [--url http://localhost:5199]
// ภาพลง scripts/out/screens/palcrop/<tag>/ (git-ignored) + sheet-<tag>.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'after'
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = join('scripts/out/screens/palcrop', tag)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const days = await page.evaluate(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const entries = pinia._s.get('entries')
  const { localDateStr, addDays } = await import('/src/lib/dates.js')
  const { markRaw } = await import('/node_modules/.vite/deps/vue.js').catch(() => import('vue'))

  const W = 1600, H = 880
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const blob = (g, hex, x, y, rx, ry, a = 0.5, n = 5) => {
    for (let k = 0; k < n; k++) {
      g.globalAlpha = a / 2
      g.fillStyle = hex
      g.beginPath()
      g.ellipse(x + (r() - 0.5) * rx * 0.3, y + (r() - 0.5) * ry * 0.3, rx * (0.7 + r() * 0.3), ry * (0.7 + r() * 0.3), r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
  }
  const paint = async (draw) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.fillStyle = '#FBFAF6'
    g.fillRect(0, 0, W, H)
    draw(g)
    return new Promise((res) => c.toBlob(res, 'image/png'))
  }
  const specs = [
    ['เต็มหน้า', ['#D98A6C', '#E3B04B', '#C46A8A'], (g) => { [[300, 250], [800, 300], [1300, 250], [500, 650], [1100, 650]].forEach(([x, y], i) => blob(g, ['#D98A6C', '#E3B04B', '#C46A8A'][i % 3], x, y, 420, 300, 0.8, 6)) }],
    ['สีน้อยมุมซ้ายบน', ['#6C8FD9'], (g) => blob(g, '#6C8FD9', 230, 150, 110, 80, 0.8)],
    ['หลายสี', ['#C0504D', '#7BAE7F', '#5E7FC4', '#E3B04B', '#9B6BC4'], (g) => { [[250, 220], [750, 640], [1250, 200], [1350, 680], [650, 200]].forEach(([x, y], i) => blob(g, ['#C0504D', '#7BAE7F', '#5E7FC4', '#E3B04B', '#9B6BC4'][i], x, y, 200, 150, 0.8)) }],
    ['สีน้อยมุมขวาล่าง', ['#7BAE7F'], (g) => blob(g, '#7BAE7F', 1380, 730, 130, 90, 0.75)],
    ['จางทั้งภาพ', ['#B7C4E0', '#E0C4B7'], (g) => { blob(g, '#B7C4E0', 500, 400, 600, 330, 0.55, 5); blob(g, '#E0C4B7', 1100, 450, 500, 300, 0.5, 5) }],
    ['จุดเข้มเล็ก+จางกว้าง', ['#3F3A6E', '#D9C4E8'], (g) => { blob(g, '#D9C4E8', 800, 440, 700, 380, 0.4); blob(g, '#3F3A6E', 1400, 160, 70, 60, 0.9) }],
    ['แถบกลางภาพ', ['#E08A4B', '#4B8AE0'], (g) => { blob(g, '#E08A4B', 800, 440, 150, 330, 0.8); blob(g, '#4B8AE0', 800, 440, 80, 200, 0.6) }],
  ]
  const out = []
  for (let i = 0; i < specs.length; i++) {
    const [name, colors, draw] = specs[i]
    const date = localDateStr(addDays(new Date(), -(20 + i)))
    const b = await paint(draw)
    entries.entries.push({
      id: `pc-${i}`, local_date: date, local_time: '10:00', emotion: 'calm', emotions: ['calm'], intensity: 1, shifted: false,
      colors: colors.map((hex, k) => ({ hex, ratio: 1 / colors.length })), image: markRaw(b), thumb: markRaw(b),
    })
    out.push({ date, name })
  }
  return out
})

const app = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })
await app((a) => a.go('cover'))
await page.waitForTimeout(800)
await app((a) => a.go('book'))
await page.waitForTimeout(2500)

const shots = []
for (const [i, d] of days.entries()) {
  await app((a, date) => a.openDay(date), d.date)
  await page.waitForTimeout(2800)
  const frame = page.locator('[data-day-frame]').first()
  const file = join(OUT, `day${i + 1}.png`)
  await frame.screenshot({ path: file })
  shots.push({ file, name: d.name })
}

// การ์ดจานสีของวัน (เห็นกรอบ + ชิ้นสี) ครอปเฉพาะส่วนบนของการ์ด
const cards = await page.evaluate(async (dates) => {
  const { makeDayCard } = await import('/src/lib/share/exporter.js')
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
  const entries = pinia._s.get('entries')
  const urls = []
  for (const date of dates) {
    const { blob } = await makeDayCard(date, entries.entriesOfDay(date), 'มะลิ')
    const bmp = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    c.width = 1080
    c.height = 700
    c.getContext('2d').drawImage(bmp, 0, 0)
    urls.push(c.toDataURL('image/png'))
  }
  return urls
}, days.map((d) => d.date))
cards.forEach((u, i) => writeFileSync(join(OUT, `card${i + 1}.png`), Buffer.from(u.split(',')[1], 'base64')))

// contact sheet: แถวบน = กรอบในสมุด แถวล่าง = ส่วนบนของการ์ด
const sheet = await page.evaluate(async ({ shots, cards }) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s })
  const A = await Promise.all(shots.map((s) => load(s.src)))
  const B = await Promise.all(cards.map(load))
  const cw = 220, pad = 10, lab = 26
  const c = document.createElement('canvas')
  c.width = A.length * (cw + pad) + pad
  c.height = pad + lab + 220 + pad + 220 * 0.65 + pad
  const x = c.getContext('2d')
  x.fillStyle = '#fff'
  x.fillRect(0, 0, c.width, c.height)
  A.forEach((img, k) => {
    const cx = pad + k * (cw + pad)
    x.fillStyle = '#000'; x.font = '14px sans-serif'; x.fillText(shots[k].name, cx, pad + 16)
    x.drawImage(img, cx, pad + lab, cw, cw * img.height / img.width)
    x.drawImage(B[k], 0, 200, 560, 340, cx, pad + lab + 220 + pad, cw, cw * 340 / 560)
  })
  return c.toDataURL('image/png')
}, { shots: shots.map((s) => ({ name: s.name, src: 'data:image/png;base64,' + Buffer.from(readFileSync(s.file)).toString('base64') })), cards: cards })
writeFileSync(join(OUT, `sheet-${tag}.png`), Buffer.from(sheet.split(',')[1], 'base64'))
console.log('sheet:', join(OUT, `sheet-${tag}.png`))
await browser.close()
