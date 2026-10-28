// ทดสอบตารางเวลาของลำดับบันทึกลงสมุด (lib/saveTimeline.js)
import { describe, expect, it } from 'vitest'
import { PAPER, POLAROID, ZOOM, flightPoses, poseTransform, saveSchedule, slotCenter } from '@/lib/saveTimeline'
import { FIRST_LEAF_SLOTS, INSERT_LEAF_SLOTS } from '@/lib/photos'

describe('saveSchedule', () => {
  it('ภาพปกติรวมประมาณ 1.6 วินาที (SPEC §5.4) และเรียงตามลำดับ', () => {
    const s = saveSchedule()
    expect(s.leaf).toBeNull()
    expect(s.total).toBeGreaterThanOrEqual(1500)
    expect(s.total).toBeLessThanOrEqual(1700)
    expect(s.shrink[0]).toBe(0)
    expect(s.book[0]).toBeGreaterThan(0) // สมุดเข้าหลังเริ่มหด
    expect(s.book[0]).toBeLessThan(s.shrink[1]) // แต่ซ้อนกับช่วงหด
    expect(s.drop[0]).toBe(s.book[1]) // ภาพลงช่องหลังสมุดเข้าที่
    expect(s.tape[0]).toBe(s.drop[1])
    expect(s.card[0]).toBeGreaterThan(s.tape[0]) // การ์ดโผล่หลังเทป
    expect(s.card[1]).toBe(s.total)
  })

  it('แผ่นแทรกใหม่: พลิกลงมาก่อนวางภาพ (§5.6) และยาวขึ้นเท่าเวลาพลิก', () => {
    const plain = saveSchedule()
    const s = saveSchedule({ newLeaf: true })
    expect(s.leaf).toEqual([s.book[1], s.drop[0]])
    expect(s.total - plain.total).toBe(s.leaf[1] - s.leaf[0])
  })

  it('scale คูณทุกเวลา (?motion=slow)', () => {
    const a = saveSchedule({ newLeaf: true })
    const b = saveSchedule({ newLeaf: true, scale: 3 })
    expect(b.total).toBe(a.total * 3)
    expect(b.drop).toEqual(a.drop.map((t) => t * 3))
  })
})

describe('slotCenter', () => {
  it('แผ่นแรก: คำนวณจาก slot + ออฟเซ็ตหน้าซ้าย แล้วใส่ช็อตซูม', () => {
    const c = slotCenter({ slot: 0 })
    const lx = 14 + FIRST_LEAF_SLOTS[0].x + POLAROID.w / 2
    const ly = 14 + FIRST_LEAF_SLOTS[0].y + POLAROID.h / 2
    expect(c.x).toBeCloseTo(ZOOM.x + ZOOM.s * lx)
    expect(c.y).toBeCloseTo(ZOOM.y + ZOOM.s * ly)
  })

  it('แผ่นแทรกใช้ slot ชุดแทรกและหน้ากระดาษแทรกเลื่อน (8,18)', () => {
    const c = slotCenter({ slot: 3, insert: true })
    const lx = 22 + INSERT_LEAF_SLOTS[3].x + POLAROID.w / 2
    const ly = 32 + INSERT_LEAF_SLOTS[3].y + POLAROID.h / 2
    expect(c.x).toBeCloseTo(ZOOM.x + ZOOM.s * lx)
    expect(c.y).toBeCloseTo(ZOOM.y + ZOOM.s * ly)
  })
})

describe('flightPoses', () => {
  const target = { x: 500, y: 300 }
  it('เริ่ม: ช่องภาพของโพลารอยด์ทับกึ่งกลางกระดาษพอดี และขยายภาพเท่ากับกระดาษ', () => {
    const p = flightPoses({ target, rotate: 2 })
    const windowCenterY = p.start.y + (POLAROID.win.y + POLAROID.win.h / 2 - POLAROID.h / 2)
    expect(p.start.x).toBe(PAPER.x + PAPER.w / 2)
    expect(windowCenterY).toBeCloseTo(PAPER.y + PAPER.h / 2)
    expect(POLAROID.win.w * p.paperScale).toBeCloseTo(PAPER.w)
  })

  it('ภาพลอย 1.08 เท่าของระดับซูมก่อนลงช่องที่ระดับซูม และมุมเอียงของภาพ', () => {
    const p = flightPoses({ target, rotate: -2.5 })
    expect(p.lift.scale).toBeCloseTo(ZOOM.s * 1.08)
    expect(p.land.scale).toBe(ZOOM.s)
    expect(p.land.rotate).toBe(-2.5)
    expect(p.lift).toMatchObject(target)
  })

  it('ไม่มีภาพจากผ้าใบ (ไม่มี WebGL) เริ่มที่ที่พักเลย', () => {
    const p = flightPoses({ target, rotate: 0, fromPaper: false })
    expect(p.start).toEqual(p.park)
  })

  it('poseTransform ลำดับฟังก์ชันเหมือนกันทุกท่า', () => {
    const p = flightPoses({ target, rotate: 1 })
    const shape = (t) => t.replace(/-?[\d.]+/g, '#')
    expect(new Set([p.start, p.park, p.lift, p.land].map((x) => shape(poseTransform(x)))).size).toBe(1)
  })
})
