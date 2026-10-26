// อัลกอริทึมจานสี (SPEC §8)
import { hexToRgb, rgbToHex } from '@/lib/color'

// น้ำหนักต่อภาพ (SPEC §8.1)
export const entryWeight = (entry) => 0.75 + 0.25 * entry.intensity

const near = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 40
}

// น้ำหนักรวม ratio × w ของแต่ละสีทั้งวัน เรียงมากไปน้อย (เท่ากันใช้สีของภาพล่าสุด)
// สีที่ใกล้กันมาก (ระยะ RGB < 40) รวมเป็นกลุ่มเดียว ใช้สีที่หนักที่สุดในกลุ่มเป็นตัวแทน
export const colorWeightsOfDay = (entries) => {
  const sorted = [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))
  const groups = [] // { hex, weight, top, last }
  sorted.forEach((entry, order) => {
    const w = entryWeight(entry)
    for (const c of entry.colors) {
      const g = groups.find((x) => near(x.hex, c.hex))
      if (g) {
        if (c.ratio * w > g.top) {
          g.hex = c.hex
          g.top = c.ratio * w
        }
        g.weight += c.ratio * w
        g.last = order
      } else {
        groups.push({ hex: c.hex, weight: c.ratio * w, top: c.ratio * w, last: order })
      }
    }
  })
  return groups.sort((a, b) => b.weight - a.weight || b.last - a.last)
}

// ความอิ่มสี (HSV 0..1): สีจางของน้ำซึมและสีเทาได้ค่าต่ำ ต่างจาก HSL ที่สีซีดมาก ๆ ยังได้ค่าสูง
export const saturationOf = (hex) => {
  const [r, g, b] = hexToRgb(hex)
  const max = Math.max(r, g, b)
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max
}

// คะแนนความเด่นของสี = น้ำหนัก × saturation (บวกค่าเล็กน้อยไว้ให้สีเทาล้วนยังเรียงตามน้ำหนักได้)
// เพื่อไม่ให้สีจางของน้ำซึมซึ่งกินพื้นที่มากชนะสีของหยดจริง ใช้กับสีเด่นเท่านั้น ส่วนชาร์ตสีแสดงตาม ratio จริง
const prominence = (hex, weight) => weight * (saturationOf(hex) + 0.01)

// สีของภาพเรียงตามความเด่น (ใช้เลือกสีหยดบนเส้นเวลา) ไม่แก้ลำดับของ entry.colors
export const rankedColors = (colors) =>
  [...colors].sort((a, b) => prominence(b.hex, b.ratio) - prominence(a.hex, a.ratio))

// สีเด่นของวัน (SPEC §7.3) เลือกจาก น้ำหนัก × saturation เท่ากันใช้สีของภาพล่าสุด
export const dominantColorOfDay = (entries) => {
  const groups = colorWeightsOfDay(entries)
  if (!groups.length) return null
  return groups.reduce((best, g) => {
    const diff = prominence(g.hex, g.weight) - prominence(best.hex, best.weight)
    return diff > 1e-9 || (Math.abs(diff) <= 1e-9 && g.last > best.last) ? g : best
  }).hex
}

// HSL ของสี: h 0..360, s/l 0..1 (hue ของสีเทาล้วนเป็น 0)
const toHsl = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  if (d === 0) return { h: 0, s: 0, l }
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)), l }
}

const fromHsl = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l - (c / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255))
}

// สีที่ saturation ไม่เกินนี้ไม่นับตอนหา hue (SPEC §8.1)
const HUE_MIN_SAT = 0.15

// น้ำหนัก ratio × w ของทุกสีในทุกภาพ ไม่รวมสีใกล้กัน (ใช้กับสูตรผสมและกลุ่มสีรอง)
const flatColors = (entries) =>
  entries.flatMap((e) => e.colors.map((c) => ({ ...c, weight: c.ratio * entryWeight(e), time: e.local_time })))

// สีผสมของวัน (SPEC §8.1): ผสมใน HSL, hue เป็น circular mean ถ่วงน้ำหนัก, s/l เป็นค่าเฉลี่ยถ่วงน้ำหนัก
export const mixColors = (entries) => {
  const list = flatColors(entries)
  const total = list.reduce((sum, c) => sum + c.weight, 0)
  if (!total) return null
  let sumS = 0
  let sumL = 0
  let x = 0
  let y = 0
  for (const c of list) {
    const { h, s, l } = toHsl(c.hex)
    sumS += s * c.weight
    sumL += l * c.weight
    if (s > HUE_MIN_SAT) {
      x += Math.cos((h * Math.PI) / 180) * c.weight
      y += Math.sin((h * Math.PI) / 180) * c.weight
    }
  }
  const hue = x === 0 && y === 0 ? 0 : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return fromHsl(hue, sumS / total, sumL / total)
}

