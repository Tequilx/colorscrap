// เพลงคลอ (streaming): สตรีมจาก src/assets/audio/music-day.mp3 และ music-night.mp3 ด้วย HTMLAudioElement (preload="auto", loop) ต่อเข้า Web Audio ผ่าน MediaElementAudioSourceNode
// เพื่อใช้บัส/คอมเพรสเซอร์/ปุ่มปิดเสียง/duck ใน lib/sound.js · ไฟล์ผ่าน scripts/make-music.sh แล้ว (ตัดเงียบหัวท้าย เริ่มมีเสียงทันที ท้ายไฟล์ crossfade เข้าหัวให้วนเนียน) จึงไม่ต้องรอดาวน์โหลดทั้งไฟล์ก่อนเล่น
// เริ่มโหลดตั้งแต่เปิดหน้า (ยังไม่เล่น) · แตะครั้งแรก = play() ในเหตุการณ์นั้นทันที แล้ว fade in 1.5 วินาที
// ช่วงเวลาตาม lib/daylight.js: กลางวัน+เย็น = day, กลางคืน = night เปลี่ยนช่วงแล้ว crossfade 4 วินาที · ห้ามเปลี่ยนเพลงตามอารมณ์ที่เลือก · ไม่มีไฟล์ = เงียบ ไม่ error
// เปลี่ยนเพลง: วางไฟล์ต้นฉบับใน docs/design/audio-src/ แล้วรัน scripts/make-music.sh (ดู docs/FILE-GUIDE.md)
// ระดับ/ปิดเปิด/ลดเสียงอัตโนมัติอยู่ที่ lib/sound.js (musicBus) ที่นี่ดูแลแค่การโหลด เล่น หยุด และสลับแทร็ก
import { watch } from 'vue'
import { period, startPeriodTimer } from '@/lib/daylight'
import { getMusicOutput, musicOn, onAudioLost, onAudioReady, onAudioRebuilt, onMusicEnabled } from '@/lib/sound'

export const FADE_IN_MS = 1500 // fade in หลังแตะครั้งแรก
export const CROSSFADE_MS = 4000 // สลับกลางวัน↔กลางคืน
export const DIRECT_VOLUME = 0.3 // สำรอง (เมื่อ createMediaElementSource ใช้ไม่ได้): เล่นผ่าน element.volume ตรง ๆ ระดับประมาณเทียบ MUSIC_BASE (ยังไม่ได้วัดบนอุปกรณ์จริง)
const GESTURES = ['pointerdown', 'touchend', 'keydown']

export const trackOf = (p) => (p === 'night' ? 'night' : 'day')
// ไฟล์เพลง: รู้ตอน build (import.meta.glob) ชื่อมี hash → cache ยาวได้ ไม่มีไฟล์ = null (เงียบ ไม่มีคำขอเครือข่าย)
const FILES = import.meta.glob('/src/assets/audio/music-*.mp3', { eager: true, query: '?url', import: 'default' })
export const urlOf = (track) => FILES[`/src/assets/audio/music-${track}.mp3`] ?? null

const els = new Map() // track → HTMLAudioElement ที่โหลดไว้แล้วแต่ยังไม่ต่อเข้ากราฟ (ต่อได้ครั้งเดียวต่อ element)
let current = null // { track, el, gain, direct, timer }
let started = false
let lostTrack = null // แทร็กที่กำลังเล่นตอน context ถูกระบบตัด (ไว้เล่นต่อบน context ใหม่)
let wasPlaying = false

// เริ่มดาวน์โหลดไว้ก่อน ไม่เล่น (iOS อาจไม่ preload จนกว่าจะแตะ ไม่เป็นไร ยังเล่นได้ตามปกติ)
const preload = (track) => {
  if (els.has(track) || typeof Audio === 'undefined') return els.get(track) ?? null
  const url = urlOf(track)
  if (!url) return null
  const el = new Audio()
  el.preload = 'auto'
  el.loop = true
  el.src = url
  el.load?.()
  els.set(track, el)
  return el
}

// play() ต้องเรียกในเหตุการณ์ของผู้ใช้ (ซิงก์) ถ้าเบราว์เซอร์ปฏิเสธ รอแตะครั้งถัดไปแล้วลองใหม่
let gestureArmed = false
const onGesture = () => {
  disarm()
  if (current && musicOn.value && current.el.paused) play(current)
}
function arm() {
  if (gestureArmed || typeof window === 'undefined') return
  gestureArmed = true
  for (const t of GESTURES) window.addEventListener(t, onGesture, { capture: true, passive: true })
}
function disarm() {
  if (!gestureArmed) return
  gestureArmed = false
  for (const t of GESTURES) window.removeEventListener(t, onGesture, { capture: true })
}
function play(entry) {
  try {
    entry.el.play()?.catch?.(() => arm())
  } catch {
    arm()
  }
}

const rampTo = (gain, ctx, value, ms) => {
  gain.gain.cancelScheduledValues(ctx.currentTime)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(value, ctx.currentTime + ms / 1000)
}
// สำรอง (ไม่ผ่าน Web Audio): ไล่ element.volume เอง
const rampVolume = (entry, to, ms) => {
  clearInterval(entry.timer)
  const from = entry.el.volume
  const t0 = Date.now()
  entry.timer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / Math.max(1, ms))
    entry.el.volume = from + (to - from) * k
    if (k >= 1) clearInterval(entry.timer)
  }, 50)
}

