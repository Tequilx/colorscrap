// ทดสอบแท็บวันเลื่อนตามวันที่เปิดและฟังก์ชันของปฏิทิน (lib/dayTabs.js)
import { describe, it, expect } from 'vitest'
import { bootDatesOf, clampMonth, monthCells, monthIndex, monthOfIndex, monthRange, slideStart, summariesToDays } from './dayTabs'

const days = (n) => Array.from({ length: n }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`) // 01..n

describe('slideStart (แท็บ 4 วันเลื่อนรอบวันที่เปิด)', () => {
  const d = days(20)
  it('เปิดวันล่าสุด (วันนี้) ครั้งแรก = หน้าต่างท้ายสุด วันนี้อยู่ขวาสุด', () => {
    const s = slideStart(d, '2026-01-20')
    expect(d.slice(s, s + 4).at(-1)).toBe('2026-01-20')
  })
  it('เปิดวันเก่าครั้งแรก = วางเป็นแท็บที่ 2', () => {
    expect(slideStart(d, '2026-01-10')).toBe(8) // idx 9 → start 8
  })
  it('ติดขอบ: วันแรกอยู่ซ้ายสุด', () => {
    expect(slideStart(d, '2026-01-01')).toBe(0)
  })
  it('อยู่ในหน้าต่างเดิม = ไม่ขยับ (กดแท็บไม่กระโดด)', () => {
    expect(slideStart(d, '2026-01-12', 8)).toBe(8)
  })
  it('พลิกถอยหลังทีละวันออกนอกหน้าต่าง = วันนั้นเป็นแท็บซ้ายสุด, ไปข้างหน้า = ขวาสุด', () => {
    expect(slideStart(d, '2026-01-08', 8)).toBe(7) // idx 7 < start 8
    expect(slideStart(d, '2026-01-13', 8)).toBe(9) // idx 12 = start+4
  })
  it('กระโดดไกลจากปฏิทิน = แท็บที่ 2', () => {
    expect(slideStart(d, '2026-01-03', 14)).toBe(1)
  })
  it('น้อยกว่า 4 วัน = แสดงทั้งหมด start 0', () => {
    expect(slideStart(days(3), '2026-01-02')).toBe(0)
    expect(slideStart([], null)).toBe(0)
  })
  it('วันที่เปิดไม่มีในรายการ ใช้หน้าต่างเดิม', () => {
    expect(slideStart(d, '2025-01-01', 5)).toBe(5)
  })
})

describe('summariesToDays / bootDatesOf', () => {
  const row = (date, time, hex, intensity = 1) => ({ local_date: date, local_time: time, intensity, colors: [{ hex, ratio: 1 }] })
  it('จัดกลุ่มตามวัน เรียงเก่า → ใหม่ และคิดสีเด่นของวัน', () => {
    const out = summariesToDays([row('2026-01-02', '10:00', '#5FA3C8'), row('2026-01-01', '09:00', '#E4572E'), row('2026-01-02', '12:00', '#5FA3C8')])
    expect(out.map((x) => x.date)).toEqual(['2026-01-01', '2026-01-02'])
    expect(out[0].hex).toBe('#E4572E')
    expect(out[1].hex).toBe('#5FA3C8')
  })
  it('bootDatesOf: 7 วันปฏิทินล่าสุด + 3 วันล่าสุดที่มีภาพ (เฉพาะวันที่มีจริง)', () => {
    const all = ['2025-12-01', '2025-12-20', '2026-01-03', '2026-01-08', '2026-01-09']
    expect(bootDatesOf(all, new Date(2026, 0, 10))).toEqual(['2026-01-03', '2026-01-08', '2026-01-09'])
    expect(bootDatesOf(all, new Date(2026, 5, 1))).toEqual(['2026-01-03', '2026-01-08', '2026-01-09']) // นานแล้ว: เหลือ 3 วันล่าสุด
    expect(bootDatesOf([], new Date())).toEqual([])
  })
})

describe('ปฏิทิน', () => {
  it('monthCells: เริ่มวันอาทิตย์ เติมช่องว่างหัว/ท้าย (ต.ค. 2026 เริ่มวันพฤหัส)', () => {
    const w = monthCells(2026, 9)
    expect(w.every((r) => r.length === 7)).toBe(true)
    expect(w[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(w[0][4]).toBe('2026-10-01')
    expect(w.flat().filter(Boolean)).toHaveLength(31)
    expect(w.flat().filter(Boolean).at(-1)).toBe('2026-10-31')
  })
  it('monthCells: กุมภาพันธ์ปีอธิกสุรทิน 29 วัน', () => {
    expect(monthCells(2028, 1).flat().filter(Boolean)).toHaveLength(29)
  })
  it('monthIndex/monthOfIndex/monthRange/clampMonth', () => {
    expect(monthOfIndex(monthIndex('2026-03-15'))).toEqual({ year: 2026, month0: 2 })
    const r = monthRange(['2026-01-05', '2026-03-02'], new Date(2026, 4, 9))
    expect(r).toEqual({ min: monthIndex('2026-01-01'), max: monthIndex('2026-05-01') })
    expect(clampMonth(0, r)).toBe(r.min)
    expect(clampMonth(1e9, r)).toBe(r.max)
    expect(monthRange([], new Date(2026, 4, 9))).toEqual({ min: monthIndex('2026-05-01'), max: monthIndex('2026-05-01') })
  })
})
