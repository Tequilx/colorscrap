// สร้างเพลงคลอชั่วคราว (placeholder) ลง public/audio/music-day.wav และ music-night.wav — เขียนไฟล์ WAV เอง ไม่ดาวน์โหลดอะไร
// เป็นคอร์ดแพดนุ่ม ๆ วนได้เนียน 24 วินาที: ทุกความถี่ถูกปัดให้เป็นจำนวนเท่าของ 1/24 Hz (ครบรอบพอดีในความยาวไฟล์)
// และซองคอร์ดเป็นหน้าต่าง cos² ที่ซ้อนกันครึ่งหนึ่งแบบวงกลม (รวมกันได้ 1 พอดี) จุดต่อท้าย→ต้นจึงต่อกันไม่สะดุด
// ใช้: node scripts/make-placeholder-music.mjs   (เปลี่ยนเป็นเพลงจริง: วางไฟล์ music-day.mp3 / music-night.mp3 ชื่อเดิมใน public/audio/ ดู docs/FILE-GUIDE.md)
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SR = 22050
const DUR = 24 // วินาที
const N = SR * DUR
const OUT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'public/audio')
mkdirSync(OUT, { recursive: true })

const NOTE = (name) => {
  const names = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const m = name.match(/^([A-G])(#|b)?(\d)$/)
  const semi = names[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12
  return 440 * 2 ** ((semi - 69) / 12)
}
// ปัดความถี่ให้ครบรอบพอดีใน DUR วินาที
const snap = (f) => Math.round(f * DUR) / DUR

const TRACKS = {
  // กลางวัน: โปร่ง สว่าง เมเจอร์ 7
  day: {
    chords: [['C3', 'G3', 'B3', 'E4'], ['A2', 'E3', 'G3', 'C4'], ['F2', 'C3', 'E3', 'A3'], ['G2', 'D3', 'F3', 'B3']],
    brightness: 0.35, // น้ำหนักฮาร์โมนิกที่ 2/3
    shimmer: 3 / DUR, // Hz ของการแกว่งความสว่างช้า ๆ (ครบรอบพอดี)
  },
  // กลางคืน: ทุ้ม มืดขึ้น ไมเนอร์/ซัส
  night: {
    chords: [['A1', 'E2', 'C3', 'G3'], ['F1', 'C2', 'A2', 'E3'], ['C2', 'G2', 'E3', 'B3'], ['E2', 'B2', 'G3', 'D4']],
    brightness: 0.12,
    shimmer: 2 / DUR,
  },
}

const render = ({ chords, brightness, shimmer }) => {
  const out = new Float32Array(N)
  const nc = chords.length
  const span = DUR / nc // ระยะห่างศูนย์กลางคอร์ด
  chords.forEach((notes, ci) => {
    const centre = ci * span
    for (let i = 0; i < N; i++) {
      const t = i / SR
      // ระยะวงกลมจากศูนย์กลางคอร์ด
      let d = Math.abs(t - centre)
      d = Math.min(d, DUR - d)
      if (d >= span) continue
      const w = Math.cos((Math.PI * d) / (2 * span)) ** 2 // หน้าต่างข้างเคียงรวมกันได้ 1
      let s = 0
      notes.forEach((nm, ni) => {
        const f = snap(NOTE(nm))
        // เสียงซ้อน 2 ตัวเพี้ยนเล็กน้อยให้เป็นแพด (ยังครบรอบพอดี: เพี้ยนเป็นจำนวนเท่าของ 1/24 Hz)
        const f2 = f + 1 / DUR
        const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * (shimmer * (1 + ni * 0.5) * t + ni / nc))
        const body = Math.sin(2 * Math.PI * f * t) + 0.7 * Math.sin(2 * Math.PI * f2 * t + 0.6)
        const over = Math.sin(2 * Math.PI * snap(f * 2) * t) * brightness * lfo + Math.sin(2 * Math.PI * snap(f * 3) * t + 1) * brightness * 0.4 * (1 - lfo)
        s += (body + over) / (1 + ni * 0.15)
      })
      out[i] += s * w
    }
  })
  // ฟุ้งเบา ๆ ด้วยลมหายใจ 1 รอบ/ไฟล์ (ครบรอบพอดี)
  for (let i = 0; i < N; i++) out[i] *= 0.88 + 0.12 * Math.sin((2 * Math.PI * i) / N)
  // ปรับระดับยอดที่ 0.7 (−3 dBFS)
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < N; i++) out[i] = (out[i] / peak) * 0.7
  return out
}

const wav = (samples) => {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2))
  return buf
}

for (const [name, spec] of Object.entries(TRACKS)) {
  const samples = render(spec)
  writeFileSync(join(OUT, `music-${name}.wav`), wav(samples))
  // ตรวจความต่อเนื่องที่รอยวน: ค่าท้าย→ต้นต้องห่างกันไม่เกินความต่างของตัวอย่างข้างเคียงทั่วไป
  const step = Math.max(...Array.from({ length: 2000 }, (_, i) => Math.abs(samples[i + 1] - samples[i])))
  const seam = Math.abs(samples[0] - samples[N - 1])
  console.log(`music-${name}.wav  ${DUR}s ${SR}Hz mono · รอยวน |ท้าย→ต้น| = ${seam.toFixed(4)} (ต่างตัวอย่างข้างเคียงสูงสุดช่วงต้น ${step.toFixed(4)})`)
}
