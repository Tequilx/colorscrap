// สคริปต์ dev อัดเสียงสังเคราะห์ (dip / glow) ออกเป็น WAV ผ่าน OfflineAudioContext (ผ่านคอมเพรสเซอร์/ซอฟต์คลิปจริงของแอป) ไว้ฟังเทียบ
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=/path/to/playwright-core/index.mjs node scripts/record-sfx.mjs [--url http://localhost:5199] [--takes 3]
// ไฟล์ลง scripts/out/audio/<ชื่อ>-<n>.wav (git-ignored) แต่ละครั้งโหลดหน้าใหม่ = สุ่มใหม่
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const url = opt('url', 'http://localhost:5199')
const takes = Number(opt('takes', 3))
mkdirSync('scripts/out/audio', { recursive: true })

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const browser = await chromium.launch({ channel: 'chrome' })
const SPECS = [
  ['dip', (s) => s.dip('calm'), 1.2],
  ['glow', (s) => s.bloom({ ms: 3000 }), 2.5],
]
for (const [name, , secs] of SPECS) {
  for (let n = 1; n <= takes; n++) {
    const page = await browser.newPage()
    // AudioContext → OfflineAudioContext ที่แกล้งบอกว่า running เพื่อให้ sound.js ยอมเล่น
    await page.addInitScript((secs) => {
      window.AudioContext = function () {
        const c = new OfflineAudioContext(2, Math.round(44100 * secs), 44100)
        Object.defineProperty(c, 'state', { get: () => 'running' })
        c.resume = () => Promise.resolve()
        c.suspend = () => Promise.resolve()
        window.__offline = c
        return c
      }
    }, secs)
    await page.goto(url + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const b64 = await page.evaluate(async ({ name }) => {
      const m = await import('/src/lib/sound.js')
      m.setSound(true)
      m.setMusic(false)
      if (name === 'dip') m.sound.dip('calm')
      else m.sound.bloom({ ms: 3000 })
      const buf = await window.__offline.startRendering()
      const L = buf.getChannelData(0)
      let peak = 0
      for (const v of L) peak = Math.max(peak, Math.abs(v))
      const out = new DataView(new ArrayBuffer(44 + L.length * 2))
      const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
      w(0, 'RIFF'); out.setUint32(4, 36 + L.length * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
      out.setUint32(24, 44100, true); out.setUint32(28, 88200, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, L.length * 2, true)
      L.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true))
      let bin = ''
      new Uint8Array(out.buffer).forEach((b) => (bin += String.fromCharCode(b)))
      return { data: btoa(bin), peak }
    }, { name })
    writeFileSync(join('scripts/out/audio', `${name}-${n}.wav`), Buffer.from(b64.data, 'base64'))
    console.log(`${name}-${n}.wav peak ${(20 * Math.log10(b64.peak || 1e-9)).toFixed(1)} dBFS`)
    await page.close()
  }
}
await browser.close()
