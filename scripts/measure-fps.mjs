// สคริปต์ dev วัด FPS ของผ้าใบ (เฉลี่ยและ 1% low) ใน 3 กรณี: idle (ปล่อยนิ่ง) / tap (แตะรัวทุก 150ms) / drag (ลากต่อเนื่อง) นานกรณีละ 5 วินาที
//   PLAYWRIGHT=/path/to/playwright/index.mjs node scripts/measure-fps.mjs --emotion calm --intensity 1 --label base
// ตัวเลือก: --url (ค่าเริ่มต้น http://localhost:5199) --dpr 1|2 --debug (เปิด ?debug) --cases idle,tap,drag,splash --seconds 5
//   --replace "ข้อความเดิม=>ข้อความใหม่" และ --module ไฟล์ (ส่วนของ path เช่น FluidCanvas.vue; ไม่ใส่ = emotions.js) ใช้ทดลองค่าโดยไม่แก้ไฟล์จริง
//   --tool drop|smear|warm  (บังคับเครื่องมือของทุก case)
//   --idle-wait ms  (รอก่อนวัด idle ค่าเริ่มต้น 6500; 15000 = วัดหลังน้ำนิ่งและการจำลองพักแล้ว)
//   --json-out ไฟล์.json
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf('--' + n)
  return i >= 0 ? args[i + 1] : d
}
const url = opt('url', 'http://localhost:5199')
const emotion = opt('emotion', 'calm')
const intensity = Number(opt('intensity', '1'))
const dpr = Number(opt('dpr', '1'))
const cases = opt('cases', 'idle,tap,drag').split(',')
const seconds = Number(opt('seconds', '5'))
const dragMs = Number(opt('drag-ms', '16')) // ช่วงเวลาระหว่าง pointermove ตอนลาก (16 ≈ 60Hz, 8 ≈ 120Hz, 4 ≈ 240Hz เมาส์/แทร็กแพดเร็ว)
const label = opt('label', '')
const tool = opt('tool', '') // ใช้เครื่องมือนี้แทนค่าเริ่มต้นของแต่ละ case (drop|smear|warm) เช่น วัดแตะรัวสีอุ่นเทียบแตะรัวสีปกติ
const idleWait = Number(opt('idle-wait', '6500')) // ms ที่รอก่อนวัดกรณี idle (ตั้ง 15000 เพื่อวัดตอนน้ำนิ่งและการจำลองพักแล้ว)
const debug = args.includes('--debug')
const reps = []
for (let i = 0; i < args.length; i++) if (args[i] === '--replace') reps.push({ module: args[i + 1 - 2] === '--module' ? args[i - 1] : 'emotions.js', pair: args[i + 1].split('=>') })
const modules = new Map()
for (let i = 0; i < args.length; i++) if (args[i] === '--replace') {
  // --module ต้องอยู่หน้า --replace ที่ตามมา
  let mod = 'emotions.js'
  for (let j = i - 1; j >= 0 && args[j] !== '--replace'; j--) if (args[j] === '--module') mod = args[j + 1]
  const pair = args[i + 1].split('=>')
  if (!modules.has(mod)) modules.set(mod, [])
  modules.get(mod).push(pair)
}

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
// ปลดเพดาน 60/30 Hz ของ rAF: ตัวเลขจึงสะท้อนงานจริงของ GPU/CPU (ถ้าไม่ปลด ได้ค่าติดเพดานของจอ ไม่เห็นความต่าง)
const vsync = args.includes('--vsync') // ใช้การตั้งค่าปกติ (rAF ผูกกับการแสดงผลจริง วัดเฟรมที่ไปถึงจอ) ไม่ปลดเพดาน
const browser = await chromium.launch({ channel: 'chrome', args: vsync ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit'] })
const results = []

for (const kase of cases) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr })
  await context.addInitScript(() => {
    let a = 7
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    // นับจำนวนคำสั่งวาด (draw call) ของ WebGL ต่อวินาที: ใช้เทียบภาระ GPU ก่อน/หลัง โดยไม่ต้องแก้โค้ดแอป
    window.__draws = 0
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      const orig = C.prototype.drawArrays
      C.prototype.drawArrays = function (...a) {
        window.__draws++
        return orig.apply(this, a)
      }
      const origE = C.prototype.drawElements
      C.prototype.drawElements = function (...a) {
        window.__draws++
        return origE.apply(this, a)
      }
    }
    localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'วัด', avatar: 'cat', coverColor: '#9E2F2A', likes: [] }))
  })
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()) // ฟอนต์ภายนอกบล็อกการโหลดหน้าเมื่อออฟไลน์ ไม่เกี่ยวกับผ้าใบ
  const page = await context.newPage()
  for (const [mod, pairs] of modules) {
    await page.route(`**/${mod}*`, async (route) => {
      const response = await route.fetch()
      let body = await response.text()
      for (const [from, to] of pairs) {
        if (!body.includes(from)) console.error(`!! ไม่พบข้อความที่จะแทนที่ใน ${mod}: ${from}`)
        body = body.replace(from, to)
      }
      await route.fulfill({ response, body })
    })
  }
  await page.goto(`${url}/${debug ? '?debug' : ''}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  await page.evaluate(({ emotion, intensity, kase, tool }) => {
    const app = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
    app.selection = { emotion, intensity }
    app.tool = tool || (kase === 'drag' ? 'smear' : 'drop')
    if (kase !== 'idle' && kase !== 'splash') app.canvasDirty = true // tap/drag เริ่มจากผ้าใบว่าง ไม่มีหยดเริ่มต้น (splash = วัดช่วงสาดตอนเข้า paint)
    window.__t = []
    location.hash = 'paint'
  }, { emotion, intensity, kase, tool })
  // idle: รอให้หยดเริ่มต้นและการซึมจบก่อน (≈ 6 วิ) แล้วค่อยวัดตอนนิ่ง
  await page.waitForTimeout(kase === 'idle' ? idleWait : kase === 'splash' ? 0 : 2000)

  const stats = await page.evaluate(
    ({ kase, seconds, dragMs, vsyncMode }) =>
      new Promise((resolve) => {
        const el = document.elementFromPoint(640, 398)
        const fire = (type, x, y, buttons = 1) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', buttons, bubbles: true }))
        const stamps = []
        const loaf = [] // Long Animation Frames: เฟรมที่ main thread ใช้เกิน 50ms พร้อมสัดส่วนสคริปต์/สไตล์+เลย์เอาต์
        try {
          new PerformanceObserver((list) => list.getEntries().forEach((e) => loaf.push({ d: Math.round(e.duration), script: Math.round(e.scripts.reduce((s, x) => s + x.duration, 0)), render: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0) }))).observe({ type: 'long-animation-frame', buffered: false })
        } catch {}
        let running = true
        // อ่าน 1 พิกเซลทุกเฟรม (เฉพาะในสคริปต์วัด ไม่ใช่โค้ดแอป) บังคับให้รอ GPU ทำเฟรมนี้เสร็จจริง
        // ไม่งั้น rAF วัดแค่เวลาที่ CPU ส่งคำสั่ง ไม่เห็นภาระของ GPU
        const gl = document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl')
        const px = new Uint8Array(4)
        const loop = () => {
          if (!running) return
          if (!vsyncMode) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
          stamps.push(performance.now())
          requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
        const start = performance.now()
        const draws0 = window.__draws
        let timer
        if (kase === 'tap') {
          let n = 0
          timer = setInterval(() => {
            const x = 200 + ((n * 137) % 880)
            const y = 160 + ((n * 91) % 480)
            n++
            fire('pointerdown', x, y)
            fire('pointerup', x, y, 0)
          }, 150)
        } else if (kase === 'drag') {
          fire('pointerdown', 300, 400)
          let a = 0
          timer = setInterval(() => {
            a += 0.18
            fire('pointermove', 640 + Math.cos(a) * 300, 400 + Math.sin(a * 1.3) * 180)
          }, dragMs)
        }
        setTimeout(() => {
          running = false
          clearInterval(timer)
          if (kase === 'drag') fire('pointerup', 640, 400, 0)
          const dts = []
          for (let i = 1; i < stamps.length; i++) dts.push(stamps[i] - stamps[i - 1])
          resolve({ dts, wall: performance.now() - start, loaf, draws: window.__draws - draws0 })
        }, seconds * 1000)
      }),
    { kase, seconds, dragMs, vsyncMode: vsync },
  )
  const dts = stats.dts.slice().sort((a, b) => a - b)
  const avgFps = (stats.dts.length / (stats.dts.reduce((s, v) => s + v, 0) / 1000)) || 0
  const p99 = dts[Math.min(dts.length - 1, Math.floor(dts.length * 0.99))] || 0
  results.push({ label, dragMs, kase, emotion, intensity, dpr, debug, frames: stats.dts.length, avgFps: +avgFps.toFixed(1), low1: +(1000 / p99).toFixed(1), worstMs: +dts[dts.length - 1]?.toFixed(0), drawsPerSec: Math.round(stats.draws / (stats.wall / 1000)), longFrames: stats.loaf.length, longWorst: stats.loaf.reduce((m, x) => Math.max(m, x.d), 0) })
  await context.close()
}
await browser.close()
for (const r of results) console.log(`${(label || '').padEnd(14)} ${r.kase.padEnd(5)}${r.kase === 'drag' ? ' ' + Math.round(1000 / r.dragMs) + 'Hz' : ''} ${r.emotion} L${r.intensity} dpr${r.dpr}${r.debug ? ' debug' : ''} | avg ${String(r.avgFps).padStart(5)} fps | 1% low ${String(r.low1).padStart(5)} fps | worst ${r.worstMs} ms | draws/s ${r.drawsPerSec} | long-frames ${r.longFrames} (max ${r.longWorst} ms)`)
const out = opt('json-out', '')
if (out) writeFileSync(out, JSON.stringify(results, null, 2))
