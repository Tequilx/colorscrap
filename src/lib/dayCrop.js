// ชิ้นสีของวัน (ข้อ 49): ครอปส่วนที่มีสีมากที่สุดจากภาพที่ผู้ใช้ระบายจริง ใช้ในกรอบ "สีของวัน" ของจานสีในสมุดและการ์ดเก็บรูปของวัน (ผลครอปเดียวกัน)
// โหลดภาพด้วย loadEntryBitmap ตัวเดิม (Blob ในเครื่อง ไม่งั้น signed URL ของภาพเต็ม 1 ครั้งต่อวัน) แล้วเก็บผลครอปไว้ในหน่วยความจำ ไม่คำนวณซ้ำ
import { C, canvasToBlob, makeCanvas } from '@/lib/share/cardDraw'
import { bestWindow, pickSourceEntry, SAMPLE_LONG, scaleWindow } from '@/lib/cropWindow'
import { loadEntryBitmap } from '@/lib/share/exporter'

const OUT_MAX = 480 // ด้านของชิ้นที่ครอปออกมา (px) พอสำหรับการ์ด (กรอบ ~284px ที่สเกล 2 ของ SVG)
const MOCK_W = 1112
const MOCK_H = 612

const cache = new Map() // entry.id → Promise<{ blob, size } | null>
const done = new Map() // entry.id → ผลที่เสร็จแล้ว (อ่านแบบ sync ได้ ไม่กะพริบตอนกลับมาวันเดิม)

// ข้อมูลจำลองไม่มีภาพจริง: ใช้ภาพสีน้ำจำลองจากสีของ entry (ตัววาดเดียวกับการ์ด) บนกระดาษ
const mockPainting = async (entry) => {
  const { renderPlaceholder } = await import('@/lib/share/cards')
  const canvas = makeCanvas(MOCK_W, MOCK_H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, MOCK_W, MOCK_H)
  renderPlaceholder(ctx, 0, 0, MOCK_W, MOCK_H, entry.colors)
  return canvas
}

const compute = async (entry) => {
  const bitmap = (await loadEntryBitmap(entry, 'image')) ?? (await mockPainting(entry))
  try {
    const W = bitmap.width
    const H = bitmap.height
    const k = SAMPLE_LONG / Math.max(W, H)
    const sw = Math.max(1, Math.round(W * k))
    const sh = Math.max(1, Math.round(H * k))
    const small = makeCanvas(sw, sh)
    const sctx = small.getContext('2d', { willReadFrequently: true })
    sctx.fillStyle = C.paper
    sctx.fillRect(0, 0, sw, sh)
    sctx.drawImage(bitmap, 0, 0, sw, sh)
    const win = scaleWindow(bestWindow(sctx.getImageData(0, 0, sw, sh).data, sw, sh), sw, sh, W, H)
    const size = Math.min(win.size, OUT_MAX)
    const out = makeCanvas(size, size)
    const octx = out.getContext('2d')
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(bitmap, win.x, win.y, win.size, win.size, 0, 0, size, size)
    return { blob: await canvasToBlob(out), size }
  } finally {
    bitmap.close?.()
  }
}

export const dayCropSource = (entries) => pickSourceEntry(entries)

// ผลที่เสร็จแล้วของ entry นั้น (sync) หรือ undefined
export const dayCropDone = (entry) => (entry ? done.get(entry.id) : undefined)

// คืน { blob, size } ของชิ้นสีวันนี้ (null = โหลดภาพไม่ได้ ผู้เรียกใช้ทางเลือกอื่น) ไม่โยน error
export const getDayCrop = (entries) => {
  const entry = pickSourceEntry(entries)
  if (!entry) return Promise.resolve(null)
  if (!cache.has(entry.id)) {
    cache.set(
      entry.id,
      compute(entry)
        .then((r) => {
          done.set(entry.id, r)
          return r
        })
        .catch((e) => {
          console.error('ครอปชิ้นสีของวันไม่สำเร็จ:', e)
          cache.delete(entry.id)
          return null
        }),
    )
  }
  return cache.get(entry.id)
}

// ออกจากระบบ: ลืมผลครอปของคนก่อน
export const clearDayCrops = () => {
  cache.clear()
  done.clear()
}
