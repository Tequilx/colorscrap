// ทดสอบการเลือกแทร็กเพลงคลอ เวที fade และระดับเสียงเพลง (lib/music.js, lib/sound.js)
import { describe, it, expect } from 'vitest'
import { CROSSFADE_MS, FADE_IN_MS, trackOf, urlOf } from './music'
import { MASTER_GAIN, MUSIC_BASE, MUSIC_DUCK, readEnabled } from './sound'

describe('music tracks', () => {
  it('กลางวันและเย็นใช้ day กลางคืนใช้ night (lib/daylight.js)', () => {
    expect(trackOf('day')).toBe('day')
    expect(trackOf('dusk')).toBe('day')
    expect(trackOf('night')).toBe('night')
  })
  it('ไฟล์เพลงเป็น mp3 ใน src/assets/audio (Vite ใส่ hash ในชื่อตอน build ข้อ 61a)', () => {
    expect(urlOf('day')).toMatch(/music-day.*\.mp3$/)
    expect(urlOf('night')).toMatch(/music-night.*\.mp3$/)
    expect(urlOf('nope')).toBeNull()
  })
  it('เวลา fade: เข้า 1.5 วิ สลับช่วง 4 วิ', () => {
    expect(FADE_IN_MS).toBe(1500)
    expect(CROSSFADE_MS).toBe(4000)
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