// กลุ่มสีจาก hue (SPEC §8.2 ข้อ 1)
export const hueGroup = (hex) => {
  const { h, s } = toHsl(hex)
  if (s < HUE_MIN_SAT) return 'เทา'
  if (h >= 345 || h < 15) return 'แดง'
  if (h < 40) return 'ส้ม'
  if (h < 65) return 'เหลือง'
  if (h < 170) return 'เขียว'
  if (h < 215) return 'ฟ้า'
  if (h < 250) return 'น้ำเงิน'
  if (h < 290) return 'ม่วง'
  return 'ชมพู'
}

// ช่วงเวลาตามเวลาของภาพล่าสุด (SPEC §8.2 ข้อ 3) ครอบคลุม 00:00–24:00
export const periodOf = (time) => {
  const h = Number(time.slice(0, 2))
  if (h >= 5 && h < 11) return 'ยามเช้า'
  if (h >= 11 && h < 14) return 'เที่ยงวัน'
  if (h >= 14 && h < 17) return 'ยามบ่าย'
  if (h >= 17 && h < 19) return 'ยามเย็น'
  if (h >= 19) return 'ยามค่ำ'
  return 'กลางดึก'
}

// กลุ่มสีรอง (SPEC §8.2 ข้อ 2): รวมน้ำหนักต่อกลุ่ม ไม่นับกลุ่มของสีหลักและ "เทา" เสมอกันใช้กลุ่มของภาพล่าสุด
const secondaryGroup = (mainGroup, entries) => {
  const groups = new Map() // กลุ่ม → { weight, time }
  for (const c of flatColors(entries)) {
    const g = hueGroup(c.hex)
    if (g === mainGroup || g === 'เทา') continue
    const cur = groups.get(g) ?? { weight: 0, time: '' }
    cur.weight += c.weight
    if (c.time >= cur.time) cur.time = c.time
    groups.set(g, cur)
  }
  let best = null
  for (const [g, v] of groups) {
    if (!best || v.weight > best.weight + 1e-9 || (Math.abs(v.weight - best.weight) <= 1e-9 && v.time >= best.time)) best = { g, ...v }
  }
  return best?.g ?? null
}

// ตัวขยาย: ใช้ข้อแรกที่ตรง (SPEC §8.2 ข้อ 2)
const modifierOf = (hex, entries) => {
  const { s, l } = toHsl(hex)
  const second = secondaryGroup(hueGroup(hex), entries)
  if (second) return 'อม' + second
  if (s >= HUE_MIN_SAT && s < 0.33) return 'หม่น'
  if ((s >= 0.33 && s < 0.45 && l <= 0.72) || l < 0.5) return 'ครึ้ม' // สีสว่างมากที่ซีดไม่เรียกครึ้ม (ลาเวนเดอร์ = ม่วงอ่อน)
  if (l > 0.72) return 'อ่อน'
  if (s > 0.6) return 'สด'
  return ''
}

// กลุ่มสีที่ใช้เรียกจริง (ข้อ 50i) แยกช่วงแดง/ชมพู/ม่วงให้ตรงกับที่ตาเห็น โดย hueGroup (ตาม SPEC §8.2 และเทสต์) ไม่เปลี่ยน:
//   แดงที่สว่างมาก (L ≥ 0.72: สีที่คนเรียกว่าชมพู ไม่ใช่แดง) → ชมพู · ชมพู hue < 310° ที่ไม่สว่าง (L < 0.6: กล้วยไม้/ม่วงบานเย็น) → ม่วง
export const displayGroup = (hex) => {
  const g = hueGroup(hex)
  const { h, l } = toHsl(hex)
  if (g === 'แดง' && l >= 0.72) return 'ชมพู'
  if (g === 'ชมพู' && h < 310 && l < 0.6) return 'ม่วง'
  return g
}

