import { describe, expect, it } from 'vitest'
import { bestWindow, pickSourceEntry, scaleWindow } from '@/lib/cropWindow'

const paper = [251, 250, 246]
const make = (w, h, paint) => {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y) ?? paper
      px.set([c[0], c[1], c[2], 255], (y * w + x) * 4)
    }
  }
  return px
}

describe('bestWindow', () => {
  it('หน้าต่างครอบก้อนสีที่อยู่มุมขวาล่าง', () => {
    const px = make(128, 80, (x, y) => (x >= 80 && y >= 40 ? [200, 60, 60] : null))
    const win = bestWindow(px, 128, 80)
    expect(win.size).toBe(40)
    expect(win.x).toBe(80)
    expect(win.y).toBe(40)
  })
  it('สีน้อยบนพื้นขาว: หน้าต่างยังครอบจุดสีทั้งหมด', () => {
    const px = make(128, 80, (x, y) => (x >= 20 && x < 30 && y >= 10 && y < 20 ? [90, 120, 200] : null))
    const win = bestWindow(px, 128, 80)
    expect(win.x).toBeLessThanOrEqual(20)
    expect(win.x + win.size).toBeGreaterThanOrEqual(30)
    expect(win.y).toBeLessThanOrEqual(10)
    expect(win.y + win.size).toBeGreaterThanOrEqual(20)
  })
  it('ภาพว่างทั้งหมดไม่พัง', () => {
    expect(bestWindow(make(64, 40, () => null), 64, 40).size).toBe(20)
  })
})

describe('scaleWindow', () => {
  it('ขยายไปภาพเต็มและไม่เกินขอบ', () => {
    expect(scaleWindow({ x: 88, y: 40, size: 40 }, 128, 80, 1600, 1000)).toEqual({ x: 1100, y: 500, size: 500 })
    const w = scaleWindow({ x: 100, y: 60, size: 40 }, 128, 80, 1600, 1000)
    expect(w.x + w.size).toBeLessThanOrEqual(1600)
    expect(w.y + w.size).toBeLessThanOrEqual(1000)
  })
})

describe('pickSourceEntry', () => {
  const e = (id, t, liked) => ({ id, local_time: t, liked })
  it('ภาพที่ถูกใจอันแรกก่อน ไม่งั้นภาพล่าสุด', () => {
    expect(pickSourceEntry([e('a', '09:00'), e('b', '10:00', true), e('c', '11:00', true)]).id).toBe('b')
    expect(pickSourceEntry([e('a', '09:00'), e('c', '11:00'), e('b', '10:00')]).id).toBe('c')
    expect(pickSourceEntry([])).toBeNull()
  })
})
