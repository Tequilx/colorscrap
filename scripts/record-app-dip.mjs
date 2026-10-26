// สคริปต์ dev อัดเสียงจุ่มพู่กัน "จากการกดจริงในแอป" (คลิกการ์ดอารมณ์ในหน้า pick) ด้วย MediaRecorder ที่ดักเอาต์พุตของ AudioContext จริง
// → scripts/out/audio/dip-app-<n>.wav ฟังเทียบกับ dip-<n>.wav (scripts/record-sfx.mjs) พร้อมสรุปว่าฟังก์ชันเสียงไหนถูกเรียกบ้าง
// FALLBACK=1 = บล็อกไฟล์ src/assets/sfx/*.mp3 ให้ใช้เสียงสังเคราะห์สำรอง · PREFIX=dip-water ตั้งชื่อไฟล์ (<PREFIX>[-synth]-<n>.wav)
// DIRECT=1 = เรียก sound.dip ตรง ๆ ในแอปจริง (ใช้เป็นเสียงอ้างอิง dip-<n>.wav ระดับเดียวกับแอป; ไฟล์จาก record-sfx.mjs ที่ render offline เบากว่า ~12 dB)
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/record-app-dip.mjs [--url http://localhost:5199] [--takes 3]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const url = opt('url', 'http://localhost:5199')
const takes = Number(opt('takes', 3))
mkdirSync('scripts/out/audio', { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const EMOTIONS = ['โกรธ', 'เศร้า', 'ตื่นเต้น'] // ไม่ใช้ 'สงบ' (เลือกอยู่แล้วตั้งต้น พู่กันไม่ขยับ)
for (let n = 1; n <= takes; n++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.addInitScript(() => {
    localStorage.setItem('colorscrap.music', '0') // ปิดเพลงคลอ ให้ไฟล์มีแต่เอฟเฟกต์
    localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'ม', avatar: 'cat', coverColor: '#2F6B4F', likes: [] }))
    // ดักทุกอย่างที่ต่อเข้า destination ของ AudioContext จริงไปที่ MediaStreamDestination ด้วย
    const Orig = window.AudioContext
    window.AudioContext = class extends Orig {
      constructor(...a) {
        super(...a)
        this.__rec = this.createMediaStreamDestination()
        window.__ctx = this
      }
    }
    const connect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (dest, ...r) {
      const res = connect.call(this, dest, ...r)
      if (dest instanceof AudioDestinationNode && this.context.__rec) connect.call(this, this.context.__rec)
      return res
    }
  })
  if (process.env.FALLBACK) await page.route('**/src/assets/sfx/*.mp3', (r) => r.abort())
  await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const urls = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((u) => /lib\/sound\.js/.test(u)))
  await page.evaluate(async (u) => {
    const m = await import(u)
    window.__calls = []
    for (const k of Object.keys(m.sound)) {
      const f = m.sound[k]
      m.sound[k] = (...a) => (window.__calls.push(k), f.apply(m.sound, a))
    }
    document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app').go('pick')
  }, urls.find((u) => u.includes('?t=')) || urls[0])
  await page.waitForTimeout(1500)
  await page.mouse.click(40, 400) // แตะครั้งแรกให้ AudioContext เริ่ม (พื้นว่าง)
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    window.__calls.length = 0
    window.__chunks = []
    window.__mr = new MediaRecorder(window.__ctx.__rec.stream)
    window.__mr.ondataavailable = (e) => window.__chunks.push(e.data)
    window.__mr.start()
  })
  if (process.env.DIRECT) await page.evaluate(async (u) => (await import(u)).sound.dip('calm'), urls.find((u) => u.includes('?t=')) || urls[0])
  else await page.locator('button[aria-pressed]').filter({ hasText: EMOTIONS[n - 1] }).first().click()
  await page.waitForTimeout(2200)
  const out = await page.evaluate(async () => {
    await new Promise((res) => { window.__mr.onstop = res; window.__mr.stop() })
    const buf = await window.__ctx.decodeAudioData(await new Blob(window.__chunks).arrayBuffer())
    const L = buf.getChannelData(0)
    let peak = 0
    for (const v of L) peak = Math.max(peak, Math.abs(v))
    const dv = new DataView(new ArrayBuffer(44 + L.length * 2))
    const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)))
    w(0, 'RIFF'); dv.setUint32(4, 36 + L.length * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, L.length * 2, true)
    L.forEach((v, i) => dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true))
    let bin = ''
    new Uint8Array(dv.buffer).forEach((b) => (bin += String.fromCharCode(b)))
    return { data: btoa(bin), peak, calls: window.__calls, secs: buf.duration }
  })
  writeFileSync(join('scripts/out/audio', `${process.env.PREFIX || (process.env.DIRECT ? 'dip' : 'dip-app')}${process.env.FALLBACK ? '-synth' : ''}-${n}.wav`), Buffer.from(out.data, 'base64'))
  console.log(`${process.env.PREFIX || 'dip-app'}-${n}.wav (${EMOTIONS[n - 1]}) ${out.secs.toFixed(1)}s peak ${(20 * Math.log10(out.peak || 1e-9)).toFixed(1)} dBFS · เรียก: ${out.calls.join(', ')}`)
  await page.close()
}
await browser.close()
