import { describe, expect, it } from 'vitest'
import { DYE_LIMIT, PAPER_LIGHT, limitScale, visibleLight } from '@/lib/dyeLimit'

// dye ของสีอารมณ์ (1 − rgb/255) ตามที่ shader ได้รับ
const dye = (hex) => [1, 3, 5].map((i) => 1 - parseInt(hex.slice(i, i + 2), 16) / 255)
const apply = (base, add) => {
  const s = limitScale(base, add)
  return base.map((v, i) => v + add[i] * s)
}
const maxc = (c) => Math.max(...c)

describe('limitScale (ต้นแบบของ shader ตัวกันดำ GPU)', () => {
  it('พื้นว่าง + หยดเบา: ลงเต็มตามที่ขอ (หน้าตาไม่เปลี่ยน)', () => {
    expect(limitScale([0, 0, 0], [0.1, 0.2, 0.3])).toBe(1)
    expect(limitScale([0.05, 0.05, 0.05], [0.2, 0.1, 0.1])).toBe(1)
  })

  it('ลงเกินเพดานไม่ได้: ช่องสีสูงสุด ≤ cap แม้หยดแรงมาก', () => {
    const out = apply([0, 0, 0], [3, 1, 0.5])
    expect(maxc(out)).toBeLessThanOrEqual(DYE_LIMIT.cap + 1e-6)
    expect(maxc(out)).toBeGreaterThan(DYE_LIMIT.cap * 0.9) // เข้าใกล้เพดาน ไม่ถูกบีบจนจาง
  })

  it('ซ้ำจุดเดิมเรื่อย ๆ ไม่ทะลุเพดานและไม่ลดสีเดิม', () => {
    let c = [0, 0, 0]
    for (let i = 0; i < 200; i++) {
      const next = apply(c, [0.2, 0.15, 0.1])
      next.forEach((v, k) => expect(v).toBeGreaterThanOrEqual(c[k] - 1e-9))
      c = next
    }
    expect(maxc(c)).toBeLessThanOrEqual(DYE_LIMIT.cap + 1e-6)
  })

  it('เกินเพดานแบบนุ่ม: ส่วนที่ลงจริงลดลงต่อเนื่องเข้าหา 0 ที่เพดาน ไม่ตัดกึก', () => {
    let prev = 1
    const samples = []
    for (let level = 0; level <= 0.85; level += 0.01) {
      const s = limitScale([level, level, level], [0.02, 0.02, 0.02])
      expect(s).toBeLessThanOrEqual(prev + 1e-6) // ไม่เพิ่มขึ้นเมื่อสีเดิมเต็มขึ้น
      prev = s
      samples.push(s)
    }
    expect(samples[0]).toBe(1)
    expect(samples.some((v) => v > 0.2 && v < 0.8)).toBe(true) // มีช่วงกลางจริง (นุ่มนวล)
    expect(samples.at(-1)).toBeLessThan(0.1)
  })

  it('สีตรงข้ามผสมกันไม่ดำ: เศร้า (น้ำเงิน) ซ้ำจนเต็ม แล้วทับเหลืองซ้ำ ความสว่างที่เห็น ≥ minLight', () => {
    let c = [0, 0, 0]
    for (let i = 0; i < 60; i++) c = apply(c, dye('#4256A8').map((v) => v * 0.4))
    for (let i = 0; i < 60; i++) c = apply(c, dye('#F7DE99').map((v) => v * 0.4))
    for (let i = 0; i < 60; i++) c = apply(c, dye('#4256A8').map((v) => v * 0.4))
    expect(visibleLight(c)).toBeGreaterThanOrEqual(DYE_LIMIT.minLight - 1e-3)
  })

  it('กังวล (ม่วง) ทับด้วยครีมทอง ซ้ำจุดเดิม ไม่ดำ', () => {
    let c = [0, 0, 0]
    for (let i = 0; i < 80; i++) c = apply(c, dye('#6E4FA0').map((v) => v * 0.5))
    for (let i = 0; i < 80; i++) c = apply(c, dye('#F3DCA0').map((v) => v * 0.5))
    expect(visibleLight(c)).toBeGreaterThanOrEqual(DYE_LIMIT.minLight - 1e-3)
    expect(maxc(c)).toBeLessThanOrEqual(DYE_LIMIT.cap + 1e-6)
  })

  it('บริเวณที่สีจริงยังไม่เต็ม ยังลงสีใหม่ได้เสมอ (บัค A: เดิม CPU บล็อกที่สีจริง ≤ 0.57)', () => {
    const base = [0.4, 0.35, 0.2] // สีจริงราว 0.4 จากเพดาน 0.85
    expect(limitScale(base, [0.1, 0.1, 0.05])).toBeGreaterThan(0.5)
  })

  it('ความสว่างของกระดาษล้วนคือ PAPER_LIGHT', () => {
    expect(visibleLight([0, 0, 0])).toBeCloseTo(PAPER_LIGHT, 6)
  })
})
