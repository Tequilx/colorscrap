// เครื่องมือวาดการ์ด 1080×1350 ด้วย Canvas 2D (SPEC ส่วนที่ 2 §8)
// SVG filter ใช้ใน canvas ตรง ๆ ไม่ได้และ foreignObject ไม่เสถียรบน Safari จึงวาดความรู้สึกวาดมือเลียนแบบเอง:
// ขอบไม่เรียบด้วย noise, เส้นประ, เทปกึ่งโปร่งใส, grain (สร้างครั้งเดียวแล้ว cache), วงซ้อนโปร่งใสในหลุมผสมสี
// ทุกอย่างวาดในเครื่อง ไม่ส่งข้อมูลไปที่อื่น

import { PALETTE } from '@/lib/tokens'

export const CARD_W = 1080
export const CARD_H = 1350

// สีทั้งหมดมาจาก tokens.js (ที่เดียว)
export const C = {
  paper: PALETTE.paper,
  ink: PALETTE.ink,
  ink2: PALETTE['ink-2'],
  soft: PALETTE['ink-soft'],
  line: PALETTE.line,
  tape: 'rgba(230, 215, 176, 0.9)', // = PALETTE.tape (ค่าเดียวกัน เขียนช่องว่างต่างกันเท่านั้น)
}

export const FONT_HAND = 'Mali, "Itim", system-ui, sans-serif'
export const FONT_BODY = '"IBM Plex Sans Thai Looped", "Noto Sans Thai", system-ui, sans-serif'
export const FONT_MONO = 'ui-monospace, Menlo, monospace'

// ความสูงกล่องบรรทัด (line-height: normal) ต่อ 1em ที่วัดจากเบราว์เซอร์ และตำแหน่ง baseline ใต้ขอบบนของกล่อง
// Mali 1.30em (ascent 1.05) · IBM Plex Sans Thai Looped 1.65em (ascent 1.12) · mono 1.17em (ascent ~0.93)
export const LINE = {
  hand: { box: 1.3, base: 1.05 },
  body: { box: 1.65, base: 1.12 },
  mono: { box: 1.17, base: 0.93 },
}

// รอโหลดฟอนต์ทุกน้ำหนักที่ใช้ก่อนวาด: ต้องส่งข้อความตัวอย่างเป็นภาษาไทยด้วย เพราะ Google Fonts แยกไฟล์ตามช่วงตัวอักษร (unicode-range)
// ถ้าไม่ส่งจะโหลดแต่ชุดละติน แล้ว canvas วาดไทยด้วยฟอนต์สำรอง
const THAI_SAMPLE = 'กขคงจฉชซญดตถทธนบปผฝพฟภมยรลวศษสหอฮ ะาิีึืุูเแโใไ่้๊๋ 0123456789 ·→%'
export const loadCardFonts = async () => {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  const wanted = [
    ['600 32px Mali', THAI_SAMPLE + 'ColorScrap'],
    ['700 34px Mali', THAI_SAMPLE],
    ['400 28px Mali', THAI_SAMPLE],
    ['400 24px "IBM Plex Sans Thai Looped"', THAI_SAMPLE + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'],
  ]
  await Promise.all(wanted.map(([font, text]) => document.fonts.load(font, text).catch(() => [])))
  await document.fonts.ready
  await warmUpFonts(wanted)
}

// Safari (iPad) วาดข้อความด้วยฟอนต์สำรองในเฟรมแรกที่ canvas เห็นฟอนต์ที่เพิ่งโหลด แม้ document.fonts.load จะ resolve แล้ว:
// วาดข้อความตัวอย่างทิ้งบน canvas เล็กหนึ่งครั้งต่อฟอนต์ แล้วรอ 1-2 เฟรม ก่อนวัด/วาดจริง (ทั้งความกว้างที่วัดและที่วาดจึงใช้ฟอนต์เดียวกัน)
const warmUpFonts = async (wanted) => {
  const c = document.createElement('canvas')
  c.width = c.height = 8
  const g = c.getContext('2d')
  for (const [font, text] of wanted) {
    g.font = font
    g.fillText(text, 0, 6)
    g.measureText(text)
  }
  const frame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)))
  await frame()
  await frame()
}

// ---- noise (ค่าสุ่มแบบกำหนด seed ให้ภาพเดิมได้ขอบเดิมทุกครั้ง) ----

