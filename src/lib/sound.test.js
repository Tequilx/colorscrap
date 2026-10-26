import { describe, it, expect } from 'vitest'
import { sfxBase, SFX_NAMES, hasSfx, sfxUrls, MAX_VOICES, SOFT_CEILING, bloomEnvelope, BELL_SCALE, pickBellNotes, createVoicePool, pitchOf, readEnabled, softClipCurve } from './sound'

describe('pitchOf', () => {
  it('อารมณ์ช้าทุ้มกว่าอารมณ์เร็ว', () => {
    expect(pitchOf('sad')).toBeLessThan(pitchOf('happy'))
    expect(pitchOf('tired')).toBeLessThan(pitchOf('calm'))
    expect(pitchOf('calm')).toBeLessThan(pitchOf('excited'))
  })
  it('อารมณ์ที่ไม่รู้จักใช้ 1', () => {
    expect(pitchOf('xyz')).toBe(1)
  })
})

describe('createVoicePool', () => {
  it('ไม่เกิน max และตัดตัวเก่าสุดก่อน', () => {
    const pool = createVoicePool(3)
    const stopped = []
    const mk = (n) => ({ stop: () => stopped.push(n) })
    ;[1, 2, 3, 4, 5].forEach((n) => pool.add(mk(n)))
    expect(pool.size).toBe(3)
    expect(stopped).toEqual([1, 2])
  })
  it('remove ไม่เรียก stop และ stopAll เคลียร์ทั้งหมด', () => {
    const pool = createVoicePool(MAX_VOICES)
    let n = 0
    const a = { stop: () => n++ }
    const b = { stop: () => n++ }
    pool.add(a)
    pool.add(b)
    pool.remove(a)
    expect(n).toBe(0)
    pool.stopAll()
    expect(n).toBe(1)
    expect(pool.size).toBe(0)
  })
  it('ค่าเริ่มต้นไม่เกิน 6 เสียง', () => {
    expect(MAX_VOICES).toBe(6)
    const pool = createVoicePool()
    for (let i = 0; i < 20; i++) pool.add({ stop() {} })
    expect(pool.size).toBe(6)
  })
})

describe('softClipCurve', () => {
  it('ยอดไม่เกินเพดาน (< 0 dBFS) เป็นฟังก์ชันคี่และเพิ่มขึ้นเรื่อย ๆ', () => {
    const c = softClipCurve(513)
    const peak = Math.max(...c.map(Math.abs))
    expect(peak).toBeLessThanOrEqual(SOFT_CEILING + 1e-6)
    expect(SOFT_CEILING).toBeLessThan(1)
    expect(c[256]).toBeCloseTo(0, 5)
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1])
  })
})

describe('bloomEnvelope', () => {
  it('ขึ้นถึง 1 ที่ยอด แล้วลดลงเรื่อย ๆ ถึง 0 ท้ายเส้น ไม่มีช่วงไหนแรงกว่าก่อนหน้าหลังยอด', () => {
    const e = bloomEnvelope(3000, 241)
    const peakAt = e.indexOf(Math.max(...e))
    expect(e[peakAt]).toBeCloseTo(1, 1)
    expect((peakAt / 240) * 3000).toBeLessThan(300)
    for (let i = peakAt + 1; i < e.length; i++) expect(e[i]).toBeLessThanOrEqual(e[i - 1] + 1e-9)
    expect(e.at(-1)).toBeCloseTo(0, 5)
  })
})

describe('readEnabled', () => {
  it('ค่าเริ่มต้นเปิด ปิดเมื่อเก็บ 0 และไม่พังเมื่ออ่านไม่ได้', () => {
    expect(readEnabled({ getItem: () => null })).toBe(true)
    expect(readEnabled({ getItem: () => '1' })).toBe(true)
    expect(readEnabled({ getItem: () => '0' })).toBe(false)
    expect(readEnabled({ getItem: () => { throw new Error('x') } })).toBe(true)
  })
})

describe('เสียงเอฟเฟกต์จากไฟล์', () => {
  it('ชื่อไฟล์ครบ 12 ตัว และรายการไฟล์ที่มีจริงมาจากตอน build (ไม่มีไฟล์ = ว่าง ไม่มีคำขอ)', () => {
    expect(SFX_NAMES).toEqual(['drop', 'smear', 'splash', 'glow', 'dip', 'stroke', 'lift', 'tape', 'cover', 'page', 'note', 'tap'])
    Object.keys(sfxUrls).forEach((n) => expect(SFX_NAMES).toContain(sfxBase(n)))
  })
  it('รองรับหลายไฟล์ต่อเสียง (dip-1.mp3, dip-2.mp3 → dip)', () => {
    expect(sfxBase('dip-2')).toBe('dip')
    expect(sfxBase('dip')).toBe('dip')
    expect(sfxBase('page-12')).toBe('page')
  })
  it('ยังไม่โหลดอะไร = ไม่มีไฟล์ (ใช้เสียงสังเคราะห์)', () => {
    SFX_NAMES.forEach((n) => expect(hasSfx(n)).toBe(false))
  })
})

describe('pickBellNotes (เติมสีสดใส)', () => {
  it('2–4 โน้ตไม่ซ้ำ อยู่ในสเกล ~600–1200 Hz', () => {
    for (let i = 0; i < 200; i++) {
      const n = pickBellNotes(Math.random)
      expect(n.length).toBeGreaterThanOrEqual(2)
      expect(n.length).toBeLessThanOrEqual(4)
      expect(new Set(n).size).toBe(n.length)
      n.forEach((f) => expect(BELL_SCALE).toContain(f))
    }
    BELL_SCALE.forEach((f) => {
      expect(f).toBeGreaterThanOrEqual(580)
      expect(f).toBeLessThanOrEqual(1200)
    })
  })
})
