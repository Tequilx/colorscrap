// QA เดินทั้ง flow ผ่าน UI จริง (โหมด mock) แล้วรายงาน: console error, FPS ต่อช่วง, ปุ่มที่ไม่มี focus ring, ข้อความล้นเวที, ภาพแต่ละขั้น
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/qa-flow.mjs [--url http://localhost:5199] [--viewport 1280x800] [--reduced] [--time day|dusk|night] [--out scripts/out/qa] [--label ชื่อ]
// ผล: <out>/<label>/*.png และ <out>/<label>/result.json (ไม่ commit)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const [VW, VH] = opt('viewport', '1280x800').split('x').map(Number)
const reduced = args.includes('--reduced')
const time = opt('time', '')
const label = opt('label', `${VW}x${VH}${reduced ? '-reduced' : ''}${time ? '-' + time : ''}`)
const OUT = join(opt('out', 'scripts/out/qa'), label)
mkdirSync(OUT, { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true })
const page = await ctx.newPage()
const result = { label, errors: [], fps: {}, focus: [], overflow: [], steps: [], downloads: [], checks: {} }
page.on('pageerror', (e) => result.errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && result.errors.push('console: ' + m.text()))
await page.addInitScript(() => {
  window.__frames = []
  let last = performance.now()
  const f = (n) => { window.__frames.push([n, n - last]); last = n; requestAnimationFrame(f) }
  requestAnimationFrame(f)
})
const q = new URLSearchParams()
if (time) q.set('time', time)
const URL = `${base}/${q.toString() ? '?' + q : ''}`
await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.evaluate(() => document.fonts.ready)

const store = (name, fn, arg) => page.evaluate(({ name, fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get(name); return new Function('s', 'arg', 'return (' + fn + ')(s, arg)')(s, arg) }, { name, fn: fn.toString(), arg })
let n = 0
const step = async (name, wait = 700) => { await page.waitForTimeout(wait); n++; result.steps.push(name); await page.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png` }) }
// FPS ของช่วงหนึ่ง: mark → ทำอะไรสักอย่าง → measure
const mark = () => page.evaluate(() => performance.now())
const measure = async (name, t0) => {
  const r = await page.evaluate((t0) => {
    const d = window.__frames.filter(([t]) => t >= t0).map(([, dt]) => dt)
    if (!d.length) return null
    const sorted = [...d].sort((a, b) => b - a)
    const worst1 = sorted.slice(0, Math.max(1, Math.ceil(d.length * 0.01)))
    const mean = d.reduce((a, b) => a + b, 0) / d.length
    return { frames: d.length, fps: Math.round(1000 / mean), low1pctFps: Math.round(1000 / (worst1.reduce((a, b) => a + b, 0) / worst1.length)), maxMs: Math.round(sorted[0]), over50: d.filter((x) => x > 50).length }
  }, t0)
  result.fps[name] = r
}
const click = (text, opts = {}) => page.getByRole('button', { name: text, ...opts }).first().click()

// ตรวจ focus ring ด้วยคีย์บอร์ด + ข้อความล้นเวที ของหน้าปัจจุบัน
const a11y = async (view) => {
  await page.evaluate(() => document.activeElement?.blur())
  const seen = new Set()
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 28)
      return { key: `${el.tagName}|${label}|${Math.round(r.x)},${Math.round(r.y)}`, label, ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 }
    })
    if (!info) continue
    if (seen.has(info.key)) break
    seen.add(info.key)
    if (!info.ring) result.focus.push(`${view}: ไม่มี focus ring · ${info.label}`)
  }
  const over = await page.evaluate(() => {
    const stage = document.querySelector('[data-stage]')?.getBoundingClientRect()
    const out = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim()
      if (!t) continue
      const el = node.parentElement
      if (!el || el.closest('script,style,[aria-hidden=true],[inert]') || getComputedStyle(el).visibility === 'hidden') continue
      let op = 1, p = el
      while (p && p !== document.body) { op *= Number(getComputedStyle(p).opacity); p = p.parentElement }
      if (op < 0.2) continue
      const range = document.createRange(); range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      if (!r.width) continue
      if (stage && (r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1 || r.bottom > stage.bottom + 1)) out.push(`นอกเวที: "${t.slice(0, 30)}"`)
      // กล่องที่มีขอบ/พื้น (ปุ่ม ชิป การ์ด) แล้วข้อความกว้างกว่ากล่อง
      const box = el.closest('button, a, [role=button], label')
      if (box) { const b = box.getBoundingClientRect(); if (r.width > 0 && (r.left < b.left - 1 || r.right > b.right + 1)) out.push(`ล้นปุ่ม: "${t.slice(0, 30)}"`) }
    }
    return [...new Set(out)]
  })
  over.forEach((o) => result.overflow.push(`${view}: ${o}`))
}

// ---- A. เข้าครั้งแรก ----
await step('hello-ผู้ใช้ใหม่', 800)
await page.fill('#hello-name', 'ฝน')
const likes = page.locator('[aria-label="สิ่งที่ทำให้ใจฟู"] button')
for (let i = 0; i < 6; i++) await likes.nth(i).click({ force: true })
result.checks.likesPressed = await likes.evaluateAll((els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').length)
await step('hello-ใจฟู', 300)
await a11y('hello')
await click('เริ่มใช้สมุด')
await step('cover', 1500)
await a11y('cover')

// ---- B. เปิดสมุด (พลิกปก) → พลิกวัน/แผ่น → ปิด ----
let t0 = await mark()
await click('เปิดสมุด')
await page.waitForTimeout(2200)
await measure('flip-open (หน้าแรก→สมุด)', t0)
await step('book-เปิดแล้ว', 500)
await a11y('book')
const dayWithLeaves = await page.evaluate(() => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); return e.dates.find((x) => e.entriesOfDay(x).length > 4) })
if (dayWithLeaves) {
  await store('app', (a, d) => a.openDay(d), dayWithLeaves)
  await page.waitForTimeout(700)
  t0 = await mark()
  await click('แผ่นก่อนหน้า').catch(() => {})
  await page.waitForTimeout(1200)
  await click('แผ่นถัดไป').catch(() => {})
  await page.waitForTimeout(1200)
  await measure('page-turn (พลิกแผ่น)', t0)
  t0 = await mark()
  const tabs = page.locator('nav[aria-label="เลือกวันในสมุด"] button')
  await tabs.first().click({ position: { x: 40, y: 8 } }) // ส่วนที่โผล่พ้นปกอยู่ด้านบนของแท็บ
  await page.waitForTimeout(1300)
  await measure('day-turn (เปลี่ยนวัน)', t0)
  await step('book-เปลี่ยนวัน', 300)
}
t0 = await mark()
await page.getByRole('button', { name: 'หน้าแรก' }).last().click() // ปุ่มของ DrawingBoard ซ่อนอยู่ก่อนในลำดับ DOM
await page.waitForTimeout(2200)
await measure('flip-close (สมุด→หน้าแรก)', t0)
await step('cover-กลับมา', 400)

// ---- C. เลือกความรู้สึก → ระบาย ----
await click('เลือกความรู้สึกวันนี้')
await step('pick', 1200)
await a11y('pick')
await click('เศร้า')
await click('มากเลย')
await page.waitForTimeout(500)
await click('เริ่มระบาย')
t0 = await mark()
await page.waitForTimeout(3800)
await measure('paint-splash (สาดสี)', t0)
await step('paint-หลังสาดสี', 300)
await a11y('paint')
// ปาดสีลากต่อเนื่อง
const box = { x: Math.round(VW / 2 - 1280 / 2) , y: 0 }
const sx = (x) => (VW - 1280 * Math.min(VW / 1280, VH / 800)) / 2 + x * Math.min(VW / 1280, VH / 800)
const sy = (y) => (VH - 800 * Math.min(VW / 1280, VH / 800)) / 2 + y * Math.min(VW / 1280, VH / 800)
t0 = await mark()
await page.mouse.move(sx(300), sy(300)); await page.mouse.down()
for (let i = 0; i < 90; i++) await page.mouse.move(sx(300 + i * 8), sy(300 + Math.sin(i / 6) * 120), { steps: 2 })
await page.mouse.up()
await measure('paint-drag (ปาดสี)', t0)
result.checks.moodFoldedAfterFirstTouch = await store('app', (a) => a.moodFolded)
await step('paint-ปาดแล้ว-โน้ตพับ', 600)
await page.getByRole('button', { name: /เปิดโน้ตอารมณ์/ }).click(); await page.waitForTimeout(700)
await step('paint-โน้ตกางกลับ', 200)
await page.getByRole('button', { name: 'เก็บโน้ตอารมณ์' }).click(); await page.waitForTimeout(700)
await click('เติมหยด')
await page.mouse.click(sx(700), sy(450)); await page.waitForTimeout(300)
await page.mouse.move(sx(500), sy(500)); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up()
await step('paint-เติมหยด', 400)
await click('แต้มแสง')
await page.mouse.click(sx(600), sy(400)); await page.waitForTimeout(1500)
await page.mouse.move(sx(800), sy(450)); await page.mouse.down(); await page.waitForTimeout(1000); await page.mouse.up()
await step('paint-แต้มแสง', 800)
await store('app', (a) => { a.warmNote = 'open' }); await page.waitForTimeout(700)
await click('ลองดู'); await page.waitForTimeout(2800)
await step('paint-ลองดู', 300)
await page.getByRole('button', { name: /เปิดโน้ตอารมณ์/ }).click({ trial: true }).catch(() => {})
// ---- D. บันทึก ----
const todayBefore = await store('entries', (e) => e.entriesOfDay(new Date().toISOString().slice(0, 10)).length).catch(() => null)
t0 = await mark()
await click('บันทึกลงสมุด')
await page.waitForTimeout(4200)
await measure('save-sequence (ลำดับบันทึก)', t0)
await step('saved-การ์ด', 300)
await a11y('saved')
await click('ดูสมุดทั้งเล่ม')
await step('book-หลังบันทึก', 1800)
// ---- E. ภาพเดี่ยว + เก็บรูป ----
await page.locator('[data-entry-id] button').last().click()
await step('photo', 1800)
await a11y('photo')
const dl = async (name) => {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), click(name)])
  result.downloads.push(`${name}: ${d ? d.suggestedFilename() : 'ไม่มีไฟล์'}`)
  await page.waitForTimeout(800)
}
await dl('การ์ดพร้อมชาร์ตสี')
await dl('เฉพาะภาพ')
await page.keyboard.press('Escape')
await step('book-กลับจาก-photo', 1500)
await dl('เก็บจานสีวันนี้เป็นรูป')
// ---- F. รีเฟรชแล้วข้อมูลยังอยู่ ----
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(1800)
result.checks.viewAfterReload = await store('app', (a) => a.view)
if (result.checks.viewAfterReload === 'cover') await click('เปิดสมุด')
await page.waitForTimeout(2300)
const photos = await page.locator('[data-entry-id]').count()
result.checks.photosOnBookAfterReload = photos
await step('หลังรีเฟรช-สมุดยังอยู่', 400)

result.verdict = { errors: result.errors.length, focusMissing: result.focus.length, overflow: result.overflow.length }
writeFileSync(`${OUT}/result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
await browser.close()
