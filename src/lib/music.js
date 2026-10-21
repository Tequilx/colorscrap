// เพลงคลอ: เล่นจาก public/audio/music-day.(mp3|wav) และ music-night.(mp3|wav) วนต่อเนื่องไม่มีช่องว่าง (AudioBufferSourceNode loop)
// ช่วงเวลาเดียวกับแสงบนโต๊ะ (lib/daylight.js): กลางวัน+เย็น = day, กลางคืน = night เปลี่ยนช่วงแล้ว crossfade 4 วินาที
// ห้ามเปลี่ยนเพลงตามอารมณ์ที่เลือก ไม่มีไฟล์ (ทั้ง mp3 และ wav) = เงียบ ไม่ error · เปลี่ยนเพลง: วางไฟล์ mp3 ชื่อเดิมทับใน public/audio/ (ดู docs/FILE-GUIDE.md)
// ระดับ/ปิดเปิด/ลดเสียงอัตโนมัติอยู่ที่ lib/sound.js (musicBus) ที่นี่ดูแลแค่การโหลด เล่น และสลับแทร็ก
import { watch } from 'vue'
import { period } from '@/lib/daylight'
import { getMusicOutput, onAudioReady } from '@/lib/sound'

export const FADE_IN_MS = 3000 // fade in หลังแตะครั้งแรก
export const CROSSFADE_MS = 4000 // สลับกลางวัน↔กลางคืน

export const trackOf = (p) => (p === 'night' ? 'night' : 'day')
// ลำดับที่ลองโหลด: mp3 ก่อน ถ้าไม่มีใช้ wav
export const candidates = (track) => [`/audio/music-${track}.mp3`, `/audio/music-${track}.wav`]

const buffers = new Map() // track → AudioBuffer | null (null = ไม่มีไฟล์)
let current = null // { track, src, gain }
let started = false

// dev server/โฮสต์แบบ SPA ตอบ index.html (200) แทน 404 เมื่อไม่มีไฟล์ → decode ล้มเหลว → ลองตัวถัดไป ไม่โยน error ออกไป
const loadBuffer = async (ctx, track) => {
  if (buffers.has(track)) return buffers.get(track)
  let buf = null
  for (const url of candidates(track)) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      buf = await ctx.decodeAudioData(await res.arrayBuffer())
      if (buf) break
    } catch {
      /* ไม่มีไฟล์/ถอดรหัสไม่ได้: ลองไฟล์ถัดไป */
    }
  }
  buffers.set(track, buf)
  return buf
}

const rampTo = (gain, ctx, value, ms) => {
  gain.gain.cancelScheduledValues(ctx.currentTime)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(value, ctx.currentTime + ms / 1000)
}

const play = async (track, fadeMs) => {
  const out = getMusicOutput()
  if (!out) return
  const { ctx, bus } = out
  const buf = await loadBuffer(ctx, track)
  if (!buf) return // เงียบ
  if (current?.track === track) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true // วนไม่มีช่องว่าง
  const gain = ctx.createGain()
  gain.gain.value = 0
  src.connect(gain).connect(bus)
  src.start()
  rampTo(gain, ctx, 1, fadeMs)
  const old = current
  current = { track, src, gain }
  if (old) {
    rampTo(old.gain, ctx, 0, fadeMs)
    setTimeout(() => {
      try {
        old.src.stop()
        old.src.disconnect()
        old.gain.disconnect()
      } catch {
        /* หยุดไปแล้ว */
      }
    }, fadeMs + 200)
  }
}

// เรียกครั้งเดียวตอนเริ่มแอป: รอ AudioContext พร้อม (หลังแตะครั้งแรก) แล้วเริ่มเพลงตามช่วงเวลา และสลับแทร็กเมื่อช่วงเวลาเปลี่ยน
export const attachMusic = () => {
  if (started) return
  started = true
  // dev (?debug): ให้สคริปต์วัดอ่านสถานะ (แทร็กที่เล่น + ระดับบัสเพลง)
  if (import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
    window.__music = () => ({ track: current?.track ?? null, busGain: getMusicOutput()?.bus.gain.value ?? null, buffers: [...buffers.entries()].map(([k, v]) => [k, Boolean(v)]) })
  }
  onAudioReady(() => play(trackOf(period.value), FADE_IN_MS))
  watch(period, (p) => {
    if (getMusicOutput()) play(trackOf(p), CROSSFADE_MS)
  })
}
