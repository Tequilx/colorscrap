// หาชิ้นของภาพระบายที่มีสีมากที่สุด (ข้อ 49) ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมี canvas
import { PALETTE } from '@/lib/tokens'
import { hexToRgb } from '@/lib/color'

export const SAMPLE_LONG = 128 // ด้านยาวของภาพย่อที่ใช้หา
export const WINDOW_FRAC = 0.5 // ด้านของหน้าต่างสี่เหลี่ยมจัตุรัส = 50% ของด้านสั้น (ช่วง 45–55%)

// ภาพของวันที่ใช้ทำชิ้นสี: ภาพที่ถูกใจก่อน (entry.liked ถ้ามีหลายภาพเอาอันแรกตามลำดับเดิม) ไม่มีก็ภาพล่าสุดของวัน
export const pickSourceEntry = (entries) => {
  if (!entries.length) return null
  return entries.find((e) => e.liked) ?? [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time)).at(-1)
}

const paperRgb = hexToRgb(PALETTE.paper)

// pixels = RGBA ของภาพย่อ w×h คืน { x, y, size } เป็นพิกเซลของภาพย่อ (ตำแหน่งที่ผลรวมระยะห่างจากสีกระดาษสูงสุด)
// เลื่อนทีละพิกเซลด้วย integral image เสมอกันเลือกตำแหน่งแรก (บน→ล่าง ซ้าย→ขวา)
export const bestWindow = (pixels, w, h, frac = WINDOW_FRAC) => {
  const size = Math.max(1, Math.min(w, h, Math.round(Math.min(w, h) * frac)))
  const stride = w + 1
  const integral = new Float64Array(stride * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const alpha = pixels[i + 3] / 255
      // พื้นโปร่งใสนับเป็นกระดาษ
      const d = alpha < 0.5 ? 0 : Math.hypot(pixels[i] - paperRgb[0], pixels[i + 1] - paperRgb[1], pixels[i + 2] - paperRgb[2])
      row += d
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row
    }
  }
  let best = { x: 0, y: 0, size, sum: -1 }
  for (let y = 0; y + size <= h; y++) {
    for (let x = 0; x + size <= w; x++) {
      const sum = integral[(y + size) * stride + x + size] - integral[y * stride + x + size] - integral[(y + size) * stride + x] + integral[y * stride + x]
      if (sum > best.sum + 1e-6) best = { x, y, size, sum }
    }
  }
  return best
}

// แปลงหน้าต่างบนภาพย่อ (sw×sh) เป็นสี่เหลี่ยมบนภาพเต็ม (W×H)
export const scaleWindow = (win, sw, sh, W, H) => {
  const size = Math.round((win.size * W) / sw)
  const side = Math.min(size, W, H)
  const x = Math.min(W - side, Math.round((win.x * W) / sw))
  const y = Math.min(H - side, Math.round((win.y * H) / sh))
  return { x, y, size: side }
}
