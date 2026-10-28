// สคริปต์ dev ตรวจชิ้นสีของวัน: ใส่ภาพระบายสังเคราะห์ 12 วัน (สีเดียว / หลายสี / สีผสมที่ไม่มีในภาพ ฯลฯ) ลง store แล้วถ่ายกรอบ "สีของวัน"+ชื่อสีในจานสี
// พร้อมค่าที่ระบบเลือก (ทางหลัก/fallback, คะแนน, สีเป้าหมาย) → contact sheet
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/palcrop.mjs <tag> [--url http://localhost:5199] [--min 0.1]
// ภาพลง scripts/out/screens/palcrop/<tag>/ (git-ignored) + sheet-<tag>.png + scores.json
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
  const { markRaw } = await import('/node_modules/.vite/deps/vue.js')

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
  const paint = (draw) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.fillStyle = '#FBFAF6'
    g.fillRect(0, 0, W, H)
    draw(g)
    return new Promise((res) => c.toBlob(res, 'image/png'))
  }
  // เข้ารหัสแบบเดียวกับแอป: ภาพเต็ม + thumb 480
  const thumbOf = async (b) => {
    const bmp = await createImageBitmap(b)
    const c = document.createElement('canvas')
    c.width = 480
    c.height = Math.round((480 * bmp.height) / bmp.width)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return new Promise((res) => c.toBlob(res, 'image/png'))
  }
  const B = (hex, x, y, rx, ry, a, n) => (g) => blob(g, hex, x, y, rx, ry, a, n)
  const many = (...fs) => (g) => fs.forEach((f) => f(g))
  const RED = '#C0504D', BLUE = '#5E7FC4', GREEN = '#7BAE7F', YEL = '#E3B04B', ORG = '#E0884A', PINK = '#F4B6C2', LAV = '#C9B8E0', PURP = '#5A3A8C'
  // [ชื่อ, [[ภาพ: colors, draw], ...]]
  const specs = [
    ['ส้ม-เหลืองเต็มหน้า', [[[ORG, YEL], many(B(ORG, 400, 300, 420, 300, 0.8, 6), B(YEL, 1100, 560, 480, 300, 0.8, 6))]]],
    ['ฟ้าน้อยมุมซ้ายบน', [[[BLUE], B(BLUE, 230, 150, 110, 80, 0.85, 5)]]],
    ['แดงล้วนกลางภาพ', [[[RED], B(RED, 800, 440, 300, 220, 0.8, 6)]]],
    ['เขียวน้อยมุมขวาล่าง', [[[GREEN], B(GREEN, 1380, 730, 130, 90, 0.8, 5)]]],
    ['ชมพูอ่อนจาง', [[[PINK], B(PINK, 800, 440, 600, 330, 0.9, 5)]]],
    ['ลาเวนเดอร์จาง', [[[LAV], B(LAV, 700, 400, 620, 330, 0.9, 5)]]],
    ['แดง+น้ำเงิน (สองภาพ ผสม=ม่วง ไม่มีจริง)', [[[RED], B(RED, 600, 440, 380, 260, 0.8, 6)], [[BLUE], B(BLUE, 1000, 440, 380, 260, 0.8, 6)]]],
    ['เหลือง+ฟ้าภาพเดียว (ผสม=เขียว ไม่มีจริง)', [[[YEL, BLUE], many(B(YEL, 420, 380, 260, 200, 0.85, 5), B(BLUE, 1200, 520, 260, 200, 0.85, 5))]]],
    ['สามภาพ แดง/เขียว/น้ำเงิน', [[[RED], B(RED, 700, 440, 300, 220, 0.8, 5)], [[GREEN], B(GREEN, 900, 440, 300, 220, 0.8, 5)], [[BLUE], B(BLUE, 800, 440, 300, 220, 0.8, 5)]]],
    ['ม่วงเข้มมุมขวาบน', [[[PURP], B(PURP, 1330, 170, 200, 150, 0.9, 6)]]],
    ['จุดเข้มเล็ก+จางกว้าง', [[['#3F3A6E', '#D9C4E8'], many(B('#D9C4E8', 800, 440, 700, 380, 0.5, 5), B('#3F3A6E', 1400, 160, 70, 60, 0.9, 5))]]],
    ['เขียว ภาพแรก + ส้ม ภาพสอง', [[[GREEN], B(GREEN, 500, 300, 330, 230, 0.8, 5)], [[ORG], B(ORG, 1150, 600, 330, 230, 0.8, 5)]]],
  ]
  const out = []
  for (let i = 0; i < specs.length; i++) {
    const [name, imgs] = specs[i]
    const date = localDateStr(addDays(new Date(), -(20 + i)))
    for (let k = 0; k < imgs.length; k++) {
      const [colors, draw] = imgs[k]
      const b = await paint(draw)
      const t = await thumbOf(b)
      entries.entries.push({
        id: `pc-${i}-${k}`, local_date: date, local_time: `1${k}:00`, emotion: 'calm', emotions: ['calm'], intensity: 1, shifted: false,
        colors: colors.map((hex) => ({ hex, ratio: 1 / colors.length })), image: markRaw(b), thumb: markRaw(t),
      })
    }
    out.push({ date, name })
  }
  return out
})

