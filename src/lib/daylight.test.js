import { describe, it, expect } from 'vitest'
import { forcedPeriod, periodOf } from './daylight'

describe('periodOf', () => {
  it('ตัดช่วงตามเวลา: 06–16 กลางวัน, 17–18 เย็น, 19–05 กลางคืน', () => {
    expect([5, 6, 12, 16].map(periodOf)).toEqual(['night', 'day', 'day', 'day'])
    expect([17, 18].map(periodOf)).toEqual(['dusk', 'dusk'])
    expect([19, 23, 0, 3, 5].map(periodOf)).toEqual(['night', 'night', 'night', 'night', 'night'])
  })
})

describe('forcedPeriod', () => {
  it('อ่าน ?time= เฉพาะค่าที่ถูกต้อง', () => {
    expect(forcedPeriod('?time=night')).toBe('night')
    expect(forcedPeriod('?debug&time=dusk')).toBe('dusk')
    expect(forcedPeriod('?time=noon')).toBeNull()
    expect(forcedPeriod('')).toBeNull()
  })
})
