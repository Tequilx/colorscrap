// สคริปต์ dev (ข้อ 63): ถ่ายแท็บวัน (เปิดวันนี้ / วันเก่า / วันแรก), ปฏิทิน 2 เดือน, เฟรมการกระโดดข้ามหลายวันจากปฏิทิน และทดสอบคีย์บอร์ด/แตะนอกกรอบ/ขนาดปุ่ม ทั้ง Mac / iPad / 375 px
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/record-calendar.mjs [--url http://localhost:5199]
// ภาพลง scripts/out/screens/calendar/ (git-ignored)
import { mkdirSync } from 'node:fs'
const args = process.argv.slice(2)
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5199'
const OUT = 'scripts/out/screens/calendar'
mkdirSync(OUT, { recursive: true })
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome' })

const open = async (viewport, name) => {
  const ctx = await browser.newContext({ viewport, hasTouch: name !== 'mac', deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(name, 'pageerror', e.message))
  await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
  await page.goto(base + '/', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  return { page, ctx }
}
const S = (n) => `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${n}')`
const TAB_POS = { position: { x: 42, y: 14 } } // แท็บที่ปิดอยู่เลื่อนลงซ่อนหลังปก 12px: กดที่ส่วนบนที่โผล่ (กลางแท็บอยู่หลังปก)
const clip = { x: 130, y: 20, width: 1020, height: 720 } // สมุด (stage 1280×800 ที่ viewport 1280×800)

const { page } = await open({ width: 1280, height: 800 }, 'mac')
const dates = await page.evaluate(`${S('entries')}.dates`)
console.log('วันที่มีภาพ', dates.length, dates[0], '…', dates.at(-1))
await page.evaluate(`${S('app')}.go('book')`)
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/1-tabs-today.png`, clip })

// เดินถอยหลังทีละวันถึงวันเก่า (ดูหน้าต่างเลื่อน) แล้วถึงวันแรก
const turn = async (d) => { await page.evaluate((x) => window.__t(x), d); await page.waitForTimeout(1400) }
await page.evaluate(`window.__t = (d) => ${S('app')}.turnToDay(d)`)
for (let k = 1; k <= 7; k++) await turn(dates.at(-1 - k))
await page.screenshot({ path: `${OUT}/2-tabs-old-day.png`, clip })
await turn(dates[0])
await page.screenshot({ path: `${OUT}/3-tabs-first-day.png`, clip })
const tabsFirst = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="เลือกวันในสมุด"] button')].map((b) => b.textContent.trim()))
console.log('แท็บเมื่อเปิดวันแรก', tabsFirst.join(' | '))
await turn(dates.at(-1))
const tabsToday = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="เลือกวันในสมุด"] button')].map((b) => b.textContent.trim()))
console.log('แท็บเมื่อเปิดวันนี้', tabsToday.join(' | '))

// ปฏิทิน: เดือนปัจจุบัน + เดือนก่อน
await page.click('[data-cal-tab]', TAB_POS)
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/4-calendar-this-month.png`, clip })
await page.click('[aria-label="เดือนก่อนหน้า"]')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/5-calendar-prev-month.png`, clip })

// ตรวจ: ขนาดปุ่ม ≥ 44, วันว่างกดไม่ได้, วันนี้มีวง, Esc ปิด, แตะนอกกรอบปิด, โฟกัสด้วยคีย์บอร์ด
const info = await page.evaluate(() => {
  const days = [...document.querySelectorAll('.cal-day')]
  const small = [...document.querySelectorAll('[role=dialog] button')].filter((b) => { const r = b.getBoundingClientRect(); const sc = r.width / b.offsetWidth; return b.offsetWidth < 44 || b.offsetHeight < 44 })
  return { days: days.length, enabled: days.filter((d) => !d.disabled).length, disabled: days.filter((d) => d.disabled).length, smallButtons: small.length, focused: document.activeElement?.className?.slice(0, 20) }
})
console.log('ปฏิทิน', JSON.stringify(info))
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
console.log('Esc ปิด:', (await page.locator('[role=dialog]').count()) === 0)
await page.click('[data-cal-tab]', TAB_POS); await page.waitForTimeout(400)
await page.mouse.click(330, 150); await page.waitForTimeout(400)
console.log('แตะนอกกรอบปิด:', (await page.locator('[role=dialog]').count()) === 0)
await page.click('[data-cal-tab]', TAB_POS); await page.waitForTimeout(400)
await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter') // โฟกัสเริ่มที่วันที่เปิดอยู่ → Shift+Tab = วันที่มีภาพก่อนหน้า (คีย์บอร์ดเลือกวันได้)
await page.waitForTimeout(1600)
console.log('เลือกด้วยคีย์บอร์ด → เปิดวัน', await page.evaluate(`${S('app')}.openDate`), 'ปฏิทินปิด:', (await page.locator('[role=dialog]').count()) === 0)

// กระโดดข้ามหลายวันจากปฏิทิน: วันนี้ → วันเก่า ~30 วัน อัดเฟรมระหว่างพลิก (หยุดแอนิเมชัน WAAPI แล้วเลื่อนเวลา)
await turn(dates.at(-1))
const target = dates.at(-20)
await page.click('[data-cal-tab]', TAB_POS); await page.waitForTimeout(400)
let months = 0
while (!(await page.locator(`[data-date="${target}"]`).count()) && months++ < 6) { await page.click('[aria-label="เดือนก่อนหน้า"]'); await page.waitForTimeout(150) }
await page.locator(`[data-date="${target}"]`).click()
await page.waitForTimeout(250)
await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().duration >= 500).forEach((a) => a.pause()))
for (const [i, f] of [0.08, 0.3, 0.5, 0.7, 0.9, 1].entries()) {
  await page.evaluate((f) => document.getAnimations().forEach((a) => { const d = a.effect?.getTiming().duration; if (d >= 500) a.currentTime = d * Math.min(f, 0.999) }), f)
  await page.waitForTimeout(80)
  await page.screenshot({ path: `${OUT}/6-jump-${i + 1}.png`, clip })
}
await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish() } catch { /* วนไม่รู้จบ */ } }))
console.log('กระโดดไปวัน', target, '→ openDate', await page.evaluate(`${S('app')}.openDate`))
await page.context().close()

// iPad (1194×834) และ 375×812: ปฏิทินเปิดอยู่
for (const [name, vp] of [['ipad', { width: 1194, height: 834 }], ['phone375', { width: 375, height: 812 }]]) {
  const { page: p, ctx } = await open(vp, name)
  await p.evaluate(`${S('app')}.go('book')`)
  await p.waitForTimeout(2500)
  await p.evaluate(() => document.querySelector('[data-cal-tab]').click()) // บนจอเล็กเวทีย่อ ตำแหน่งกดในแท็บเล็กมาก (ข้อจำกัดของทั้งแอป) จึงสั่งคลิกตรง ๆ
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${OUT}/7-${name}-calendar.png` })
  const btn = await p.evaluate(() => { const b = document.querySelector('.cal-day:not([disabled])'); const r = b.getBoundingClientRect(); return { cssW: Math.round(r.width), cssH: Math.round(r.height), stageW: b.offsetWidth, stageH: b.offsetHeight } })
  console.log(name, '(ปุ่มวัน px จริงบนจอ / px ในเวที)', JSON.stringify(btn))
  await ctx.close()
}
await browser.close()
console.log('เสร็จ →', OUT)
