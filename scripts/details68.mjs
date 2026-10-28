// สคริปต์ dev: หน้าตั้งชื่อ/ปรับแต่งสมุด (โหมดแก้ไข) คอลัมน์ขวา: ตัวอย่างปก → ปุ่มบันทึก → กลุ่มบัญชี ที่ Mac 1280×800 / iPad 1180×820 และ 820×1180 / 375×667 + วัดระยะ
// AccountActions แสดงเฉพาะโหมดจริง จึง mount ซ้อนเองในหน้า mock (auth.user ปลอม) โดย mount ลงช่อง [data-account-slot] ของ CoverPreview (ตำแหน่งเดียวกับที่ใช้จริง)
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=… node scripts/details68.mjs <before|after>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const tag = process.argv[2] || 'after'
const url = 'http://localhost:5199'
const OUT = join('scripts/out/screens/details68')
mkdirSync(OUT, { recursive: true })
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const shots = []
for (const [name, viewport, safe] of [['mac', { width: 1280, height: 800 }, 0], ['ipad-land', { width: 1180, height: 820 }, 20], ['ipad-port', { width: 820, height: 1180 }, 20], ['phone375', { width: 375, height: 667 }, 0]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  await context.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#2F6B4F', likes: ['ทะเล'] })))
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  // จำลอง safe-area ด้านล่าง (ไอแพดมีแถบ home): ตั้ง CSS var ผ่าน env ไม่ได้ จึงเติม padding ให้ root ผ่าน style ของ html? — ใช้ตัวแปรที่คอมโพเนนต์อ่านจาก env(): override ด้วย CSS ไม่ได้ ข้ามการจำลอง แล้ววัดระยะขั้นต่ำ 24 + safe ตามสูตร
  await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia._s.get('app').openSettings()
    await new Promise((r) => setTimeout(r, 1500))
    pinia._s.get('auth').user = { email: 'mali.kanyaphat.longname@example.com' }
    // ให้ App.vue แสดง AccountActions จริง: มันเช็ค !USE_MOCK จึงไม่ขึ้นเอง mount ซ้อน
    const { createApp } = await import('/node_modules/.vite/deps/vue.js')
    const C = (await import('/src/components/hello/AccountActions.vue')).default
    const slot = document.querySelector('[data-account-slot]')
    const host = document.createElement('div')
    ;(slot ?? document.querySelector('[data-stage]')).appendChild(host)
    const a = createApp(C)
    a.use(pinia)
    a.mount(host)
  })
  await page.waitForTimeout(800)
  const file = join(OUT, `${tag}-${name}.png`)
  await page.screenshot({ path: file })
  shots.push({ name: `${tag} ${name}`, src: 'data:image/png;base64,' + readFileSync(file).toString('base64') })
  const m = await page.evaluate((safe) => {
    const stage = document.querySelector('[data-stage]').getBoundingClientRect()
    const sc = stage.height / 800
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const slot = document.querySelector('[data-account-slot]')
    const col = slot ? slot.parentElement : document.querySelector('[data-stage]') // ก่อนแก้ไม่มี slot: ใช้ทั้งเวที (กรองด้วยตำแหน่งซ้าย ≥ 790)
    const btns = [...col.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().left >= stage.left + 780 * sc)
    const save = btns.find((b) => /^บันทึก/.test(b.textContent.trim()))
    const out = btns.find((b) => /ออกจากระบบ/.test(b.textContent))
    const del = btns.find((b) => /ลบข้อมูล/.test(b.textContent))
    const email = [...col.querySelectorAll('span')].find((s) => s.children.length === 0 && /@example\.com/.test(s.textContent))
    const u = (px) => Math.round(px / sc)
    const rs = { save: r(save), email: r(email), out: r(out), del: r(del) }
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    const names = Object.keys(rs)
    const overlaps = names.flatMap((a, i) => names.slice(i + 1).filter((b) => hit(rs[a], rs[b])).map((b) => `${a}×${b}`))
    const btnT = Math.min(rs.out.top, rs.del.top), btnB = Math.max(rs.out.bottom, rs.del.bottom)
    const sheet = document.querySelector('.-rotate-\\[0\\.6deg\\]')
    return { scale: +sc.toFixed(3), 'บันทึก→อีเมล': u(rs.email.top - rs.save.bottom), 'อีเมล→ปุ่มบัญชี': u(btnT - rs.email.bottom), 'ปุ่มบัญชี→ขอบล่างเวที': u(stage.bottom - btnB), 'ปุ่มบัญชีสูง': u(btnB - btnT), 'ซ้อนกัน': overlaps.length ? overlaps.join(',') : 'ไม่มี', 'ล้นคอลัมน์': slot ? Math.round(col.scrollHeight - col.clientHeight) : 'n/a' }
  }, safe)
  console.log(name, JSON.stringify(m))
  await context.close()
}
await browser.close()
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const data = await p.evaluate(async (items) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(items.map((m) => load(m.src)))
  const H = 420, lab = 18, pad = 4
  const ws = L.map((im) => Math.round(im.width * (H / im.height)))
  const c = document.createElement('canvas'); c.width = ws.reduce((a, b) => a + b + pad, pad); c.height = H + lab + 2 * pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '13px sans-serif'; x.fillStyle = '#222'
  let cx = pad
  L.forEach((im, i) => { x.fillText(items[i].name, cx, pad + 13); x.drawImage(im, cx, pad + lab, ws[i], H); cx += ws[i] + pad })
  return c.toDataURL('image/png').split(',')[1]
}, shots)
writeFileSync(join(OUT, `${tag}-sheet.png`), Buffer.from(data, 'base64'))
await b.close()
