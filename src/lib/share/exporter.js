// สร้างรูปที่จะเก็บ: โหลดภาพของ entry (ทำในเครื่องทั้งหมด ไม่อัปโหลดอะไรขึ้นไป) แล้วเรียกตัววาดการ์ด
// ภาพที่ยังอยู่ในเครื่อง (entry.image/thumb เป็น Blob) ใช้ตรง ๆ ภาพที่อยู่ใน Storage (bucket private) ขอ signed URL → fetch → blob → createImageBitmap
// เพื่อให้ canvas ไม่ tainted (วาด <img> ข้ามโดเมนแล้ว toBlob จะ error) โหมดจำลองไม่มีภาพจริง → null (การ์ดวาดหยดสีจำลองจากสี)
import { signPaths } from '@/lib/remote'
import { C, canvasToBlob, makeCanvas } from '@/lib/share/cardDraw'
import { renderDayCard, renderPhotoCard, renderPlaceholder } from '@/lib/share/cards'
import { cardPhotoFileName, dayCardFileName, photoOnlyFileName } from '@/lib/share/fileNames'

// kind: 'image' (ภาพเต็ม) | 'thumb' (ภาพย่อ) → ImageBitmap | null
export const loadEntryBitmap = async (entry, kind = 'image') => {
  let blob = entry[kind] ?? null
  const path = entry[`${kind}_path`]
  if (!blob && path) {
    const [signed] = await signPaths([path], 120)
    if (!signed) throw new Error('ขอลิงก์ภาพไม่สำเร็จ')
    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error(`โหลดภาพไม่สำเร็จ (${res.status})`)
    blob = await res.blob()
  }
  return blob ? createImageBitmap(blob) : null
}

const closeBitmap = (bitmap) => bitmap?.close?.()

// การ์ดภาพพร้อมชาร์ตสี (7a)
export const makePhotoCard = async (entry, userName) => {
  const image = await loadEntryBitmap(entry, 'image')
  try {
    return { blob: await renderPhotoCard({ entry, image, userName }), filename: cardPhotoFileName(entry) }
  } finally {
    closeBitmap(image)
  }
}

// เฉพาะภาพ: ภาพที่บันทึกไว้ตามความละเอียดเดิม แปลงเป็น PNG ไม่มีกรอบหรือข้อความ
export const makePhotoOnly = async (entry) => {
  const image = await loadEntryBitmap(entry, 'image')
  try {
    const canvas = image ? makeCanvas(image.width, image.height) : makeCanvas(1600, 880)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = C.paper
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (image) ctx.drawImage(image, 0, 0)
    else {
      // ข้อมูลจำลองไม่มีภาพจริง: ใช้ตัววาดภาพจำลองเดียวกับการ์ด
      renderPlaceholder(ctx, 0, 0, canvas.width, canvas.height, entry.colors)
    }
    return { blob: await canvasToBlob(canvas), filename: photoOnlyFileName(entry) }
  } finally {
    closeBitmap(image)
  }
}

// การ์ดจานสีของวัน (7b): entries = ภาพของวันนั้น (เรียงตามเวลา) ใช้ภาพย่อ 3 ภาพล่าสุดเท่านั้น
export const makeDayCard = async (date, entries, userName) => {
  const latest = [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time)).slice(-3)
  const thumbs = new Map()
  const bitmaps = []
  try {
    for (const e of latest) {
      const bmp = await loadEntryBitmap(e, 'thumb')
      if (bmp) {
        thumbs.set(e.id, bmp)
        bitmaps.push(bmp)
      }
    }
    return { blob: await renderDayCard({ date, entries, thumbs, userName }), filename: dayCardFileName(date) }
  } finally {
    bitmaps.forEach(closeBitmap)
  }
}
