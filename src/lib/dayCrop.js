// ชิ้นสีของวัน (ข้อ 49, 50i): ครอปจากภาพที่ผู้ใช้ระบายจริง ใช้ในกรอบ "สีของวัน" ของจานสีในสมุดและการ์ดเก็บรูปของวัน (ผลครอปและชื่อเดียวกัน)
// ทางหลัก: ใช้สีผสมของวัน (ที่ชื่อสีอ้างถึง) เป็นเป้าหมาย ค้นทุกภาพของวัน (ภาพย่อ ~128px) หาภาพ+ตำแหน่งที่ใกล้สีเป้าหมายมากที่สุด แล้วครอปจากภาพเต็ม
// ทาง fallback: ไม่มีภาพที่มีสีนี้จริง (คะแนน < MIN_MATCH) → ครอปส่วนที่สีเยอะสุดของภาพที่เลือกตามข้อ 49 แล้วตั้งชื่อสีใหม่จากชิ้นนั้น
// โหลดภาพ: Blob ในเครื่อง / signed URL ที่ imageUrls cache ไว้แล้ว (ภาพย่อ ไม่ขอ URL ใหม่) / loadEntryBitmap ตัวเดิม (ภาพเต็ม 1 ครั้งต่อวันเฉพาะภาพที่ชนะ) ผลเก็บในหน่วยความจำต่อวัน
import { oklabToHex, hexToOklab } from '@/lib/color'
import { C, canvasToBlob, makeCanvas } from '@/lib/share/cardDraw'
import { bestWindow, bestWindowOf, dominantOfPixels, MIN_MATCH, pickSourceEntry, SAMPLE_LONG, scaleWindow, targetScores } from '@/lib/cropWindow'
import { colorPartFromTone, dayColor } from '@/lib/palette'
import { loadEntryBitmap } from '@/lib/share/exporter'
import { useImageUrlsStore } from '@/stores/imageUrls'

const OUT_MAX = 480 // ด้านของชิ้นที่ครอปออกมา (px) พอสำหรับการ์ด
const MOCK_W = 1112
const MOCK_H = 612

const cache = new Map() // key ของวัน → Promise<ผล | null>
const done = new Map() // key → ผลที่เสร็จแล้ว (อ่านแบบ sync ได้ ไม่กะพริบตอนกลับมาวันเดิม)

export const dayCropKey = (entries) => (entries.length ? entries.map((e) => e.id).sort().join('|') : null)

// ข้อมูลจำลองไม่มีภาพจริง: ใช้ภาพสีน้ำจำลองจากสีของ entry (ตัววาดเดียวกับการ์ด) บนกระดาษ
const mockPainting = async (entry, w = MOCK_W) => {
  const { renderPlaceholder } = await import('@/lib/share/cards')
  const h = Math.round((w * MOCK_H) / MOCK_W)
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, w, h)
  renderPlaceholder(ctx, 0, 0, w, h, entry.colors)
  return canvas
}

// ภาพย่อสำหรับค้น: Blob ในเครื่อง ไม่งั้นใช้ signed URL ที่ cache ไว้แล้วของภาพย่อ ไม่มีก็ใช้ตัวโหลดเดิม
const loadSample = async (entry) => {
  if (entry.thumb) return createImageBitmap(entry.thumb)
  if (entry.thumb_path) {
    const url = useImageUrlsStore().get(entry.thumb_path)
    if (url) {
      try {
        const res = await fetch(url)
        if (res.ok) return await createImageBitmap(await res.blob())
      } catch {
        /* ใช้ตัวโหลดเดิมแทน */
      }
    }
    return loadEntryBitmap(entry, 'thumb')
  }
  return entry.image || entry.image_path ? loadEntryBitmap(entry, 'image') : mockPainting(entry, 480)
}

const loadFull = async (entry) => (await loadEntryBitmap(entry, 'image')) ?? mockPainting(entry)

