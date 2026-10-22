// อัดวิดีโอเดโม ~90 วิ (1280×800, โหมด mock) ผ่าน UI จริง: หน้าแรก → พลิกปกเข้าสมุดแล้วกลับ → เลือก "เศร้า มากเลย" (พู่กันจุ่ม) → สาดสี
// → ปาด (โน้ตพับเก็บเอง) → เติมหยด → แต้มแสง → บันทึก (กระดาษลอย การ์ด แถบสีถูกปาด) → พลิกหน้าสมุด → ภาพเดี่ยว (ภาพยังเปียก) → เก็บรูปจานสีของวัน
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/record-demo.mjs [--url http://localhost:5199] [--out scripts/out/demo] [--times night,day]
// ได้ <out>/demo-night.webm และ demo-day.webm (git-ignored ไม่ commit) ** Playwright อัดเสียงไม่ได้ ไฟล์ไม่มีเสียงเอฟเฟกต์/เพลง ** เคอร์เซอร์ที่เห็นในวิดีโอเป็นจุดจำลอง (วิดีโอจับเคอร์เซอร์จริงไม่ได้)
import { mkdirSync, renameSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const OUT = opt('out', 'scripts/out/demo')
const times = opt('times', 'night,day').split(',')
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')

const run = async (time) => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const tmp = join(OUT, `tmp-${time}`)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, recordVideo: { dir: tmp, size: { width: 1280, height: 800 } } })
  await ctx.addInitScript(() => {
    localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล', 'แมว', 'เพลง'] }))
    // จุดแทนเคอร์เซอร์ (วิดีโอไม่ติดเคอร์เซอร์จริง)
    addEventListener('DOMContentLoaded', () => {
      const dot = document.createElement('div')
      dot.style.cssText = 'position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:2px solid #2D2B33;background:rgba(255,255,255,.55);pointer-events:none;left:-50px;top:-50px;transition:transform .12s'
      document.body.appendChild(dot)
      addEventListener('pointermove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px' }, true)
      addEventListener('pointerdown', () => (dot.style.transform = 'scale(.7)'), true)
      addEventListener('pointerup', () => (dot.style.transform = ''), true)
    })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`${base}/?time=${time}`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const pause = (s) => page.waitForTimeout(s * 1000)
  const click = async (name, opts = {}) => {
    const loc = page.getByRole('button', { name, ...opts }).first()
    const b = await loc.boundingBox()
    if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 })
    await pause(0.35)
    await loc.click()
  }
  const store = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('a', 'arg', 'return (' + fn + ')(a, arg)')(s, arg) }, { fn: fn.toString(), arg })

  await pause(3.5) // หน้าแรก
  await click('เปิดสมุด'); await pause(4.5) // พลิกปกเข้าสมุด
  await page.getByRole('button', { name: 'หน้าแรก' }).last().click(); await pause(3.5) // พลิกกลับ
  await click('เลือกความรู้สึกวันนี้'); await pause(2)
  await click('เศร้า'); await pause(2.2) // พู่กันจุ่ม
  await click('มากเลย'); await pause(1.2)
  await click('เริ่มระบาย'); await pause(5) // สาดสี
  // ปาด: โน้ตพับเก็บเอง
  await page.mouse.move(380, 280, { steps: 10 }); await page.mouse.down()
  for (let i = 0; i < 70; i++) await page.mouse.move(380 + i * 9, 280 + Math.sin(i / 7) * 110, { steps: 3 })
  await page.mouse.up(); await pause(3)
  // เติมหยด
  await click('เติมหยด')
  for (const [x, y] of [[420, 520], [640, 330], [860, 480]]) { await page.mouse.move(x, y, { steps: 14 }); await pause(0.3); await page.mouse.click(x, y); await pause(1.1) }
  await page.mouse.move(700, 540, { steps: 10 }); await page.mouse.down(); await pause(1.2); await page.mouse.up(); await pause(2.5)
  // แต้มแสง
  await click('แต้มแสง')
  await page.mouse.move(560, 420, { steps: 14 }); await pause(0.3); await page.mouse.click(560, 420); await pause(3)
  await page.mouse.move(820, 360, { steps: 10 }); await page.mouse.down(); await pause(1.2); await page.mouse.up(); await pause(3.5)
  // บันทึก
  await click('บันทึกลงสมุด'); await pause(5.5)
  await click('ดูสมุดทั้งเล่ม'); await pause(3)
  // พลิกหน้าสมุด: วันที่มีหลายแผ่น แล้วเปลี่ยนวัน
  const d = await page.evaluate(() => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); return e.dates.find((x) => e.entriesOfDay(x).length > 4) })
  if (d) {
    await store((a, x) => a.turnToDay(x), d); await pause(2.5)
    await click('แผ่นถัดไป'); await pause(2.5)
    await click('แผ่นก่อนหน้า'); await pause(2)
  }
  await store((a) => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); const t = e.dates.at(-1); a.openDay(t) }); await pause(1.5)
  await page.locator('[data-entry-id] button').last().click(); await pause(5) // ภาพเดี่ยว (ภาพยังเปียก)
  await page.keyboard.press('Escape'); await pause(2)
  await click('เก็บจานสีวันนี้เป็นรูป'); await pause(4)

  const video = page.video()
  await ctx.close()
  const path = await video.path()
  const target = join(OUT, `demo-${time}.webm`)
  renameSync(path, target)
  await browser.close()
  console.log('เขียน', target)
}

for (const t of times) await run(t)
