// เสียงทั้งหมดสังเคราะห์ด้วย Web Audio (ไม่มีไฟล์เสียง) โมดูลเดียว ใช้ผ่าน `sound.drop(...)`, `sound.brush(...)` ฯลฯ
// - AudioContext สร้างหลังแตะ/กดครั้งแรกเท่านั้น (นโยบาย autoplay ของ Chrome/Safari) ก่อนหน้านั้นทุกฟังก์ชันเงียบเฉย ๆ
// - ปิดเสียง (soundOn = false, จำใน localStorage) = ไม่เล่น ไม่ตั้งเวลา และ master ลดเป็น 0 ทันที
// - เสียงพร้อมกันไม่เกิน MAX_VOICES (ตัวเก่าสุดถูกตัดออกเบา ๆ) และผ่านคอมเพรสเซอร์ + ตัวจำกัดนุ่ม (soft clip) ก่อนออกลำโพง
//   จึงแตะรัวแล้วไม่แตก/ไม่ดังสะสม (ยอดสัญญาณ ≤ SOFT_CEILING < 0 dBFS)
import { ref } from 'vue'

const KEY = 'colorscrap.sound'
export const MAX_VOICES = 6
export const MASTER_GAIN = 0.6
export const SOFT_CEILING = 0.89 // ≈ −1 dBFS

// อ่านค่าที่จำไว้ ค่าเริ่มต้นเปิด (ใช้ storage ที่ส่งเข้ามาได้เพื่อทดสอบ; ถ้าอ่านไม่ได้ เช่น private mode ถือว่าเปิด)
export const readEnabled = (storage = globalThis.localStorage) => {
  try {
    return storage?.getItem(KEY) !== '0'
  } catch {
    return true
  }
}
const writeEnabled = (on) => {
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ไม่มีที่เก็บ = ไม่จำ */
  }
}
export const soundOn = ref(readEnabled())

// อารมณ์ช้า (เศร้า เหนื่อย สงบ) ทุ้มกว่า อารมณ์เร็วแหลมกว่า
const PITCH = { sad: 0.7, tired: 0.62, calm: 0.8, warm: 0.92, angry: 0.88, anxious: 1.12, happy: 1.15, excited: 1.28 }
export const pitchOf = (emotion) => PITCH[emotion] ?? 1

// ที่เก็บเสียงที่ยังเล่นอยู่: เกิน max ตัดตัวเก่าสุด (voice = { stop() })
export const createVoicePool = (max = MAX_VOICES) => {
  const list = []
  return {
    add(voice) {
      list.push(voice)
      while (list.length > max) list.shift().stop?.()
      return voice
    },
    remove(voice) {
      const i = list.indexOf(voice)
      if (i >= 0) list.splice(i, 1)
    },
    stopAll() {
      list.splice(0).forEach((v) => v.stop?.())
    },
    get size() {
      return list.length
    },
  }
}

// ตัวจำกัดนุ่ม: tanh เลื่อนสเกลให้ค่าสูงสุดเท่ากับ SOFT_CEILING พอดี
export const softClipCurve = (n = 1024, drive = 1.4) => {
  const curve = new Float32Array(n)
  const norm = Math.tanh(drive)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = (Math.tanh(x * drive) / norm) * SOFT_CEILING
  }
  return curve
}

// เส้นโค้งซองเสียงของแต้มแสงบาน (ขึ้นแบบ sin ถึงยอดที่ tipMs แล้วลดเป็นเส้นตรงถึง 0 ที่ totalMs) ค่า 0..1 ใช้กับ setValueCurveAtTime
export const bloomEnvelope = (totalMs, points = 64, tipMs = 250) => {
  const tip = Math.min(tipMs, totalMs * 0.3)
  const out = new Float32Array(points)
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * totalMs
    out[i] = t <= tip ? Math.sin((Math.PI / 2) * (t / tip)) : 1 - (t - tip) / (totalMs - tip)
  }
  return out
}

const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const DEBUG = import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')

let ctx = null
let master = null
let noiseBuffer = null
let attached = false
let lastDropAt = 0
let lastTapAt = 0
const pool = createVoicePool(MAX_VOICES)

const ready = () => soundOn.value && ctx && ctx.state === 'running'

