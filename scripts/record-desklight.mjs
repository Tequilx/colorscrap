// สคริปต์ dev : ภาพหน้าปก/สมุดช่วง day/dusk/night (?time=) ที่ iPad 1180×820 และ Mac 1280×800 เพื่อเทียบว่าฉากไม่เปลี่ยนตามช่วงเวลา
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/record-desklight.mjs <before|after>   → scripts/out/screens/desklight/<รอบ>-<อุปกรณ์>-<ช่วง>-<หน้า>.png
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const tag = process.argv[2] || 'run'
const OUT = 'scripts/out/screens/desklight'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })
const S = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`
for (const [dev, vp] of [['mac', { width: 1280, height: 800 }], ['ipad', { width: 1180, height: 820 }]]) {
  for (const time of ['day', 'dusk', 'night']) {
    const ctx = await browser.newContext({ viewport: vp })
    const page = await ctx.newPage()
    await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
    await page.goto(`http://localhost:5199/?time=${time}`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.evaluate(`${S('app')}.go('cover')`)
    await page.waitForTimeout(2800)
    await page.screenshot({ path: `${OUT}/${tag}-${dev}-${time}-cover.png` })
    await page.evaluate(`${S('app')}.go('book')`)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${OUT}/${tag}-${dev}-${time}-book.png` })
    await ctx.close()
  }
}
await browser.close()
// contact sheet: แถว = อุปกรณ์×หน้า, คอลัมน์ = day/dusk/night
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const items = []
for (const dev of ['mac', 'ipad']) for (const pg of ['cover', 'book']) for (const t of ['day', 'dusk', 'night']) items.push({ name: `${tag} ${dev} ${t} ${pg}`, src: 'data:image/png;base64,' + readFileSync(`${OUT}/${tag}-${dev}-${t}-${pg}.png`).toString('base64') })
const data = await p.evaluate(async (items) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(items.map((m) => load(m.src)))
  const cw = 420, ch = 280, lab = 18, pad = 4
  const c = document.createElement('canvas'); c.width = 3 * (cw + pad) + pad; c.height = 4 * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '12px sans-serif'; x.fillStyle = '#222'
  L.forEach((im, i) => { const cx = pad + (i % 3) * (cw + pad), cy = pad + Math.floor(i / 3) * (ch + lab + pad); x.fillText(items[i].name, cx, cy + 13); x.drawImage(im, cx, cy + lab, cw, ch) })
  return c.toDataURL('image/png').split(',')[1]
}, items)
writeFileSync(`${OUT}/${tag}-sheet.png`, Buffer.from(data, 'base64'))
await b.close()
console.log('→', `${OUT}/${tag}-sheet.png`)
