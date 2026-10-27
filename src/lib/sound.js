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
export const readEnabled = (storage = globalThis.localStorage, key = KEY) => {
  try {
    return storage?.getItem(key) !== '0'
  } catch {
    return true
  }
}
const writeEnabled = (on, key = KEY) => {
  try {
    globalThis.localStorage?.setItem(key, on ? '1' : '0')
  } catch {
    /* ไม่มีที่เก็บ = ไม่จำ */
  }
}
export const soundOn = ref(readEnabled())

// เพลงคลอ (lib/music.js) เปิด/ปิดแยกจากเอฟเฟกต์ จำค่าแยก ค่าเริ่มต้นเปิดทั้งคู่
const MUSIC_KEY = 'colorscrap.music'
export const MUSIC_BASE = 0.04 // วัดแล้วยอดเพลงอยู่ราว −22 dBFS เทียบยอดเอฟเฟกต์ −3.4 dBFS (ต่าง ~ −19 dB) ผ่านคอมเพรสเซอร์ที่ชดเชยระดับให้เอง
// pentatonic (C D E G A) ช่วง ~600–1200 Hz ของเสียงเติมสีสดใส
export const BELL_SCALE = [587, 659, 784, 880, 1047, 1175]
// สุ่ม 2–4 โน้ตไม่ซ้ำจาก BELL_SCALE (rnd = ฟังก์ชัน 0..1) ทดสอบได้
export const pickBellNotes = (rnd) => {
  const n = 2 + Math.floor(rnd() * 3)
  const pool = [...BELL_SCALE]
  const out = []
  while (out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  return out
}
const DIP_GAP_MS = 150 // จุ่มพู่กันถี่กว่านี้ไม่ซ้อนเสียงใหม่
let lastDip = -Infinity
const BELL_GAP_MS = 150 // เสียงเติมสีสดใสไม่ซ้อนถ้ากดถี่กว่านี้
let lastBell = -Infinity
export const MUSIC_DUCK = 0.5 // ลดเหลือครึ่งหนึ่งระหว่างลำดับบันทึก/แต้มแสงบาน
export const musicOn = ref(readEnabled(globalThis.localStorage, MUSIC_KEY))

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
let musicBus = null
let duckDepth = 0
const readyCallbacks = []
let noiseBuffer = null
let attached = false
let lastDropAt = 0
let lastTapAt = 0
let peakTimer = null
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
  ctx.addEventListener?.('statechange', onStateChange)
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
  // เพลงคลอเข้าคอมเพรสเซอร์/ตัวจำกัดตัวเดียวกับเอฟเฟกต์ (ยอดรวมไม่เกินเพดาน) ผ่านบัสของตัวเอง ระดับ ≈ −20 dB เทียบเอฟเฟกต์
  musicBus = ctx.createGain()
  musicBus.gain.value = 0
  musicBus.connect(comp)
  master.connect(comp)
  comp.connect(clip)
  clip.connect(ctx.destination)
  loadSfx()
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
    clearInterval(peakTimer)
    peakTimer = setInterval(() => {
      an.getFloatTimeDomainData(buf)
      let p = 0
      for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]))
      window.__soundPeak = Math.max(window.__soundPeak, p)
    }, 30)
    window.__soundVoices = () => pool.size
    window.__sfxLoaded = () => SFX_NAMES.filter(hasSfx) // dev: ไฟล์ใน src/assets/sfx ที่โหลดสำเร็จ
  }
}

// สร้าง AudioContext ครั้งแรก (ต้องอยู่ในเหตุการณ์ของผู้ใช้) แล้วแจ้งผู้รอ (เพลงคลอ) — ใช้ทั้งตอนแตะครั้งแรกและตอนกดปุ่มเปิดเสียง
const ensureCtx = () => {
  if (ctx) return
  build()
  if (!ctx) return
  applyMusicGain(true)
  readyCallbacks.splice(0).forEach((cb) => cb())
}

