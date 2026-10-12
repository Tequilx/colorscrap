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

  const five = [
    mk('d1', date, '08:05', 'happy', 1, false, [0.55, 0.25, 0.2]),
    mk('d2', date, '10:30', 'calm', 2, false, [0.5, 0.3, 0.2]),
    mk('d3', date, '13:40', 'tired', 1, true, [0.4, 0.25, 0.2, 0.15]),
    mk('d4', date, '15:40', 'anxious', 1, false, [0.46, 0.24, 0.14, 0.1, 0.06]),
    mk('d5', date, '21:50', 'sad', 0, false, [0.6, 0.25, 0.15]),
  ]
  const thumbs = new Map()
  for (const e of five) thumbs.set(e.id, await imageOf(e))
  result['card-day-5'] = await toB64(await cards.renderDayCard({ date, entries: five, thumbs, userName: 'ศศิธร' }))
  const three = five.slice(0, 3)
  result['card-day-3'] = await toB64(await cards.renderDayCard({ date, entries: three, thumbs, userName: 'Alexander' }))
  return result
})

for (const [name, b64] of Object.entries(files)) {
  writeFileSync(join(out, name + '.png'), Buffer.from(b64, 'base64'))
  console.log('เขียน', join(out, name + '.png'))
}
await browser.close()