const release = (entry) => {
  clearInterval(entry.timer)
  try {
    entry.el.pause()
    entry.gain?.disconnect()
  } catch {
    /* หยุดไปแล้ว */
  }
  if (els.get(entry.track) === entry.el) els.delete(entry.track) // ต่อเข้ากราฟไปแล้ว ใช้ซ้ำไม่ได้ ครั้งหน้าสร้าง element ใหม่
}

// เริ่มแทร็ก (เรียกซิงก์ในเหตุการณ์ของผู้ใช้ได้ ไม่มี await ก่อน play)
const start = (track, fadeMs) => {
  const out = getMusicOutput()
  if (!out || !musicOn.value || current?.track === track) return
  const el = preload(track)
  if (!el) return // ไม่มีไฟล์ = เงียบ
  const { ctx, bus } = out
  const entry = { track, el, gain: null, direct: false, timer: 0 }
  try {
    const src = ctx.createMediaElementSource(el)
    entry.gain = ctx.createGain()
    entry.gain.gain.value = 0
    src.connect(entry.gain).connect(bus)
  } catch {
    entry.direct = true // ต่อเข้ากราฟไม่ได้: คุม volume เอง
    el.volume = 0
  }
  play(entry)
  if (entry.direct) rampVolume(entry, DIRECT_VOLUME, fadeMs)
  else rampTo(entry.gain, ctx, 1, fadeMs)
  const old = current
  current = entry
  if (old) {
    if (old.direct) rampVolume(old, 0, fadeMs)
    else rampTo(old.gain, ctx, 0, fadeMs)
    setTimeout(() => release(old), fadeMs + 200)
  }
}

// ผู้ใช้ปิดเพลง: เสียงลงที่บัส (sound.js) แล้วหยุดสตรีมเพื่อไม่กินเครือข่าย/แบตเตอรี่
const pauseSoon = () => {
  const entry = current
  setTimeout(() => {
    if (entry && entry === current && !musicOn.value) entry.el.pause()
  }, 600)
}
// เปิดเพลงด้วยการกดปุ่ม (มี gesture อยู่แล้ว) เรียกซิงก์จาก setMusic
const resumeNow = () => {
  if (!getMusicOutput()) return // ยังไม่แตะครั้งแรก: onAudioReady จะเริ่มให้
  if (current) {
    if (current.el.paused) play(current)
  } else start(trackOf(period.value), FADE_IN_MS)
}

// สลับแอป : ซ่อนหน้า = หยุดสตรีม (sound.js suspend context เอง) · กลับมา = play() ต่อ ถ้าถูกปฏิเสธรอแตะแล้วเล่นในเหตุการณ์นั้น
// context ถูกตัดแล้วสร้างใหม่ (resume ไม่ขึ้น): element ที่เคยต่อ MediaElementSource กับ context เก่าไปแล้ว ใช้ไม่ได้ → สร้าง element ใหม่ของแทร็กเดียวกันต่อกราฟใหม่
const rememberPlaying = () => {
  if (!current || current.el.paused) return
  wasPlaying = true
  current.el.pause()
}
const resumeIfWasPlaying = () => {
  if (!wasPlaying || !current || !musicOn.value) return
  wasPlaying = false
  play(current)
}

// เรียกครั้งเดียวตอนเริ่มแอป: เริ่มโหลดเพลงตามช่วงเวลาทันที รอ AudioContext พร้อม (หลังแตะครั้งแรก) แล้วเล่น และสลับแทร็กเมื่อช่วงเวลาเปลี่ยน
export const attachMusic = () => {
  if (started) return
  started = true
  // dev (?debug): ให้สคริปต์วัดอ่านสถานะ (แทร็กที่เล่น + ระดับบัสเพลง) playing = เสียงเริ่มเดินจริง (currentTime > 0)
  if (import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
    window.__music = () => ({
      track: current?.track ?? null,
      playing: Boolean(current && !current.el.paused && current.el.currentTime > 0),
      busGain: getMusicOutput()?.bus.gain.value ?? null,
      loaded: [...els.entries()].map(([k, e]) => [k, e.readyState]),
    })
  }
  startPeriodTimer()
  preload(trackOf(period.value))
  onAudioReady(() => start(trackOf(period.value), FADE_IN_MS))
  onMusicEnabled(resumeNow)
  watch(musicOn, (on) => {
    if (!on) pauseSoon()
  })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) rememberPlaying()
      else resumeIfWasPlaying()
    })
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', rememberPlaying)
    window.addEventListener('pageshow', resumeIfWasPlaying)
  }
  onAudioLost(() => {
    lostTrack = current?.track ?? lostTrack
    if (current) release(current)
    current = null
    wasPlaying = false
  })
  onAudioRebuilt(() => {
    const track = lostTrack
    lostTrack = null
    if (track && musicOn.value) start(track, FADE_IN_MS)
  })
  watch(period, (p) => {
    preload(trackOf(p))
    if (getMusicOutput()) start(trackOf(p), CROSSFADE_MS)
  })
}
