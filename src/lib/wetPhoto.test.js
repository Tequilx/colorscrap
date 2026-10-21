import { describe, it, expect } from 'vitest'
import { WET_MS, WET_PEAK, wetStrength } from './wetCurve'

describe('wetStrength', () => {
  it('เริ่มที่ peak ลดลงไม่เพิ่มกลับ และเป็น 0 พอดีที่ WET_MS (นิ่งใน ~3 วิ)', () => {
    expect(WET_MS).toBe(3000)
    expect(wetStrength(0)).toBeCloseTo(WET_PEAK, 5)
    let prev = Infinity
    for (let t = 0; t <= WET_MS; t += 50) {
      const s = wetStrength(t)
      expect(s).toBeLessThanOrEqual(prev + 1e-9)
      prev = s
    }
    expect(wetStrength(WET_MS)).toBe(0)
    expect(wetStrength(WET_MS + 500)).toBe(0)
  })
  it('ease-out: ช่วงแรกลดเร็วกว่าช่วงหลัง', () => {
    const early = wetStrength(0) - wetStrength(300)
    const late = wetStrength(2400) - wetStrength(2700)
    expect(early).toBeGreaterThan(late)
  })
  it('t ติดลบถือเป็น 0', () => {
    expect(wetStrength(-100)).toBeCloseTo(WET_PEAK, 5)
  })
})
