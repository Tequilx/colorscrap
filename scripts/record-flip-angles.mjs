// สคริปต์ dev: อัดภาพแผ่นพลิกหน้าสมุดทุกมุม (0 30 60 85 95 120 150 180°) ทั้งไปวันใหม่ (next) และย้อนวันเก่า (prev) ใน WebKit และ Chromium
// เพื่อตรวจว่าช่วง 0–90° เห็นหน้าเดิมปกติ และ 90–180° เห็นหลังแผ่นอ่านได้ปกติ (ไม่มีตัวหนังสือกลับด้านทะลุ) · ตั้ง FLIPBACK=true|false เพื่อเขียนทับค่าคงที่ FLIP_BACK_CONTENT ใน OpenBook.vue ตอนทดสอบ
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… [FLIPBACK=true] node scripts/record-flip-angles.mjs <ชื่อรอบ> [--engine webkit|chromium|both]
// ภาพลง scripts/out/screens/flip-angles/<รอบ>-<engine>-<ทิศ>-<มุม>.png + <รอบ>-<engine>-sheet.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { timeAtProgress } from '../src/lib/flipTiming.js'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const engineArg = args.includes('--engine') ? args[args.indexOf('--engine') + 1] : 'both'
const base = 'http://localhost:5199'
const OUT = 'scripts/out/screens/flip-angles'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { webkit, chromium, devices } = pw.default || pw
const ANGLES = [0, 30, 60, 85, 95, 120, 150, 180]
const S = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`

const run = async (name, launch, ctxOpts) => {
  const browser = await launch()
  const ctx = await browser.newContext({ ...ctxOpts, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(name, 'pageerror', e.message))
  if (process.env.FLIPBACK) {
    await page.route('**/src/components/book/OpenBook.vue*', async (route) => {
      const r = await route.fetch()
      const body = (await r.text()).replace(/const FLIP_BACK_CONTENT = (true|false)/, `const FLIP_BACK_CONTENT = ${process.env.FLIPBACK}`)
      await route.fulfill({ response: r, body })
    })
  }
  await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
  await page.goto(base + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  const byCount = await page.evaluate(`${S('entries')}.dates.map((d) => [d, ${S('entries')}.entriesOfDay(d).length])`)
  const many = byCount.find(([, n]) => n > 4)[0]
  const dayA = byCount.filter(([d]) => d < many).at(-1)[0]
  await page.evaluate(`${S('app')}.go('book')`)
  await page.waitForTimeout(2500)
  const shots = []
  for (const [dir, from, to] of [['next', dayA, many], ['prev', many, dayA]]) {
    await page.evaluate(`${S('app')}.openDay('${from}')`)
    await page.waitForTimeout(700)
    await page.evaluate(`${S('app')}.turnToDay('${to}')`)
    await page.waitForTimeout(250)
    const n = await page.evaluate(() => { const an = document.getAnimations().filter((a) => a.effect?.getTiming().duration >= 500); an.forEach((a) => a.pause()); return an.length })
    if (!n) console.warn(name, dir, 'ไม่พบแอนิเมชัน')
    for (const deg of ANGLES) {
      const f = Math.min(timeAtProgress(deg / 180), 0.9995)
      await page.evaluate((f) => document.getAnimations().forEach((a) => { const d = a.effect?.getTiming().duration; if (d >= 500) a.currentTime = d * f }), f)
      await page.waitForTimeout(120)
      const file = `${OUT}/${tag}-${name}-${dir}-${String(deg).padStart(3, '0')}.png`
      await page.screenshot({ path: file, clip: { x: 130, y: 50, width: 1020, height: 680 } })
      shots.push({ label: `${dir} ${deg}°`, src: 'data:image/png;base64,' + readFileSync(file).toString('base64') })
    }
    await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish() } catch { /* วนไม่รู้จบ */ } }))
    await page.waitForTimeout(500)
  }
  await browser.close()
  return shots
}
const sheet = async (name, shots) => {
  const b = await chromium.launch({ channel: 'chrome' })
  const p = await b.newPage()
  const data = await p.evaluate(async (items) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
    const L = await Promise.all(items.map((m) => load(m.src)))
    const cw = 330, ch = 220, lab = 16, pad = 4, cols = 4
    const rows = Math.ceil(L.length / cols)
    const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '12px sans-serif'; x.fillStyle = '#222'
    L.forEach((im, i) => { const cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + lab + pad); x.fillText(items[i].label, cx, cy + 12); x.drawImage(im, cx, cy + lab, cw, ch) })
    return c.toDataURL('image/png').split(',')[1]
  }, shots)
  writeFileSync(`${OUT}/${tag}-${name}-sheet.png`, Buffer.from(data, 'base64'))
  await b.close()
}
const engines = []
if (engineArg !== 'chromium') engines.push(['webkit', () => webkit.launch(), devices['iPad Pro 11 landscape'] ? { ...devices['iPad Pro 11 landscape'], viewport: { width: 1280, height: 800 }, hasTouch: false } : { viewport: { width: 1280, height: 800 } }])
if (engineArg !== 'webkit') engines.push(['chromium', () => chromium.launch({ channel: 'chrome' }), { viewport: { width: 1280, height: 800 } }])
for (const [name, launch, opts] of engines) {
  try { const shots = await run(name, launch, opts); await sheet(name, shots); console.log('เสร็จ', name) } catch (e) { console.error(name, 'ล้มเหลว:', String(e.message).slice(0, 200)) }
}
