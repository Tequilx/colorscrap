import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearWarm, thumbUrlsOf, warmEntries, warmUrl, within } from './warmImages'

const made = []
class FakeImage {
  constructor() { made.push(this); this.decodeCalls = 0 }
  decode() { this.decodeCalls++; return Promise.resolve() }
}
beforeEach(() => {
  made.length = 0
  clearWarm()
  globalThis.Image = FakeImage
})

describe('warmImages (ข้อ 62)', () => {
  const store = { get: (p) => ({ 'a/t': 'https://x/a', 'b/t': 'https://x/b' })[p] ?? null }
  it('thumbUrlsOf: ข้าม entry ที่ยังเป็น Blob ในเครื่อง, ไม่มี path และที่ signed URL ยังไม่พร้อม', () => {
    const list = [{ thumb_path: 'a/t' }, { thumb: {}, thumb_path: 'b/t' }, { thumb_path: null }, { thumb_path: 'zz' }]
    expect(thumbUrlsOf(list, store)).toEqual(['https://x/a'])
  })
  it('warmUrl: โหลด + decode ครั้งเดียวต่อ URL (เรียกซ้ำใช้ตัวเดิม ไม่เพิ่มคำขอ)', async () => {
    await warmUrl('https://x/a')
    await warmUrl('https://x/a')
    expect(made).toHaveLength(1)
    expect(made[0].decodeCalls).toBe(1)
    expect(made[0].src).toBe('https://x/a')
  })
  it('warmUrl ไม่มี URL = ไม่ทำอะไร และ decode ล้มเหลวไม่โยน error', async () => {
    await warmUrl(null)
    expect(made).toHaveLength(0)
    FakeImage.prototype.decode = () => Promise.reject(new Error('x'))
    await expect(warmUrl('https://x/b')).resolves.toBeUndefined()
  })
  it('warmEntries อุ่นทุกภาพของ entries', async () => {
    FakeImage.prototype.decode = function () { this.decodeCalls++; return Promise.resolve() }
    await warmEntries([{ thumb_path: 'a/t' }, { thumb_path: 'b/t' }], store)
    expect(made.map((i) => i.src)).toEqual(['https://x/a', 'https://x/b'])
  })
  it('within: รอไม่เกินเวลาที่กำหนด ถ้ายังไม่เสร็จปล่อยไปก่อน', async () => {
    vi.useFakeTimers()
    let done = false
    const p = within(new Promise(() => {}), 150).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(149)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(done).toBe(true)
    vi.useRealTimers()
  })
})