const build = () => {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AC) return
  try {
    ctx = new AC()
  } catch {
    ctx = null
    return
  }
  master = ctx.createGain()
  master.gain.value = soundOn.value ? MASTER_GAIN : 0
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 8
  comp.ratio.value = 10
  comp.attack.value = 0.003
  comp.release.value = 0.2
  const clip = ctx.createWaveShaper()
  clip.curve = softClipCurve()
  clip.oversample = '2x'
  master.connect(comp)
  comp.connect(clip)
  clip.connect(ctx.destination)
  // ขาวนวล 1 วินาที วนซ้ำ ใช้เป็นพื้นของเสียงพู่กัน/กระดาษ/เทป
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  if (DEBUG) {
    // dev: วัดยอดสัญญาณหลังตัวจำกัด (window.__soundPeak, 1 = 0 dBFS) ไว้ตรวจเกณฑ์ "ไม่แตก"
    const an = ctx.createAnalyser()
    an.fftSize = 2048
    clip.connect(an)
    const buf = new Float32Array(an.fftSize)
    window.__soundPeak = 0
    setInterval(() => {
      an.getFloatTimeDomainData(buf)
      let p = 0
      for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]))
      window.__soundPeak = Math.max(window.__soundPeak, p)
    }, 30)
    window.__soundVoices = () => pool.size
  }
}

// เรียกครั้งเดียวตอนเริ่มแอป: รอแตะ/กดครั้งแรกแล้วค่อยสร้าง AudioContext (iOS ต้องสร้าง/resume ในเหตุการณ์ของผู้ใช้)
export const attachSound = () => {
  if (attached || typeof window === 'undefined') return
  attached = true
  const unlock = () => {
    if (!ctx) build()
    ctx?.resume?.()
  }
  for (const type of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(type, unlock, { passive: true })
}

export const setSound = (on) => {
  soundOn.value = on
  writeEnabled(on)
  if (!on) {
    sound.brushStop(true)
    pool.stopAll()
  }
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.02)
  }
  if (on) {
    // เปิดเสียงด้วยการแตะปุ่ม = มี gesture อยู่แล้ว สร้าง/ปลุก context ตรงนี้ด้วย
    if (!ctx) build()
    ctx?.resume?.()
  }
}

// ---------- ตัวช่วยสร้างเสียง ----------
const noiseSource = (loop = true) => {
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer
  s.loop = loop
  s.loopStart = rand(0, 0.5)
  return s
}
// ซองเสียงแบบเร็ว: เพิ่มที่ attack วินาที แล้วลดแบบเลขชี้กำลังถึง 0.0001 ที่ attack+decay
const env = (gain, t, peak, attack, decay) => {
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}
// เสียงที่ปล่อยตัวเองเมื่อจบ: nodes = ต้นทางที่ต้อง stop, end = เวลาจบ (วินาทีของ ctx)
const voice = (nodes, end, extra = []) => {
  const v = {
    stop() {
      const t = ctx.currentTime
      for (const n of nodes) {
        try {
          n.stop(t + 0.03)
        } catch {
          /* หยุดไปแล้ว */
        }
      }
      pool.remove(v)
    },
  }
  pool.add(v)
  const last = nodes[0]
  if (last) last.onended = () => pool.remove(v)
  for (const n of nodes) {
    try {
      n.stop(end)
    } catch {
      /* ignore */
    }
  }
  return v
}

