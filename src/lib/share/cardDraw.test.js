import { describe, it, expect } from 'vitest'
import { fitLines } from '@/lib/share/cardDraw'

// ctx จำลอง: ความกว้างตัวอักษรละ 0.5em ตามขนาดฟอนต์ที่ตั้งไว้ล่าสุด (font = "<weight> <size>px ...")
const fakeCtx = () => {
  let size = 10
  return {
    save() {},
    restore() {},
    set font(f) { size = Number(/(\d+(?:\.\d+)?)px/.exec(f)[1]) },
    measureText: (t) => ({ width: Array.from(t).length * size * 0.5 }),
  }
}
const widthOf = (t, size) => Array.from(t).length * size * 0.5

describe('fitLines (ข้อความการ์ดห้ามล้น)', () => {
  it('พอดีอยู่แล้ว → ไม่ย่อ ไม่ตัดบรรทัด', () => {
    expect(fitLines(fakeCtx(), 'สั้น ๆ', 500, { size: 26 })).toEqual({ size: 26, lines: ['สั้น ๆ'] })
  })
  it('ยาวเกินเล็กน้อย → ย่อลง แต่ไม่ต่ำกว่า 70% ของขนาดตั้งต้น', () => {
    const text = 'x'.repeat(30) // ที่ 26px = 390 กว้าง; 70% = 18px → 270
    const r = fitLines(fakeCtx(), text, 300, { size: 26 })
    expect(r.lines).toEqual([text])
    expect(r.size).toBeGreaterThanOrEqual(Math.floor(26 * 0.7))
    expect(widthOf(text, r.size)).toBeLessThanOrEqual(300)
  })
  it('ยาวจนย่อ 70% ก็ไม่พอ → ตัดบรรทัด ไม่เกิน maxLines และทุกบรรทัดไม่กว้างเกิน', () => {
    const text = 'aaaa bbbb cccc dddd eeee ffff gggg hhhh'
    const r = fitLines(fakeCtx(), text, 120, { size: 20, maxLines: 2 })
    expect(r.size).toBe(14)
    expect(r.lines.length).toBeLessThanOrEqual(2)
    for (const l of r.lines) expect(widthOf(l, r.size)).toBeLessThanOrEqual(120)
  })
  it('ยาวเกินแม้ตัดบรรทัดแล้ว → ตัดท้ายด้วย … ห้ามล้น', () => {
    const text = 'x'.repeat(200)
    const r = fitLines(fakeCtx(), text, 100, { size: 20, maxLines: 2 })
    expect(r.lines.length).toBeLessThanOrEqual(2)
    expect(r.lines.at(-1).endsWith('…')).toBe(true)
    for (const l of r.lines) expect(widthOf(l, r.size)).toBeLessThanOrEqual(100)
  })
  it('maxLines = 1 → บรรทัดเดียวเสมอ (ตัดด้วย …)', () => {
    const r = fitLines(fakeCtx(), 'y'.repeat(80), 100, { size: 20 })
    expect(r.lines).toHaveLength(1)
    expect(widthOf(r.lines[0], r.size)).toBeLessThanOrEqual(100)
  })
})
