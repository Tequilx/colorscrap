// สคริปต์ dev (ข้อ 61b): อัด 6 เฟรมต่อการพลิกหน้าสมุดเปลี่ยนวัน ทั้งไปวันใหม่ (next) และย้อนวันเก่า (prev) แล้วทำ contact sheet
// เฟรมแน่นอนทุกครั้ง: หยุดแอนิเมชัน WAAPI ทั้งหมดแล้วเลื่อน currentTime ไปที่สัดส่วนที่ต้องการ (CSS transition ของแผ่นแทรกไม่เกี่ยวกับการพลิกวัน)
// วันที่ใช้ทดสอบ (mock): -2 วัน = 6 ภาพ มีแผ่นแทรก · วันนี้ = 2 ภาพ · -4 วัน = 2 ภาพ
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node scripts/record-flip-layer.mjs <ชื่อรอบ เช่น before|after> [--url http://localhost:5199]
// ภาพลง scripts/out/screens/flip-layer/<ชื่อรอบ>/ + <ชื่อรอบ>-sheet.png (git-ignored)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const OUT = `scripts/out/screens/flip-layer/${tag}`
mkdirSync(OUT, { recursive: true })

const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
await page.goto(base + '/', { waitUntil: 'load' })
await page.waitForTimeout(1200)

const app = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })
const dates = await app((a) => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); return e.dates })
const byCount = await page.evaluate(() => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); return e.dates.map((d) => [d, e.entriesOfDay(d).length]) })
console.log('วัน:', JSON.stringify(byCount))
const many = byCount.find(([, n]) => n > 4)[0] // มีแผ่นแทรก
const dayA = byCount.filter(([d]) => d < many).at(-1)[0] // ถัดเก่ากว่า
const dayB = byCount.at(-1)[0] // วันนี้ (ใหม่กว่า)

await app((a) => a.go('book'))
await page.waitForTimeout(2500)

const fracs = [0.08, 0.22, 0.4, 0.58, 0.76, 0.93]
const frames = []
const run = async (name, from, to) => {
  await app((a, d) => a.openDay(d), from)
  await page.waitForTimeout(700)
  await app((a, d) => a.turnToDay(d), to)
  await page.waitForTimeout(60) // ให้ watcher + nextTick สร้างแอนิเมชันเสร็จ
  const info = await page.evaluate(() => { const an = document.getAnimations().filter((a) => a.effect?.getTiming().duration >= 500); an.forEach((a) => a.pause()); return an.length })
  if (!info) console.warn(name, 'ไม่พบแอนิเมชัน')
  for (const [i, f] of fracs.entries()) {
    await page.evaluate((f) => document.getAnimations().forEach((a) => { const d = a.effect?.getTiming().duration; if (d >= 500) a.currentTime = d * f }), f)
    await page.waitForTimeout(80)
    const file = `${OUT}/${name}-${i + 1}.png`
    await page.screenshot({ path: file, clip: { x: 130, y: 70, width: 1020, height: 660 } })
    frames.push([`${name} ${Math.round(f * 100)}%`, file])
  }
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish() } catch { /* วนไม่รู้จบ */ } }))
  await page.waitForTimeout(400)
}
await run('next-to-many', dayA, many) // ไปวันใหม่: หน้าขวายกขึ้น ลงหน้าซ้าย (หน้าซ้ายใหม่ = วันที่มีแผ่นแทรก)
await run('prev-from-many', many, dayA) // ย้อนวันเก่า: หน้าซ้ายยกขึ้น ลงหน้าขวา (หน้าซ้ายที่ถูกพลิกคือวันที่มีแผ่นแทรก)
await run('prev-from-today', dayB, many) // ย้อนจากวันนี้ ไปวันที่มีหลายภาพ
await browser.close()

// contact sheet: 6 คอลัมน์ x 3 แถว
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const imgs = frames.map(([name, f]) => ({ name, src: 'data:image/png;base64,' + readFileSync(f).toString('base64') }))
const data = await p.evaluate(async (imgs) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(imgs.map((m) => load(m.src)))
  const cw = 340, ch = 220, lab = 20, pad = 6, cols = 6
  const rows = Math.ceil(L.length / cols)
  const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '14px sans-serif'; x.fillStyle = '#222'
  L.forEach((im, i) => { const cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + lab + pad); x.fillText(imgs[i].name, cx, cy + 15); x.drawImage(im, cx, cy + lab, cw, ch) })
  return c.toDataURL('image/png').split(',')[1]
}, imgs)
writeFileSync(`scripts/out/screens/flip-layer/${tag}-sheet.png`, Buffer.from(data, 'base64'))
await b.close()
console.log('เสร็จ → scripts/out/screens/flip-layer/' + tag + '-sheet.png')
