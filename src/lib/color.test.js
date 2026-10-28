// ทดสอบความสว่างและสีจางของ lib/color.js
import { describe, it, expect } from 'vitest'
import { PALE_L, isPale, lightnessOf } from './color'

describe('lightnessOf / isPale', () => {
  it('ความสว่าง HSL: ขาว 1, ดำ 0, น้ำเงินสด ~0.5', () => {
    expect(lightnessOf('#ffffff')).toBe(1)
    expect(lightnessOf('#000000')).toBe(0)
    expect(lightnessOf('#0000ff')).toBeCloseTo(0.5, 5)
  })
  it('สีจางจนกลืนกระดาษ (L > 90%) = pale สีเข้มกว่าไม่ใช่', () => {
    expect(PALE_L).toBe(0.9)
    expect(isPale('#f6d7dc')).toBe(true) // ชมพูอ่อนแบบในภาพ "สีในภาพนี้"
    expect(isPale('#e6e7f0')).toBe(true)
    expect(isPale('#9AA3D6')).toBe(false)
    expect(isPale('#4256A8')).toBe(false)
  })
})
