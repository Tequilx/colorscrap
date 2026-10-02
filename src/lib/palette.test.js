import { describe, expect, it } from 'vitest'
import {
  chunk,
  dominantColorOfDay,
  hueGroup,
  mixColors,
  nameOfDay,
  percentsOf,
  periodOf,
  rankedColors,
  spreadXs,
  timelineX,
} from '@/lib/palette'

// fixture ตาม SPEC §8.2: ทุกภาพมีสีเดียว ratio = 1 intensity 1 ยกเว้นระบุไว้
const CALM = '#5FA3C8'
const TIRED = '#5B6773'
const HAPPY = '#F1BE48'
const EXCITED = '#E2688A'

const e = (local_time, hex, extra = {}) => ({ local_time, intensity: 1, colors: [{ hex, ratio: 1 }], ...extra })
const last = (list) => list.reduce((a, b) => (b.local_time > a.local_time ? b : a)).local_time
const nameOf = (list) => nameOfDay(mixColors(list), last(list), list).full

describe('mixColors (SPEC §8.1)', () => {
  it('calm + tired = #5788A3', () => {
    expect(mixColors([e('09:12', CALM), e('13:40', TIRED)]).toUpperCase()).toBe('#5788A3')
  })
  it('calm + tired + calm = #5892B1', () => {
    expect(mixColors([e('09:12', CALM), e('13:40', TIRED), e('15:12', CALM)]).toUpperCase()).toBe('#5892B1')
  })
  it('ภาพเดียวหลายสี hue ถ่วงด้วย ratio = #55D9C1', () => {
    const entry = { local_time: '10:00', intensity: 1, colors: [{ hex: CALM, ratio: 0.6 }, { hex: HAPPY, ratio: 0.4 }] }
    expect(mixColors([entry]).toUpperCase()).toBe('#55D9C1')
  })
  it('hue เป็นค่าเฉลี่ยวงกลม: แดงสองฝั่ง 0° ได้แดง ไม่ใช่เขียว', () => {
    const mix = mixColors([e('08:00', '#FF1A00'), e('09:00', '#FF001A')])
    expect(hueGroup(mix)).toBe('แดง')
  })
  it('intensity สูงมีน้ำหนักมากกว่า', () => {
    const low = mixColors([e('08:00', CALM, { intensity: 0 }), e('09:00', HAPPY, { intensity: 0 })])
    const high = mixColors([e('08:00', CALM, { intensity: 0 }), e('09:00', HAPPY, { intensity: 4 })])
    expect(hueGroup(low)).not.toBe(hueGroup(high))
    expect(hueGroup(high)).toBe('เหลือง')
  })
  it('ไม่มีภาพ = null', () => {
    expect(mixColors([])).toBeNull()
  })
})

describe('nameOfDay (SPEC §8.2)', () => {
  it('09:12 calm, 13:40 tired = ฟ้าหม่นเที่ยงวัน', () => {
    expect(nameOf([e('09:12', CALM), e('13:40', TIRED)])).toBe('ฟ้าหม่นเที่ยงวัน')
  })
  it('เพิ่ม 15:12 calm = ฟ้าครึ้มยามบ่าย', () => {
    expect(nameOf([e('09:12', CALM), e('13:40', TIRED), e('15:12', CALM)])).toBe('ฟ้าครึ้มยามบ่าย')
  })

  const base = [e('09:00', CALM), e('10:00', CALM), e('18:45', CALM), e('11:05', HAPPY), e('16:30', EXCITED)]
  it('ไม่ใช้สีอุ่น (tired ไม่ปรับโทน) = ฟ้าอมชมพูยามเย็น', () => {
    expect(nameOf([...base, e('14:00', TIRED)])).toBe('ฟ้าอมชมพูยามเย็น')
  })
  it('ใช้สีอุ่น (tired ปรับโทน) = ฟ้าอมเหลืองยามเย็น', () => {
    const shifted = { local_time: '14:00', intensity: 1, colors: [{ hex: TIRED, ratio: 0.7 }, { hex: '#F7DE99', ratio: 0.3 }] }
    expect(nameOf([...base, shifted])).toBe('ฟ้าอมเหลืองยามเย็น')
  })
  it('ไม่ส่ง entries = ไม่มีกลุ่มสีรอง', () => {
    expect(nameOfDay('#5788A3', '13:40').full).toBe('ฟ้าหม่นเที่ยงวัน')
  })
  it('saturation < 0.15 = เทา', () => {
    expect(nameOfDay('#808080', '09:00').colorPart).toBe('เทา')
  })
  it('แบ่งเป็นส่วนสีกับส่วนเวลา', () => {
    expect(nameOfDay('#5788A3', '13:40')).toMatchObject({ colorPart: 'ฟ้าหม่น', periodPart: 'เที่ยงวัน' })
  })
})

