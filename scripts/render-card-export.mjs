// สคริปต์ dev ทดสอบการ์ดดาวน์โหลด (ข้อ 59a) ใน Playwright webkit (device iPad Pro 11) และ chromium แล้ววางภาพผลคู่กัน
// กรณีทดสอบ: ชื่อ 20 ตัวอักษร · วันที่ยาวที่สุด (พฤหัสบดี 30 พฤศจิกายน) · คำบรรยาย 4 อารมณ์ + "มากเลย" · "ไข่หวาน" (สระ/วรรณยุกต์ครบ)
// นอกจากภาพ ยังดักทุก fillText: ถ้าข้อความตกนอกขอบใน 72–1008 px (ยกเว้นข้อความในโพลารอยด์ที่เอียง) หรือนอกการ์ด จะรายงาน
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node scripts/render-card-export.mjs [--url http://localhost:5199] [--out scripts/out/screens/card-export]
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const url = opt('url', 'http://localhost:5199')
const out = opt('out', 'scripts/out/screens/card-export')
mkdirSync(out, { recursive: true })

const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { webkit, chromium, devices } = pw.default || pw

const ONLY = opt('only', '')
const ENGINES = [
  { name: 'webkit-ipad', launch: () => webkit.launch(), ctx: devices['iPad Pro 11 landscape'] },
  { name: 'chromium', launch: () => chromium.launch({ channel: 'chrome' }), ctx: { viewport: { width: 1280, height: 800 } } },
].filter((e) => !ONLY || e.name === ONLY)

const inPage = async (page) => {
  const cards = await import('/src/lib/share/cards.js')
  const { emotionShades } = await import('/src/lib/emotions.js')

  // ดักข้อความทุกครั้งที่วาด: พิกัดหลัง transform (ซ้ายสุด/ขวาสุดของข้อความ)
  const log = []
  const orig = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
    const w = this.measureText(text).width
    const t = this.getTransform()
    const al = this.textAlign
    const x0 = al === 'right' || al === 'end' ? x - w : al === 'center' ? x - w / 2 : x
    const left = t.a * x0 + t.c * y + t.e
    const right = t.a * (x0 + w) + t.c * y + t.e
    const rotated = Math.abs(t.b) > 0.001 || Math.abs(t.c) > 0.001
    if (this.canvas.width === 1080) log.push({ text, left: Math.round(left), right: Math.round(right), y: Math.round(t.b * x + t.d * y + t.f), rotated, font: this.font })
    return orig.call(this, text, x, y, ...rest)
  }

  const painting = (hexes, seed) => {
    const c = document.createElement('canvas')
    c.width = 1112; c.height = 612
    const g = c.getContext('2d')
    g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, c.width, c.height)
    let s = seed
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    hexes.forEach((hex) => { for (let k = 0; k < 4; k++) { g.globalAlpha = 0.35; g.fillStyle = hex; g.beginPath(); g.ellipse(200 + r() * 700, 120 + r() * 380, 90 + r() * 170, 60 + r() * 110, r() * 3, 0, Math.PI * 2); g.fill() } })
    return createImageBitmap(c)
  }
  const mk = (id, date, time, emotions, intensity, shifted) => {
    const emotion = emotions[emotions.length - 1]
    const sh = emotionShades(emotion)
    return { id, local_date: date, local_time: time, emotion, emotions, intensity, shifted, colors: [sh.base, sh.light, sh.deep, '#DED8E3', '#E9E5E8'].map((hex, i) => ({ hex, ratio: [0.46, 0.24, 0.14, 0.1, 0.06][i] })) }
  }
  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(bin)
  }
  const date = '2023-11-30' // พฤหัสบดี 30 พฤศจิกายน 2566 (ยาวที่สุด)
  const four = mk('a', date, '23:59', ['calm', 'anxious', 'sad', 'excited'], 2, true) // emotionLabel ใช้อารมณ์แรก→ล่าสุด + "→ สดใสขึ้น" + "มากเลย"
  const day = [mk('d1', date, '08:10', ['calm'], 0, false), mk('d2', date, '14:30', ['anxious', 'sad'], 2, true), four]
  const thumbs = new Map()
  for (const e of day) thumbs.set(e.id, await painting(e.colors.map((c) => c.hex), e.id.charCodeAt(1) || 3))
  const longName = 'สมศักดิ์ศรีสุวรรณภูมิ' // 20 ตัวอักษรไทยรวมสระ/วรรณยุกต์
  const cases = {
    'photo-longname-4emo': () => cards.renderPhotoCard({ entry: four, image: null, userName: longName }),
    'photo-khaiwan': () => cards.renderPhotoCard({ entry: four, image: null, userName: 'ไข่หวาน' }),
    'day-longname-4emo': () => cards.renderDayCard({ date, entries: day, thumbs, userName: longName }),
    'day-khaiwan': () => cards.renderDayCard({ date, entries: day, thumbs, userName: 'ไข่หวาน' }),
  }
  const result = {}
  for (const [name, fn] of Object.entries(cases)) {
    log.length = 0
    const blob = await fn()
    const bad = log.filter((l) => !l.rotated && (l.left < 71 || l.right > 1009)).concat(log.filter((l) => l.rotated && (l.left < 0 || l.right > 1080)))
    result[name] = { png: await toB64(blob), texts: log.length, bad, edges: log.filter((l) => !l.rotated && l.y < 140 || l.y > 1200).map((l) => `${l.text} ${l.left}–${l.right}`) }
  }
  // fonts ที่ canvas เห็นจริง
  result.__fonts = ['600 32px Mali', '700 34px Mali', '400 24px "IBM Plex Sans Thai Looped"'].map((f) => `${f}: ${document.fonts.check(f, 'ไข่หวาน')}`)
  return result
}

const report = {}
for (const eng of ENGINES) {
  const browser = await eng.launch()
  const ctx = await browser.newContext(eng.ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(eng.name, 'pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && console.error(eng.name, 'console', m.text()))
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(`(${inPage.toString()})()`)
  report[eng.name] = { fonts: r.__fonts }
  delete r.__fonts
  for (const [name, v] of Object.entries(r)) {
    writeFileSync(join(out, `${eng.name}-${name}.png`), Buffer.from(v.png, 'base64'))
    report[eng.name][name] = { texts: v.texts, overflow: v.bad }
  }
  await browser.close()
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

// วางคู่กัน: webkit | chromium
const b = await chromium.launch({ channel: 'chrome' })
const pg = await b.newPage()
if (ENGINES.length > 1) for (const name of ['photo-longname-4emo', 'photo-khaiwan', 'day-longname-4emo', 'day-khaiwan']) {
  const srcs = ENGINES.map((e) => 'data:image/png;base64,' + readFileSync(join(out, `${e.name}-${name}.png`)).toString('base64'))
  const png = await pg.evaluate(async ([srcs, labels]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
    const L = await Promise.all(srcs.map(load))
    const c = document.createElement('canvas'); c.width = 1080 * 2 + 30; c.height = 1350 + 40
    const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, c.width, c.height)
    L.forEach((im, i) => { g.drawImage(im, i * 1110, 40); g.fillStyle = '#fff'; g.font = '24px sans-serif'; g.fillText(labels[i], i * 1110 + 8, 28) })
    return c.toDataURL('image/png')
  }, [srcs, ENGINES.map((e) => e.name)])
  writeFileSync(join(out, `compare-${name}.png`), Buffer.from(png.split(',')[1], 'base64'))
}
await b.close()
console.log('เสร็จ →', out)
