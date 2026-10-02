import { describe, expect, it } from 'vitest'
import { flightTransforms, PHOTO_POSE } from '@/lib/flip'

describe('flightTransforms', () => {
  it('เริ่มที่ตำแหน่งในสมุด (เลื่อนย้อนจากปลายทาง, scale 1) จบที่ท่ากลางโต๊ะ', () => {
    const [start, end] = flightTransforms({ x: 300, y: 250, rotate: 2.5 }, { x: 640, y: 400 })
    expect(start).toBe('translate(-340px, -150px) rotate(2.5deg) scale(1)')
    expect(end).toBe(`translate(0px, 0px) rotate(${PHOTO_POSE.rotate}deg) scale(${PHOTO_POSE.scale})`)
  })

  it('ภาพอยู่ขวา/ล่างของปลายทาง ให้ค่าเลื่อนเป็นบวก', () => {
    const [start] = flightTransforms({ x: 900, y: 600, rotate: -3 }, { x: 640, y: 400 })
    expect(start).toContain('translate(260px, 200px)')
  })
})
