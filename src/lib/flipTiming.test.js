// ทดสอบจังหวะการพลิกหน้า (lib/flipTiming.js)
import { describe, it, expect } from 'vitest'
import { TURN_EASING, easingCss, progressAt, timeAtProgress } from './flipTiming'

describe('flipTiming', () => {
  it('ปลายทางตรงกัน: เวลา 0/1 → ความคืบหน้า 0/1', () => {
    expect(progressAt(0)).toBeCloseTo(0, 6)
    expect(progressAt(1)).toBeCloseTo(1, 6)
    expect(timeAtProgress(0)).toBeCloseTo(0, 6)
    expect(timeAtProgress(1)).toBeCloseTo(1, 6)
  })
  it('timeAtProgress เป็นฟังก์ชันผกผันของ progressAt', () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) expect(progressAt(timeAtProgress(p))).toBeCloseTo(p, 4)
  })
  it('มุม 90° (ครึ่งทาง) เกิดก่อนครึ่งเวลา: easing เร่งต้น (ease-in-out ที่ช่วงแรกเร็วกว่า)', () => {
    const half = timeAtProgress(0.5)
    expect(half).toBeGreaterThan(0.3)
    expect(half).toBeLessThan(0.6)
  })
  it('easingCss ตรงกับค่าคงที่', () => {
    expect(easingCss()).toBe('cubic-bezier(0.45, 0, 0.25, 1)')
    expect(TURN_EASING).toHaveLength(4)
  })
})
