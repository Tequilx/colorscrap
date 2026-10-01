// อัลกอริทึมจานสี (SPEC §8)
// หมายเหตุ: mixColors / nameOfDay ในไฟล์นี้เป็น "ตัวแทนชั่วคราว" สำหรับช่วง C (เฉลี่ย RGB และตั้งชื่อแบบง่าย)
// ขั้นที่ 8 จะเขียนใหม่ตาม §8.1–8.2 (ผสม HSL, ตัวขยาย, กลุ่มสีรอง) พร้อม unit test
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

// สีเด่นของวัน (SPEC §7.3)
export const dominantColorOfDay = (entries) => colorWeightsOfDay(entries)[0]?.hex ?? null

// ตัวแทนชั่วคราว: เฉลี่ย RGB ถ่วงน้ำหนัก
export const mixColors = (entries) => {
  const groups = colorWeightsOfDay(entries)
  if (!groups.length) return null
  const total = groups.reduce((s, g) => s + g.weight, 0)
  const rgb = [0, 1, 2].map((i) => groups.reduce((s, g) => s + hexToRgb(g.hex)[i] * g.weight, 0) / total)
  return rgbToHex(rgb)
}

const hueOf = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return { h: 0, s: 0 }
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  const l = (max + min) / 2
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)) }
}

// กลุ่มสีจาก hue (SPEC §8.2 ข้อ 1)
export const hueGroup = (hex) => {
  const { h, s } = hueOf(hex)
  if (s < 0.15) return 'เทา'
  if (h >= 345 || h < 15) return 'แดง'
  if (h < 40) return 'ส้ม'
  if (h < 65) return 'เหลือง'
  if (h < 170) return 'เขียว'
  if (h < 215) return 'ฟ้า'
  if (h < 250) return 'น้ำเงิน'
  if (h < 290) return 'ม่วง'
  return 'ชมพู'
}

// ช่วงเวลาตามเวลาของภาพล่าสุด (SPEC §8.2 ข้อ 3)
export const periodOf = (time) => {
  const h = Number(time.slice(0, 2))
  if (h >= 5 && h < 11) return 'ยามเช้า'
  if (h >= 11 && h < 14) return 'เที่ยงวัน'
  if (h >= 14 && h < 17) return 'ยามบ่าย'
  if (h >= 17 && h < 19) return 'ยามเย็น'
  if (h >= 19) return 'ยามค่ำ'
  return 'กลางดึก'
}

// ตัวแทนชั่วคราว: กลุ่มสี + หม่น (ถ้า saturation ต่ำ) + ช่วงเวลา แบ่งเป็น 2 ส่วนสำหรับตัดบรรทัด
export const nameOfDay = (mixHex, lastTime) => {
  const { s } = hueOf(mixHex)
  const group = hueGroup(mixHex)
  const colorPart = group + (group !== 'เทา' && s < 0.33 ? 'หม่น' : '')
  const periodPart = periodOf(lastTime)
  return { colorPart, periodPart, full: colorPart + periodPart }
}

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
