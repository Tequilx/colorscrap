// ทดสอบการวางป้าย "+N ภาพ" บนการ์ดของวัน (badgeLayout ใน lib/share/cards.js)
import { describe, it, expect } from 'vitest'
import { BADGE, badgeLayout } from './cards'

describe('badgeLayout', () => {
  it('กรอบกว้าง = ข้อความ + padding ซ้ายขวาเท่ากัน ชิดขอบขวาของพื้นที่การ์ด', () => {
    const l = badgeLayout(100)
    expect(l.bw).toBe(100 + 2 * BADGE.pad)
    expect(l.bx + l.bw).toBe(1008)
  })
  it('ป้ายไม่ทับชุดโพลารอยด์: ห่างขอบขวาของชุดอย่างน้อย gap ทุกความกว้างข้อความ (+1, +8, +12, +99)', () => {
    for (const w of [20, 60, 110, 140, 200]) {
      const l = badgeLayout(w)
      expect(l.bx - l.groupRight).toBeGreaterThanOrEqual(BADGE.gap - 1e-9)
      expect(l.scale).toBeGreaterThan(0.6)
      expect(l.scale).toBeLessThanOrEqual(1)
    }
  })
  it('ข้อความยิ่งยาวชุดโพลารอยด์ยิ่งย่อ', () => {
    expect(badgeLayout(140).scale).toBeLessThan(badgeLayout(40).scale)
  })
})