const hash2 = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t) => t * t * (3 - 2 * t)
// value noise 0..1
const noise2 = (x, y, seed) => {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = smooth(x - x0)
  const fy = smooth(y - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
const fractal = (x, y, seed) => noise2(x, y, seed) * 0.65 + noise2(x * 2.1, y * 2.1, seed + 7) * 0.35

// ค่าสุ่ม 0..1 จากเลขลำดับ (ใช้กับ seed ที่ไม่ต้องการความต่อเนื่อง)
export const rnd = (i, seed = 1) => hash2(i, i * 3 + 1, seed)

// ---- path ----

// แยก path แบบ M/L/C/Z (พอสำหรับ BLOB_PATHS และหยดบนเส้นเวลา) เป็นจุดตามเส้น: [[x, y], ...] (ปิดรูปเสมอ)
export const flattenPath = (d, steps = 14) => {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? []
  const pts = []
  let i = 0
  let cmd = ''
  let cur = [0, 0]
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[MLCZ]/.test(tokens[i])) cmd = tokens[i++]
    if (cmd === 'Z') continue
    if (cmd === 'M' || cmd === 'L') {
      cur = [num(), num()]
      pts.push(cur)
    } else if (cmd === 'C') {
      const p1 = [num(), num()]
      const p2 = [num(), num()]
      const p3 = [num(), num()]
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const u = 1 - t
        pts.push([
          u * u * u * cur[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * cur[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ])
      }
      cur = p3
    }
  }
  return pts
}

// วาดรูปปิดจากจุด ทำเส้นโค้งผ่านจุดกึ่งกลางระหว่างจุด (เรียบ ไม่เป็นเหลี่ยม)
const tracePoints = (ctx, pts) => {
  const n = pts.length
  if (n < 3) return
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2)
  for (let k = 0; k < n; k++) {
    const p = pts[k]
    const q = pts[(k + 1) % n]
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
  }
  ctx.closePath()
}

// ขยับจุดด้วย noise (เลียนแบบ feTurbulence + feDisplacementMap): amp = ระยะขยับสูงสุด (px), freq = ความถี่ต่อ px
export const wobble = (pts, { amp, freq, seed = 3 }) =>
  pts.map(([x, y]) => [x + (fractal(x * freq, y * freq, seed) - 0.5) * 2 * amp, y + (fractal(x * freq + 31.7, y * freq + 17.3, seed + 5) - 0.5) * 2 * amp])

// แปลงจุดด้วย matrix อย่างง่าย: เลื่อน tx,ty หลังย่อ s
export const placePoints = (pts, tx, ty, s) => pts.map(([x, y]) => [x * s + tx, y * s + ty])

export const fillPoints = (ctx, pts, fill, alpha = 1) => {
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.fillStyle = fill
  ctx.beginPath()
  tracePoints(ctx, pts)
  ctx.fill()
  ctx.restore()
}

// สี่เหลี่ยมมุมโค้งแบบเรียบ
export const roundRectPath = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

// รูปแคปซูลขอบไม่เรียบ (แถบสี): เดินตามเส้นรอบรูปทุก ~6px แล้วขยับด้วย noise เล็กน้อย
export const wobblyCapsule = (x, y, w, h, { amp = 1.6, seed = 4 } = {}) => {
  const r = Math.min(h / 2, w / 2)
  const pts = []
  const step = 6
  for (let px = x + r; px <= x + w - r; px += step) pts.push([px, y])
  for (let a = -90; a <= 90; a += 18) pts.push([x + w - r + Math.cos((a * Math.PI) / 180) * r, y + r + Math.sin((a * Math.PI) / 180) * r])
  for (let px = x + w - r; px >= x + r; px -= step) pts.push([px, y + h])
  for (let a = 90; a <= 270; a += 18) pts.push([x + r + Math.cos((a * Math.PI) / 180) * r, y + r + Math.sin((a * Math.PI) / 180) * r])
  return wobble(pts, { amp, freq: 0.07, seed })
}

// ---- ชิ้นส่วนที่ใช้ซ้ำ ----

export const dashedLine = (ctx, x1, x2, y, { color = C.line, width = 2, dash = [8, 7] } = {}) => {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x1, y + width / 2)
  ctx.lineTo(x2, y + width / 2)
  ctx.stroke()
  ctx.restore()
}

