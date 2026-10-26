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

// ---- OKLab (ข้อ 50i) ใช้วัดความใกล้กันของสีแบบที่ตาเห็น ----
const toLinear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
// rgb 0..255 → [L, a, b] (L 0..1, a/b ราว −0.4..0.4)
export const rgbToOklab = (r, g, b) => {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
export const hexToOklab = (hex) => rgbToOklab(...hexToRgb(hex))
const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
export const oklabToHex = ([L, a, b]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (v) => Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v)))))
  return rgbToHex([clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)])
}
