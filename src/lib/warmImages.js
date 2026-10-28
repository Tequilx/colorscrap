// อุ่นภาพของวันไว้ก่อนพลิกหน้า: โหลด + decode ภาพย่อด้วย Image() ตัวถือไว้ แล้วภาพจริงในสมุด (URL เดียวกัน) ใช้แคชเดิม ไม่เพิ่มคำขอ
// ภาพที่ยังเป็น Blob ในเครื่อง (เพิ่งบันทึก) ข้าม: object URL สร้างต่อ component และโหลดทันทีอยู่แล้ว
const MAX_HELD = 48
const held = new Map() // url → { img, ready: Promise }

export const warmUrl = (url) => {
  if (!url || typeof Image === 'undefined') return Promise.resolve()
  const hit = held.get(url)
  if (hit) {
    held.delete(url) // ใช้ล่าสุด ย้ายไปท้าย
    held.set(url, hit)
    return hit.ready
  }
  const img = new Image()
  img.src = url
  const ready = (img.decode ? img.decode() : Promise.resolve()).catch(() => {})
  held.set(url, { img, ready })
  while (held.size > MAX_HELD) held.delete(held.keys().next().value)
  return ready
}

// URL ภาพย่อของ entries ที่ต้องขอจาก Storage (ไม่มี Blob ในเครื่อง และ signed URL พร้อมแล้ว) store = useImageUrlsStore()
export const thumbUrlsOf = (entries, store) =>
  entries
    .filter((e) => !e.thumb && e.thumb_path)
    .map((e) => store.get(e.thumb_path))
    .filter(Boolean)

export const warmEntries = (entries, store) => Promise.all(thumbUrlsOf(entries, store).map(warmUrl))

// รอ promise ได้ไม่เกิน ms (ไม่โยน error) ใช้กับ "รอได้ ~150 ms ถ้ายังไม่เสร็จเริ่มพลิกไปเลย"
export const within = (promise, ms) =>
  Promise.race([Promise.resolve(promise).catch(() => {}), new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))])

export const clearWarm = () => held.clear()