// ชื่อสีของวัน: กลุ่มสี + ตัวขยาย + ช่วงเวลา (SPEC §8.2) แบ่ง 2 ส่วนสำหรับตัดบรรทัด
// entries (ภาพของวัน) ใช้หากลุ่มสีรอง ถ้าไม่ส่งมาจะไม่มี "อม..."
export const nameOfDay = (mixHex, lastLocalTime, entries = []) => {
  const colorPart = displayGroup(mixHex) + modifierOf(mixHex, entries)
  const periodPart = periodOf(lastLocalTime)
  return { colorPart, periodPart, full: colorPart + periodPart }
}

// ชื่อสีจากชิ้นที่ครอป (ข้อ 50i ทาง fallback): กลุ่มสีตาม hue ของสีตัวแทน + ตัวขยายตาม L/C ใน OKLab: เข้ม (L < 0.45) · อ่อน (L > 0.80) · จาง (chroma < 0.06) · ไม่เข้าข้อไหนไม่มีตัวขยาย
export const TONE_DARK_L = 0.45
export const TONE_LIGHT_L = 0.8
export const TONE_PALE_C = 0.06
export const colorPartFromTone = (hex, L, C) => {
  const mod = L < TONE_DARK_L ? 'เข้ม' : L > TONE_LIGHT_L ? 'อ่อน' : C < TONE_PALE_C ? 'จาง' : ''
  return displayGroup(hex) + mod
}

// ชื่อสีของวันที่ตรงกับชิ้นที่แสดง: ทางหลักใช้ชื่อเดิม ทาง fallback เปลี่ยนส่วนสี (ส่วนช่วงเวลาเหมือนเดิม)
export const nameForCrop = (name, crop) => (crop?.via === 'fallback' && crop.colorPart ? { ...name, colorPart: crop.colorPart, full: crop.colorPart + name.periodPart } : name)

// สีผสมและชื่อของวัน จากค่าผสมตัวเดียวกัน (ชื่อต้องตรงกับสีที่แสดงเสมอ) ไม่มีภาพ = null
export const dayColor = (entries) => {
  const mix = mixColors(entries)
  if (!mix) return null
  const lastTime = entries.reduce((t, e) => (e.local_time > t ? e.local_time : t), '')
  return { mix, name: nameOfDay(mix, lastTime, entries) }
}

// เทียบชื่อสีเฉพาะส่วนสี (กลุ่มสี + ตัวขยาย) ไม่นับช่วงเวลา ใช้ตัดสินว่า "สีของวันนี้ยังคงเดิม" (a, b = ผลของ dayColor)
export const sameColorName = (a, b) => Boolean(a && b) && a.name.colorPart === b.name.colorPart

// เส้นเวลา 00:00–24:00 ในกรอบ SVG กว้าง 412: เว้นขอบซ้ายขวา 18 ให้หยดและป้ายเวลาไม่ถูกตัด (SPEC §8.3)
export const TIMELINE_LEFT = 18
export const TIMELINE_WIDTH = 376

// ตำแหน่ง x บนเส้นเวลา
export const timelineX = (localTime) => {
  const [h, m] = localTime.split(':').map(Number)
  return TIMELINE_LEFT + Math.min(1, Math.max(0, (h + m / 60) / 24)) * TIMELINE_WIDTH
}

// เลื่อนหยดที่ใกล้กันเกินไปออกจากกันเล็กน้อย ไม่ให้ทับกันสนิท (ห่างอย่างน้อย minGap)
// รับ x ที่เรียงจากน้อยไปมาก คืน x ใหม่ในลำดับเดิม และยังอยู่ในกรอบเส้นเวลา
export const spreadXs = (xs, minGap = 14) => {
  const out = [...xs]
  const hi = TIMELINE_LEFT + TIMELINE_WIDTH
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + minGap)
  // ถ้าดันเกินขอบขวา เลื่อนกลับทางซ้ายทีละตัว
  if (out.length) out[out.length - 1] = Math.min(out[out.length - 1], hi)
  for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - minGap)
  return out
}

// แบ่งเป็นชุดละ n
export const chunk = (list, n) => {
  const out = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

// เปอร์เซ็นต์ของแต่ละสีในภาพ เป็นจำนวนเต็มที่รวมกันได้ 100 พอดี (ปัดแบบ largest remainder)
export const percentsOf = (colors) => {
  const total = colors.reduce((s, c) => s + c.ratio, 0) || 1
  const raw = colors.map((c) => (c.ratio / total) * 100)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((s, v) => s + v, 0)
  raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (left-- > 0) out[i] += 1
    })
  return out
}
