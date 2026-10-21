import { describe, it, expect } from 'vitest'
import { LABEL_FULL_MIN, LABEL_GAP, LABEL_NONE_MIN, jaggedOffsets, layoutRibbon, ribbonCaption, sortedByTime, sweepPolygon, timeIcon } from './dayRibbon'

const mk = (i, time, emotion = 'sad', intensity = 1, shifted = false) => ({
  id: `e${i}`,
  local_time: time,
  emotion,
  emotions: [emotion],
  intensity,
  shifted,
  colors: [{ hex: '#4256A8', ratio: 0.6 }, { hex: '#9AA3D6', ratio: 0.4 }],
})
const TIMES = ['00:45', '01:07', '01:59', '08:10', '12:30', '15:00', '18:20', '22:40']
const set = (n, intensities = []) => Array.from({ length: n }, (_, i) => mk(i, TIMES[i], ['sad', 'tired', 'calm', 'happy'][i % 4], intensities[i] ?? 1, i % 3 === 1))

const overlap = (a, b) => !(a[1] + LABEL_GAP <= b[0] || a[0] >= b[1] + LABEL_GAP)

describe('layoutRibbon', () => {
  it('1 ภาพเต็มความกว้าง', () => {
    const [s] = layoutRibbon(set(1), 360)
    expect(s.x).toBe(0)
    expect(s.w).toBeCloseTo(360, 5)
    expect(s.level).toBe(2)
  })
  it('ความกว้างรวมเท่าแถบ เรียงตามเวลา ไม่มีช่องว่าง และกว้าง ∝ น้ำหนัก', () => {
    const segs = layoutRibbon([mk(1, '10:00', 'sad', 2), mk(0, '08:00', 'sad', 0)], 400)
    expect(segs.map((s) => s.id)).toEqual(['e0', 'e1'])
    expect(segs[0].x).toBe(0)
    expect(segs[1].x).toBeCloseTo(segs[0].w, 5)
    expect(segs[0].w + segs[1].w).toBeCloseTo(400, 5)
    expect(segs[1].w / segs[0].w).toBeCloseTo(1.25 / 0.75, 5) // น้ำหนัก 0.75+0.25·intensity
  })
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('ป้ายไม่ทับกัน %i ภาพ (ทุกชุดความเข้ม และแถบกว้างต่าง ๆ)', (n) => {
    for (const width of [300, 362, 420, 560]) {
      for (const pattern of [[], [0, 1, 2, 0, 1, 2, 0, 1], [2, 2, 2, 0, 0, 0, 2, 0], [0, 2, 0, 2, 0, 2, 0, 2]]) {
        const segs = layoutRibbon(set(n, pattern), width)
        const boxes = segs.filter((s) => s.box).map((s) => s.box)
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false)
      }
    }
  })
  it('กฎความกว้าง: < 90px เหลือแค่เวลา, < 50px ไม่มีป้าย', () => {
    const segs = layoutRibbon(set(8), 360) // ~45px ต่อช่วง
    for (const s of segs) {
      if (s.w < LABEL_NONE_MIN) expect(s.level).toBe(0)
      else if (s.w < LABEL_FULL_MIN) expect(s.level).toBeLessThanOrEqual(1)
    }
    expect(segs.some((s) => s.level === 0)).toBe(true)
  })
  it('ช่วงล่าสุดได้ป้ายก่อนเสมอเมื่อแย่งที่กัน', () => {
    const segs = layoutRibbon(set(6), 340)
    expect(segs.at(-1).level).toBeGreaterThan(0)
  })
  it('สีช่วง: shifted ไล่ไปสีแต้มแสงของอารมณ์ ภาพปกติไม่มีสีปลายทาง', () => {
    const [a, b] = layoutRibbon([mk(0, '08:00', 'sad', 1, false), mk(1, '09:00', 'sad', 1, true)], 300)
    expect(a.to).toBeNull()
    expect(b.to).toMatch(/^#/)
    expect(b.main).toBe('#4256A8')
  })
})

describe('segmentColors', () => {
  it('ภาพแต้มแสงที่สีเด่นที่สุดคือสีแต้มแสงเอง: ใช้สีเด่นที่ห่างจากสีแต้มแสงเป็นสีหลัก (ไม่ไล่เหลือง→เหลือง)', () => {
    const e = { ...mk(0, '08:00', 'tired', 1, true), colors: [{ hex: '#F7DE99', ratio: 0.5 }, { hex: '#5B6773', ratio: 0.5 }] }
    const [s] = layoutRibbon([e], 300)
    expect(s.main).toBe('#5B6773')
    expect(s.to).toBe('#F7DE99')
  })
  it('ไม่มีสีที่ห่างพอ: ใช้สีเด่นสุดตามเดิม', () => {
    const e = { ...mk(0, '08:00', 'tired', 1, true), colors: [{ hex: '#F7DE99', ratio: 1 }] }
    expect(layoutRibbon([e], 300)[0].main).toBe('#F7DE99')
  })
})

describe('helpers', () => {
  it('ไอคอนช่วงเวลา และคำบรรยาย', () => {
    expect(timeIcon('01:07')).toBe('moon')
    expect(timeIcon('12:00')).toBe('sun')
    expect(timeIcon('18:59')).toBe('sun')
    expect(timeIcon('19:00')).toBe('moon')
    expect(ribbonCaption(mk(0, '01:00', 'tired', 1, true))).toBe('เหนื่อย → มีแสงขึ้น')
    expect(ribbonCaption(mk(0, '01:00', 'sad'))).toBe('เศร้า')
  })
  it('เรียงตามเวลา', () => {
    expect(sortedByTime([mk(0, '09:00'), mk(1, '08:00')]).map((e) => e.id)).toEqual(['e1', 'e0'])
  })
  it('ขอบสั่น: คงที่ทุกครั้ง จุดเท่ากันทุกตำแหน่ง ไม่ใช่เส้นตรง', () => {
    const j = jaggedOffsets()
    expect(j).toEqual(jaggedOffsets())
    expect(new Set(j).size).toBeGreaterThan(5)
    const a = sweepPolygon(0, 80, j)
    const b = sweepPolygon(300, 80, j)
    expect(a.split(',').length).toBe(b.split(',').length) // จำนวนจุดเท่ากัน interpolate ได้
    expect(a.startsWith('polygon(')).toBe(true)
  })
})
