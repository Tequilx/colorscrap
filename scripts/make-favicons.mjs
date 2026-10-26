// สร้างไอคอนเว็บ/แอปจาก BrandIcon (lib/brand.js): public/favicon.svg (ตัว C เป็น path) + favicon-16.png, favicon-32.png, apple-touch-icon.png (180), icon-512.png + manifest.webmanifest
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/make-favicons.mjs [--url http://localhost:5199]
// เรนเดอร์หลัง document.fonts.ready (ตัว C เป็นเวกเตอร์จาก Mali 700 อยู่แล้ว ไม่พึ่งฟอนต์ตอนเรนเดอร์) พื้นสี่เหลี่ยม #FBFAF6 มุมโค้ง
import { mkdirSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 })
await page.goto(base + '/', { waitUntil: 'load' })
await page.evaluate(async () => { await document.fonts.ready })
const svg = await page.evaluate(async () => (await import('/src/lib/brand.js')).brandIconSvg(512, { background: true, p: 'fav' }))
mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.svg', svg + '\n')
const SIZES = { 'favicon-16.png': 16, 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-512.png': 512 }
for (const [file, size] of Object.entries(SIZES)) {
  await page.evaluate(async ({ size }) => {
    await document.fonts.ready
    const m = await import('/src/lib/brand.js')
    document.documentElement.style.background = 'transparent'
    document.body.style.cssText = 'margin:0;background:transparent;overflow:hidden'
    document.body.innerHTML = `<div id="icon" style="width:${size}px;height:${size}px">${m.brandIconSvg(size, { background: true, p: 'fav' })}</div>`
  }, { size })
  await page.locator('#icon').screenshot({ path: `public/${file}`, omitBackground: true })
}
writeFileSync(
  'public/manifest.webmanifest',
  JSON.stringify({ name: 'ColorScrap', short_name: 'ColorScrap', description: 'สมุดระบายความรู้สึก', lang: 'th', start_url: '/', display: 'standalone', background_color: '#FBFAF6', theme_color: '#FBFAF6', icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }, { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2) + '\n',
)
console.log('เขียน public/favicon.svg, favicon-16.png, favicon-32.png, apple-touch-icon.png, icon-512.png, manifest.webmanifest')
await browser.close()
