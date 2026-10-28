// สคริปต์ dev : อัดทุกเฟรม (CDP screencast) รอบจังหวะแผ่นลงถึงหน้า (−150 ถึง +300 ms) ทั้งไปวันใหม่ (next) และย้อนวันเก่า (prev)
// แล้วหาเฟรมที่ "กะพริบ": เฟรมที่ต่างจากทั้งเฟรมก่อนและหลังมากกว่าที่สองเฟรมนั้นต่างกันเอง (spike) พิมพ์ตาราง |Δ| ต่อเฟรม + contact sheet ลง scripts/out/screens/flip-land/
// (ดัดแปลงจาก record-flip-reveal.mjs ใช้ภาพ/เซิร์ฟเวอร์ภาพชุดเดียวกัน)
// ภาพจริงของสมุดจำลองด้วยเซิร์ฟเวอร์ภาพเล็ก ๆ (พอร์ต 5398) + ดัก module remote.js ให้ signPaths คืน URL ของเซิร์ฟเวอร์นั้น (ทางเดียวกับโหมดจริง: imageUrls.prefetch → <img src>)
//   --net fast4g|none   throttle Fast 4G (CDP, ปิด cache) หรือไม่
//   --cache cold|warm   warm = เปิดดูทุกวันมาก่อนแล้ว (ภาพอยู่ใน cache/หน่วยความจำ) · cold = ยังไม่เคยเปิดวันปลายทาง
//   --settle <ms>       รอหลังเปิดสมุดก่อนพลิก (ผู้ใช้จริงมักรอเป็นวินาที; ค่า 100 = พลิกทันที)
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/record-flip-reveal.mjs <ชื่อรอบ before|after> [--net fast4g] [--cache cold] [--settle 1500]
// ภาพลง scripts/out/screens/flip-land/<ชื่อรอบ>-<net>-<cache>-s<settle>/ + sheet.png (git-ignored) และพิมพ์ตารางวัด
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const net = opt('net', 'none')
const cache = opt('cache', 'warm')
const settle = +opt('settle', 1500)
const name = `${tag}-${net}-${cache}-s${settle}`
const OUT = `scripts/out/screens/flip-land/${name}`
mkdirSync(OUT, { recursive: true })

// ภาพทดสอบ 16 ภาพ 356×196 (สีต่างกัน มี noise ให้ไฟล์ ~30–60 KB) ทำด้วย ffmpeg
const dir = mkdtempSync(join(tmpdir(), 'flipimg-'))
const imgs = []
for (let i = 0; i < 16; i++) {
  const f = join(dir, `${i}.jpg`)
  const hex = [...Array(3)].map((_, k) => (60 + ((i * 53 + k * 91) % 150)).toString(16).padStart(2, '0')).join('')
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x${hex}:s=356x196,noise=alls=60:allf=t+u`, '-frames:v', '1', '-q:v', '5', f])
  imgs.push(readFileSync(f))
}
const PORT = 5398
let imgRequests = 0
const server = createServer((req, res) => {
  const m = /\/__img\/(\d+)/.exec(req.url)
  if (!m) return res.writeHead(404).end()
  imgRequests++
  res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' })
  res.end(imgs[+m[1] % imgs.length])
}).listen(PORT)

const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.error('pageerror', e.message))
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.error(m.type(), m.text().slice(0, 300)))
await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
// signPaths → URL ของเซิร์ฟเวอร์ภาพ (หมายเลขภาพจากเลขใน path)
await page.route('**/src/lib/remote.js*', async (route) => {
  const r = await route.fetch()
  const body = (await r.text()).replace('export const signPaths = async (paths, ttl) => {', `export const signPaths = async (paths) => paths.map((p) => ({ path: p, signedUrl: 'http://localhost:${PORT}/__img/' + p.replace(/\\D/g, '') }))\nconst __unusedSign = async (paths, ttl) => {`)
  await route.fulfill({ response: r, body })
})
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: net === 'fast4g' })
await page.goto(base + '/', { waitUntil: 'load' })
await page.waitForTimeout(1200)

const store = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`
const ev = (code) => page.evaluate(code)
// ใส่ path ของภาพให้ทุก entry แล้วขอ signed URL ทั้งสมุด (เหมือน entries.load ในโหมดจริง) ก่อนเข้าสมุด
await ev(`(async () => { const e = ${store('entries')}; e.entries.forEach((x, i) => { x.thumb_path = 't/' + i; x.image_path = 'i/' + i }); await ${store('imageUrls')}.prefetch(e.entries.map((x) => x.thumb_path)) })()`)
const byCount = await ev(`${store('entries')}.dates.map((d) => [d, ${store('entries')}.entriesOfDay(d).length])`)
const many = byCount.find(([, n]) => n > 4)[0]
const dayA = byCount.filter(([d]) => d < many).at(-1)[0]
const app = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('app', 'arg', 'return (' + fn + ')(app, arg)')(s, arg) }, { fn: fn.toString(), arg })