// เทปกึ่งโปร่งใส ปลายซ้ายขวาฉีกเป็นฟันปลาเล็กน้อย (cx, cy = กึ่งกลาง)
export const drawTape = (ctx, cx, cy, w, h, rotateDeg = 0) => {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotateDeg * Math.PI) / 180)
  ctx.fillStyle = C.tape
  ctx.beginPath()
  const t = 3
  const steps = Math.max(3, Math.round(h / 7))
  ctx.moveTo(-w / 2, -h / 2)
  ctx.lineTo(w / 2, -h / 2)
  for (let k = 0; k <= steps; k++) ctx.lineTo(w / 2 + (k % 2 ? -t : t) * (0.6 + rnd(k, 3) * 0.6), -h / 2 + (h * k) / steps)
  ctx.lineTo(-w / 2, h / 2)
  for (let k = steps; k >= 0; k--) ctx.lineTo(-w / 2 + (k % 2 ? t : -t) * (0.6 + rnd(k, 8) * 0.6), -h / 2 + (h * k) / steps)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ไอคอนหยด ColorScrap (viewBox 26×32): fill ตามสี, ขอบ ink 2px
const DROP_ICON = 'M13 2 C13 2 3 15 3 21 A10 10 0 0 0 23 21 C23 15 13 2 13 2 Z'
export const drawDropIcon = (ctx, x, y, fill) => {
  ctx.save()
  ctx.translate(x, y)
  const p = new Path2D(DROP_ICON)
  ctx.fillStyle = fill
  ctx.fill(p)
  ctx.lineWidth = 2
  ctx.strokeStyle = C.ink
  ctx.lineJoin = 'round'
  ctx.stroke(p)
  ctx.restore()
}

// grain บาง ๆ ทั้งการ์ด: ลาย noise 256×256 สร้างครั้งเดียวแล้ว cache (ใช้ซ้ำทุกการ์ด)
let grainPattern = null
const getGrain = (ctx) => {
  if (!grainPattern) {
    const tile = document.createElement('canvas')
    tile.width = tile.height = 256
    const g = tile.getContext('2d')
    const img = g.createImageData(256, 256)
    for (let i = 0; i < 256 * 256; i++) {
      const v = rnd(i, 11)
      img.data[i * 4 + 3] = Math.round(v * v * 20) // alpha ~0–0.08 เฉลี่ยราว 0.03 (บางพอไม่ทำให้การ์ดดูหม่น)
    }
    g.putImageData(img, 0, 0)
    grainPattern = tile
  }
  return ctx.createPattern(grainPattern, 'repeat')
}
export const drawGrain = (ctx, w, h) => {
  ctx.save()
  ctx.fillStyle = getGrain(ctx)
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// ---- ข้อความ ----

const familyOf = (kind) => (kind === 'hand' ? FONT_HAND : kind === 'mono' ? FONT_MONO : FONT_BODY)

// วางข้อความโดยกำหนดขอบบนของกล่องบรรทัด (เหมือนจัดวาง CSS) kind = hand | body | mono
// คืนความกว้างข้อความ align: left | right | center — วัดความกว้างด้วยฟอนต์เดียวกับที่วาดแล้ววางเอง (ไม่ใช้ textAlign ของ canvas ซึ่งบน Safari ผิดตำแหน่งได้เมื่อฟอนต์เพิ่งเปลี่ยน)
// boxHeight ที่ระบุ = กล่องที่สูงกว่าตัวอักษร (ข้อความอยู่กึ่งกลางกล่อง)
export const drawText = (ctx, text, x, top, { size, weight = 400, kind = 'hand', color = C.ink, align = 'left', boxHeight } = {}) => {
  const m = LINE[kind]
  ctx.save()
  ctx.font = `${weight} ${size}px ${familyOf(kind)}`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const width = ctx.measureText(text).width
  const own = size * m.box
  const offset = boxHeight ? (boxHeight - own) / 2 : 0
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  ctx.fillText(text, left, top + offset + size * m.base)
  ctx.restore()
  return width
}

// ชื่อที่ถูกเซ็นเซอร์ (maskName): ส่วนที่เป็นตัวอักษรวาดด้วยฟอนต์ ส่วน "•" วาดเป็นวงกลมเอง — glyph • ของ Mali เป็นลายมือแปลก ๆ (อ่านเป็น "ะะะ") และต่างกันตามเครื่อง
// ระยะห่างของจุดเท่าความกว้าง "•" ของฟอนต์ที่ใช้ (fitLines/measureText วัดด้วยตัวอักษร • เหมือนกัน เลย์เอาต์ตรงกัน) คืนความกว้างรวม
export const drawMasked = (ctx, text, x, top, { size, weight = 400, kind = 'hand', color = C.ink, boxHeight } = {}) => {
  const m = LINE[kind]
  const offset = boxHeight ? (boxHeight - size * m.box) / 2 : 0
  const baseline = top + offset + size * m.base
  let cx = x
  const dot = measureText(ctx, '•', { size, weight, kind })
  for (const part of text.split(/(•)/)) {
    if (!part) continue
    if (part === '•') {
      ctx.save()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cx + dot / 2, baseline - size * 0.3, size * 0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      cx += dot
    } else {
      cx += drawText(ctx, part, cx, top, { size, weight, kind, color, boxHeight })
    }
  }
  return cx - x
}

export const measureText = (ctx, text, { size, weight = 400, kind = 'hand' }) => {
  ctx.save()
  ctx.font = `${weight} ${size}px ${familyOf(kind)}`
  const w = ctx.measureText(text).width
  ctx.restore()
  return w
}

// ย่อขนาดตัวอักษรลงจนพอดีความกว้าง (คำบรรยายยาวบนโพลารอยด์) ไม่ต่ำกว่า min
export const fitSize = (ctx, text, maxWidth, { size, min = 26, weight = 400, kind = 'hand' }) => {
  let s = size
  while (s > min && measureText(ctx, text, { size: s, weight, kind }) > maxWidth) s -= 1
  return s
}

const segmentsOf = (text) =>
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), (s) => s.segment)
    : Array.from(text)

