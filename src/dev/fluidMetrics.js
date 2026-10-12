// วัดสีบนผ้าใบ (เครื่องมือ dev ใช้ตอนจูนน้ำไหล) ฟังก์ชันบริสุทธิ์ ไม่แตะ DOM: รับพิกเซล RGBA ของภาพที่ "เห็นบนจอ" (กลับสีแล้ว)
// ink ของพิกเซล = ระยะ RGB จากสีกระดาษ ÷ ระยะของสีอารมณ์เต็มแรง (1 = เข้มเท่าสีอารมณ์ตรง ๆ)

const dist = (r, g, b, p) => Math.hypot(r - p[0], g - p[1], b - p[2])

// opts: { width, height, paper:[r,g,b], full: ระยะเต็มแรงของสีอารมณ์, center:{x,y} (0..1), radius: px ในภาพตัวอย่าง,
//         visible: เกณฑ์ที่ตาเริ่มเห็นว่ามีสี, strong: เกณฑ์ที่ถือว่าเข้มชัด }
export const measureInk = (rgba, opts) => {
  const { width, height, paper, full, center, radius, visible = 0.1, strong = 0.25 } = opts
  const n = width * height
  const cx = center.x * width
  const cy = center.y * height
  let total = 0
  let peak = 0
  let nearSum = 0
  let nearCount = 0
  const nearRgb = [0, 0, 0]
  let darkest = 1 // ความสว่างต่ำสุด (0 ดำสนิท 1 ขาว) ในรัศมี: ใช้ตรวจว่าสีสะสมจนดำ/เป็นโคลนไหม
  let areaVisible = 0
  let areaStrong = 0
  const all = new Float32Array(n)
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const ink = dist(rgba[o], rgba[o + 1], rgba[o + 2], paper) / full
    all[i] = ink
    total += ink
    if (ink > peak) peak = ink
    if (ink >= visible) {
      areaVisible++
      mask[i] = 1
    }
    if (ink >= strong) areaStrong++
    const x = i % width
    const y = (i / width) | 0
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
      nearSum += ink
      nearCount++
      nearRgb[0] += rgba[o]
      nearRgb[1] += rgba[o + 1]
      nearRgb[2] += rgba[o + 2]
      const lum = (0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2]) / 255
      if (lum < darkest) darkest = lum
    }
  }
  // เส้นรอบรูปของบริเวณที่เห็นสี: พิกเซลในบริเวณที่มีเพื่อนบ้าน 4 ทิศอย่างน้อย 1 อันอยู่นอกบริเวณ
  // circ = 4π·พื้นที่ / เส้นรอบรูป² (วงกลม ≈ 1, ยิ่งเป็นแฉกหรือขอบหยักยิ่งต่ำ) ใช้เทียบ "ขอบแฉก" ก่อน/หลัง
  let perimeter = 0
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue
    const x = i % width
    const y = (i / width) | 0
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - width] || !mask[i + width]) perimeter++
  }
  // ค่าเฉลี่ยของ 1% ที่เข้มที่สุด (ทนต่อพิกเซลเดียวที่สว่างผิดปกติได้ดีกว่า peak)
  const sorted = Float32Array.from(all).sort()
  const topN = Math.max(1, Math.round(n * 0.01))
  let topSum = 0
  for (let i = n - topN; i < n; i++) topSum += sorted[i]
  return {
    near: nearCount ? nearSum / nearCount : 0, // ความเข้มเฉลี่ยในรัศมีรอบจุดหยด
    nearColor: nearCount ? nearRgb.map((v) => Math.round(v / nearCount)) : paper, // สีเฉลี่ยในรัศมี
    darkest, // พิกเซลที่มืดที่สุดในรัศมี (0..1)
    peak,
    top1: topSum / topN,
    total: total / n, // "ปริมาณสี" ต่อพิกเซล (เฉลี่ยทั้งผ้าใบ)
    areaVisible: areaVisible / n, // สัดส่วนผ้าใบที่เห็นว่ามีสี
    areaStrong: areaStrong / n,
    perimeter,
    circ: perimeter ? (4 * Math.PI * areaVisible) / (perimeter * perimeter) : 0,
  }
}
