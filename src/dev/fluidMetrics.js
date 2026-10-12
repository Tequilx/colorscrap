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
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const ink = dist(rgba[o], rgba[o + 1], rgba[o + 2], paper) / full
    all[i] = ink
    total += ink
    if (ink > peak) peak = ink
    if (ink >= visible) {
      areaVisible++
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
  }
}

// ค่าต่างเฉลี่ยของพิกเซลระหว่างสองภาพ (0..255 ต่อช่องสี) ใช้วัดว่าน้ำนิ่งจริงไหม
export const meanAbsDiff = (a, b) => {
  let sum = 0
  let count = 0
  for (let i = 0; i < a.length; i += 4) {
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    count += 3
  }
  return count ? sum / count : 0
}

// ตำแหน่งกึ่งกลาง (centroid, 0..1 ของความกว้าง/สูง) ของสีแต่ละสีในภาพ: ทุกพิกเซลที่มีสีเกิน visible ถูกจัดเข้าสีที่ทิศ (ผลต่างจากกระดาษ) ใกล้ที่สุด
// colors = [[r,g,b], ...] ของสีอารมณ์ที่ใช้ คืนค่า [{ x, y, n }] ตามลำดับเดียวกัน (n = จำนวนพิกเซล)
export const colorCentroids = (rgba, { width, height, paper, colors, full, visible = 0.1 }) => {
  const dirs = colors.map((c) => {
    const d = c.map((v, i) => v - paper[i])
    const len = Math.hypot(...d) || 1
    return d.map((v) => v / len)
  })
  const acc = colors.map(() => ({ sx: 0, sy: 0, n: 0 }))
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const d = [rgba[o] - paper[0], rgba[o + 1] - paper[1], rgba[o + 2] - paper[2]]
    const len = Math.hypot(...d)
    if (len / full[0] < visible) continue
    let best = 0
    let bestCos = -2
    dirs.forEach((u, k) => {
      const cos = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / len
      if (cos > bestCos) {
        bestCos = cos
        best = k
      }
    })
    acc[best].sx += (i % width) / width
    acc[best].sy += ((i / width) | 0) / height
    acc[best].n++
  }
  return acc.map((a) => ({ x: a.n ? a.sx / a.n : 0, y: a.n ? a.sy / a.n : 0, n: a.n }))
}
