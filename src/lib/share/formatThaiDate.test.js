// ทดสอบการจัดรูปวันที่ภาษาไทย (พ.ศ.) ของการ์ดเก็บรูป
import { describe, expect, it } from 'vitest'
import { formatThaiDate } from '@/lib/share/formatThaiDate'
import { cardPhotoFileName, dayCardFileName, photoOnlyFileName } from '@/lib/share/fileNames'

describe('formatThaiDate', () => {
  it('อังคาร 13 ตุลาคม 2569 (พ.ศ. ไม่มีคำว่า "วัน")', () => {
    expect(formatThaiDate(new Date(2026, 9, 13))).toBe('อังคาร 13 ตุลาคม 2569')
  })

  it('ขอบปี: 1 มกราคม และ 31 ธันวาคม', () => {
    expect(formatThaiDate(new Date(2027, 0, 1))).toBe('ศุกร์ 1 มกราคม 2570')
    expect(formatThaiDate(new Date(2026, 11, 31))).toBe('พฤหัสบดี 31 ธันวาคม 2569')
  })

  it('ไม่ขึ้นกับเวลาของวัน (ใช้ปฏิทินท้องถิ่น)', () => {
    expect(formatThaiDate(new Date(2026, 9, 13, 23, 59))).toBe('อังคาร 13 ตุลาคม 2569')
    expect(formatThaiDate(new Date(2026, 9, 13, 0, 0))).toBe('อังคาร 13 ตุลาคม 2569')
  })
})

describe('ชื่อไฟล์', () => {
  const entry = { local_date: '2026-10-13', local_time: '09:05' }

  it('การ์ดภาพ: colorscrap-YYYY-MM-DD-HHmm.png', () => {
    expect(cardPhotoFileName(entry)).toBe('colorscrap-2026-10-13-0905.png')
  })

  it('เฉพาะภาพ: colorscrap-photo-YYYY-MM-DD-HHmm.png', () => {
    expect(photoOnlyFileName(entry)).toBe('colorscrap-photo-2026-10-13-0905.png')
  })

  it('การ์ดวัน: colorscrap-day-YYYY-MM-DD.png', () => {
    expect(dayCardFileName('2026-10-13')).toBe('colorscrap-day-2026-10-13.png')
  })
})
