// ทดสอบการหาหน้าต่างครอปชิ้นสีของวัน (lib/cropWindow.js)
import { describe, expect, it } from 'vitest'
import { hexToOklab, hexToRgb, oklabToHex } from '@/lib/color'
import { displayGroup, colorPartFromTone, hueGroup } from '@/lib/palette'
import { bestWindow, bestWindowOf, dominantOfPixels, MIN_MATCH, pickSourceEntry, scaleWindow, targetScores } from '@/lib/cropWindow'

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

describe('targetScores / bestWindowOf (ข้อ 50i)', () => {
  const lab = hexToOklab('#C0504D') // แดง
  it('ครอบก้อนสีเป้าหมาย ไม่ไปครอบก้อนสีอื่น', () => {
    const px = make(128, 80, (x, y) => (x < 40 && y < 40 ? [60, 90, 200] : x >= 80 && y >= 40 ? [192, 80, 77] : null))
    const win = bestWindowOf(targetScores(px, 128, 80, lab), 128, 80)
    expect(win.x).toBeGreaterThanOrEqual(80)
    expect(win.y).toBeGreaterThanOrEqual(40)
    expect(win.mean).toBeGreaterThan(0.9)
  })
  it('ไม่มีสีเป้าหมายเลย: คะแนนต่ำกว่าเกณฑ์', () => {
    const px = make(128, 80, (x, y) => (x < 60 ? [60, 90, 200] : null))
    expect(bestWindowOf(targetScores(px, 128, 80, lab), 128, 80).mean).toBeLessThan(MIN_MATCH)
  })
  it('กระดาษล้วนได้ 0', () => {
    expect(bestWindowOf(targetScores(make(64, 40, () => null), 64, 40, lab), 64, 40).sum).toBe(0)
  })
})

describe('dominantOfPixels + colorPartFromTone', () => {
  it('สีจัดถ่วงน้ำหนักมากกว่าคราบจาง', () => {
    const px = make(20, 20, (x) => (x < 2 ? [200, 40, 40] : [235, 215, 215]))
    const t = dominantOfPixels(px, 20, 20)
    expect(hueGroup(oklabToHex(t.lab))).toBe('แดง')
  })
  it('ไม่มีสีเลย = null', () => {
    expect(dominantOfPixels(make(8, 8, () => null), 8, 8)).toBeNull()
  })
  it('ตัวขยายตาม L/C', () => {
    expect(colorPartFromTone('#3A2A6E', 0.3, 0.12)).toBe('ม่วงเข้ม')
    expect(colorPartFromTone('#D9C4E8', 0.85, 0.05)).toBe('ม่วงอ่อน')
    expect(colorPartFromTone('#B3A2C8', 0.7, 0.04)).toBe('ม่วงจาง')
    expect(colorPartFromTone('#5E7FC4', 0.62, 0.12)).toBe('น้ำเงิน')
  })
})

describe('displayGroup แยกแดง/ชมพู/ม่วง/ลาเวนเดอร์', () => {
  it('แดงสว่าง = ชมพู, แดงจริงยังแดง, ลาเวนเดอร์ = ม่วง, ชมพูบานเย็นเข้ม = ม่วง', () => {
    expect(displayGroup('#F4A6A6')).toBe('ชมพู')
    expect(displayGroup('#D6453A')).toBe('แดง')
    expect(displayGroup('#B7A6CF')).toBe('ม่วง')
    expect(displayGroup('#E2688A')).toBe('ชมพู')
    expect(displayGroup('#6E2C70')).toBe('ม่วง')
    expect(displayGroup('#B256C2')).toBe('ม่วง')
  })
})

describe('oklab', () => {
  it('ไป-กลับใกล้เดิม', () => {
    ;['#C0504D', '#5E7FC4', '#FBFAF6'].forEach((hex) => {
      const back = hexToRgb(oklabToHex(hexToOklab(hex)))
      hexToRgb(hex).forEach((v, i) => expect(Math.abs(v - back[i])).toBeLessThanOrEqual(1))
    })
  })
})
