// ทดสอบการสร้าง uuid (lib/uuid.js) ทั้งแบบ crypto.randomUUID และสำรอง
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uuid } from '@/lib/uuid'

const realCrypto = globalThis.crypto // เก็บตัวจริงไว้ก่อน stub ไม่งั้น mock เรียกตัวเองวน
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

describe('uuid', () => {
  it('ใช้ crypto.randomUUID เมื่อมี', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555')
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: realCrypto.getRandomValues.bind(realCrypto) })
    expect(uuid()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('ไม่มี randomUUID (http ผ่าน IP) สร้าง v4 เองจาก getRandomValues', () => {
    const getRandomValues = vi.fn((a) => realCrypto.getRandomValues(a))
    vi.stubGlobal('crypto', { getRandomValues })
    const ids = Array.from({ length: 200 }, () => uuid())
    expect(getRandomValues).toHaveBeenCalledTimes(200)
    for (const id of ids) expect(id).toMatch(V4)
    expect(new Set(ids).size).toBe(200)
  })

  it('ตั้ง version และ variant bits ถูกแม้ค่าสุ่มเป็น 0x00 หรือ 0xff ทั้งหมด', () => {
    for (const fill of [0x00, 0xff]) {
      vi.stubGlobal('crypto', { getRandomValues: (a) => a.fill(fill) })
      expect(uuid()).toMatch(V4)
    }
    vi.stubGlobal('crypto', { getRandomValues: (a) => a.fill(0) })
    expect(uuid()).toBe('00000000-0000-4000-8000-000000000000')
  })
})