await app((a) => a.go('book'))
await page.waitForTimeout(2500)
if (cache === 'warm') {
  for (const [d] of byCount) { await app((a, x) => a.openDay(x), d); await page.waitForTimeout(500) }
} else {
  await cdp.send('Network.clearBrowserCache')
}

// บันทึกต่อเฟรม: จังหวะพลิกเสร็จ (leafFlipping true→false) และสถานะภาพจริงในหน้า (ไม่นับสำเนาบนแผ่น)
await ev(`(() => {
  const app = ${store('app')}
  window.__log = { end: null, frames: [] }
  let was = false
  const tick = () => {
    const now = performance.timeOrigin + performance.now()
    const on = document.querySelector('.turn-snap.absolute')?.style.visibility === 'visible' // สำเนาหน้าเก่าใต้แผ่น: ติดตอนพลิก ถูกเคลียร์ใน stopTurn (app.leafFlipping ใช้ไม่ได้ PhotoPage รีเซ็ตกลางทาง)
    if (was && !on && window.__log.end == null) window.__log.end = now
    was = on || was
    const real = [...document.querySelectorAll('[data-wet-target] img')].filter((i) => !i.closest('.turn-snap'))
    const crop = document.querySelector('[data-day-frame] img')
    window.__log.frames.push({ t: now, n: real.length, notDone: real.filter((i) => !i.complete || !i.naturalWidth).length, minOp: real.reduce((m, i) => Math.min(m, +getComputedStyle(i).opacity), 1), crop: crop ? +getComputedStyle(crop).opacity : null })
    window.__raf = requestAnimationFrame(tick)
  }
  window.__raf = requestAnimationFrame(tick)
})()`)