// ---- ปลุกเสียงหลังสลับแอป (iOS/iPadOS Safari) ----
// iOS ตัด AudioContext ('interrupted' / 'suspended') เมื่อสลับแอป ล็อกจอ หรือมีสายเข้า และ resume() นอกเหตุการณ์ของผู้ใช้ไม่สำเร็จ (promise ค้าง/ไม่เปลี่ยน state)
// จึง: ซ่อน → suspend เอง · กลับมาแล้ว state ไม่ใช่ running → ติด listener ครั้งเดียว (capture) รอแตะแล้ว resume() ถ้า 800 ms แล้วยังไม่ running (หรือ context ถูก close) สร้าง context ใหม่ต่อกราฟเสียงใหม่
// เพลงแจ้งผ่าน onAudioLost / onAudioRebuilt เพื่อเล่นต่อบน context ใหม่ (AudioBuffer ที่ถอดรหัสไว้ใช้ข้าม context ได้)
export const RESUME_TIMEOUT_MS = 800
const GESTURES = ['pointerdown', 'touchend', 'keydown']
const lostCallbacks = []
const rebuiltCallbacks = []
export const onAudioLost = (cb) => lostCallbacks.push(cb)
export const onAudioRebuilt = (cb) => rebuiltCallbacks.push(cb)
// สถานะจริงของเสียง (ปุ่มเปิด/ปิดแสดงค่าที่ผู้ใช้ตั้ง ส่วนนี้บอกว่าตอนนี้เล่นได้จริงไหม): idle = ยังไม่แตะครั้งแรก · running · blocked = รอแตะเพื่อปลุก
export const audioState = ref('idle')

const readable = (key) => {
  try {
    return globalThis.localStorage?.getItem(key) != null
  } catch {
    return false
  }
}
const wantsAudio = () => soundOn.value || musicOn.value
const settle = () => {
  audioState.value = !ctx ? 'idle' : ctx.state === 'running' ? 'running' : 'blocked'
}
let unlockArmed = false
let recovering = null
const onStateChange = () => {
  settle()
  if (!ctx || typeof document === 'undefined') return
  // ถูกระบบหยุด (interrupted/suspended/closed) ขณะหน้ายังเห็นอยู่ = รอแตะเพื่อปลุก
  if (ctx.state !== 'running' && !document.hidden && wantsAudio()) armUnlock()
  if (ctx.state === 'running') disarmUnlock()
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), ms))])
const recover = () => {
  if (recovering) return recovering
  recovering = (async () => {
    ensureCtx()
    if (!ctx) return
    if (ctx.state !== 'closed') {
      try {
        await withTimeout(Promise.resolve(ctx.resume?.()), RESUME_TIMEOUT_MS)
      } catch {
        /* ปฏิเสธ = ถือว่าไม่สำเร็จ ไปสร้างใหม่ด้านล่าง */
      }
    }
    if (ctx.state === 'running') return
    // resume ไม่สำเร็จหรือถูก close: ทิ้ง context เก่า สร้างใหม่ใน gesture เดียวกัน
    lostCallbacks.forEach((cb) => cb())
    sound.brushStop?.(true)
    pool.stopAll()
    const old = ctx
    old.removeEventListener?.('statechange', onStateChange)
    try {
      await old.close?.()
    } catch {
      /* ปิดไปแล้ว */
    }
    ctx = null
    master = null
    musicBus = null
    build()
    if (!ctx) return
    ctx.resume?.()
    applyMusicGain(true)
    rebuiltCallbacks.forEach((cb) => cb())
  })().finally(() => {
    recovering = null
    settle()
  })
  return recovering
}
// ทุกการแตะ: ยังไม่มี context = สร้างแล้ว resume (ทางเดิม) · มีแล้วแต่ไม่ได้ running (สลับแอป/ถูกระบบหยุด) = ปลุก หรือสร้างใหม่ถ้าปลุกไม่ขึ้น
const unlock = () => {
  if (!ctx) {
    ensureCtx()
    ctx?.resume?.()
    return
  }
  if (ctx.state !== 'running') recover()
}
// อยู่ในเหตุการณ์ของผู้ใช้อยู่แล้ว (กดปุ่มเปิดเสียง/เพลง): สร้างครั้งแรก หรือปลุก/สร้างใหม่ถ้าถูกระบบหยุดไว้
const wake = () => {
  const had = Boolean(ctx)
  ensureCtx()
  if (!ctx) return
  if (had && ctx.state !== 'running') recover()
  else ctx.resume?.()
}
function armUnlock() {
  if (unlockArmed || typeof window === 'undefined') return
  unlockArmed = true
  for (const type of GESTURES) window.addEventListener(type, onUnlockGesture, { capture: true, passive: true })
}
function disarmUnlock() {
  if (!unlockArmed) return
  unlockArmed = false
  for (const type of GESTURES) window.removeEventListener(type, onUnlockGesture, { capture: true })
}
function onUnlockGesture() {
  disarmUnlock()
  unlock()
}

