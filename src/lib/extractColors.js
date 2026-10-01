// ดูดสีจากภาพที่ผู้ใช้ระบาย (SPEC §6.6) เพื่อให้จานสีมาจากสีที่ผสมเองจริง
import { getPaletteSync } from 'colorthief'
import { PALETTE } from '@/lib/tokens'
import { hexToRgb, rgbToHex } from '@/lib/color'

const SAMPLE_SIZE = 200 // ด้านยาวของภาพที่ใช้ดูดสี
const PAPER_DISTANCE = 28 // ระยะ RGB ที่ถือว่าเป็นกระดาษ (ปรับจูนได้) ต่ำกว่านี้ตัดทิ้ง แต่สีจางของน้ำซึมที่ไกลกว่านี้ยังเก็บ
const MAX_COLORS = 5
const PALETTE_SIZE = 8

const paperRgb = hexToRgb(PALETTE.paper)
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// ฟังก์ชันบริสุทธิ์ (ทดสอบได้โดยไม่ต้องมี canvas): pixels = RGBA ของภาพย่อ, palette = hex จาก colorthief
// คืน [{ hex, ratio }] สูงสุด 5 สี เรียงมากไปน้อย ratio รวม 1 ถ้าไม่มี pixel ที่ไม่ใช่กระดาษเลยคืน fallbackHex ratio 1
export const pickColors = (pixels, paletteHex, fallbackHex) => {
  // สีในจานที่ใกล้กระดาษไม่ต้องใช้ (ไม่เอามาแย่งช่องกับสีจริง)
  const palette = paletteHex.map(hexToRgb).filter((c) => distance(c, paperRgb) >= PAPER_DISTANCE)
  const counts = new Array(palette.length).fill(0)
  const sum = [0, 0, 0]
  let total = 0

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const px = [pixels[i], pixels[i + 1], pixels[i + 2]]
    if (distance(px, paperRgb) < PAPER_DISTANCE) continue
    total++
    sum[0] += px[0]
    sum[1] += px[1]
    sum[2] += px[2]
    let best = -1
    let bestD = Infinity
    palette.forEach((c, j) => {
      const d = distance(px, c)
      if (d < bestD) {
        bestD = d
        best = j
      }
    })
    if (best >= 0) counts[best]++
  }

  if (total === 0) return [{ hex: fallbackHex, ratio: 1 }]

  let result = palette
    .map((c, j) => ({ hex: rgbToHex(c), n: counts[j] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_COLORS)
  // colorthief ไม่ให้สีมาเลย (ทั้งภาพจางมาก) ใช้สีเฉลี่ยของส่วนที่ไม่ใช่กระดาษแทน
  if (result.length === 0) result = [{ hex: rgbToHex(sum.map((v) => v / total)), n: total }]

  const kept = result.reduce((s, c) => s + c.n, 0)
  const colors = result.map((c) => ({ hex: c.hex, ratio: Math.round((c.n / kept) * 1000) / 1000 }))
  // ปัดเศษแล้วให้ผลรวมเป็น 1 พอดี
  const diff = 1 - colors.reduce((s, c) => s + c.ratio, 0)
  colors[0].ratio = Math.round((colors[0].ratio + diff) * 1000) / 1000
  return colors
}

// ย่อ canvas ให้ด้านยาว SAMPLE_SIZE แล้วคืน { canvas, pixels } โดย pixel ที่เป็นกระดาษถูกทำให้โปร่งใส
// เพื่อไม่ให้ colorthief เอากระดาษไปกินช่องจาน 8 สี (spec ให้วางบนพื้นกระดาษแล้วตัดทีหลัง ผลเหมือนกันแต่ได้สีจริงมากกว่า)
const sampleOf = (source) => {
  const scale = SAMPLE_SIZE / Math.max(source.width, source.height)
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = PALETTE.paper
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const pixels = image.data
  const masked = new Uint8ClampedArray(pixels)
  for (let i = 0; i < masked.length; i += 4) {
    if (distance([masked[i], masked[i + 1], masked[i + 2]], paperRgb) < PAPER_DISTANCE) masked[i + 3] = 0
  }
  ctx.putImageData(new ImageData(masked, w, h), 0, 0)
  return { canvas, pixels }
}

// source: canvas ของผ้าใบ (พื้นเป็นสีกระดาษอยู่แล้ว), fallbackHex: สีอารมณ์ ใช้เมื่อไม่มีสีบนผ้าใบ
export const extractColors = (source, fallbackHex) => {
  try {
    const { canvas, pixels } = sampleOf(source)
    let palette = []
    try {
      palette = (getPaletteSync(canvas, { colorCount: PALETTE_SIZE, quality: 1, ignoreWhite: false }) ?? []).map((c) => c.hex())
    } catch {
      // ภาพโปร่งใสทั้งภาพ colorthief อาจโยน error: ให้ pickColors ตัดสินเอง
    }
    return pickColors(pixels, palette, fallbackHex)
  } catch (error) {
    console.error('ดูดสีไม่สำเร็จ:', error)
    return [{ hex: fallbackHex, ratio: 1 }]
  }
}
