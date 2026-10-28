// ทดสอบตัววัดหมึก/พื้นที่สีของผ้าใบ (src/dev/fluidMetrics.js)
import { describe, expect, it } from 'vitest'
import { colorCentroids, meanAbsDiff, measureInk } from '@/dev/fluidMetrics'

const make = (w, h, fill) => {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) px.set(fill(i % w, (i / w) | 0), i * 4)
  return px
}
const paper = [250, 250, 250]

describe('measureInk', () => {
  it('ภาพกระดาษล้วน: ทุกค่าเป็น 0', () => {
    const m = measureInk(make(10, 10, () => [250, 250, 250, 255]), { width: 10, height: 10, paper, full: 100, center: { x: 0.5, y: 0.5 }, radius: 3 })
    expect(m).toMatchObject({ near: 0, peak: 0, total: 0, areaVisible: 0, areaStrong: 0 })
  })

  it('สีเต็มแรงครึ่งหนึ่งของผ้าใบ: area 0.5 และ ink = 1', () => {
    // ระยะจากกระดาษ = 100 (ลดทุกช่อง 57.7) → ink = 1 เมื่อ full = 100
    const d = 100 / Math.sqrt(3)
    const px = make(10, 10, (x) => (x < 5 ? [250 - d, 250 - d, 250 - d, 255] : [250, 250, 250, 255]))
    const m = measureInk(px, { width: 10, height: 10, paper, full: 100, center: { x: 0.25, y: 0.5 }, radius: 2 })
    expect(m.areaVisible).toBeCloseTo(0.5)
    expect(m.areaStrong).toBeCloseTo(0.5)
    expect(m.peak).toBeCloseTo(1, 2)
    expect(m.near).toBeCloseTo(1, 2)
    expect(m.total).toBeCloseTo(0.5, 2)
  })

  it('รัศมีเฉลี่ยเฉพาะรอบจุดที่ระบุ: จุดอยู่ฝั่งว่าง = 0', () => {
    const d = 100 / Math.sqrt(3)
    const px = make(10, 10, (x) => (x < 5 ? [250 - d, 250 - d, 250 - d, 255] : [250, 250, 250, 255]))
    const m = measureInk(px, { width: 10, height: 10, paper, full: 100, center: { x: 0.85, y: 0.5 }, radius: 1.5 })
    expect(m.near).toBe(0)
  })
})

describe('meanAbsDiff', () => {
  it('ภาพเหมือนกัน = 0 และต่างกัน 10 ทุกช่องสี = 10', () => {
    const a = make(4, 4, () => [100, 100, 100, 255])
    const b = make(4, 4, () => [110, 90, 100, 255])
    expect(meanAbsDiff(a, a)).toBe(0)
    expect(meanAbsDiff(a, b)).toBeCloseTo(20 / 3, 5)
  })
})

describe('colorCentroids', () => {
  it('จัดพิกเซลเข้าสีที่ทิศใกล้ที่สุดแล้วคืนตำแหน่งกึ่งกลางของแต่ละสี', () => {
    const red = [200, 50, 50]
    const blue = [50, 50, 200]
    // ซ้ายสีแดง (x < 4) ขวาสีน้ำเงิน (x ≥ 8) ตรงกลางเป็นกระดาษ
    const px = make(12, 4, (x) => (x < 4 ? [...red, 255] : x >= 8 ? [...blue, 255] : [250, 250, 250, 255]))
    const [r, b] = colorCentroids(px, { width: 12, height: 4, paper, colors: [red, blue], full: [200] })
    expect(r.n).toBe(16)
    expect(b.n).toBe(16)
    expect(r.x).toBeCloseTo(1.5 / 12, 5)
    expect(b.x).toBeCloseTo(9.5 / 12, 5)
  })
})