// กลับมาเห็นหน้า: ค่าเปิด/ปิดที่จำไว้อาจเปลี่ยนจากแท็บอื่น → ซิงก์ให้ปุ่มตรงกับความจริง แล้วถ้า context ไม่ได้ running ก็รอแตะ
const onShown = () => {
  // เฉพาะเมื่ออ่าน localStorage ได้ (private mode อ่านไม่ได้ = คงค่าในหน่วยความจำ ไม่เด้งกลับเป็นเปิด)
  if (readable(KEY)) soundOn.value = readEnabled()
  if (readable(MUSIC_KEY)) musicOn.value = readEnabled(globalThis.localStorage, MUSIC_KEY)
  if (ctx) applyMusicGain(true)
  if (master && ctx) master.gain.setValueAtTime(soundOn.value ? MASTER_GAIN : 0, ctx.currentTime)
  if (!ctx) return
  settle()
  if (ctx.state !== 'running' && wantsAudio()) {
    armUnlock()
    ctx.resume?.()?.catch?.(() => {}) // บางกรณี (เช่นกลับจากแท็บอื่นบน desktop) สำเร็จเองโดยไม่ต้องแตะ
  }
}
const onHidden = () => {
  if (ctx && ctx.state === 'running') ctx.suspend?.()?.catch?.(() => {})
}

// เรียกครั้งเดียวตอนเริ่มแอป: รอแตะ/กดครั้งแรกแล้วค่อยสร้าง AudioContext (iOS ต้องสร้าง/resume ในเหตุการณ์ของผู้ใช้)
export const attachSound = () => {
  if (attached || typeof window === 'undefined') return
  attached = true
  for (const type of GESTURES) window.addEventListener(type, unlock, { passive: true })
  // แท็บถูกซ่อน/จอพับ/สลับแอป: หยุดเสียงทั้งหมด (suspend) กลับมาแล้วเล่นต่อ (ดู onShown)
  document.addEventListener('visibilitychange', () => (document.hidden ? onHidden() : onShown()))
  window.addEventListener('pagehide', onHidden)
  window.addEventListener('pageshow', onShown) // กลับจาก bfcache: visibilitychange อาจไม่ยิง
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
    wake()
  }
}

// ---- เพลงคลอ: บัส + ลดเสียงอัตโนมัติ (ใช้โดย lib/music.js) ----
const applyMusicGain = (instant = false) => {
  if (!musicBus || !ctx) return
  const target = musicOn.value ? MUSIC_BASE * (duckDepth > 0 ? MUSIC_DUCK : 1) : 0
  musicBus.gain.cancelScheduledValues(ctx.currentTime)
  // ลง (duck/ปิด) เร็วหน่อย ขึ้น (คืนเสียง) ช้า ๆ
  const tc = instant ? 0.001 : target < musicBus.gain.value ? 0.15 : 0.6
  musicBus.gain.setTargetAtTime(target, ctx.currentTime, tc)
}
export const setMusic = (on) => {
  musicOn.value = on
  writeEnabled(on, MUSIC_KEY)
  if (on) wake()
  applyMusicGain()
}
// ลดเสียงเพลงลงครึ่งหนึ่งนาน ms แล้วคืน (ซ้อนกันได้: นับเป็นชั้น)
export const duckMusic = (ms) => {
  if (!ctx) return
  duckDepth++
  applyMusicGain()
  setTimeout(() => {
    duckDepth = Math.max(0, duckDepth - 1)
    applyMusicGain()
  }, ms)
}
// ให้ lib/music.js ขอ context/บัสเมื่อพร้อม (หลังแตะครั้งแรก) cb เรียกครั้งเดียวทันทีถ้าพร้อมอยู่แล้ว
export const onAudioReady = (cb) => {
  if (ctx) cb()
  else readyCallbacks.push(cb)
}
export const getMusicOutput = () => (ctx && musicBus ? { ctx, bus: musicBus } : null)

