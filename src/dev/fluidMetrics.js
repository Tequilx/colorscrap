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
  let areaVisible = 0
  let areaStrong = 0
  const all = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const ink = dist(rgba[o], rgba[o + 1], rgba[o + 2], paper) / full
    all[i] = ink
    total += ink
    if (ink > peak) peak = ink
    if (ink >= visible) areaVisible++
    if (ink >= strong) areaStrong++
    const x = i % width
    const y = (i / width) | 0
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
      nearSum += ink
      nearCount++
    }
  }
  // ค่าเฉลี่ยของ 1% ที่เข้มที่สุด (ทนต่อพิกเซลเดียวที่สว่างผิดปกติได้ดีกว่า peak)
  const sorted = Float32Array.from(all).sort()
  const topN = Math.max(1, Math.round(n * 0.01))
  let topSum = 0
  for (let i = n - topN; i < n; i++) topSum += sorted[i]
  return {
    near: nearCount ? nearSum / nearCount : 0, // ความเข้มเฉลี่ยในรัศมีรอบจุดหยด
    peak,
    top1: topSum / topN,
    total: total / n, // "ปริมาณสี" ต่อพิกเซล (เฉลี่ยทั้งผ้าใบ)
    areaVisible: areaVisible / n, // สัดส่วนผ้าใบที่เห็นว่ามีสี
    areaStrong: areaStrong / n,
  }
}