// ข้อความที่ต้องไม่ล้นความกว้าง: ย่อก่อนจนถึง minScale (ค่าตั้งต้น 70% ของขนาดเดิม) ถ้ายังกว้างเกินค่อยตัดบรรทัดตามคำ (ไม่เกิน maxLines)
// ถ้ายังไม่พอ ตัดท้ายบรรทัดสุดท้ายด้วย "…" คืน { size, lines } — ไม่มีกรณีที่ผลลัพธ์กว้างเกิน maxWidth
export const fitLines = (ctx, text, maxWidth, { size, minScale = 0.7, weight = 400, kind = 'hand', maxLines = 1 } = {}) => {
  const w = (t, sz) => measureText(ctx, t, { size: sz, weight, kind })
  const min = Math.floor(size * minScale)
  let s = size
  while (s > min && w(text, s) > maxWidth) s -= 1
  if (w(text, s) <= maxWidth) return { size: s, lines: [text] }
  const lines = []
  let line = ''
  const segs = segmentsOf(text)
  for (let i = 0; i < segs.length; i++) {
    const next = line + segs[i]
    if (w(next, s) <= maxWidth || !line) {
      line = next
      continue
    }
    if (lines.length === maxLines - 1) {
      // ไม่มีบรรทัดเหลือ: รวมที่เหลือทั้งหมดไว้บรรทัดนี้แล้วตัดด้วย …
      line += segs.slice(i).join('')
      break
    }
    lines.push(line.trimEnd())
    line = segs[i].trimStart()
  }
  const ellipsize = (t) => {
    if (w(t, s) <= maxWidth) return t
    const g = Array.from(t)
    while (g.length > 1 && w(g.join('').trimEnd() + '…', s) > maxWidth) g.pop()
    return g.join('').trimEnd() + '…'
  }
  lines.push(ellipsize(line))
  return { size: s, lines }
}

// วาดผลของ fitLines ในกล่องสูง boxHeight (จัดกึ่งกลางแนวตั้ง) lineHeight = ตัวคูณขนาดตัวอักษรเมื่อมีหลายบรรทัด
export const drawFitted = (ctx, text, x, top, { maxWidth, size, minScale = 0.7, weight = 400, kind = 'hand', color = C.ink, align = 'left', boxHeight, maxLines = 1, lineHeight = 1.25 } = {}) => {
  const fit = fitLines(ctx, text, maxWidth, { size, minScale, weight, kind, maxLines })
  if (fit.lines.length === 1) {
    drawText(ctx, fit.lines[0], x, top, { size: fit.size, weight, kind, color, align, boxHeight })
    return fit
  }
  const lh = fit.size * lineHeight
  const total = lh * fit.lines.length
  const start = boxHeight ? top + (boxHeight - total) / 2 : top
  fit.lines.forEach((line, i) => drawText(ctx, line, x, start + i * lh, { size: fit.size, weight, kind, color, align, boxHeight: lh }))
  return fit
}

// วาดภาพแบบ cover ลงกรอบ (ไม่ยืด ตัดส่วนเกินตรงกลาง)
export const drawCover = (ctx, image, x, y, w, h) => {
  const iw = image.width
  const ih = image.height
  const scale = Math.max(w / iw, h / ih)
  const sw = w / scale
  const sh = h / scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h)
  ctx.restore()
}

export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('สร้างไฟล์ PNG ไม่สำเร็จ'))), 'image/png')
  })

export const makeCanvas = (w = CARD_W, h = CARD_H) => {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}
