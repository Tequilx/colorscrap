import { describe, expect, it } from 'vitest'
import { graphemesOf, maskName } from '@/lib/share/maskName'

// fallback ที่ไม่ใช้ Intl.Segmenter (เบราว์เซอร์เก่า): ทดสอบแยกด้วยการส่งฟังก์ชันตัดเอง
const fallback = (text) => {
  const original = Intl.Segmenter
  Intl.Segmenter = undefined
  try {
    return graphemesOf(text)
  } finally {
    Intl.Segmenter = original
  }
}

describe('maskName', () => {
  it('ตัวอย่างจากสเปก', () => {
    expect(maskName('สมใจ')).toBe('ส••จ')
    expect(maskName('ศศิธร')).toBe('ศ••ร')
    expect(maskName('มด')).toBe('ม•')
    expect(maskName('Alexander')).toBe('A•••r')
  })

  it('ว่าง/ช่องว่างล้วน/ไม่มีค่า → สตริงว่าง (ซ่อนบรรทัด "โดย")', () => {
    expect(maskName('')).toBe('')
    expect(maskName('   ')).toBe('')
    expect(maskName(null)).toBe('')
    expect(maskName(undefined)).toBe('')
  })

  it('ตัดช่องว่างหัวท้ายก่อน', () => {
    expect(maskName('  สมใจ  ')).toBe('ส••จ')
  })

  it('1 ตัว และ 2 ตัว → ตัวแรก + •', () => {
    expect(maskName('ก')).toBe('ก•')
    expect(maskName('กข')).toBe('ก•')
  })

  it('3 ตัว → จุดเดียว, 4 ตัว → 2 จุด, 5 ตัวขึ้นไป → ไม่เกิน 3 จุด', () => {
    expect(maskName('กขค')).toBe('ก•ค')
    expect(maskName('กขคง')).toBe('ก••ง')
    expect(maskName('กขคงจ')).toBe('ก•••จ')
    expect(maskName('กขคงจฉชซ')).toBe('ก•••ซ')
  })

  it('สระบน/ล่าง/วรรณยุกต์ติดกับพยัญชนะ ไม่ถูกตัดครึ่ง', () => {
    expect(maskName('ปิยะ')).toBe('ปิ•ะ') // ปิ, ย, ะ = 3 grapheme (ไม่ใช่ ป + ิ แยกกัน)
    expect(maskName('ก้อง')).toBe('ก้•ง') // ก้, อ, ง (วรรณยุกต์อยู่กับ ก)
    expect(maskName('ผู้')).toBe('ผู้•') // ผู้ เป็นหนึ่งตัว
    expect(maskName('ที่')).toBe('ที่•')
    expect(maskName('สุขใจ')).toBe('สุ••จ') // สุ, ข, ใ, จ
  })

  it('สระหน้าอยู่ก้อนเดียวกับพยัญชนะตัวถัดไป (ไม่ลอยเดี่ยว) จำนวนจุดคงเดิม', () => {
    expect(maskName('ไข่หวาน')).toBe('ไข่•••น') // ไ,ข่,ห,ว,า,น = 6 → 3 จุด
    expect(maskName('สมใจ')).toBe('ส••จ') // ตามสเปก (สระหน้าไม่ใช่ตัวแรก)
    expect(maskName('เมย์')).toBe('เม•ย์') // เ,ม,ย์ = 3 → 1 จุด
    expect(maskName('เก')).toBe('เก•')
    expect(maskName('เ')).toBe('เ•')
    expect(maskName('Alexander')).toBe('A•••r')
  })

  it('ตัวอักษรที่ไม่ใช่ BMP (อีโมจิ) นับเป็นตัวเดียว', () => {
    expect(maskName('🐱ใจ')).toBe('🐱•จ')
  })

  it('fallback: ไม่มี Intl.Segmenter ก็รวมสระ/วรรณยุกต์เข้ากับพยัญชนะ', () => {
    expect(fallback('ศศิธร')).toEqual(['ศ', 'ศิ', 'ธ', 'ร'])
    expect(fallback('ก้อง')).toEqual(['ก้', 'อ', 'ง'])
    expect(fallback('ผู้')).toEqual(['ผู้'])
    expect(fallback('Alexander')).toHaveLength(9)
  })

  it('fallback ให้ผลเดียวกับ Segmenter กับชื่อที่ไม่มีสระหน้า', () => {
    for (const name of ['ศศิธร', 'ก้อง', 'ปิยะ', 'ผู้', 'Alexander']) {
      expect(maskName(name, fallback)).toBe(maskName(name))
    }
  })
})