const shots = []
cdp.on('Page.screencastFrame', async (f) => { shots.push({ t: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })

const results = []
const allShots = {}
const run = async (label, from, to) => {
  await app((a, d) => a.openDay(d), from)
  await page.waitForTimeout(settle)
  await ev('window.__log.end = null; window.__log.frames = []')
  shots.length = 0
  const req0 = imgRequests
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 })
  await app((a, d) => a.turnToDay(d), to)
  if (false) for (let k = 0; k < 8; k++) { console.log(k, await ev(`JSON.stringify([${store('app')}.leafFlipping, ${store('app')}.pageTurn?.dir, document.querySelector('.turn-snap.absolute')?.style.visibility, document.getAnimations().length])`)); await page.waitForTimeout(60) }
  await page.waitForTimeout(300)
  if (process.env.DBG) console.log(await ev(`JSON.stringify([${store('app')}.openDate, ${store('app')}.busy, ${store('app')}.leafFlipping, window.__log.frames.length, window.__log.end, !!${store('app')}.pageTurn, matchMedia('(prefers-reduced-motion: reduce)').matches])`))
  await page.waitForFunction(() => window.__log.end != null, null, { timeout: 8000 })
  await page.waitForTimeout(700)
  await cdp.send('Page.stopScreencast')
  const log = await ev('window.__log')
  const end = log.end
  const after = log.frames.filter((f) => f.t >= end - 20)
  const pops = after.filter((f) => f.notDone > 0 || f.minOp < 0.99 || (f.crop != null && f.crop < 0.99))
  const lastBad = pops.length ? Math.round(pops.at(-1).t - end) : null
  const atEnd = log.frames.filter((f) => f.t <= end).at(-1)
  results.push({ label, imgsAtEnd: atEnd?.n, notDoneAtEnd: atEnd?.notDone, cropOpAtEnd: atEnd?.crop, badFramesAfterEnd: pops.length, lastBadMsAfterEnd: lastBad, newImgRequests: imgRequests - req0 })
  allShots[label] = { end, shots: shots.map((x) => ({ off: x.t - end, data: x.data })).filter((f) => f.off >= -150 && f.off <= 300) }
  return []
}
await run('next', dayA, many)
await run('prev', many, dayA)
await browser.close()
server.close()
const diffPage = await (await chromium.launch({ channel: 'chrome' })).newPage()
const report = {}
const sheetItems = []
for (const label of ['next', 'prev']) {
  const { shots: sh } = allShots[label]
  const res = await diffPage.evaluate(async (list) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/jpeg;base64,' + s })
    const c = document.createElement('canvas'); c.width = 510; c.height = 330
    const g = c.getContext('2d', { willReadFrequently: true })
    const px = []
    for (const f of list) { const im = await load(f.data); g.drawImage(im, 130, 70, 1020, 660, 0, 0, 510, 330); px.push(g.getImageData(0, 0, 510, 330).data) }
    const d = (a, b) => { let sum = 0; for (let k = 0; k < a.length; k += 4) sum += (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) / 3; return sum / (a.length / 4) }
    return list.map((f, i) => {
      const prev = i > 0 ? d(px[i - 1], px[i]) : null
      const nextD = i < list.length - 1 ? d(px[i], px[i + 1]) : null
      const skip = i > 0 && i < list.length - 1 ? d(px[i - 1], px[i + 1]) : null
      // spike: เฟรมนี้ต่างจากเพื่อนบ้านทั้งสองข้างมากกว่าที่เพื่อนบ้านต่างกันเอง (เฟรมที่ "เด้ง" แล้วกลับ)
      const spike = prev != null && nextD != null ? Math.max(0, Math.min(prev, nextD) - skip) : 0
      return { off: Math.round(f.off), prev: prev == null ? null : +prev.toFixed(2), spike: +spike.toFixed(2) }
    })
  }, sh.map((f) => ({ off: f.off, data: f.data })))
  report[label] = res
  sh.forEach((f, i) => { const file = `${OUT}/${label}-${String(i).padStart(2, '0')}.jpg`; writeFileSync(file, Buffer.from(f.data, 'base64')); sheetItems.push({ name: `${label} ${res[i].off >= 0 ? '+' : ''}${res[i].off}ms Δ${res[i].prev ?? '-'}${res[i].spike > 0.5 ? ' SPIKE ' + res[i].spike : ''}`, src: 'data:image/jpeg;base64,' + f.data }) })
}
await diffPage.context().browser().close()
for (const label of ['next', 'prev']) {
  console.log(`== ${name} ${label}: เฟรม ${report[label].length}, spike สูงสุด ${Math.max(...report[label].map((r) => r.spike))}, |Δ| สูงสุดหลังลงถึง(≥0ms) ${Math.max(0, ...report[label].filter((r) => r.off >= 0).map((r) => r.prev ?? 0))}`)
  console.log(report[label].map((r) => `${r.off}:${r.prev ?? '-'}${r.spike > 0.5 ? '*' : ''}`).join(' '))
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report))
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const data = await p.evaluate(async (items) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(items.map((m) => load(m.src)))
  const cw = 250, ch = 161, lab = 18, pad = 4, cols = 8
  const rows = Math.ceil(L.length / cols)
  const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '11px sans-serif'; x.fillStyle = '#222'
  L.forEach((im, i) => { const cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + lab + pad); x.fillText(items[i].name, cx, cy + 12); x.drawImage(im, 130, 70, 1020, 660, cx, cy + lab, cw, ch) })
  return c.toDataURL('image/png').split(',')[1]
}, sheetItems)
writeFileSync(`${OUT}/sheet.png`, Buffer.from(data, 'base64'))
await b.close()
console.log('→', OUT)
