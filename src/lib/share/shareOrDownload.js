// ส่งรูปให้ผู้ใช้ (SPEC ส่วนที่ 2 §9): แชร์ได้ → Web Share (iPad เปิดหน้าแชร์ ให้กด "บันทึกรูปภาพ") ไม่ได้ → ดาวน์โหลดเป็นไฟล์
// คืนสถานะให้ UI ตัดสินใจ: 'shared' | 'cancelled' | 'downloaded' | 'blocked'
//   cancelled = ผู้ใช้กดยกเลิกหน้าแชร์ (เงียบ ไม่ขึ้น error)
//   blocked = NotAllowedError: การแชร์หลุดจากจังหวะที่ผู้ใช้กด (ทำรูปนานเกินกว่าที่เบราว์เซอร์ยอมให้ถือสิทธิ์ไว้) UI เก็บไฟล์ไว้
//             แล้วให้ปุ่ม "แตะเพื่อบันทึก" เรียกอีกครั้งในจังหวะแตะใหม่ (ไม่ดาวน์โหลดให้เอง เพราะบน iPad ไฟล์จะไปอยู่ที่ที่หาไม่เจอ)
// ข้อผิดพลาดอื่นโยนต่อให้ผู้เรียก

export const makeFile = (blob, filename) => new File([blob], filename, { type: blob.type || 'image/png' })

export const canShareFile = (file) => {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [file] }))
  } catch {
    return false
  }
}

// ดาวน์โหลดด้วย <a download> + object URL แล้ว revoke ทีหลัง (ให้เบราว์เซอร์เริ่มโหลดทันก่อน)
export const downloadFile = (file) => {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const shareOrDownload = async (blob, filename) => {
  const file = blob instanceof File ? blob : makeFile(blob, filename)
  if (!canShareFile(file)) {
    downloadFile(file)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled'
    if (error?.name === 'NotAllowedError') return 'blocked'
    throw error
  }
}
