// สคริปต์ dev: ถ่ายหน้าซ้ายของสมุดสามแบบ (วันที่มีแผ่นเดียว / แผ่นแรกของวันหลายแผ่น / แผ่น "(ต่อ)") เพื่อดูบรรทัดใต้หัววันที่
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/shot-leaf-subtitle.mjs <ชื่อรอบ before|after>
// ภาพลง scripts/out/screens/leaf-subtitle/<รอบ>-{single,multi-first,multi-cont}.png
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] || 'run'
const OUT = 'scripts/out/screens/leaf-subtitle'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
await page.goto('http://localhost:5199/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
const S = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`
const clip = { x: 130, y: 20, width: 520, height: 720 } // หน้าซ้ายของสมุด
const days = await page.evaluate(`(() => { const e = ${S('entries')}; const c = {}; e.entries.forEach((x) => { c[x.local_date] = (c[x.local_date] || 0) + 1 }); return c })()`)
const dates = Object.keys(days).sort()
const single = dates.find((d) => days[d] <= 4)
const multi = dates.find((d) => days[d] > 4)
console.log('single', single, days[single], 'multi', multi, days[multi])
await page.evaluate(`${S('app')}.go('book')`)
await page.waitForTimeout(2500)
const show = async (date, leaf, name) => {
  await page.evaluate(`${S('app')}.turnToDay('${date}')`)
  await page.waitForTimeout(1600)
  if (leaf !== null) { await page.evaluate(`${S('app')}.setLeaf(${leaf})`); await page.waitForTimeout(1200) }
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, clip })
}
await show(single, null, 'single')
await show(multi, 0, 'multi-first')
await page.evaluate(`${S('app')}.setLeaf(1)`)
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/${tag}-multi-cont.png`, clip })
await browser.close()
