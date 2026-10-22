import { describe, it, expect } from 'vitest'
import { BLEND_FRAC, LABEL_GAP, LABEL_NONE_MIN, gradientStops, groupLabel, groupRuns, jaggedOffsets, labelsHeight, layoutRibbon, ribbonCaption, ribbonSvgMarkup, sortedByTime, sweepPolygon, textWidth, timeIcon } from './dayRibbon'

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
const EMOS = ['sad', 'tired', 'calm', 'happy', 'excited', 'angry', 'anxious', 'warm']
// ทุกภาพคนละอารมณ์ติดกัน = ไม่ถูกรวม
const set = (n, intensities = []) => Array.from({ length: n }, (_, i) => mk(i, TIMES[i], EMOS[i], intensities[i] ?? 1, i % 3 === 1 && ['tired', 'angry', 'anxious', 'sad'].includes(EMOS[i])))

const hit = (a, b, gap) => !(a.x1 + gap <= b.x0 || a.x0 >= b.x1 + gap || a.y1 + gap <= b.y0 || a.y0 >= b.y1 + gap)
const noOverlap = (segs) => {
  const rects = segs.filter((s) => s.box).flatMap((s) => [{ ...s.box, own: s.id, kind: 'label' }, { ...s.tick, own: s.id, kind: 'tick' }])
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      if (rects[i].own === rects[j].own) continue
      if (hit(rects[i], rects[j], rects[i].kind === 'label' && rects[j].kind === 'label' ? LABEL_GAP : 0)) return false
    }
  return true
}

describe('groupRuns (รวมช่วง)', () => {
  it('ภาพติดกันอารมณ์เดียวกัน+shifted เหมือนกัน รวมเป็นช่วงเดียว น้ำหนักรวมกัน', () => {
    const g = groupRuns([mk(0, '04:05', 'excited', 1), mk(1, '04:06', 'excited', 2), mk(2, '04:08', 'excited', 0)])
    expect(g).toHaveLength(1)
    expect(g[0].count).toBe(3)
    expect(g[0].weight).toBeCloseTo(1 + 1.25 + 0.75, 5)
  })
  it('shifted ต่างกัน หรืออารมณ์เดียวกันแต่ไม่ติดกัน = ไม่รวม', () => {
    expect(groupRuns([mk(0, '01:00', 'sad', 1, false), mk(1, '01:05', 'sad', 1, true)])).toHaveLength(2)
    expect(groupRuns([mk(0, '01:00', 'sad'), mk(1, '01:05', 'calm'), mk(2, '01:10', 'sad')])).toHaveLength(3)
  })
  it('ไม่แก้ข้อมูลเดิม (รวมเป็นการแสดงผล)', () => {
    const e = [mk(1, '04:06', 'excited'), mk(0, '04:05', 'excited')]
    const copy = JSON.stringify(e)
    groupRuns(e)
    expect(JSON.stringify(e)).toBe(copy)
  })
})

describe('groupLabel', () => {
  it('ช่วงรวม: "04:05–04:08" + "ตื่นเต้น ×3" · ภาพเดียว: เวลาเดียว ไม่มี ×', () => {
    const [g] = groupRuns([mk(0, '04:05', 'excited'), mk(1, '04:06', 'excited'), mk(2, '04:08', 'excited')])
    expect(groupLabel(g)).toMatchObject({ time: '04:05–04:08', caption: 'ตื่นเต้น ×3' })
    const [one] = groupRuns([mk(0, '04:05', 'excited')])
    expect(groupLabel(one).caption).toBe('ตื่นเต้น')
    expect(groupLabel(one).time).toBe('04:05')
  })
  it('ภาพ shifted รวมกัน: "เหนื่อย → มีแสงขึ้น ×2"', () => {
    const [g] = groupRuns([mk(0, '01:00', 'tired', 1, true), mk(1, '01:09', 'tired', 1, true)])
    expect(groupLabel(g).caption).toBe('เหนื่อย → มีแสงขึ้น ×2')
  })
})