// ---------- เสียงเอฟเฟกต์จากไฟล์ (ทางเลือก ข้อ 40) ----------
// วางไฟล์ src/assets/sfx/<ชื่อ>.mp3 ตามตาราง SFX_NAMES (docs/FILE-GUIDE.md "เปลี่ยนเสียงเอฟเฟกต์") ถ้ามีไฟล์ใช้ไฟล์แทนเสียงสังเคราะห์ของเสียงนั้น ไม่มี/ถอดรหัสไม่ได้ = ใช้เสียงสังเคราะห์เดิม ไม่มี error
// ข้อ 46: รายชื่อไฟล์ที่มีจริงรู้ตอน build (import.meta.glob) โหลดเฉพาะไฟล์ที่มี ไม่มีไฟล์เลย = ไม่มีคำขอเครือข่ายเลย (ไม่มี 404)
// ไฟล์ผ่านทางเดียวกับเสียงสังเคราะห์ทุกอย่าง: pool จำกัด ≤ 6 เสียง (voice) → master (เปิด/ปิดเอฟเฟกต์ + ระดับ) → คอมเพรสเซอร์ → soft clip
export const SFX_NAMES = ['drop', 'smear', 'splash', 'glow', 'dip', 'stroke', 'lift', 'tape', 'cover', 'page', 'note', 'tap']
const SFX_FILES = import.meta.glob('/src/assets/sfx/*.mp3', { eager: true, query: '?url', import: 'default' })
// ชื่อไฟล์ (ไม่รวม .mp3) → URL ของไฟล์ที่มีจริง รองรับหลายไฟล์ต่อเสียง: dip.mp3 หรือ dip-1.mp3, dip-2.mp3 … (สุ่มเล่นหนึ่งไฟล์ทุกครั้ง) ชื่อที่ไม่อยู่ใน SFX_NAMES ถูกข้าม
export const sfxBase = (stem) => stem.replace(/-\d+$/, '')
export const sfxUrls = Object.fromEntries(
  Object.entries(SFX_FILES)
    .map(([path, url]) => [path.split('/').pop().replace(/\.mp3$/, ''), url])
    .filter(([stem]) => SFX_NAMES.includes(sfxBase(stem))),
)
const sfxBuffers = new Map() // ชื่อเสียง → AudioBuffer แรกที่โหลดได้ | null (null = ไม่มีไฟล์)
const sfxVariants = new Map() // ชื่อเสียง → AudioBuffer[] ทุกไฟล์ของเสียงนั้น
export const hasSfx = (name) => Boolean(sfxBuffers.get(name))
let sfxStarted = false
const loadSfx = () => {
  if (sfxStarted) return
  sfxStarted = true
  for (const [stem, url] of Object.entries(sfxUrls)) {
    const name = sfxBase(stem)
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((ab) => (ab ? ctx.decodeAudioData(ab) : null)) // โฮสต์แบบ SPA ตอบ index.html แทน 404 → decode ล้ม → null
      .then((buf) => {
        if (!buf) return
        sfxVariants.set(name, [...(sfxVariants.get(name) ?? []), buf])
        if (!sfxBuffers.get(name)) sfxBuffers.set(name, buf)
      })
      .catch(() => {})
  }
}
// เล่นไฟล์ name หนึ่งครั้ง (มีหลายไฟล์ = สุ่มหนึ่งไฟล์) gain คูณระดับไฟล์ rate = ปรับความเร็ว/ระดับเสียง คืน true ถ้ามีไฟล์และเล่นแล้ว
const playSfx = (name, { gain = 1, rate = 1 } = {}) => {
  const list = sfxVariants.get(name)
  if (!list?.length) return false
  const buf = list[Math.floor(Math.random() * list.length)]
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g).connect(master)
  src.start()
  voice([src], ctx.currentTime + buf.duration / rate + 0.05)
  return true
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
// ระฆังแก้วหนึ่งโน้ต: sine + overtone triangle ×2.4 เบามาก attack 30 ms decay ~600 ms lowpass 2 kHz คืน oscillator ที่ต้อง stop
const bellNote = (t, freq, peak) => {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.03)
  g.gain.setTargetAtTime(0, t + 0.03, 0.2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2000
  lp.connect(g).connect(master)
  const nodes = []
  for (const [type, ratio, level] of [['sine', 1, 1], ['triangle', 2.4, 0.12]]) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq * ratio
    const og = ctx.createGain()
    og.gain.value = level
    o.connect(og).connect(lp)
    o.start(t)
    o.stop(t + 1.2)
    nodes.push(o)
  }
  return nodes
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
    const pitch = pitchOf(emotion) * rand(0.95, 1.05)
    if (size > 1.3 && hasSfx('splash') ? playSfx('splash', { rate: pitch }) : playSfx('drop', { gain: 0.45 + 0.55 * clamp(strength, 0, 1), rate: pitch })) return
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
    if (!brushVoice && hasSfx('smear')) {
      // ไฟล์ smear วนได้ ระดับตามความเร็วเหมือนเสียงสังเคราะห์
      const src = ctx.createBufferSource()
      src.buffer = sfxBuffers.get('smear')
      src.loop = true
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(g).connect(master)
      src.start()
      brushVoice = { src, bp: null, g, smooth: 0, stopFn: null }
      brushVoice.stopFn = pool.add({ stop: () => sound.brushStop(true) })
    }
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
    b.g.gain.setTargetAtTime(b.smooth * (b.bp ? 0.12 : 0.9), t, 0.035)
    b.bp?.frequency.setTargetAtTime(800 + b.smooth * 2600, t, 0.05)
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

  // เติมสีสดใส (bloom): ระฆังแก้ว 2–4 โน้ตสุ่มจาก pentatonic (BELL_SCALE ~600–1200 Hz) ไล่กันห่าง 60–100 ms แต่ละโน้ต attack 30 ms decay ~600 ms lowpass 2 kHz
  // ความดังรวม 2/3 ของเสียงโน้ตเดียวเดิม (แบ่งตามจำนวนโน้ต) กดถี่กว่า BELL_GAP_MS ไม่ซ้อน ms = ความยาวเส้นโค้งการบาน ใช้แค่ลดเสียงเพลง gentle = กดค้าง เบากว่า
  bloom({ ms = 3000, gentle = false } = {}) {
    if (!ready()) return
    const now = performance.now()
    if (now - lastBell < BELL_GAP_MS) return
    lastBell = now
    duckMusic(ms)
    if (playSfx('glow', { gain: gentle ? 0.6 : 1 })) return
    const t0 = ctx.currentTime
    const notes = pickBellNotes(Math.random)
    const peak = ((gentle ? 0.04 : 0.07) * (2 / 3)) / notes.length
    const nodes = []
    let at = t0
    for (const f of notes) {
      nodes.push(...bellNote(at, f * rand(0.995, 1.005), peak))
      at += rand(0.06, 0.1)
    }
    voice(nodes, at + 0.9)
  },

  // บันทึก: กระดาษลอยขึ้น (ลมเบา กวาดความถี่ขึ้น)
  paperRise(ms = 520) {
    if (!ready()) return
    if (playSfx('lift')) return
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
    if (playSfx('tape')) return
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
    if (playSfx(long ? 'cover' : 'page')) return
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
  // จุ่มพู่กัน (ข้อ 56): ใช้ไฟล์ dip(-n).mp3 ถ้ามี (สุ่มไฟล์ + playbackRate 0.94–1.06) ไม่มีใช้เสียงน้ำสังเคราะห์: noise ผ่าน bandpass ที่ความถี่ขยับขึ้นลง attack ~15 ms decay ~300 ms
  // + "ฟองน้ำ" 3–5 เม็ด (sine สั้น 20–40 ms pitch ไต่ขึ้นเร็ว เบา ๆ สุ่มเวลา 0–200 ms) lowpass รวม 3 kHz ไม่มีเสียงทุ้ม กันซ้อนถ้ากดถี่กว่า DIP_GAP_MS
  dip() {
    if (!ready()) return
    const now = performance.now()
    if (now - lastDip < DIP_GAP_MS) return
    lastDip = now
    if (playSfx('dip', { rate: rand(0.94, 1.06), gain: 0.4 })) return
    const t = ctx.currentTime
    const j = () => rand(0.95, 1.05)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3000
    lp.connect(master)
    const nodes = []
    const sw = noiseSource(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.1
    bp.frequency.setValueAtTime(900 * j(), t)
    bp.frequency.exponentialRampToValueAtTime(1500 * j(), t + 0.09)
    bp.frequency.exponentialRampToValueAtTime(800 * j(), t + 0.32)
    const sg = ctx.createGain()
    env(sg, t, 0.26, 0.015, 0.3)
    sw.connect(bp).connect(sg).connect(lp)
    sw.start(t)
    nodes.push(sw)
    const bubbles = 3 + Math.floor(Math.random() * 3)
    for (let k = 0; k < bubbles; k++) {
      const at = t + rand(0, 0.2)
      const dur = rand(0.02, 0.04)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(rand(500, 800), at)
      o.frequency.exponentialRampToValueAtTime(rand(1000, 1400), at + dur)
      const og = ctx.createGain()
      env(og, at, rand(0.05, 0.09), 0.004, dur)
      o.connect(og).connect(lp)
      o.start(at)
      o.stop(at + dur + 0.02)
      nodes.push(o)
    }
    voice(nodes, t + 0.5)
  },

  // ปาดพู่กันครั้งเดียว (แถบสีของวัน DayRibbon paintLast): เสียงเสียดสีไล่ขึ้นแล้วเบาลงตลอด ms
  stroke(ms = 1100) {
    if (!ready()) return
    if (playSfx('stroke')) return
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

  // โน้ตอารมณ์เก็บ/กางออก: กระดาษเสียดสีเบา ๆ (up = กางออก ความถี่ขึ้น / ไม่ใช่ = เก็บ ความถี่ลง)
  paperSlide(up = false) {
    if (!ready()) return
    if (playSfx('note', { rate: up ? 1.08 : 0.94 })) return
    const t = ctx.currentTime
    const src = noiseSource(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(up ? 900 : 2200, t)
    bp.frequency.exponentialRampToValueAtTime(up ? 2200 : 900, t + 0.28)
    const g = ctx.createGain()
    env(g, t, 0.06, 0.04, 0.26)
    src.connect(bp).connect(g).connect(master)
    src.start(t)
    voice([src], t + 0.36)
  },

  // แตะปุ่ม: เสียงแตะกระดาษเบามาก
  tap() {
    if (!ready()) return
    const now = performance.now()
    if (now - lastTapAt < 40) return
    lastTapAt = now
    if (playSfx('tap', { rate: rand(0.95, 1.05) })) return
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

// dev: แก้ไฟล์นี้แล้วโหลดหน้าใหม่ทั้งหน้า (ไม่ HMR) ไม่งั้นโมดูลที่ยังไม่ถูกอัปเดตถือ sound.js ตัวเก่าค้างอยู่คนละ instance กับตัวใหม่ → ได้ยินเสียงเก่า (ข้อ 53d)
if (import.meta.hot) import.meta.hot.decline()
