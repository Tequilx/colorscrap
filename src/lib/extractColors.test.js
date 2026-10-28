// ทดสอบการเลือกสีเด่นจากภาพที่ระบาย (lib/extractColors.js)
import { describe, expect, it } from 'vitest'
import { pickColors } from '@/lib/extractColors'
import { PALETTE } from '@/lib/tokens'
import { hexToRgb } from '@/lib/color'

const px = (...list) => new Uint8ClampedArray(list.flatMap(([hex, n = 1, a = 255]) => Array.from({ length: n }, () => [...hexToRgb(hex), a]).flat()))

describe('pickColors (SPEC §6.6)', () => {
  it('ไม่มี pixel ที่ไม่ใช่กระดาษ = fallback ratio 1', () => {
    expect(pickColors(px([PALETTE.paper, 10]), ['#FF0000'], '#123456')).toEqual([{ hex: '#123456', ratio: 1 }])
  })
  it('นับ ratio ตามจำนวน pixel เรียงมากไปน้อย รวมเป็น 1', () => {
    const out = pickColors(px(['#FF0000', 3], ['#0000FF', 1], [PALETTE.paper, 20]), ['#FF0000', '#0000FF'], '#000000')
    expect(out).toEqual([{ hex: '#ff0000', ratio: 0.75 }, { hex: '#0000ff', ratio: 0.25 }])
    expect(out.reduce((s, c) => s + c.ratio, 0)).toBeCloseTo(1)
  })
  it('pixel โปร่งใสไม่นับ', () => {
    const out = pickColors(px(['#FF0000', 5, 0], ['#0000FF', 2]), ['#FF0000', '#0000FF'], '#000000')
    expect(out).toEqual([{ hex: '#0000ff', ratio: 1 }])
  })
  it('จำกัดไม่เกิน 5 สี', () => {
    const hexes = ['#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#000000', '#FFA500']
    const out = pickColors(px(...hexes.map((h, i) => [h, 10 - i])), hexes, '#111111')
    expect(out).toHaveLength(5)
  })
  it('จานว่าง = ใช้สีเฉลี่ยของส่วนที่ไม่ใช่กระดาษ', () => {
    const out = pickColors(px(['#FF0000', 2]), [], '#111111')
    expect(out).toEqual([{ hex: '#ff0000', ratio: 1 }])
  })
})
