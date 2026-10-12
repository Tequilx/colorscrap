import { colorWeightsOfDay } from '@/lib/palette'

// หยดในหลุมผสมสี: ใช้ร่วมกันระหว่างหน้าสมุด (MixingWell.vue) กับการ์ดจานสีของวันที่เก็บเป็นรูป ให้เห็นเหมือนกัน
// ตำแหน่งหยดสำหรับสีที่หนักที่สุดไปเบาที่สุด (จากดีไซน์ 5-book / 6-book-extra-leaf) พิกัดใน viewBox 200×200
export const WELL_SPOTS = [
  { x: 6, y: 24, s: 1.05 },
  { x: 52, y: 70, s: 0.85 },
  { x: 84, y: 38, s: 0.72 },
  { x: 104, y: 104, s: 0.45 },
  { x: 30, y: 100, s: 0.55 },
  { x: 110, y: 10, s: 0.4 },
]

// [{ hex, x, y, scale }] เรียงจากสีที่หนักที่สุด ขนาดตามน้ำหนักรวม: สีที่เบามากเล็กลงจากตำแหน่งมาตรฐานได้ถึง 40%
export const wellBlobs = (entries) => {
  const groups = colorWeightsOfDay(entries).slice(0, WELL_SPOTS.length)
  const max = groups[0]?.weight ?? 1
  return groups.map((g, i) => ({
    hex: g.hex,
    x: WELL_SPOTS[i].x,
    y: WELL_SPOTS[i].y,
    scale: WELL_SPOTS[i].s * (0.6 + 0.4 * (g.weight / max)),
  }))
}
