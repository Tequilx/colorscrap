// เซนเซอร์ชื่อผู้ใช้บนการ์ดที่จะแชร์ (SPEC ส่วนที่ 2 §6): ตัวแรก + • + ตัวสุดท้าย นับตาม grapheme (ตัวอักษรที่ตาเห็นเป็นหนึ่งตัว)
// ภาษาไทยมีสระบน/ล่างและวรรณยุกต์ซ้อนกับพยัญชนะ การนับ code point จะตัดครึ่งตัวอักษรแล้วสระลอย

const MAX_DOTS = 3

// เครื่องหมายที่ต้องติดกับตัวก่อนหน้า: ไม้หันอากาศ สระบน/ล่าง (ิ-ฺ) ไม้ไต่คู้ วรรณยุกต์ การันต์ ฯลฯ (ใช้เมื่อไม่มี Intl.Segmenter)
const THAI_COMBINING = /[ัิ-ฺ็-๎]/

const fallbackGraphemes = (text) => {
  const out = []
  for (const ch of Array.from(text)) {
    if (out.length && (THAI_COMBINING.test(ch) || /\p{M}/u.test(ch))) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

export const graphemesOf = (text) => {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  }
  return fallbackGraphemes(text)
}

// ว่าง → '' (ผู้เรียกซ่อนบรรทัด "โดย") · 1–2 ตัว → ตัวแรก + • · 3 ตัวขึ้นไป → ตัวแรก + • × min(n−2, 3) + ตัวสุดท้าย
export const maskName = (name, graphemes = graphemesOf) => {
  const list = graphemes(String(name ?? '').trim())
  if (!list.length) return ''
  if (list.length <= 2) return list[0] + '•'
  return list[0] + '•'.repeat(Math.min(list.length - 2, MAX_DOTS)) + list[list.length - 1]
}
