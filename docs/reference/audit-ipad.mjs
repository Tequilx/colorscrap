// สคริปต์ dev กวาดบั๊กฝั่งไอแพดแบบอัตโนมัติ (ข้อ 58): Playwright webkit + device iPad Pro 11 / iPad (gen 7) แนวตั้ง+แนวนอน, hasTouch, โหมด mock
// ไล่ flow จริงทุกหน้า เก็บภาพ + console error/warning + request 404 + ปุ่มเล็กกว่า 44×44 + ปุ่ม/ข้อความล้นจอหรือทับกัน + ข้อความถูกตัด
// แล้วทดสอบเพิ่ม: หมุนจอระหว่างระบาย, 100vh vs dvh, เสียงเริ่มหลังแตะครั้งแรก, WebGL context lost
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node scripts/audit-ipad.mjs [--url http://localhost:5199] [--only "iPad Pro 11 landscape"]
// ผล: scripts/out/screens/ipad/<device>/*.png + contact-sheet.png + result.json (git-ignored)
// ข้อจำกัดของตัวจำลอง: WebKit บน macOS ไม่ใช่ iOS Safari (ไม่มี safe-area จริง ไม่มีแถบ Safari ย่อ/ขยาย ไม่มี GPU/หน่วยความจำของ iPad)
// Playwright webkit ไม่มี touchscreen.move → การลากส่ง PointerEvent(pointerType=touch) เข้า overlay ตรง ๆ
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const only = opt('only', '')
const ROOT = join('scripts/out/screens/ipad')
mkdirSync(ROOT, { recursive: true })

const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { webkit, devices } = pw.default || pw

const DEVICES = []
for (const name of ['iPad Pro 11', 'iPad (gen 7)']) {
  DEVICES.push({ key: `${name} portrait`, desc: devices[name] }, { key: `${name} landscape`, desc: devices[name + ' landscape'] })
}
const report = {}

const slug = (s) => s.replace(/[^\w]+/g, '-').toLowerCase()

async function run({ key, desc }) {
  const OUT = join(ROOT, slug(key))
  mkdirSync(OUT, { recursive: true })
  const res = { key, viewport: desc.viewport, errors: [], warnings: [], notFound: [], steps: [], extra: {} }
  const browser = await webkit.launch()
  const ctx = await browser.newContext({ ...desc, hasTouch: true, isMobile: true })
  await ctx.addInitScript(() => { try { sessionStorage.clear() } catch {} })
  const page = await ctx.newPage()
  let stepName = 'boot'
  page.on('pageerror', (e) => res.errors.push(`[${stepName}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !/Failed to load resource/.test(t)) res.errors.push(`[${stepName}] console.error: ${t}`)
    else if (m.type() === 'warning') res.warnings.push(`[${stepName}] ${t.slice(0, 200)}`)
  })
  page.on('response', (r) => { if (r.status() >= 400) res.notFound.push(`[${stepName}] ${r.status()} ${r.url()}`) })
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) res.notFound.push(`[${stepName}] failed ${r.url()} ${r.failure()?.errorText}`) })

  const store = (name, fn, arg) => page.evaluate(({ name, fn, arg }) => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get(name)
    return new Function('s', 'arg', 'return (' + fn + ')(s, arg)')(s, arg)
  }, { name, fn: fn.toString(), arg })
  const tap = async (name, opts = {}) => {
    const loc = page.getByRole('button', { name, ...opts }).first()
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    await loc.tap({ timeout: 6000 })
  }
  // สเตจ → พิกัดหน้าจอ
  const toScreen = async (x, y) => page.evaluate(([x, y]) => {
    const r = document.querySelector('[data-stage]').getBoundingClientRect()
    const k = r.width / 1280
    return [r.left + x * k, r.top + y * k]
  }, [x, y])
  const touchDrag = async (pts) => page.evaluate((pts) => {
    const el = document.querySelector('.touch-none')
    const fire = (type, [x, y]) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }))
    fire('pointerdown', pts[0])
    return new Promise((res) => {
      let i = 1
      const tick = () => { if (i < pts.length) { fire('pointermove', pts[i++]); requestAnimationFrame(tick) } else { fire('pointerup', pts[pts.length - 1]); res() } }
      requestAnimationFrame(tick)
    })
  }, pts)

  // ตรวจหน้าปัจจุบัน
  const inspect = () => page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight
    const vis = (el) => {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      let op = 1, p = el
      while (p && p !== document.body) { const c = getComputedStyle(p); if (c.display === 'none') return false; op *= Number(c.opacity); p = p.parentElement }
      return op > 0.3 && !el.closest('[inert],[aria-hidden=true]')
    }
    const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28)
    const out = { small: [], offscreen: [], overlap: [], clipped: [], scrollbars: null }
    const btns = [...document.querySelectorAll('button, a[href], [role=button], input, textarea, select')].filter(vis).map((el) => ({ el, r: el.getBoundingClientRect() })).filter((b) => b.r.width > 0 && b.r.height > 0)
    for (const { el, r } of btns) {
      // ขนาดที่นิ้วเห็นจริง (หลังสเกลสเตจ) — ใช้ภาพรวมกรอบ ไม่ใช่ CSS ก่อน transform
      if (r.width < 44 || r.height < 44) out.small.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`)
      if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh || r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) out.offscreen.push(`${name(el)} @${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`)
    }
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (w > 6 && h > 6) {
        // ต้องเป็นองค์ประกอบบนสุดที่จุดกึ่งกลางส่วนที่ทับ จึงจะนับว่าบังกันจริง
        const cx = Math.max(a.r.left, b.r.left) + w / 2, cy = Math.max(a.r.top, b.r.top) + h / 2
        const top = document.elementFromPoint(cx, cy)
        if (top && (a.el.contains(top) || b.el.contains(top))) out.overlap.push(`${name(a.el)} ⨯ ${name(b.el)} (${Math.round(w)}×${Math.round(h)})`)
      }
    }
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      const t = n.textContent.trim()
      const el = n.parentElement
      if (!t || !el || el.closest('script,style') || !vis(el)) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      const r = rg.getBoundingClientRect()
      if (!r.width) continue
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) out.offscreen.push(`ข้อความ "${t.slice(0, 24)}"`)
      const cs = getComputedStyle(el)
      if ((cs.textOverflow === 'ellipsis' || cs.overflow !== 'visible') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && el.clientWidth > 0) out.clipped.push(`"${t.slice(0, 24)}" ${el.scrollWidth}/${el.clientWidth}×${el.scrollHeight}/${el.clientHeight}`)
      const box = el.closest('button, [role=button], label')
      if (box) { const b = box.getBoundingClientRect(); if (r.left < b.left - 1.5 || r.right > b.right + 1.5) out.clipped.push(`ล้นปุ่ม "${t.slice(0, 24)}"`) }
    }
    const de = document.documentElement
    out.scrollbars = de.scrollWidth > vw + 1 || de.scrollHeight > vh + 1 ? `${de.scrollWidth}×${de.scrollHeight} > ${vw}×${vh}` : null
    for (const k of ['small', 'offscreen', 'overlap', 'clipped']) out[k] = [...new Set(out[k])]
    return out
  })

  let n = 0
  const step = async (name, wait = 700) => {
    stepName = name
    await page.waitForTimeout(wait)
    n++
    const id = String(n).padStart(2, '0')
    await page.screenshot({ path: join(OUT, `${id}-${name}.png`) })
    const r = await inspect().catch((e) => ({ error: e.message }))
    res.steps.push({ id, name, ...r })
  }
  const safe = async (label, fn) => { try { await fn() } catch (e) { res.errors.push(`[${stepName}] flow "${label}" ล้ม: ${e.message.split('\n')[0]}`) } }

  await page.goto(`${base}/`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.fonts.ready)

  // ---- หน้าแรก → ตั้งชื่อสมุด ----
  await step('hello-ผู้ใช้ใหม่', 800)
  await safe('ตั้งชื่อ', async () => {
    await page.locator('#hello-name').tap()
    await page.fill('#hello-name', 'ฝน')
    const likes = page.locator('[aria-label="สิ่งที่ทำให้ใจฟู"] button')
    for (let i = 0; i < 3; i++) await likes.nth(i).tap()
    await step('hello-กรอกชื่อ', 300)
    await tap('เริ่มใช้สมุด')
  })
  await step('cover', 1500)

  // ---- เปิดสมุดดูก่อน (พลิกปก พลิกวัน ใบแทรก) ----
  await safe('เปิดสมุด', async () => {
    await tap('เปิดสมุด')
    await step('book-เปิดแล้ว', 2200)
    const d = await store('entries', (e) => e.dates.find((x) => e.entriesOfDay(x).length > 4))
    if (d) {
      await store('app', (a, d) => a.openDay(d), d)
      await step('book-วันที่มีใบแทรก', 1200)
      await safe('พลิกแผ่น', async () => {
        await tap('แผ่นก่อนหน้า'); await page.waitForTimeout(1200)
        await tap('แผ่นถัดไป'); await step('book-พลิกแผ่น', 1200)
      })
      await safe('พลิกวัน', async () => {
        const tabs = page.locator('nav[aria-label="เลือกวันในสมุด"] button')
        await tabs.first().tap({ position: { x: 40, y: 8 } })
        await step('book-เปลี่ยนวัน', 1400)
      })
    }
    await tap('หน้าแรก', { includeHidden: false }).catch(async () => { await page.getByRole('button', { name: 'หน้าแรก' }).last().tap() })
    await step('cover-กลับมา', 2200)
  })

  // ---- เลือกอารมณ์ (จุ่มพู่กัน) → ระบาย ----
  await safe('เลือกอารมณ์', async () => {
    await tap('เลือกความรู้สึกวันนี้')
    await step('pick', 1200)
    await tap('เศร้า')
    await step('pick-จุ่มพู่กัน', 450)
    await tap('มากเลย')
    await page.waitForTimeout(500)
    await tap('เริ่มระบาย')
  })
  await step('paint-สาดสี', 600)
  await step('paint-หลังสาดสี', 3500)
  await safe('ระบาย', async () => {
    const pts = []
    for (let i = 0; i < 40; i++) pts.push(await toScreen(300 + i * 18, 320 + Math.sin(i / 5) * 110))
    await touchDrag(pts)
    await step('paint-ปาดสีด้วยนิ้ว', 700)
    await tap('เติมหยด')
    const [x, y] = await toScreen(700, 450)
    await page.touchscreen.tap(x, y)
    await step('paint-เติมหยด', 700)
    await tap('แต้มแสง')
    const [x2, y2] = await toScreen(560, 420)
    await page.touchscreen.tap(x2, y2)
    await step('paint-แต้มแสง', 1800)
  })

  // ---- ทดสอบเพิ่ม: หมุนจอระหว่างระบาย ----
  await safe('หมุนจอ', async () => {
    const snap = () => page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400 && x.getBoundingClientRect().width > 100)
      if (!c) return null
      const r = c.getBoundingClientRect()
      return { w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) }
    })
    const cap = () => page.evaluate(async () => new Promise((resolve) => requestAnimationFrame(() => {
      const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400 && x.getBoundingClientRect().width > 100)
      const t = document.createElement('canvas'); t.width = 64; t.height = 40
      const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 40)
      const d = g.getImageData(0, 0, 64, 40).data
      let nonBg = 0; const bg = [d[0], d[1], d[2]]
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 40) nonBg++
      resolve(nonBg)
    })))
    const before = { canvas: await snap(), painted: await cap().catch(() => null), vp: page.viewportSize() }
    const vp = page.viewportSize()
    await page.setViewportSize({ width: vp.height, height: vp.width })
    await page.waitForTimeout(1200)
    await step('paint-หมุนจอ', 300)
    const after = { canvas: await snap(), painted: await cap().catch(() => null), vp: page.viewportSize() }
    const stage = await page.evaluate(() => { const r = document.querySelector('[data-stage]').getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } })
    await page.setViewportSize(vp)
    await page.waitForTimeout(1000)
    const back = { canvas: await snap(), painted: await cap().catch(() => null) }
    res.extra.rotate = { before, after, back, stageAfterRotate: stage }
  })

  // ---- ทดสอบเพิ่ม: 100vh vs dvh (จำลองแถบ Safari ย่อ/ขยายด้วยการเปลี่ยนความสูง viewport) ----
  await safe('dvh', async () => {
    const vp = page.viewportSize()
    const m = () => page.evaluate(() => {
      const r = document.querySelector('[data-stage]').getBoundingClientRect()
      const probe = (u) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;height:${u};width:1px;visibility:hidden`; document.body.appendChild(d); const h = d.getBoundingClientRect().height; d.remove(); return h }
      return { innerH: innerHeight, vh: probe('100vh'), dvh: probe('100dvh'), svh: probe('100svh'), lvh: probe('100lvh'), vvH: window.visualViewport?.height, stageTop: Math.round(r.top), stageBottom: Math.round(r.bottom), docH: document.documentElement.scrollHeight }
    })
    const full = await m()
    await page.setViewportSize({ width: vp.width, height: vp.height - 90 })
    await page.waitForTimeout(800)
    const shrunk = await m()
    await step('paint-แถบ-safari-แสดง', 300)
    await page.setViewportSize(vp)
    await page.waitForTimeout(600)
    res.extra.dvh = { full, shrunk, usesDvhInCss: null }
  })

  // ---- ทดสอบเพิ่ม: WebGL context lost ----
  await safe('contextlost', async () => {
    const countBefore = await page.evaluate(() => document.querySelectorAll('canvas').length)
    const ok = await page.evaluate(async () => {
      const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400 && x.getBoundingClientRect().width > 100)
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      const ext = gl?.getExtension('WEBGL_lose_context')
      window.__lost = []; window.__restored = []
      c.addEventListener('webglcontextlost', (e) => window.__lost.push(e.defaultPrevented))
      c.addEventListener('webglcontextrestored', () => window.__restored.push(1))
      if (!ext) return 'no-ext'
      ext.loseContext()
      return 'lost'
    })
    await page.waitForTimeout(800)
    await step('paint-context-lost', 200)
    const restored = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400); const gl = c.getContext('webgl2') || c.getContext('webgl'); return { isLost: gl?.isContextLost?.(), lostEvents: window.__lost, restoredEvents: window.__restored } })
    // พยายามกู้เองหลัง 1 วินาที เหมือนที่เบราว์เซอร์ทำเมื่อ preventDefault()
    await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400); const gl = c.getContext('webgl2') || c.getContext('webgl'); gl?.getExtension('WEBGL_lose_context')?.restoreContext() })
    await page.waitForTimeout(1500)
    await page.touchscreen.tap(...(await toScreen(500, 400)))
    await step('paint-หลังกู้-context', 800)
    const after = await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find((x) => x.width >= 400); const gl = c.getContext('webgl2') || c.getContext('webgl'); return { isLost: gl?.isContextLost?.(), restoredEvents: window.__restored } })
    res.extra.contextLost = { trigger: ok, canvases: countBefore, right_after: restored, after_restore: after }
  })

  // ---- บันทึก → การ์ด → สมุด → ภาพเดี่ยว → จานสี → ปรับแต่ง → เสียง ----
  await safe('บันทึก', async () => {
    // ปาดใหม่เผื่อ context lost ทำให้ผ้าใบว่าง
    await store('app', (a) => { a.canvasDirty = true })
    await tap('บันทึกลงสมุด')
    await step('save-ระหว่างบันทึก', 700)
    await step('saved-การ์ดหลังบันทึก', 4200)
    await tap('ดูสมุดทั้งเล่ม')
    await step('book-หลังบันทึก', 2000)
  })
  await safe('ภาพเดี่ยว', async () => {
    await page.locator('[data-entry-id] button').last().tap()
    await step('photo', 1800)
    await tap('กลับ').catch(() => store('app', (a) => a.go('book')))
    await page.waitForTimeout(1200)
  })
  await safe('จานสี', async () => {
    await store('app', (a) => { if (a.view !== 'book') a.go('book') })
    await page.waitForTimeout(800)
    await step('book-จานสีของวัน', 800)
  })
  await safe('ปรับแต่ง', async () => {
    await store('app', (a) => a.go('cover')); await page.waitForTimeout(1800)
    await store('app', (a) => a.openSettings()); await step('ปรับแต่ง', 1400)
    await store('app', (a) => a.go('cover')); await page.waitForTimeout(1200)
  })
  await safe('ตั้งค่าเสียง', async () => {
    await step('cover-ปุ่มเสียง', 400)
    await page.getByRole('button', { name: 'เพลง' }).first().tap()
    await page.getByRole('button', { name: 'เสียงเอฟเฟกต์' }).first().tap()
    await step('cover-สลับเสียงแล้ว', 400)
    await page.getByRole('button', { name: 'เพลง' }).first().tap()
    await page.getByRole('button', { name: 'เสียงเอฟเฟกต์' }).first().tap()
  })

  // ---- เสียงต้องเริ่มได้หลังแตะครั้งแรก (หน้าใหม่ + ห่อ AudioContext ดูจำนวน instance/สถานะ ก่อน-หลังแตะ) ----
  await safe('audio', async () => {
    const p2 = await ctx.newPage()
    await p2.addInitScript(() => {
      const Orig = window.AudioContext || window.webkitAudioContext
      window.__acs = []
      const Wrapped = function (...a) { const c = new Orig(...a); window.__acs.push(c); return c }
      Wrapped.prototype = Orig.prototype
      window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped
    })
    await p2.goto(`${base}/?debug`, { waitUntil: 'load' })
    await p2.waitForTimeout(1500)
    const st = () => p2.evaluate(() => ({ contexts: window.__acs.length, states: window.__acs.map((c) => c.state), music: window.__music?.() ?? null }))
    const beforeTap = await st()
    await p2.touchscreen.tap(200, 200)
    await p2.waitForTimeout(1500)
    const afterTap = await st()
    // จำลองสลับแอป: ซ่อน→แสดง แล้วดูว่า context ถูก suspend/resume ไหม (ไม่ได้จำลอง state 'interrupted' ของ iOS)
    await p2.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
    await p2.waitForTimeout(500)
    const hidden = await st()
    await p2.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
    await p2.waitForTimeout(800)
    const visibleNoGesture = await st()
    await p2.touchscreen.tap(220, 220)
    await p2.waitForTimeout(800)
    const visibleAfterTap = await st()
    res.extra.audio = { beforeTap, afterTap, hidden, visibleNoGesture, visibleAfterTap }
    await p2.close()
  })

  await browser.close()
  report[key] = res
  writeFileSync(join(OUT, 'result.json'), JSON.stringify(res, null, 2))
  console.log(`${key}: ${res.steps.length} steps, ${res.errors.length} errors, ${res.notFound.length} 404`)
}

for (const d of DEVICES) {
  if (only && d.key !== only) continue
  await run(d)
}
writeFileSync(join(ROOT, 'result-all.json'), JSON.stringify(report, null, 2))

// contact sheet ต่อ device
const b = await webkit.launch()
const pg = await b.newPage()
for (const d of DEVICES) {
  if (only && d.key !== only) continue
  const dir = join(ROOT, slug(d.key))
  const files = readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f)).sort()
  const imgs = files.map((f) => ({ name: f.replace('.png', ''), src: 'data:image/png;base64,' + readFileSync(join(dir, f)).toString('base64') }))
  const sheet = await pg.evaluate(async (imgs) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
    const L = await Promise.all(imgs.map((m) => load(m.src)))
    const cols = 6, cw = 300, pad = 10, lab = 22
    const ch = Math.round(cw * (L[0].height / L[0].width))
    const rows = Math.ceil(L.length / cols)
    const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
    L.forEach((img, k) => { const cx = pad + (k % cols) * (cw + pad), cy = pad + Math.floor(k / cols) * (ch + lab + pad); x.fillStyle = '#000'; x.font = '13px sans-serif'; x.fillText(imgs[k].name, cx, cy + 14); x.drawImage(img, cx, cy + lab, cw, ch); x.strokeStyle = '#bbb'; x.strokeRect(cx, cy + lab, cw, ch) })
    return c.toDataURL('image/png')
  }, imgs)
  writeFileSync(join(dir, 'contact-sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'))
}
await b.close()
console.log('เสร็จ →', ROOT)
