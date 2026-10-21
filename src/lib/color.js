// ฟังก์ชันสีพื้นฐาน (ผสม RGB ธรรมดา ไม่ใช่ mixColors ของจานสีประจำวัน)
import { PALETTE } from '@/lib/tokens'

export const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

// ผสมสี a เข้าหาสี b ด้วยสัดส่วน t (0 = a ล้วน, 1 = b ล้วน)
export const mixRgb = (a, b, t) => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex(ca.map((v, i) => v * (1 - t) + cb[i] * t))
}

// สันปกและสายรัดคำนวณจากสีปก ผสมไปทางสี ink (SPEC §3.1)
export const coverSpine = (cover) => mixRgb(cover, PALETTE.ink, 0.14)
export const coverStrap = (cover) => mixRgb(cover, PALETTE.ink, 0.32)

// สีตัวหนังสือบนพื้นสีใดก็ได้ เลือกขาวหรือ ink ที่ contrast สูงกว่า (SPEC §10: ไม่ต่ำกว่า 4.5:1)
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const readableOn = (bg) =>
  contrast(bg, '#FFFFFF') >= contrast(bg, PALETTE.ink) ? '#FFFFFF' : PALETTE.ink

// ความสว่าง HSL (0..1) = (max + min) / 2 ใช้ตัดสินว่าสีจางจนกลืนกระดาษ (> PALE_L) ต้องใส่ขอบจาง ๆ ให้เห็นบนกระดาษ
export const lightnessOf = (hex) => {
  const [r, g, b] = hexToRgb(hex)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510
}
export const PALE_L = 0.9
export const isPale = (hex) => lightnessOf(hex) > PALE_L
