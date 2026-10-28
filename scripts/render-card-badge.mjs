// สคริปต์ dev: ตรวจป้าย "+N ภาพ" บนการ์ดจานสีของวัน (เก็บรูปของวัน) ที่ +1 / +8 / +12 / +99 ภาพ แล้ววัดว่าป้ายไม่ทับโพลารอยด์/เส้นประท้ายการ์ด และอยู่ในกรอบการ์ด
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/render-card-badge.mjs <ชื่อรอบ before|after> [--webkit]
// ภาพลง scripts/out/screens/card-badge/<รอบ>-<N>.png (ครอปส่วนล่างของการ์ด) + <รอบ>-sheet.png
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const OUT = 'scripts/out/screens/card-badge'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium, webkit } = pw.default || pw
const engine = args.includes('--webkit') ? webkit : chromium
const browser = await (args.includes('--webkit') ? engine.launch() : engine.launch({ channel: 'chrome' }))
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto('http://localhost:5199/')
await page.waitForTimeout(800)
const res = await page.evaluate(async () => {
  const cards = await import('/src/lib/share/cards.js')
  const { emotionShades } = await import('/src/lib/emotions.js')
  const em = ['calm', 'anxious', 'excited', 'sad', 'happy', 'tired', 'angry', 'warm']
  const painting = (hexes, seed) => {
    const c = document.createElement('canvas'); c.width = 1112; c.height = 612
    const g = c.getContext('2d'); g.fillStyle = '#FBFAF6'; g.fillRect(0, 0, 1112, 612)
    let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    hexes.forEach((hex) => { for (let k = 0; k < 3; k++) { g.globalAlpha = 0.4; g.fillStyle = hex; g.beginPath(); g.ellipse(200 + r() * 700, 120 + r() * 380, 90 + r() * 170, 60 + r() * 110, r() * 3, 0, Math.PI * 2); g.fill() } })
    return createImageBitmap(c)
  }
  const mk = (i) => { const e = em[i % 8]; const sh = emotionShades(e); return { id: 'x' + i, local_date: '2026-10-13', local_time: `${String(1 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`, emotion: e, emotions: [e], intensity: 1, shifted: i % 5 === 0 && ['sad', 'tired', 'angry', 'anxious'].includes(e), colors: [sh.base, sh.light, sh.deep].map((hex, k) => ({ hex, ratio: [0.5, 0.3, 0.2][k] })) } }
  const toB64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin) }
  const out = {}
  for (const n of [4, 11, 15, 102]) {
    const list = Array.from({ length: n }, (_, i) => mk(i))
    const thumbs = new Map()
    for (const e of list.slice(-3)) thumbs.set(e.id, await painting(e.colors.map((c) => c.hex), e.id.length * 7 + n))
    out[n - 3] = await toB64(await cards.renderDayCard({ date: '2026-10-13', entries: list, thumbs, userName: 'สมใจ' }))
  }
  out.layout = cards.badgeLayout ? [20, 60, 110, 140].map((w) => cards.badgeLayout(w)) : null
  return out
})
const files = []
for (const n of [1, 8, 12, 99]) { const f = `${OUT}/${tag}-${n}.png`; writeFileSync(f, Buffer.from(res[n], 'base64')); files.push([`${tag} +${n}`, f]) }
if (res.layout) console.log('badgeLayout', JSON.stringify(res.layout.map((l) => ({ bw: Math.round(l.bw), scale: +l.scale.toFixed(3), groupRight: Math.round(l.groupRight), bx: Math.round(l.bx) }))))
await browser.close()
// contact sheet: ครอปส่วนล่างของการ์ด (y 880–1350) ของทั้ง 4 แบบ
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const data = await p.evaluate(async (items) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(items.map((m) => load(m.src)))
  const cw = 540, ch = 235, lab = 18, pad = 4
  const c = document.createElement('canvas'); c.width = 2 * (cw + pad) + pad; c.height = 2 * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '13px sans-serif'; x.fillStyle = '#222'
  L.forEach((im, i) => { const cx = pad + (i % 2) * (cw + pad), cy = pad + Math.floor(i / 2) * (ch + lab + pad); x.fillText(items[i].name, cx, cy + 13); x.drawImage(im, 0, 880, 1080, 470, cx, cy + lab, cw, ch) })
  return c.toDataURL('image/png').split(',')[1]
}, files.map(([name, f]) => ({ name, src: 'data:image/png;base64,' + readFileSync(f).toString('base64') })))
writeFileSync(`${OUT}/${tag}-sheet.png`, Buffer.from(data, 'base64'))
await b.close()
console.log('→', `${OUT}/${tag}-sheet.png`)
