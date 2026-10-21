// เรขาคณิตของแถบสีของวัน (components/book/DayRibbon.vue) ฟังก์ชันล้วน ทดสอบได้
// 1 ภาพ = 1 ช่วง เรียงตามเวลาจากซ้ายไปขวา (ตามลำดับ ไม่ใช่แกน 24 ชม.) ความกว้างช่วง ∝ น้ำหนักภาพ (palette.js entryWeight)
import { EMOTION_BY_KEY, WARM_TONES, emotionLabel } from '@/lib/emotions'
import { entryWeight, rankedColors } from '@/lib/palette'
import { hexToRgb } from '@/lib/color'

const FAR_FROM_TONE = 70 // ระยะ RGB ที่ถือว่า "ไม่ใช่สีแต้มแสง"
const colorDistance = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

export const BLEND_FRAC = 0.035 // รอยต่อซึมเข้าหากัน ~3.5% ของความกว้างทั้งแถบ
export const LABEL_FULL_MIN = 90 // ช่วงแคบกว่านี้แสดงแค่เวลา
export const LABEL_NONE_MIN = 50 // ช่วงแคบกว่านี้ไม่มีป้าย
export const LABEL_GAP = 6 // ระยะห่างขั้นต่ำระหว่างป้ายข้างเคียง (px)
export const TIME_BOX = 66 // ไอคอน + HH:MM (px ประมาณที่ 14px)
export const CHAR_W = 9 // ความกว้างตัวอักษรไทยต่อ 1 ตัวที่ 16px (ประมาณ)

export const sortedByTime = (entries) => [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))

// ไอคอนช่วงเวลา: 06:00–18:59 ดวงอาทิตย์ ที่เหลือพระจันทร์
export const timeIcon = (time) => {
  const h = Number(time.slice(0, 2))
  return h >= 6 && h < 19 ? 'sun' : 'moon'
}

// ข้อความบรรทัดที่ 2 ของป้าย: "เหนื่อย → มีแสงขึ้น" (ภาพที่ปรับด้วยแต้มแสงต่อท้าย "→ มีแสงขึ้น")
export const ribbonCaption = (entry) => `${emotionLabel(entry)}${entry.shifted ? ' → มีแสงขึ้น' : ''}`

// สีของช่วง: สีหลักของภาพ (rankedColors: สัดส่วน × ความอิ่มสี ไม่เอาสีใกล้กระดาษเพราะ extractColors ตัดออกแล้ว) ภาพที่ shifted ไล่ไปสีแต้มแสงของอารมณ์นั้น
export const segmentColors = (entry) => {
  const ranked = rankedColors(entry.colors)
  if (!entry.shifted) return { main: ranked[0].hex, to: null }
  const tone = WARM_TONES[entry.emotion] ?? WARM_TONES[entry.emotions?.[0]] ?? null
  // ภาพที่แต้มแสง: สีแต้มแสงเองมักเป็นสีสด/เด่นอยู่ใน colors แล้ว ถ้าเอามาเป็นสีหลักแถบจะไม่ไล่ (เหลือง→เหลือง) จึงเลือกสีเด่นที่ห่างจากสีแต้มแสงก่อน
  const base = tone ? ranked.find((c) => colorDistance(c.hex, tone) > FAR_FROM_TONE) : null
  return { main: (base ?? ranked[0]).hex, to: tone }
}

// ช่วงทั้งหมดของแถบกว้าง width: [{ entry, id, x, w, cx, time, icon, caption, main, to, level, box }]
// level ของป้าย: 2 = เวลา + อารมณ์, 1 = เวลาอย่างเดียว, 0 = ไม่มีป้าย box = ช่วง x ของป้าย [x0, x1] (ว่าง ถ้า level 0)
export const layoutRibbon = (entries, width, { measure } = {}) => {
  const list = sortedByTime(entries)
  const total = list.reduce((s, e) => s + entryWeight(e), 0) || 1
  let x = 0
  const segs = list.map((entry) => {
    const w = (width * entryWeight(entry)) / total
    const seg = { entry, id: entry.id, x, w, cx: x + w / 2, time: entry.local_time, icon: timeIcon(entry.local_time), caption: ribbonCaption(entry), ...segmentColors(entry), level: 0, box: null }
    x += w
    return seg
  })
  const boxWidth = measure ?? ((seg, level) => (level === 2 ? Math.max(TIME_BOX, seg.caption.length * CHAR_W) : TIME_BOX))
  const wanted = (seg) => (seg.w >= LABEL_FULL_MIN ? 2 : seg.w >= LABEL_NONE_MIN ? 1 : 0)
  // ตัดสินจากขวาไปซ้าย: ช่วงล่าสุดได้ป้ายก่อน ถ้าทับกับป้ายที่ได้ไปแล้วลดระดับลงจนไม่ทับ (ไม่ทับกันทุกกรณี)
  const taken = []
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i]
    for (let level = wanted(seg); level > 0; level--) {
      const half = boxWidth(seg, level) / 2
      const box = [seg.cx - half, seg.cx + half]
      if (taken.every(([a, b]) => box[1] + LABEL_GAP <= a || box[0] >= b + LABEL_GAP)) {
        seg.level = level
        seg.box = box
        taken.push(box)
        break
      }
    }
  }
  return segs
}

// ขอบนำสั่นแบบรอยพู่กัน: ค่าเยื้อง x ของแต่ละจุดตามความสูง (px) ผลคงที่ (ไม่สุ่มใหม่ทุกครั้ง) ใช้กับ clip-path polygon
export const jaggedOffsets = (teeth = 14, amp = 7) =>
  Array.from({ length: teeth + 1 }, (_, i) => Math.round((Math.sin(i * 2.1) * 0.55 + Math.sin(i * 5.3 + 1) * 0.45) * amp * 10) / 10)

// polygon() ที่คลุมทุกอย่างทางซ้ายของ x (ขอบขวาสั่นตาม offsets) สูง h
export const sweepPolygon = (x, h, offsets) => {
  const n = offsets.length - 1
  const pts = ['0px -20px']
  offsets.forEach((dx, i) => pts.push(`${(x + dx).toFixed(1)}px ${(-20 + ((h + 40) * i) / n).toFixed(1)}px`))
  pts.push(`0px ${h + 20}px`)
  return `polygon(${pts.join(', ')})`
}

export { EMOTION_BY_KEY }
