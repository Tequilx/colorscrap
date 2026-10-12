// สคริปต์ dev วัดสีน้ำบนผ้าใบ (ขั้นจูนน้ำไหล) หยดสี 1 หยดที่กลางผ้าใบ แล้ววัดที่เวลาต่าง ๆ
//
// วิธีใช้ (ต้องมี Playwright ติดตั้งนอกโปรเจกต์ ไม่ได้อยู่ใน package.json):
//   1) เปิดเซิร์ฟเวอร์:  VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node scripts/measure-fluid.mjs --emotions calm,excited,sad --seeds 1,2
// ตัวเลือก: --url http://localhost:5199  --times 1,5,15,30,60  --out ผลลัพธ์.json
//   --replace "ข้อความเดิม=>ข้อความใหม่"  (ใช้ซ้ำได้) แทนที่ข้อความในโมดูล emotions.js ที่เบราว์เซอร์โหลด (ตั้งตัวแปรแวดล้อม MODULE=ส่วนของ path เพื่อเปลี่ยนไฟล์ เช่น MODULE=FluidCanvas.vue)
//   เพื่อลองค่าใหม่/ทดลองแยกปัจจัยโดยไม่แก้ไฟล์จริง เช่น --replace "DENSITY_DISSIPATION = 0.002=>DENSITY_DISSIPATION = 0"
// ผลลัพธ์: ค่า ink ต่อพิกเซล = ระยะสีจากกระดาษ ÷ ระยะของสีอารมณ์เต็มแรง (1 = เข้มเท่าสีอารมณ์) ดู src/dev/fluidMetrics.js
import { writeFileSync } from 'node:fs'
import { measureInk } from '../src/dev/fluidMetrics.js'
import { PALETTE, EMOTION_COLORS } from '../src/lib/tokens.js'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : fallback
}
const replacements = args.flatMap((a, i) => (a === '--replace' ? [args[i + 1]] : [])).map((s) => s.split('=>'))
const url = opt('url', 'http://localhost:5199')
const emotions = opt('emotions', 'calm,excited,sad').split(',')
const seeds = opt('seeds', '1').split(',').map(Number)
const times = opt('times', '1,5,15,30,60').split(',').map(Number)
const out = opt('out', '')
// scenario: drop = หยด 1 หยดแล้วรอ (ค่าเริ่มต้น) | tap = แตะจุดเดิมทุก 250 ms | hold = กดค้างที่จุดเดิม (หยดต่อเนื่อง)
//           | initial = ปล่อยให้แอปหยดสีเริ่มต้นของอารมณ์เองตอนเข้า paint (ไม่แตะ) แล้วรอ
const scenario = opt('scenario', 'drop')
// --extract: ตอนจบรัน extractColors จริง (เหมือนตอนกดบันทึก) แล้วรายงานสีที่ดูดได้
const extract = args.includes('--extract')
// ระดับอารมณ์ที่ใช้ (0 นิดหน่อย, 1 พอประมาณ, 2 มากเลย)
const intensityLevel = Number(opt('intensity', '1'))

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const paper = hexRgb(PALETTE.paper)
const SAMPLE = { w: 278, h: 153 } // ย่อผ้าใบ 1112×612 ลง 4 เท่าก่อนวัด
const PAPER_RECT = { x: 84, y: 92, w: 1112, h: 612 } // ตำแหน่งกระดาษบน stage (ผ้าใบเต็มกระดาษ)

const browser = await chromium.launch({ channel: 'chrome' })
const results = []

