// สคริปต์ dev: ตรวจลำดับขนาดตัวอักษรบนการ์ดจานสีของวัน: ชื่อสีสั้น และชื่อสียาว 2 บรรทัด
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/render-card-type.mjs <ชื่อรอบ before|after> [--webkit]
// ภาพลง scripts/out/screens/card-type/<รอบ>-short.png / <รอบ>-long.png
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'run'
const OUT = 'scripts/out/screens/card-type'
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
  const { dayColor } = await import('/src/lib/palette.js')
  const { emotionShades } = await import('/src/lib/emotions.js')
  const mk = (i, e, time) => { const sh = emotionShades(e); return { id: 'x' + i, local_date: '2026-10-13', local_time: time, emotion: e, emotions: [e], intensity: 1, shifted: false, colors: [sh.base, sh.light, sh.deep].map((hex, k) => ({ hex, ratio: [0.5, 0.3, 0.2][k] })) } }
  const sets = {
    short: [mk(0, 'calm', '10:00'), mk(1, 'calm', '10:30')],
    long: [mk(0, 'angry', '17:40'), mk(1, 'warm', '18:10'), mk(2, 'excited', '18:30')],
  }
  const toB64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin) }
  const out = { names: {}, fonts: [] }
  for (const [k, list] of Object.entries(sets)) {
    const d = dayColor(list)
    out.names[k] = d.name
    out[k] = await toB64(await cards.renderDayCard({ date: '2026-10-13', entries: list, userName: 'สมใจ' }))
  }
  out.fonts = ['700 76px Mali', '600 52px Mali', '600 30px Mali', '500 30px Mali'].map((f) => [f, document.fonts.check(f, 'สีของวัน')])
  return out
})
console.log(JSON.stringify(res.names), JSON.stringify(res.fonts))
for (const k of ['short', 'long']) writeFileSync(`${OUT}/${tag}-${k}.png`, Buffer.from(res[k], 'base64'))
await browser.close()