describe('hueGroup / periodOf', () => {
  it('ขอบ hue ตามตาราง', () => {
    expect(hueGroup('#FF0000')).toBe('แดง')
    expect(hueGroup('#FF8000')).toBe('ส้ม')
    expect(hueGroup('#FFFF00')).toBe('เหลือง')
    expect(hueGroup('#00FF00')).toBe('เขียว')
    expect(hueGroup('#00FFFF')).toBe('ฟ้า')
    expect(hueGroup('#0000FF')).toBe('น้ำเงิน')
    expect(hueGroup('#8000FF')).toBe('ม่วง')
    expect(hueGroup('#FF00FF')).toBe('ชมพู')
  })
  it('ช่วงเวลาครอบคลุม 00:00–24:00', () => {
    const cases = { '00:00': 'กลางดึก', '04:59': 'กลางดึก', '05:00': 'ยามเช้า', '10:59': 'ยามเช้า', '11:00': 'เที่ยงวัน', '14:00': 'ยามบ่าย', '17:00': 'ยามเย็น', '19:00': 'ยามค่ำ', '23:59': 'ยามค่ำ' }
    for (const [t, name] of Object.entries(cases)) expect(periodOf(t)).toBe(name)
  })
})

describe('timelineX / spreadXs (SPEC §8.3)', () => {
  it('timelineX', () => {
    expect(timelineX('00:00')).toBe(18)
    expect(timelineX('12:00')).toBe(206)
    expect(timelineX('24:00')).toBe(394)
  })
  it('spreadXs ดันไปทางขวาให้ห่างอย่างน้อย minGap', () => {
    expect(spreadXs([100, 102, 104])).toEqual([100, 114, 128])
  })
  it('spreadXs ล้นขอบขวาเลื่อนกลับทางซ้าย ลำดับเดิม', () => {
    const out = spreadXs([380, 390, 394])
    expect(out).toEqual([366, 380, 394])
  })
  it('spreadXs ที่ห่างพออยู่แล้วไม่ขยับ', () => {
    expect(spreadXs([20, 100, 300])).toEqual([20, 100, 300])
  })
})

describe('percentsOf', () => {
  it('รวมกันได้ 100 พอดี', () => {
    const p = percentsOf([{ ratio: 1 }, { ratio: 1 }, { ratio: 1 }])
    expect(p.reduce((a, b) => a + b, 0)).toBe(100)
    expect(p).toEqual([34, 33, 33])
  })
  it('ไม่ต้องรวม ratio = 1', () => {
    expect(percentsOf([{ ratio: 0.6 }, { ratio: 0.2 }])).toEqual([75, 25])
  })
})

describe('rankedColors / dominantColorOfDay', () => {
  const pale = { hex: '#E8ECEF', ratio: 0.7 } // จางมาก ครอบพื้นที่มาก
  const real = { hex: '#E2688A', ratio: 0.3 }
  it('rankedColors เรียงตาม ratio × saturation และไม่แก้ array เดิม', () => {
    const colors = [pale, real]
    expect(rankedColors(colors)[0]).toBe(real)
    expect(colors[0]).toBe(pale)
  })
  it('dominantColorOfDay: สีจางที่กินพื้นที่มากไม่ชนะสีจริง', () => {
    expect(dominantColorOfDay([{ local_time: '09:00', intensity: 1, colors: [pale, real] }])).toBe(real.hex)
  })
  it('dominantColorOfDay: ไม่มีภาพ = null', () => {
    expect(dominantColorOfDay([])).toBeNull()
  })
  it('dominantColorOfDay: เท่ากันใช้สีของภาพล่าสุด', () => {
    // สีเดียวกันสองภาพ น้ำหนักรวมเท่ากัน → ภาพล่าสุด (HAPPY 10:00) ชนะ ถ้าเป็น saturation เท่ากัน
    const a = { local_time: '09:00', intensity: 1, colors: [{ hex: '#FF0000', ratio: 1 }] }
    const b = { local_time: '10:00', intensity: 1, colors: [{ hex: '#00FF00', ratio: 1 }] }
    expect(dominantColorOfDay([a, b])).toBe('#00FF00')
    expect(dominantColorOfDay([b, a])).toBe('#00FF00')
  })
})

describe('chunk', () => {
  it('แบ่งเป็นชุดละ n', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 4)).toEqual([])
  })
})
