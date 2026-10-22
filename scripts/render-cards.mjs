// สคริปต์ dev สร้างการ์ด PNG ตัวอย่าง (ข้อมูลจำลอง 3 อารมณ์: สงบ กังวล เศร้า · วันที่มี 1 ภาพ / 5 ภาพ) ไว้ scripts/out/ เทียบกับไฟล์ดีไซน์
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/render-cards.mjs [--url http://localhost:5199] [--out scripts/out]
// ใช้ฟอนต์จริงจาก Google Fonts (ต้องมีอินเทอร์เน็ต) และเรียก src/lib/share/cards.js ตัวเดียวกับแอป
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const url = opt('url', 'http://localhost:5199')
const out = opt('out', 'scripts/out')
mkdirSync(out, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()))
await page.goto(url + '/')
await page.waitForTimeout(800)

const files = await page.evaluate(async () => {
  const cards = await import('/src/lib/share/cards.js')
  const { EMOTION_COLORS } = await import('/src/lib/tokens.js')
  const { emotionShades } = await import('/src/lib/emotions.js')

  // ภาพระบายจำลอง 1112×612 (สัดส่วนเดียวกับผ้าใบจริง): วงสีน้ำซ้อนกันบนกระดาษ
  const painting = (hexes, seed) => {
    const c = document.createElement('canvas')
    c.width = 1112
    c.height = 612
    const g = c.getContext('2d')
    g.fillStyle = '#FBFAF6'
    g.fillRect(0, 0, c.width, c.height)
    let s = seed
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    hexes.forEach((hex, i) => {
      for (let k = 0; k < 4; k++) {
        g.globalAlpha = 0.35
        g.fillStyle = hex
        g.beginPath()
        g.ellipse(200 + r() * 700, 120 + r() * 380, 90 + r() * 170, 60 + r() * 110, r() * 3, 0, Math.PI * 2)
        g.fill()
      }
    })
    g.globalAlpha = 1
    return createImageBitmap(c)
  }

  const mk = (id, date, time, emotion, intensity, shifted, ratios) => {
    const sh = emotionShades(emotion)
    const hexes = [sh.base, sh.light, sh.deep, '#DED8E3', '#E9E5E8'].slice(0, ratios.length)
    return { id, local_date: date, local_time: time, emotion, emotions: [emotion], intensity, shifted, colors: hexes.map((hex, i) => ({ hex, ratio: ratios[i] })) }
  }
  const date = '2026-10-13'
  const calm = mk('a', date, '09:12', 'calm', 1, false, [0.46, 0.24, 0.14, 0.1, 0.06])
  const anxious = mk('b', date, '00:24', 'anxious', 1, false, [0.46, 0.24, 0.14, 0.1, 0.06])
  const sad = mk('c', date, '20:10', 'sad', 2, true, [0.5, 0.3, 0.2])
  const imageOf = (e) => painting(e.colors.map((c) => c.hex), e.id.charCodeAt(0))

  const toB64 = async (blob) => {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(bin)
  }
  const result = {}
  result['card-photo-calm'] = await toB64(await cards.renderPhotoCard({ entry: calm, image: await imageOf(calm), userName: 'สมใจ' }))
  result['card-photo-anxious'] = await toB64(await cards.renderPhotoCard({ entry: anxious, image: await imageOf(anxious), userName: 'ศศิธร' }))
  result['card-photo-sad'] = await toB64(await cards.renderPhotoCard({ entry: sad, image: await imageOf(sad), userName: 'Alexander' }))
  result['card-photo-noimage-noname'] = await toB64(await cards.renderPhotoCard({ entry: calm, image: null, userName: '' }))

  const one = [calm]
  result['card-day-1'] = await toB64(await cards.renderDayCard({ date, entries: one, thumbs: new Map([['a', await imageOf(calm)]]), userName: 'สมใจ' }))

  // วัน 3 ภาพ (ข้อมูลเดียวกับแบบ 11): สงบ → เหนื่อย(แต้มแสง) → เศร้า(แต้มแสง)
  const d3 = [
    mk('e1', date, '00:45', 'calm', 1, false, [0.5, 0.3, 0.2]),
    mk('e2', date, '01:07', 'tired', 1, true, [0.5, 0.3, 0.2]),
    mk('e3', date, '01:59', 'sad', 2, true, [0.5, 0.3, 0.2]),
  ]
  // วัน 13 ภาพ มีอารมณ์ซ้ำติดกัน (เหมือนแบบ 12)
  const seq = [['02:10', 'anxious', true], ['04:05', 'excited'], ['04:06', 'excited'], ['04:09', 'excited'], ['04:10', 'anxious'], ['04:53', 'anxious'], ['05:44', 'excited'], ['06:10', 'excited'], ['07:30', 'excited'], ['16:39', 'sad', true], ['16:43', 'tired'], ['18:20', 'happy'], ['21:05', 'calm']]
  const d13 = seq.map(([t, em, sh], i) => mk('f' + i, date, t, em, 1, !!sh, [0.5, 0.3, 0.2]))
  const thumbs = new Map()
  for (const e of [...d3, ...d13]) thumbs.set(e.id, await imageOf(e))
  result['card-day-3'] = await toB64(await cards.renderDayCard({ date, entries: d3, thumbs, userName: 'Alexander' }))
  result['card-day-13'] = await toB64(await cards.renderDayCard({ date, entries: d13, thumbs, userName: 'ไฮแอน' }))

  // Web Share (จำลอง) และดาวน์โหลด: ไฟล์ต้องเป็น PNG 1080×1350 ทั้งสองทาง
  const { shareOrDownload, makeFile } = await import('/src/lib/share/shareOrDownload.js')
  const blob = await cards.renderDayCard({ date, entries: d13, thumbs, userName: 'ไฮแอน' })
  const file = makeFile(blob, 'day.png')
  let sharedFile = null
  const orig = { share: navigator.share, canShare: navigator.canShare, touch: Object.getOwnPropertyDescriptor(Navigator.prototype, 'maxTouchPoints') }
  Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5, configurable: true })
  navigator.canShare = () => true
  navigator.share = async ({ files }) => { sharedFile = files[0] }
  const r1 = await shareOrDownload(file, 'day.png')
  Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 0, configurable: true })
  const r2 = await shareOrDownload(file, 'day.png')
  const bmp = await createImageBitmap(sharedFile)
  result.__share = JSON.stringify({ r1, r2, type: sharedFile?.type, w: bmp.width, h: bmp.height })
  return result
})

console.log('share/download:', files.__share)
delete files.__share
for (const [name, b64] of Object.entries(files)) {
  writeFileSync(join(out, name + '.png'), Buffer.from(b64, 'base64'))
  console.log('เขียน', join(out, name + '.png'))
}
await browser.close()
