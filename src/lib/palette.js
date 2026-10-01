// อัลกอริทึมจานสี (SPEC §8) — ตอนนี้มีเฉพาะ dominantColorOfDay
// mixColors / nameOfDay / timelineX จะทำจริงในขั้นที่ 8
import { hexToRgb } from '@/lib/color'

// น้ำหนักต่อภาพ (SPEC §8.1)
export const entryWeight = (entry) => 0.75 + 0.25 * entry.intensity

const near = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 40
}

// สีเด่นของวัน (SPEC §7.3): สีที่น้ำหนักรวม ratio × w สูงสุด
// สีที่ใกล้กันมาก (ระยะ RGB < 40) รวมเป็นกลุ่มเดียวก่อน เท่ากันใช้สีของภาพล่าสุด
export const dominantColorOfDay = (entries) => {
  if (!entries.length) return null
  const sorted = [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))
  const groups = [] // { hex, weight, last }
  sorted.forEach((entry, order) => {
    const w = entryWeight(entry)
    for (const c of entry.colors) {
      const g = groups.find((x) => near(x.hex, c.hex))
      if (g) {
        // ใช้สีที่หนักที่สุดในกลุ่มเป็นตัวแทน
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
  groups.sort((a, b) => b.weight - a.weight || b.last - a.last)
  return groups[0].hex
}
