import { describe, it, expect } from 'vitest'
import { CROSSFADE_MS, FADE_IN_MS, candidates, trackOf, trimSilence } from './music'
import { MASTER_GAIN, MUSIC_BASE, MUSIC_DUCK, readEnabled } from './sound'

describe('music tracks', () => {
  it('กลางวันและเย็นใช้ day กลางคืนใช้ night (ช่วงเวลาเดียวกับ DeskLight)', () => {
    expect(trackOf('day')).toBe('day')
    expect(trackOf('dusk')).toBe('day')
    expect(trackOf('night')).toBe('night')
  })
  it('ไฟล์เพลงเป็น mp3 (ข้อ 45)', () => {
    expect(candidates('day')).toEqual(['/audio/music-day.mp3'])
    expect(candidates('night')[0]).toMatch(/music-night\.mp3$/)
  })
  it('เวลา fade: เข้า 3 วิ สลับช่วง 4 วิ', () => {
    expect(FADE_IN_MS).toBe(3000)
    expect(CROSSFADE_MS).toBe(4000)
  })
})

describe('trimSilence', () => {
  const mk = (len, from, to, amp = 0.2) => Float32Array.from({ length: len }, (_, i) => (i >= from && i < to ? amp : 0))
  it('ตัดเงียบหัวท้าย คืนวินาที', () => {
    const t = trimSilence([mk(1000, 100, 900)], 1000)
    expect(t.start).toBeCloseTo(0.1, 5)
    expect(t.end).toBeCloseTo(0.9, 5)
  })
  it('ใช้ช่องที่ดังก่อน/หลังสุด และไม่มีเสียงเลย = ทั้งไฟล์', () => {
    const t = trimSilence([mk(1000, 300, 500), mk(1000, 200, 700)], 1000)
    expect(t.start).toBeCloseTo(0.2, 5)
    expect(t.end).toBeCloseTo(0.7, 5)
    expect(trimSilence([new Float32Array(500)], 1000)).toEqual({ start: 0, end: 0.5 })
  })
})

describe('music levels', () => {
  it('เพลงเบากว่าเอฟเฟกต์ ~20 dB และลดเหลือครึ่งหนึ่งตอน duck', () => {
    expect(MUSIC_BASE).toBeLessThan(MASTER_GAIN / 10)
    expect(MUSIC_DUCK).toBe(0.5)
  })
  it('เปิด/ปิดเพลงจำแยกจากเอฟเฟกต์ (คนละ key) ค่าเริ่มต้นเปิด', () => {
    const store = { 'colorscrap.sound': '0' }
    const storage = { getItem: (k) => store[k] ?? null }
    expect(readEnabled(storage, 'colorscrap.sound')).toBe(false)
    expect(readEnabled(storage, 'colorscrap.music')).toBe(true)
  })
})
