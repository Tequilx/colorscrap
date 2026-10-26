// สคริปต์ dev ถ่ายภาพก่อน/หลังของข้อ 53 (a เทปหน้าปรับแต่งสมุด, b ปุ่มบัญชีห่างขอบล่าง) ที่ 1280×800, iPad 1180×820 และ 375×667
// AccountActions แสดงเฉพาะโหมดจริง จึง mount ซ้อนเองในหน้า mock (auth.user ปลอม) เพื่อวัดตำแหน่ง
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/details53.mjs <before|after> [--url http://localhost:5199]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tag = args.find((a) => !a.startsWith('--')) || 'after'
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = join('scripts/out/screens/details53', tag)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
for (const [name, viewport] of [['mac', { width: 1280, height: 800 }], ['ipad', { width: 1180, height: 820 }], ['phone', { width: 375, height: 667 }]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  await context.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#2F6B4F', likes: ['ทะเล'] })))
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia._s.get('app').openSettings()
    await new Promise((r) => setTimeout(r, 1500))
    const { createApp } = await import('/node_modules/.vite/deps/vue.js')
    const C = (await import('/src/components/hello/AccountActions.vue')).default
    pinia._s.get('auth').user = { email: 'mali@example.com' }
    const host = document.createElement('div')
    document.querySelector('[data-stage]').appendChild(host)
    const a = createApp(C)
    a.use(pinia)
    a.mount(host)
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  const m = await page.evaluate(() => {
    const stage = document.querySelector('[data-stage]').getBoundingClientRect()
    const acc = [...document.querySelectorAll('button')].filter((b) => /ออกจากระบบ|ลบข้อมูล/.test(b.textContent)).map((b) => b.getBoundingClientRect())
    const accBottom = Math.max(...acc.map((r) => r.bottom))
    const sheet = document.querySelector('#app').querySelector('.-rotate-\\[0\\.6deg\\]')?.getBoundingClientRect()
    return { stageBottom: Math.round(stage.bottom), buttonsBottom: Math.round(accBottom), gapScreenPx: Math.round(stage.bottom - accBottom), scale: +(stage.height / 800).toFixed(3), gapStageUnits: Math.round((stage.bottom - accBottom) / (stage.height / 800)), sheetRight: sheet && Math.round(sheet.right), buttonsLeft: Math.round(Math.min(...acc.map((r) => r.left))), tapeCount: document.querySelectorAll('.-rotate-\\[0\\.6deg\\] > [class*="tape"], .-rotate-\\[0\\.6deg\\] svg').length }
  })
  console.log(name, JSON.stringify(m))
  await context.close()
}
await browser.close()
