// หาชิ้นของภาพระบายที่มีสีมากที่สุด (ข้อ 49) ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องมี canvas
import { PALETTE } from '@/lib/tokens'
import { hexToRgb, rgbToOklab } from '@/lib/color'

export const SAMPLE_LONG = 128 // ด้านยาวของภาพย่อที่ใช้หา
// คะแนนเฉลี่ยของหน้าต่าง (0..1 = สัดส่วนพื้นที่ที่เป็นสีเป้าหมายโดยประมาณ) ต่ำกว่านี้ = ไม่มีภาพที่มีสีนี้จริง ใช้วิธีข้อ 49 แทน (ค่าจากการทดสอบ ดู docs/ROADMAP ข้อ 50i)
export const MIN_MATCH = 0.065
export const WINDOW_FRAC = 0.5 // ด้านของหน้าต่างสี่เหลี่ยมจัตุรัส = 50% ของด้านสั้น (ช่วง 45–55%)

// ภาพของวันที่ใช้ทำชิ้นสี: ภาพที่ถูกใจก่อน (entry.liked ถ้ามีหลายภาพเอาอันแรกตามลำดับเดิม) ไม่มีก็ภาพล่าสุดของวัน
export const pickSourceEntry = (entries) => {
  if (!entries.length) return null
  return entries.find((e) => e.liked) ?? [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time)).at(-1)
}

const paperRgb = hexToRgb(PALETTE.paper)

const PAPER_DISTANCE = 28 // เท่ากับ extractColors: ใกล้กระดาษกว่านี้ไม่นับเป็นสี

// คะแนนต่อพิกเซลแบบ "ห่างจากกระดาษ" (ข้อ 49)
export const paperScores = (pixels, w, h) => {
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    // พื้นโปร่งใสนับเป็นกระดาษ
    out[i] = pixels[o + 3] < 128 ? 0 : Math.hypot(pixels[o] - paperRgb[0], pixels[o + 1] - paperRgb[1], pixels[o + 2] - paperRgb[2])
  }
  return out
}

// คะแนนต่อพิกเซลแบบ "ใกล้สีเป้าหมาย" (ข้อ 50i): exp(−ΔE²/σ²) ใน OKLab ไม่นับพิกเซลที่ใกล้สีกระดาษ
export const SIGMA = 0.09
export const targetScores = (pixels, w, h, targetLab, sigma = SIGMA) => {
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (pixels[o + 3] < 128) continue
    if (Math.hypot(pixels[o] - paperRgb[0], pixels[o + 1] - paperRgb[1], pixels[o + 2] - paperRgb[2]) < PAPER_DISTANCE) continue
    const [L, a, b] = rgbToOklab(pixels[o], pixels[o + 1], pixels[o + 2])
    const d2 = (L - targetLab[0]) ** 2 + (a - targetLab[1]) ** 2 + (b - targetLab[2]) ** 2
    out[i] = Math.exp(-d2 / (sigma * sigma))
  }
  return out
}

// หาหน้าต่างจัตุรัสที่ผลรวมคะแนนสูงสุด (integral image เลื่อนทีละพิกเซล) คืน { x, y, size, sum, mean } บนภาพย่อ w×h เสมอกันเลือกตำแหน่งแรก (บน→ล่าง ซ้าย→ขวา)
export const bestWindowOf = (scores, w, h, frac = WINDOW_FRAC) => {
  const size = Math.max(1, Math.min(w, h, Math.round(Math.min(w, h) * frac)))
  const stride = w + 1
  const integral = new Float64Array(stride * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += scores[y * w + x]
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
  return { ...best, mean: best.sum / (size * size) }
}

// pixels = RGBA ของภาพย่อ w×h ตำแหน่งที่ห่างจากสีกระดาษรวมสูงสุด (วิธีข้อ 49)
export const bestWindow = (pixels, w, h, frac = WINDOW_FRAC) => bestWindowOf(paperScores(pixels, w, h), w, h, frac)

// แปลงหน้าต่างบนภาพย่อ (sw×sh) เป็นสี่เหลี่ยมบนภาพเต็ม (W×H)
export const scaleWindow = (win, sw, sh, W, H) => {
  const size = Math.round((win.size * W) / sw)
  const side = Math.min(size, W, H)
  const x = Math.min(W - side, Math.round((win.x * W) / sw))
  const y = Math.min(H - side, Math.round((win.y * H) / sh))
  return { x, y, size: side }
}

// ชื่อสีจากชิ้นที่ครอป (ข้อ 50i ทาง fallback): เฉลี่ย OKLab ของพิกเซลที่ไม่ใช่กระดาษโดยถ่วงน้ำหนักตาม chroma (สีจัดมีเสียงมากกว่าคราบจาง)
// คืน { hex, L, C } ของสีตัวแทน หรือ null ถ้าไม่มีพิกเซลสีเลย
export const dominantOfPixels = (pixels, w, h) => {
  let sw = 0
  let sL = 0
  let sa = 0
  let sb = 0
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (pixels[o + 3] < 128) continue
    if (Math.hypot(pixels[o] - paperRgb[0], pixels[o + 1] - paperRgb[1], pixels[o + 2] - paperRgb[2]) < PAPER_DISTANCE) continue
    const [L, a, b] = rgbToOklab(pixels[o], pixels[o + 1], pixels[o + 2])
    const wt = Math.hypot(a, b) + 0.01
    sw += wt
    sL += L * wt
    sa += a * wt
    sb += b * wt
  }
  if (!sw) return null
  const lab = [sL / sw, sa / sw, sb / sw]
  return { lab, L: lab[0], C: Math.hypot(lab[1], lab[2]) }
}
