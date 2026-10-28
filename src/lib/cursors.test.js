import { describe, it, expect } from 'vitest'
import { BRUSH_HOTSPOT, CURSOR_SIZE, FINGER_HOTSPOT, brushCursor, brushSvg, canvasCursor, cursorValue, fingerCursor, fingerSvg } from './cursors'

const decode = (v) => decodeURIComponent(v.match(/base64|charset=utf8,([^"]+)"/)[1])

// SVG ต้องเป็น XML ที่ถูกต้อง: แอตทริบิวต์ซ้ำในแท็กเดียวทำให้เบราว์เซอร์โหลดภาพไม่ได้และเคอร์เซอร์ถอยเป็น auto เงียบ ๆ
const noDuplicateAttrs = (svg) =>
  [...svg.matchAll(/<[a-zA-Z][^>]*>/g)].every(([tag]) => {
    const names = [...tag.matchAll(/\s([a-zA-Z:-]+)=/g)].map((m) => m[1])
    return new Set(names).size === names.length
  })

describe('cursor values', () => {
  it('SVG ไม่มีแอตทริบิวต์ซ้ำและแท็กปิดครบ', () => {
    for (const svg of [fingerSvg(), fingerSvg('#112233'), brushSvg('#445566')]) {
      expect(noDuplicateAttrs(svg)).toBe(true)
      expect(svg.match(/<svg/g)).toHaveLength(1)
      expect(svg.endsWith('</svg>')).toBe(true)
    }
  })
  it('เป็น url ของ SVG 32px พร้อมจุดคลิกที่ปลายนิ้ว/ปลายขน และ fallback auto', () => {
    const f = fingerCursor()
    expect(f.startsWith('url("data:image/svg+xml')).toBe(true)
    expect(f.endsWith(`${FINGER_HOTSPOT[0]} ${FINGER_HOTSPOT[1]}, auto`)).toBe(true)
    expect(fingerSvg()).toContain(`width="${CURSOR_SIZE}"`)
    expect(CURSOR_SIZE).toBe(32)
    expect(brushCursor('#4256A8').endsWith(`${BRUSH_HOTSPOT[0]} ${BRUSH_HOTSPOT[1]}, auto`)).toBe(true)
  })
  it('จุดคลิกอยู่ในภาพ 32×32', () => {
    for (const [x, y] of [FINGER_HOTSPOT, BRUSH_HOTSPOT]) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(CURSOR_SIZE)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThan(CURSOR_SIZE)
    }
  })
  it('สีอารมณ์ติดปลายนิ้ว/ปลายขนจริง', () => {
    expect(decode(canvasCursor('smear', '#d6453a', '#f7de99'))).toContain('#d6453a')
    expect(decode(canvasCursor('drop', '#4256a8', '#f7de99'))).toContain('#4256a8')
    expect(decode(canvasCursor('warm', '#4256a8', '#f7de99'))).toContain('#f7de99')
    expect(decode(canvasCursor('warm', '#4256a8', '#f7de99'))).not.toContain('#4256a8')
  })
  it('นิ้วเปล่าไม่มีสีปลายนิ้ว', () => {
    expect(fingerSvg()).not.toContain('#abcdef')
    expect(fingerSvg('#abcdef')).toContain('#abcdef')
    expect(brushSvg('#123456')).toContain('#123456')
  })
  it('cursorValue เข้ารหัส SVG ให้อยู่ใน url() ได้', () => {
    const v = cursorValue('<svg a="1">#</svg>', [1, 2])
    expect(v).not.toContain('<svg')
    expect(v).toContain('%23')
  })
})
