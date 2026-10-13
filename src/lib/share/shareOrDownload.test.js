import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shareOrDownload } from '@/lib/share/shareOrDownload'

const blob = new Blob(['x'], { type: 'image/png' })

// document/URL ปลอมสำหรับเส้นทางดาวน์โหลด (vitest รันบน node)
const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '', rel: '' }
const stubDom = () => {
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } })
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
}
const domError = (name) => Object.assign(new Error(name), { name })

beforeEach(() => {
  vi.useFakeTimers()
  anchor.click.mockClear()
  stubDom()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('shareOrDownload', () => {
  it('แชร์ได้: เรียก navigator.share ด้วยไฟล์เดียวและไม่ดาวน์โหลด', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: vi.fn(() => true), maxTouchPoints: 5 })
    expect(await shareOrDownload(blob, 'a.png')).toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    const [{ files }] = share.mock.calls[0]
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('a.png')
    expect(files[0].type).toBe('image/png')
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it('ผู้ใช้กดยกเลิก (AbortError): เงียบ ไม่ดาวน์โหลด ไม่โยน error', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(domError('AbortError')), canShare: () => true, maxTouchPoints: 5 })
    expect(await shareOrDownload(blob, 'a.png')).toBe('cancelled')
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it('NotAllowedError: คืน blocked ให้ UI เก็บไฟล์ไว้ ไม่ดาวน์โหลดเอง', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(domError('NotAllowedError')), canShare: () => true, maxTouchPoints: 5 })
    expect(await shareOrDownload(blob, 'a.png')).toBe('blocked')
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it('ไม่มี navigator.share: ดาวน์โหลดด้วย <a download> แล้ว revoke ทีหลัง', async () => {
    vi.stubGlobal('navigator', {})
    expect(await shareOrDownload(blob, 'a.png')).toBe('downloaded')
    expect(anchor.download).toBe('a.png')
    expect(anchor.href).toBe('blob:fake')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('มี share แต่ canShare บอกว่าแชร์ไฟล์ไม่ได้ (desktop): ดาวน์โหลด', async () => {
    const share = vi.fn()
    vi.stubGlobal('navigator', { share, canShare: () => false, maxTouchPoints: 5 })
    expect(await shareOrDownload(blob, 'a.png')).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
    expect(anchor.click).toHaveBeenCalledTimes(1)
  })

  it('error อื่นโยนต่อ (ให้ UI ขึ้น "ทำรูปไม่สำเร็จ")', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(domError('DataError')), canShare: () => true, maxTouchPoints: 5 })
    await expect(shareOrDownload(blob, 'a.png')).rejects.toThrow('DataError')
  })

  it('คอมพิวเตอร์ที่ใช้เมาส์: ดาวน์โหลดเสมอ แม้มี navigator.share (Mac)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true, maxTouchPoints: 0 })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(await shareOrDownload(blob, 'a.png')).toBe('downloaded')
    expect(share).not.toHaveBeenCalled()
    expect(anchor.click).toHaveBeenCalledTimes(1)
  })

  it('iPad ที่รายงานตัวเป็น Mac (maxTouchPoints 5): ใช้หน้าแชร์', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true, maxTouchPoints: 5, platform: 'MacIntel' })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(await shareOrDownload(blob, 'a.png')).toBe('shared')
    expect(anchor.click).not.toHaveBeenCalled()
  })

  it('pointer: coarse (maxTouchPoints ไม่รายงาน): ใช้หน้าแชร์', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    vi.stubGlobal('matchMedia', (q) => ({ matches: q === '(pointer: coarse)' }))
    expect(await shareOrDownload(blob, 'a.png')).toBe('shared')
  })
})