const app = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })
await app((a) => a.go('cover'))
await page.waitForTimeout(800)
await app((a) => a.go('book'))
await page.waitForTimeout(2500)

const rows = []
for (const [i, d] of days.entries()) {
  await app((a, date) => a.openDay(date), d.date)
  await page.waitForTimeout(3000)
  const file = join(OUT, `day${String(i + 1).padStart(2, '0')}.png`)
  await page.locator('[data-day-frame]').first().locator('..').screenshot({ path: file })
  const info = await page.evaluate(async (date) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const list = pinia._s.get('entries').entriesOfDay(date)
    const { getDayCrop } = await import('/src/lib/dayCrop.js')
    const { dayColor, nameForCrop } = await import('/src/lib/palette.js')
    const crop = await getDayCrop(list)
    const base = dayColor(list)
    return { via: crop.via, score: crop.score, target: crop.target, tone: crop.toneHex ?? null, baseName: base.name.colorPart, shownName: nameForCrop(base.name, crop).colorPart, winner: crop.entryId }
  }, d.date)
  rows.push({ ...d, file, ...info })
}
writeFileSync(join(OUT, 'scores.json'), JSON.stringify(rows.map(({ file, ...r }) => r), null, 1))
console.table(rows.map((r) => ({ name: r.name, via: r.via, score: +r.score.toFixed(3), target: r.target, base: r.baseName, shown: r.shownName })))

const sheet = await page.evaluate(async (rows) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = s })
  const L = await Promise.all(rows.map((r) => load(r.src)))
  const cols = 3, cw = 412, ch = 170, pad = 12, lab = 44
  const rowsN = Math.ceil(L.length / cols)
  const c = document.createElement('canvas')
  c.width = pad + cols * (cw + pad)
  c.height = pad + rowsN * (ch + lab + pad)
  const x = c.getContext('2d')
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
  L.forEach((img, k) => {
    const cx = pad + (k % cols) * (cw + pad), cy = pad + Math.floor(k / cols) * (ch + lab + pad)
    x.fillStyle = '#FBFAF6'; x.fillRect(cx, cy, cw, ch)
    x.drawImage(img, cx, cy + (ch - img.height) / 2)
    x.fillStyle = rows[k].target; x.beginPath(); x.arc(cx + 10, cy + ch + 14, 7, 0, 7); x.fill()
    x.strokeStyle = '#999'; x.stroke()
    x.fillStyle = '#000'; x.font = '13px sans-serif'
    x.fillText(`${rows[k].name}`, cx + 24, cy + ch + 18)
    x.fillText(`${rows[k].via === 'target' ? 'ทางหลัก (ตามสีเป้าหมาย)' : 'FALLBACK (ข้อ 49 + ตั้งชื่อใหม่)'} · score ${rows[k].score.toFixed(3)} · ชื่อ ${rows[k].baseName}${rows[k].shownName !== rows[k].baseName ? ' → ' + rows[k].shownName : ''}`, cx + 24, cy + ch + 36)
  })
  return c.toDataURL('image/png')
}, rows.map((r) => ({ name: r.name, via: r.via, score: r.score, target: r.target, baseName: r.baseName, shownName: r.shownName, src: 'data:image/png;base64,' + readFileSync(r.file).toString('base64') })))
writeFileSync(join(OUT, `sheet-${tag}.png`), Buffer.from(sheet.split(',')[1], 'base64'))
console.log('sheet:', join(OUT, `sheet-${tag}.png`))
await browser.close()