describe('layoutRibbon', () => {
  it('1 ภาพเต็มความกว้าง', () => {
    const [s] = layoutRibbon(set(1), 360)
    expect(s.x).toBe(0)
    expect(s.w).toBeCloseTo(360, 5)
    expect(s.level).toBe(2)
  })
  it('ความกว้างรวมเท่าแถบ เรียงตามเวลา ไม่มีช่องว่าง และกว้าง ∝ น้ำหนัก', () => {
    const segs = layoutRibbon([mk(1, '10:00', 'calm', 2), mk(0, '08:00', 'sad', 0)], 400)
    expect(segs.map((s) => s.id)).toEqual(['e0', 'e1'])
    expect(segs[0].x).toBe(0)
    expect(segs[1].x).toBeCloseTo(segs[0].w, 5)
    expect(segs[0].w + segs[1].w).toBeCloseTo(400, 5)
    expect(segs[1].w / segs[0].w).toBeCloseTo(1.25 / 0.75, 5)
  })
  it('ช่วงรวมกว้างตามน้ำหนักรวม (แถบลายน้อยลง ช่วงกว้างขึ้น)', () => {
    const merged = layoutRibbon([mk(0, '04:05', 'excited'), mk(1, '04:06', 'excited'), mk(2, '04:08', 'excited'), mk(3, '05:00', 'calm')], 400)
    expect(merged).toHaveLength(2)
    expect(merged[0].w / merged[1].w).toBeCloseTo(3, 5)
  })
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('ป้ายและขีดไม่ทับกัน %i ภาพ (ทุกชุดความเข้ม และแถบกว้างต่าง ๆ)', (n) => {
    for (const width of [300, 362, 412, 560]) {
      for (const pattern of [[], [0, 1, 2, 0, 1, 2, 0, 1], [2, 2, 2, 0, 0, 0, 2, 0], [0, 2, 0, 2, 0, 2, 0, 2]]) {
        expect(noOverlap(layoutRibbon(set(n, pattern), width))).toBe(true)
      }
    }
  })
  it('8 ภาพที่มีอารมณ์ซ้ำติดกัน (กรณีจริง): ป้ายไม่ทับกัน และทุกช่วงที่กว้าง ≥ 40px มีป้าย', () => {
    const dup = [mk(0, '04:05', 'excited'), mk(1, '04:06', 'excited', 2), mk(2, '04:08', 'excited'), mk(3, '04:20', 'calm'), mk(4, '05:10', 'sad'), mk(5, '05:12', 'sad', 1, true), mk(6, '05:40', 'tired', 0), mk(7, '06:10', 'happy')]
    for (const width of [300, 362, 412]) {
      const segs = layoutRibbon(dup, width)
      expect(noOverlap(segs)).toBe(true)
      for (const s of segs) if (s.w >= LABEL_NONE_MIN) expect(s.level).toBeGreaterThan(0)
    }
  })
  it('ซ่อนป้ายได้เฉพาะช่วงที่แคบกว่า 40px; ช่วงแคบ 40–90px ใช้เวลาอย่างเดียวและเยื้องเป็นแถว', () => {
    const segs = layoutRibbon(set(8), 360) // ~45px ต่อช่วง
    for (const s of segs) {
      if (s.w >= LABEL_NONE_MIN) expect(s.level).toBeGreaterThan(0)
      if (s.w < 90) expect(s.level).toBeLessThanOrEqual(1)
    }
    expect(segs.some((s) => s.row > 0)).toBe(true) // ชนกันแล้วเยื้องลง ไม่ซ่อน
    expect(labelsHeight(segs)).toBeGreaterThan(30)
  })
  it('ช่วงที่แคบกว่า 40px ไม่มีป้าย', () => {
    const segs = layoutRibbon([mk(0, '01:00', 'sad', 2), mk(1, '01:10', 'calm', 0), mk(2, '01:20', 'happy', 2), mk(3, '01:30', 'tired', 0), mk(4, '01:40', 'angry', 0), mk(5, '01:50', 'warm', 2), mk(6, '02:00', 'excited', 2), mk(7, '02:10', 'anxious', 2)], 200)
    expect(segs.some((s) => s.w < LABEL_NONE_MIN && s.level === 0)).toBe(true)
  })
  it('สีช่วง: shifted ไล่ไปสีแต้มแสงของอารมณ์ ภาพปกติไม่มีสีปลายทาง; ภาพที่สีเด่นคือสีแต้มแสงเองใช้สีอื่นเป็นสีหลัก', () => {
    const [a, b] = layoutRibbon([mk(0, '08:00', 'calm', 1, false), mk(1, '09:00', 'sad', 1, true)], 300)
    expect(a.to).toBeNull()
    expect(b.to).toMatch(/^#/)
    expect(b.main).toBe('#4256A8')
    const e = { ...mk(0, '08:00', 'tired', 1, true), colors: [{ hex: '#F7DE99', ratio: 0.5 }, { hex: '#5B6773', ratio: 0.5 }] }
    const [s] = layoutRibbon([e], 300)
    expect(s.main).toBe('#5B6773')
    expect(s.to).toBe('#F7DE99')
  })
})

describe('gradientStops (ไล่นุ่ม ไม่มีแถบตัดคม)', () => {
  it('ช่วงละ 2 จุดหยุดพอดี (สีหลัก → สีแต้มแสง/สีหลักเดิม) offset ไม่ลดลง อยู่ใน 0..1', () => {
    const segs = layoutRibbon(set(6), 412)
    const st = gradientStops(segs, 412)
    expect(st).toHaveLength(segs.length * 2)
    for (let i = 0; i < st.length; i++) {
      expect(st[i].offset).toBeGreaterThanOrEqual(0)
      expect(st[i].offset).toBeLessThanOrEqual(1)
      if (i) expect(st[i].offset).toBeGreaterThanOrEqual(st[i - 1].offset)
    }
    expect(st[0].offset).toBe(0)
    expect(st.at(-1).offset).toBe(1)
  })
  it('รอยต่อระหว่างช่วงซึมกว้าง ~7% ของความกว้างแถบ (สองฝั่งรวม)', () => {
    const segs = layoutRibbon([mk(0, '01:00', 'calm'), mk(1, '02:00', 'sad')], 400)
    const st = gradientStops(segs, 400)
    expect((st[2].offset - st[1].offset) * 400).toBeCloseTo(BLEND_FRAC * 400, 5)
    expect(BLEND_FRAC).toBeCloseTo(0.07, 5)
  })
  it('ช่วง shifted: สองจุดหยุดของช่วงเป็นสีหลักแล้วสีแต้มแสง ไม่มีจุดหยุดเพิ่ม (ไม่มีแถบเหลืองแทรก)', () => {
    const segs = layoutRibbon([mk(0, '01:00', 'calm'), mk(1, '02:00', 'tired', 1, true), mk(2, '03:00', 'sad')], 400)
    const st = gradientStops(segs, 400)
    expect(st).toHaveLength(6)
    expect(st[2].color).not.toBe(st[3].color) // ช่วง shifted ไล่สี
    expect(st[0].color).toBe(st[1].color) // ช่วงปกติสีเดียว
  })
})

describe('textWidth', () => {
  it('ไม่นับสระ/วรรณยุกต์ที่ซ้อนอยู่ และใกล้ความกว้างที่วัดจริง (เหนื่อย → มีแสงขึ้น ≈ 139px ที่ 15px)', () => {
    expect(textWidth('สงบ')).toBeCloseTo(30, 5)
    const w = textWidth('เหนื่อย → มีแสงขึ้น')
    expect(w).toBeGreaterThanOrEqual(139) // ประมาณเผื่อ ไม่ต่ำกว่าจริงที่ 15px (วัดที่ 16px ได้ 148 → 15px ≈ 139)
    expect(w).toBeLessThan(165)
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
    expect(a.split(',').length).toBe(b.split(',').length)
    expect(a.startsWith('polygon(')).toBe(true)
  })
})

describe('ribbonSvgMarkup', () => {
  const entries = [
    { id: 'a', local_time: '01:00', emotion: 'calm', emotions: ['calm'], intensity: 1, shifted: false, colors: [{ hex: '#5FA3C8', ratio: 1 }] },
    { id: 'b', local_time: '02:00', emotion: 'sad', emotions: ['sad'], intensity: 1, shifted: true, colors: [{ hex: '#4256A8', ratio: 1 }] },
  ]
  it('มีฟิลเตอร์/gradient ใน defs ของตัวเอง id ขึ้นต้นด้วย prefix และ region เป็น userSpaceOnUse', () => {
    const m = ribbonSvgMarkup(layoutRibbon(entries, 400), 400, 'zz')
    expect(m).toContain('id="zz-fm"')
    expect(m).toContain('id="zz-fh"')
    expect(m).toContain('id="zz-g"')
    expect(m.match(/filterUnits="userSpaceOnUse"/g).length).toBe(2)
    expect(m).not.toMatch(/url\(#(wcr|wcrh|grain)\)/)
  })
  it('สองอินสแตนซ์ id ไม่ซ้ำกัน', () => {
    const segs = layoutRibbon(entries, 400)
    const ids = (p) => [...ribbonSvgMarkup(segs, 400, p).matchAll(/id="([^"]+)"/g)].map((x) => x[1])
    expect(ids('a').some((i) => ids('b').includes(i))).toBe(false)
  })
})