// ย่อเหลือด้านยาว SAMPLE_LONG แล้วอ่านพิกเซล
const sampleOf = (bitmap) => {
  const k = SAMPLE_LONG / Math.max(bitmap.width, bitmap.height)
  const w = Math.max(1, Math.round(bitmap.width * k))
  const h = Math.max(1, Math.round(bitmap.height * k))
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  return { pixels: ctx.getImageData(0, 0, w, h).data, w, h }
}

const compute = async (entries) => {
  const day = dayColor(entries)
  if (!day) return null
  const targetHex = day.mix
  const targetLab = hexToOklab(targetHex)

  // 1) ค้นทุกภาพ: ภาพ+ตำแหน่งที่ใกล้สีเป้าหมายที่สุด
  const samples = []
  for (const entry of entries) {
    let bmp = null
    try {
      bmp = await loadSample(entry)
      const s = sampleOf(bmp)
      samples.push({ entry, ...s, win: bestWindowOf(targetScores(s.pixels, s.w, s.h, targetLab), s.w, s.h) })
    } catch (e) {
      console.error('โหลดภาพย่อไม่สำเร็จ:', e)
    } finally {
      bmp?.close?.()
    }
  }
  if (!samples.length) return null
  const best = samples.reduce((a, b) => (b.win.mean > a.win.mean ? b : a))
  const viaTarget = best.win.mean >= MIN_MATCH

  // 2) เลือกภาพ+หน้าต่าง: ทางหลักตามสีเป้าหมาย / fallback ข้อ 49 (ภาพต้นทาง = ถูกใจ/ล่าสุด หน้าต่างที่สีเยอะสุด)
  let pick = best
  let win = best.win
  if (!viaTarget) {
    pick = samples.find((s) => s.entry.id === pickSourceEntry(entries).id) ?? best
    win = bestWindow(pick.pixels, pick.w, pick.h)
  }

  // 3) ครอปจากภาพเต็ม
  const full = await loadFull(pick.entry)
  try {
    const rect = scaleWindow(win, pick.w, pick.h, full.width, full.height)
    const size = Math.min(rect.size, OUT_MAX)
    const out = makeCanvas(size, size)
    const octx = out.getContext('2d')
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(full, rect.x, rect.y, rect.size, rect.size, 0, 0, size, size)
    const result = { blob: await canvasToBlob(out), size, via: viaTarget ? 'target' : 'fallback', target: targetHex, score: best.win.mean, entryId: pick.entry.id, colorPart: null }
    if (!viaTarget) {
      // ตั้งชื่อใหม่จากชิ้นที่ครอป
      const s = sampleOf(out)
      const tone = dominantOfPixels(s.pixels, s.w, s.h)
      if (tone) {
        result.toneHex = oklabToHex(tone.lab)
        result.colorPart = colorPartFromTone(result.toneHex, tone.L, tone.C)
      }
    }
    return result
  } finally {
    full.close?.()
  }
}

// ผลที่เสร็จแล้วของวันนั้น (sync) หรือ undefined
export const dayCropDone = (entries) => done.get(dayCropKey(entries))

// คืนผลของวัน { blob, size, via: 'target' | 'fallback', target, score, colorPart (เฉพาะ fallback = ชื่อสีใหม่) } (null = โหลดภาพไม่ได้ ผู้เรียกใช้ทางเลือกอื่น) ไม่โยน error
export const getDayCrop = (entries) => {
  const key = dayCropKey(entries)
  if (!key) return Promise.resolve(null)
  if (!cache.has(key)) {
    cache.set(
      key,
      compute(entries)
        .then((r) => {
          if (r) done.set(key, r)
          else cache.delete(key)
          return r
        })
        .catch((e) => {
          console.error('ครอปชิ้นสีของวันไม่สำเร็จ:', e)
          cache.delete(key)
          return null
        }),
    )
  }
  return cache.get(key)
}

// ออกจากระบบ: ลืมผลครอปของคนก่อน
export const clearDayCrops = () => {
  cache.clear()
  done.clear()
}
