// ตรวจระยะบรรทัดไทย: วิ่งทุกหน้า (โหมด mock) แล้วหา "บรรทัดข้อความ" (Range.getClientRects ต่อบรรทัด = กรอบเนื้ออักษรรวมสระบน/ล่าง)
// ที่ซ้อนทับกับบรรทัดของ element อื่นในแนวตั้งเกิน 1.5px ทั้งที่ทับกันในแนวนอนด้วย (บรรทัดของ element เดียวกันที่ต่อกันไม่นับ ยกเว้นทับเกิน 3px)
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/check-leading.mjs [--url http://localhost:5199] [--out scripts/out/leading/<ชื่อ>] [--viewport 1280x800]
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const OUT = opt('out', 'scripts/out/leading/run')
const [VW, VH] = opt('viewport', '1280x800').split('x').map(Number)
mkdirSync(OUT, { recursive: true })
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, reducedMotion: 'reduce' })
await ctx.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล', 'แมว'] })))
const page = await ctx.newPage()
await page.goto(base + '/?time=day', { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.evaluate(() => document.fonts.ready)
const st = (name, fn, arg) => page.evaluate(({ name, fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get(name); return new Function('s', 'arg', 'return (' + fn + ')(s, arg)')(s, arg) }, { name, fn: fn.toString(), arg })

const scan = async (view) => {
  const found = await page.evaluate(() => {
    const lines = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const t = node.textContent.trim()
      if (!t) continue
      const el = node.parentElement
      if (!el || el.closest('script,style,[aria-hidden=true],[inert],svg') || getComputedStyle(el).visibility === 'hidden') continue
      let op = 1, p = el
      while (p && p !== document.body) { const cs = getComputedStyle(p); op *= Number(cs.opacity); if (cs.display === 'none') op = 0; p = p.parentElement }
      if (op < 0.3) continue
      const range = document.createRange(); range.selectNodeContents(node)
      // รวมสี่เหลี่ยมที่อยู่บรรทัดเดียวกัน (rect ย่อยของข้อความเดียวกัน)
      const byTop = new Map()
      for (const r of range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue
        const k = Math.round(r.top / 3)
        const cur = byTop.get(k)
        if (!cur) byTop.set(k, { l: r.left, r: r.right, t: r.top, b: r.bottom })
        else { cur.l = Math.min(cur.l, r.left); cur.r = Math.max(cur.r, r.right); cur.t = Math.min(cur.t, r.top); cur.b = Math.max(cur.b, r.bottom) }
      }
      // สระบน/วรรณยุกต์ของไทยสูงเกินกรอบเนื้ออักษร (~0.22em) สระล่างต่ำเกิน (~0.16em) เผื่อให้ตรงกับที่ตาเห็น
      const mali = /Mali/.test(getComputedStyle(el).fontFamily) // กรอบเนื้ออักษรของ IBM Plex สูง 1.65em เผื่อไว้แล้ว มีเฉพาะ Mali (1.3em) ที่สระ/วรรณยุกต์ล้น
      const fs = parseFloat(getComputedStyle(el).fontSize)
      const up = !mali ? 0 : /[\u0E31\u0E34-\u0E37\u0E47-\u0E4E]/.test(t) ? 0.22 * fs : 0
      const down = !mali ? 0 : /[\u0E38-\u0E3A]/.test(t) ? 0.16 * fs : 0
      for (const v of byTop.values()) lines.push({ ...v, t: v.t - up, b: v.b + down, text: t.slice(0, 26), el })
    }
    const out = []
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], b = lines[j]
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l)
      const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t)
      if (ox <= 2 || oy <= 0) continue
      // ซ้อนกันเกือบทั้งกรอบ = ข้อความเลเยอร์ซ้อน (เช่น cross-fade) ไม่ใช่บรรทัดชน
      const hMin = Math.min(a.b - a.t, b.b - b.t)
      if (oy > hMin * 0.85) continue
      const same = a.el === b.el
      if (oy > (same ? 3 : 1.5)) out.push(`"${a.text}" × "${b.text}" ทับ ${oy.toFixed(1)}px`)
    }
    return out
  })
  console.log(view, found.length ? '\n  ' + found.join('\n  ') : 'ok')
  return found.length
}
let bad = 0
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
await st('app', (a) => a.openSettings()); await page.waitForTimeout(900); await shot('hello'); bad += await scan('hello')
await st('app', (a) => a.go('cover')); await page.waitForTimeout(900); await shot('cover'); bad += await scan('cover')
await st('app', (a) => a.go('pick')); await page.waitForTimeout(900); await shot('pick'); bad += await scan('pick')
await st('app', (a) => { a.selection = { emotion: 'sad', intensity: 1 }; a.newSheet(); a.go('paint') }); await page.waitForTimeout(2500); await st('app', (a) => { a.warmNote = 'open' }); await page.waitForTimeout(800); await shot('paint'); bad += await scan('paint')
await st('app', (a) => a.go('book')); await page.waitForTimeout(1500); await shot('book'); bad += await scan('book')
const d = await page.evaluate(() => { const e = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('entries'); return e.dates.find((x) => e.entriesOfDay(x).length > 4) })
await st('app', (a, d) => a.openDay(d), d); await page.waitForTimeout(900); await shot('book-leaf'); bad += await scan('book-leaves')
await st('app', (a) => a.setLeaf(0)); await page.waitForTimeout(900); await shot('book-leaf0'); bad += await scan('book-leaf0')
await st('app', (a) => a.openPhoto('mock-4')); await page.waitForTimeout(1500); await shot('photo'); bad += await scan('photo')
await st('app', (a) => a.go('book')); await page.waitForTimeout(1200)
await st('app', (a) => { a.selection = { emotion: 'calm', intensity: 1 }; a.newSheet(); a.go('paint') }); await page.waitForTimeout(3000)
await st('app', (a) => { a.saveToBook() }); await page.waitForTimeout(3500); await shot('saved'); bad += await scan('saved')
console.log('รวมบรรทัดที่ชน:', bad)
await browser.close()