for (const emotion of emotions) {
  for (const seed of seeds) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await context.addInitScript((seedValue) => {
      // Math.random แบบกำหนด seed ให้หยดสุ่มทิศ/เฉดซ้ำได้ เทียบก่อน-หลังได้เป็นธรรม
      let a = seedValue
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'วัดสี', avatar: 'cat', coverColor: '#9E2F2A', likes: [] }))
    }, seed)
    const page = await context.newPage()
    if (replacements.length) {
      // ทุกการแทนที่ทำในเส้นทางเดียว (route ซ้อนกันจะไม่ต่อกัน เหลือแค่อันสุดท้าย)
      await page.route(`**/${process.env.MODULE || 'src/lib/emotions.js'}*`, async (route) => {
        const response = await route.fetch()
        let body = await response.text()
        for (const [from, to] of replacements) {
          if (!body.includes(from)) console.error(`!! ไม่พบข้อความที่จะแทนที่: ${from}`)
          body = body.split(from).join(to)
        }
        await route.fulfill({ response, body })
      })
    }
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${url}/?debug`)
    await page.waitForTimeout(800)

    const params = await page.evaluate(async (key) => {
      const m = await import('/src/lib/emotions.js')
      return { ...m.FLUID_PARAMS[key], initialSplats: m.INITIAL_SPLATS[key], density: m.DENSITY_DISSIPATION, inkCap: m.INK_CAP }
    }, emotion)

    // เข้า paint โดยตั้ง canvasDirty ไว้ก่อน = ไม่หยดสีเริ่มต้น ผ้าใบว่างจริง
    await page.evaluate(({ key, initialOnly, level }) => {
      const app = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app')
      app.selection = { emotion: key, intensity: level }
      app.tool = 'drop'
      if (!initialOnly) app.canvasDirty = true
      window.__frames = 0
      window.__sim = 0
      let last = performance.now()
      const loop = () => {
        const now = performance.now()
        window.__sim += Math.min((now - last) / 1000, 1 / 60) // เวลาในโลกจำลอง (ไลบรารีจำกัด dt ที่ 1/60 วินาทีต่อเฟรม)
        last = now
        window.__frames++
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
      location.hash = 'paint'
    }, { key: emotion, initialOnly: scenario === 'initial', level: intensityLevel })
    await page.waitForTimeout(1800)

    const cx = PAPER_RECT.x + PAPER_RECT.w / 2
    const cy = PAPER_RECT.y + PAPER_RECT.h / 2
    const start = await page.evaluate(() => ({ t: performance.now(), frames: window.__frames, sim: window.__sim }))
    await page.mouse.move(cx, cy)
    if (scenario === 'initial') {
      // ไม่แตะ: ใช้หยดเริ่มต้นของแอป (สุ่มตำแหน่ง จึงวัดรอบจุดกลางไม่มีความหมาย ดู extractColors/ปริมาณรวมแทน)
    } else if (scenario === 'hold') {
      await page.mouse.down() // กดค้างตลอดการวัด: หยดต่อเนื่องที่จุดเดิม
    } else if (scenario === 'tap') {
      // แตะจุดเดิมทุก 250 ms ตลอดการวัด (ไม่รอ: ทำในเบราว์เซอร์)
      await page.evaluate(
        ({ cx, cy, ms }) => {
          const el = document.elementFromPoint(cx, cy)
          const fire = (type) => el.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', buttons: 1, bubbles: true }))
          window.__tapTimer = setInterval(() => {
            fire('pointerdown')
            fire('pointerup')
          }, ms)
        },
        { cx, cy, ms: 250 },
      )
    } else {
      await page.mouse.down()
      await page.mouse.up()
    }

    const full = Math.hypot(...hexRgb(EMOTION_COLORS[emotion]).map((v, i) => v - paper[i]))
    const samples = []
    for (const t of [0.4, ...times]) {
      const shot = await page.evaluate(
        ({ t, startT, size, startSim }) =>
          new Promise((resolve) => {
            const wait = startT + t * 1000 - performance.now()
            setTimeout(() => {
              requestAnimationFrame(() => {
                const source = document.querySelector('canvas')
                const c = document.createElement('canvas')
                c.width = size.w
                c.height = size.h
                const ctx = c.getContext('2d', { willReadFrequently: true })
                ctx.drawImage(source, 0, 0, size.w, size.h)
                // ย้อนการกลับสีของ CSS (invert) เหมือน FluidCanvas.capture
                ctx.globalCompositeOperation = 'difference'
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, size.w, size.h)
                resolve({ rgba: Array.from(ctx.getImageData(0, 0, size.w, size.h).data), sim: window.__sim - startSim, frames: window.__frames })
              })
            }, Math.max(0, wait))
          }),
        { t, startT: start.t, size: SAMPLE, startSim: start.sim },
      )
      const m = measureInk(shot.rgba, { width: SAMPLE.w, height: SAMPLE.h, paper, full, center: { x: 0.5, y: 0.5 }, radius: 20 })
      samples.push({ t, sim: +shot.sim.toFixed(2), ...m })
    }
    let extracted = null
    if (extract) {
      extracted = await page.evaluate(
        ({ fallback }) =>
          new Promise((resolve) => {
            requestAnimationFrame(async () => {
              const source = document.querySelector('canvas')
              const c = document.createElement('canvas')
              c.width = source.width
              c.height = source.height
              const ctx = c.getContext('2d', { willReadFrequently: true })
              ctx.drawImage(source, 0, 0)
              ctx.globalCompositeOperation = 'difference'
              ctx.fillStyle = '#ffffff'
              ctx.fillRect(0, 0, c.width, c.height)
              const m = await import('/src/lib/extractColors.js')
              resolve(m.extractColors(c, fallback))
            })
          }),
        { fallback: EMOTION_COLORS[emotion] },
      )
    }
    if (scenario === 'hold') await page.mouse.up()
    if (scenario === 'tap') await page.evaluate(() => clearInterval(window.__tapTimer))
    const end = await page.evaluate(() => ({ t: performance.now(), frames: window.__frames }))
    const fps = ((end.frames - start.frames) / ((end.t - start.t) / 1000)).toFixed(1)
    results.push({ emotion, seed, scenario, intensity: intensityLevel, fps: Number(fps), params, samples, errors, extracted })
    console.error(`เสร็จ ${emotion} seed ${seed} (${fps} fps)`)
    await context.close()
  }
}
await browser.close()

if (out) writeFileSync(out, JSON.stringify({ replacements, results }, null, 2))
const pct = (v) => (v * 100).toFixed(1).padStart(6) + '%'
for (const r of results) {
  console.log(`\n## ${r.emotion} seed ${r.seed} ${r.scenario} · ${r.fps} fps · ${JSON.stringify(r.params)}`)
  console.log('เวลา(วิ) sim(วิ) | เข้มรอบจุด | จุดเข้มสุด | ปริมาณรวม | พื้นที่ที่เห็นสี | พื้นที่เข้มชัด | สีเฉลี่ยรอบจุด | มืดสุด')
  if (r.extracted) console.log('สีที่ดูดได้ (extractColors): ' + r.extracted.map((c) => `${c.hex} ${(c.ratio * 100).toFixed(0)}%`).join(', '))
  for (const s of r.samples) console.log(`${String(s.t).padStart(6)} ${String(s.sim).padStart(7)} | ${pct(s.near)} | ${pct(s.top1)} | ${pct(s.total)} | ${pct(s.areaVisible)} | ${pct(s.areaStrong)} | rgb(${s.nearColor}) | ${(s.darkest * 100).toFixed(0)}%`)
}
