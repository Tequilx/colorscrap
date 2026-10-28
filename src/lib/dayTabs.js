// แท็บวันและปฏิทินของสมุด: ฟังก์ชันล้วน ไม่แตะ Vue/store (ทดสอบใน dayTabs.test.js)
import { addDays, localDateStr, parseLocalDate } from '@/lib/dates'
import { dominantColorOfDay } from '@/lib/palette'

export const TAB_COUNT = 4

// แถวสรุปรายวันจากเซิร์ฟเวอร์ [{ local_date, local_time, intensity, colors }] → [{ date, hex }] เรียงเก่า → ใหม่ (สีเด่นของวันสูตรเดียวกับหน้าจานสี)
export const summariesToDays = (rows) => {
  const byDate = new Map()
  for (const r of rows) {
    if (!byDate.has(r.local_date)) byDate.set(r.local_date, [])
    byDate.get(r.local_date).push(r)
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, hex: dominantColorOfDay(list) }))
}

// วันที่ต้องโหลดรายละเอียดตอนเปิดแอป: 7 วันปฏิทินล่าสุด (แถบหน้าปก) + 3 วันล่าสุดที่มีภาพ (แท็บบนปก) + วันล่าสุด เฉพาะวันที่มีภาพจริง
export const bootDatesOf = (dates, today = new Date()) => {
  const week = new Set(Array.from({ length: 7 }, (_, i) => localDateStr(addDays(today, -i))))
  const want = new Set([...dates.slice(-3), ...dates.filter((d) => week.has(d))])
  return dates.filter((d) => want.has(d))
}

// หน้าต่างแท็บ 4 วันที่เลื่อนรอบวันที่เปิดอยู่ นับเฉพาะวันที่มีภาพ (dates เรียงเก่า → ใหม่)
//  · เปิดครั้งแรก: วันที่เปิดเป็นวันล่าสุด = หน้าต่างท้ายสุด (วันนี้อยู่ขวาสุด) ไม่งั้นวางวันที่เปิดเป็นแท็บที่ 2
//  · อยู่ในหน้าต่างอยู่แล้ว: ไม่ขยับ (กดแท็บไม่ทำให้แท็บกระโดด)
//  · ออกนอกหน้าต่างทีละวัน (พลิกถัดไป/ก่อนหน้า): เลื่อนให้วันนั้นอยู่ขอบ · กระโดดไกล (ปฏิทิน): วางเป็นแท็บที่ 2
// คืน start (ดัชนีแท็บซ้ายสุด) ใช้ dates.slice(start, start + 4)
export const slideStart = (dates, current, prevStart = null, size = TAB_COUNT) => {
  const maxStart = Math.max(0, dates.length - size)
  const clamp = (n) => Math.min(maxStart, Math.max(0, n))
  const idx = dates.indexOf(current)
  if (idx < 0) return clamp(prevStart ?? maxStart)
  if (prevStart == null) return idx === dates.length - 1 ? maxStart : clamp(idx - 1)
  const start = clamp(prevStart)
  if (idx >= start && idx < start + size) return start
  if (idx === start - 1) return clamp(idx)
  if (idx === start + size) return clamp(idx - size + 1)
  return clamp(idx - 1)
}

// ---- ปฏิทิน ----
// เซลล์ของเดือน (month0 = 0..11) เป็นแถวละ 7 วัน เริ่มวันอาทิตย์ (ตรงกับ DAYS_SHORT) ช่องว่างหัว/ท้ายเดือน = null · ค่าอื่น = 'YYYY-MM-DD'
export const monthCells = (year, month0) => {
  const first = new Date(year, month0, 1)
  const count = new Date(year, month0 + 1, 0).getDate()
  const cells = Array(first.getDay()).fill(null)
  for (let d = 1; d <= count; d++) cells.push(localDateStr(new Date(year, month0, d)))
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

// ดัชนีเดือนรวม (ปี*12 + เดือน) ใช้เทียบ/ขยับเดือนง่าย ๆ
export const monthIndex = (dateStr) => {
  const d = parseLocalDate(dateStr)
  return d.getFullYear() * 12 + d.getMonth()
}
export const monthOfIndex = (i) => ({ year: Math.floor(i / 12), month0: i % 12 })
// ช่วงเดือนที่เลื่อนไปได้: เดือนของวันแรกที่มีภาพ ถึงเดือนปัจจุบัน (หรือเดือนของวันล่าสุดถ้าใหม่กว่า) ไม่มีภาพเลย = เดือนปัจจุบันเดือนเดียว
export const monthRange = (dates, today = new Date()) => {
  const now = today.getFullYear() * 12 + today.getMonth()
  if (!dates.length) return { min: now, max: now }
  return { min: Math.min(monthIndex(dates[0]), now), max: Math.max(monthIndex(dates.at(-1)), now) }
}
export const clampMonth = (i, range) => Math.min(range.max, Math.max(range.min, i))
