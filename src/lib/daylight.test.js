// ทดสอบช่วงเวลาของวัน ?time= และชั่วโมงที่ใช้เลือกคำทักทาย (lib/daylight.js)
import { describe, it, expect } from 'vitest'
import { forcedPeriod, greetingHour, periodOf } from './daylight'

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

describe('greetingHour (?time= มีผลกับคำทักทาย)', () => {
  it('ไม่บังคับ = เวลาจริง', () => {
    expect(greetingHour(14, null)).toBe(14)
  })
  it('บังคับช่วงที่ตรงกับเวลาจริง = ใช้เวลาจริง (คำทักทายเช้า/บ่ายยังแยกกัน)', () => {
    expect(greetingHour(14, 'day')).toBe(14)
    expect(greetingHour(21, 'night')).toBe(21)
  })
  it('บังคับช่วงอื่น = ชั่วโมงตัวแทนของช่วง', () => {
    expect(greetingHour(14, 'night')).toBe(22)
    expect(greetingHour(14, 'dusk')).toBe(17)
    expect(greetingHour(3, 'day')).toBe(9)
  })
})