export const sound = {
  // หยดสี: เสียงน้ำหยดสั้น ๆ ระดับเสียงสุ่มเล็กน้อยทุกครั้ง strength ต่ำ (กดค้าง) เบาลง size ใหญ่ (สาด) ก้องนานขึ้น
  drop(emotion, { strength = 1, size = 1 } = {}) {
    if (!ready()) return
    const now = performance.now()
    if (now - lastDropAt < 45) return // หยดถี่กว่านี้ฟังเป็นก้อนเดียวอยู่แล้ว
    lastDropAt = now
    const t = ctx.currentTime
    const f0 = 430 * pitchOf(emotion) * rand(0.92, 1.08)
    const vol = 0.07 + 0.15 * clamp(strength, 0, 1)
    const decay = 0.13 + 0.09 * clamp(size, 0.5, 2)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0 * 0.72, t)
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.55, t + 0.07)
    env(g, t, vol, 0.004, decay)
    osc.connect(g).connect(master)
    const osc2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(f0 * 1.4, t)
    osc2.frequency.exponentialRampToValueAtTime(f0 * 3.1, t + 0.07)
    env(g2, t, vol * 0.28, 0.003, decay * 0.5)
    osc2.connect(g2).connect(master)
    const click = noiseSource(false)
    const cf = ctx.createBiquadFilter()
    cf.type = 'bandpass'
    cf.frequency.value = 2400 * pitchOf(emotion)
    const cg = ctx.createGain()
    env(cg, t, vol * 0.3, 0.001, 0.018)
    click.connect(cf).connect(cg).connect(master)
    const end = t + 0.004 + decay + 0.05
    osc.start(t)
    osc2.start(t)
    click.start(t)
    voice([osc, osc2, click], end)
  },

  // พู่กันลาก: เสียงเสียดสีเบา ๆ ต่อเนื่อง ดังตามความเร็ว (px/วินาทีของผ้าใบ) เรียกทุก pointermove หยุดเรียก = เบาลงเอง
  brush(speed) {
    if (!ready()) return
    const v = clamp(speed / 2200, 0, 1)
    if (!brushVoice) {
      const src = noiseSource(true)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 0.8
      bp.frequency.value = 1200
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 4200
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(bp).connect(lp).connect(g).connect(master)
      src.start()
      brushVoice = { src, bp, g, smooth: 0, stopFn: null }
      brushVoice.stopFn = pool.add({
        stop: () => sound.brushStop(true),
      })
    }
    const b = brushVoice
    b.smooth += (v - b.smooth) * 0.35
    const t = ctx.currentTime
    b.g.gain.setTargetAtTime(b.smooth * 0.12, t, 0.035)
    b.bp.frequency.setTargetAtTime(800 + b.smooth * 2600, t, 0.05)
    clearTimeout(brushTimer)
    brushTimer = setTimeout(() => sound.brushStop(), 120)
  },
  // ปล่อยพู่กัน: ค่อย ๆ เบาลงแล้วหยุด (fast = ตัดทันที ใช้ตอนปิดเสียง)
  brushStop(fast = false) {
    clearTimeout(brushTimer)
    const b = brushVoice
    if (!b || !ctx) return
    brushVoice = null
    const t = ctx.currentTime
    b.g.gain.cancelScheduledValues(t)
    b.g.gain.setTargetAtTime(0, t, fast ? 0.01 : 0.06)
    try {
      b.src.stop(t + (fast ? 0.05 : 0.4))
    } catch {
      /* ignore */
    }
    pool.remove(b.stopFn)
  },

  // แต้มแสงบาน: เสียงอุ่นนุ่มฟุ้งขึ้นแล้วจางตามเส้นโค้งเดียวกับการบาน (ms = ความยาวเส้นโค้ง) gentle = กดค้าง เบาและสั้น
  bloom({ ms = 3000, gentle = false } = {}) {
    if (!ready()) return
    const t = ctx.currentTime
    const dur = ms / 1000
    const vol = gentle ? 0.035 : 0.06
    const curve = bloomEnvelope(ms)
    const g = ctx.createGain()
    g.gain.value = 0 // เส้นโค้งเริ่มที่ 0 เอง (ไม่ตั้งค่าซ้อนเวลาเดียวกัน: Safari โยน error ถ้าซ้อนกับ setValueCurveAtTime)
    g.gain.setValueCurveAtTime(curve.map((c) => c * vol), t, dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(500, t)
    lp.frequency.linearRampToValueAtTime(1400, t + 0.25)
    lp.frequency.linearRampToValueAtTime(600, t + dur)
    lp.connect(g).connect(master)
    const nodes = []
    const base = 196 * rand(0.99, 1.01)
    for (const [ratio, det] of [[1, -4], [1.25, 3], [1.5, -2], [2, 5]]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = base * ratio
      o.detune.value = det
      const og = ctx.createGain()
      og.gain.value = ratio === 2 ? 0.35 : 1
      o.connect(og).connect(lp)
      o.start(t)
      nodes.push(o)
    }
    // ลมหายใจฟุ้ง ๆ ใต้เสียงอุ่น
    const hush = noiseSource(true)
    const hbp = ctx.createBiquadFilter()
    hbp.type = 'bandpass'
    hbp.frequency.setValueAtTime(700, t)
    hbp.frequency.linearRampToValueAtTime(1800, t + 0.4)
    hbp.Q.value = 0.6
    const hg = ctx.createGain()
    hg.gain.value = 0.25
    hush.connect(hbp).connect(hg).connect(lp)
    hush.start(t)
    nodes.push(hush)
    voice(nodes, t + dur + 0.05)
  },

  // บันทึก: กระดาษลอยขึ้น (ลมเบา กวาดความถี่ขึ้น)
  paperRise(ms = 520) {
    if (!ready()) return
    const t = ctx.currentTime
    const dur = ms / 1000
    const src = noiseSource(true)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.9
    bp.frequency.setValueAtTime(450, t)
    bp.frequency.exponentialRampToValueAtTime(2300, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.11, t + dur * 0.45)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    voice([src], t + dur + 0.02)
  },
  // บันทึก: แปะเทป (ฉีกสั้น ๆ แล้วแปะเบา ๆ)
  tape() {
    if (!ready()) return
    const t = ctx.currentTime
    const rip = noiseSource(false)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800
    const rg = ctx.createGain()
    // ฉีกเป็นจังหวะถี่ ๆ ลดลง
    rg.gain.setValueAtTime(0.0001, t)
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.012
      rg.gain.linearRampToValueAtTime(0.13 * (1 - i / 9), at + 0.003)
      rg.gain.linearRampToValueAtTime(0.03, at + 0.01)
    }
    rg.gain.linearRampToValueAtTime(0.0001, t + 0.1)
    rip.connect(hp).connect(rg).connect(master)
    rip.start(t)
    const pat = ctx.createOscillator()
    const pg = ctx.createGain()
    pat.type = 'sine'
    pat.frequency.setValueAtTime(190, t + 0.1)
    pat.frequency.exponentialRampToValueAtTime(90, t + 0.17)
    env(pg, t + 0.1, 0.16, 0.003, 0.07)
    pat.connect(pg).connect(master)
    pat.start(t + 0.1)
    voice([rip, pat], t + 0.3)
  },

  // พลิกแผ่น/เปิดสมุด: เสียงกระดาษพลิก (long = เปิดสมุด ทุ้มและนานกว่า)
  flip({ long = false } = {}) {
    if (!ready()) return
    const t = ctx.currentTime
    const dur = long ? 0.34 : 0.17
    const src = noiseSource(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.7
    bp.frequency.setValueAtTime(long ? 1800 : 3200, t)
    bp.frequency.exponentialRampToValueAtTime(long ? 500 : 1100, t + dur)
    const g = ctx.createGain()
    env(g, t, long ? 0.12 : 0.1, dur * 0.2, dur * 0.8)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    voice([src], t + dur + 0.05)
  },

  // จุ่มพู่กันลงน้ำสี (หน้าเลือกความรู้สึก): ตูมนุ่ม ๆ + ซู่เบา ๆ ระดับเสียงตามอารมณ์
  dip(emotion) {
    if (!ready()) return
    const t = ctx.currentTime
    const f = 250 * pitchOf(emotion)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f * 0.6, t)
    osc.frequency.exponentialRampToValueAtTime(f * 1.3, t + 0.09)
    env(g, t, 0.17, 0.006, 0.24)
    osc.connect(g).connect(master)
    osc.start(t)
    const sw = noiseSource(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(1500, t)
    bp.frequency.exponentialRampToValueAtTime(550, t + 0.2)
    const sg = ctx.createGain()
    env(sg, t, 0.07, 0.01, 0.2)
    sw.connect(bp).connect(sg).connect(master)
    sw.start(t)
    voice([osc, sw], t + 0.4)
  },

  // ปาดพู่กันครั้งเดียว (แถบสีของวัน DayRibbon paintLast): เสียงเสียดสีไล่ขึ้นแล้วเบาลงตลอด ms
  stroke(ms = 1100) {
    if (!ready()) return
    const t = ctx.currentTime
    const dur = ms / 1000
    const src = noiseSource(true)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.9
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.linearRampToValueAtTime(2300, t + dur * 0.55)
    bp.frequency.linearRampToValueAtTime(1300, t + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.11, t + dur * 0.3)
    g.gain.linearRampToValueAtTime(0.07, t + dur * 0.8)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(lp).connect(g).connect(master)
    src.start(t)
    voice([src], t + dur + 0.03)
  },

  // แตะปุ่ม: เสียงแตะกระดาษเบามาก
  tap() {
    if (!ready()) return
    const now = performance.now()
    if (now - lastTapAt < 40) return
    lastTapAt = now
    const t = ctx.currentTime
    const src = noiseSource(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(1500, 2000)
    bp.Q.value = 1.2
    const g = ctx.createGain()
    env(g, t, 0.045, 0.002, 0.03)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    voice([src], t + 0.06)
  },
}

let brushVoice = null
let brushTimer = 0
