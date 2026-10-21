// วาดการ์ด PNG 1080×1350 สองแบบ (SPEC ส่วนที่ 2 §3–§4) ตามไฟล์ดีไซน์ docs/design/screens/7a-card-photo.dc.html และ 7b-card-day.dc.html
// พิกัดทั้งหมดคือพิกัดในดีไซน์ (px ของการ์ด) ข้อมูลจริงมาจากผู้เรียก: ภาพตัวอย่างสีม่วงในดีไซน์เป็นแค่ตัวอย่าง
import { BLOB_PATHS, timelineDrop } from '@/lib/doodles'
import { EMOTION_BY_KEY, INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { wellBlobs } from '@/lib/mixingWell'
import { TIMELINE_LEFT, TIMELINE_WIDTH, dayColor, percentsOf, rankedColors, spreadXs, timelineX } from '@/lib/palette'
import { localDateStr, parseLocalDate, thaiDateShort } from '@/lib/dates'
import { formatThaiDate } from '@/lib/share/formatThaiDate'
import { maskName } from '@/lib/share/maskName'
import {
  C,
  CARD_H,
  CARD_W,
  LINE,
  canvasToBlob,
  dashedLine,
  drawCover,
  drawDropIcon,
  drawGrain,
  drawTape,
  drawText,
  fillPoints,
  fitSize,
  flattenPath,
  loadCardFonts,
  makeCanvas,
  placePoints,
  roundRectPath,
  wobble,
  wobblyCapsule,
} from '@/lib/share/cardDraw'

const RAD = Math.PI / 180

// ส่วนหัว: ซ้าย ไอคอนหยด + "ColorScrap" ขวา วันที่ไทย (ใช้ร่วมสองการ์ด)
const drawHeader = (ctx, dropColor, dateText) => {
  const top = 56
  const textBox = 32 * LINE.hand.box // 41.6
  const dateBox = 26 * LINE.body.box // 42.9
  const row = Math.max(32, textBox, dateBox)
  drawDropIcon(ctx, 72, top + (row - 32) / 2, dropColor)
  drawText(ctx, 'ColorScrap', 72 + 26 + 10, top, { size: 32, weight: 600, kind: 'hand', boxHeight: row })
  drawText(ctx, dateText, 1008, top, { size: 26, kind: 'body', color: C.soft, align: 'right', boxHeight: row })
}

// ท้ายการ์ด: เส้นประ + "โดย {ชื่อ}" (ซ่อนถ้าไม่มีชื่อ) + "สมุดระบายความรู้สึก"
// bottom = ระยะจากขอบล่างการ์ด, padTop = ช่องไฟใต้เส้นประ (7a: 48/20, 7b: 52/22)
const drawFooter = (ctx, maskedName, bottom, padTop) => {
  const content = Math.max(28 * LINE.hand.box, 22 * LINE.body.box)
  const top = CARD_H - bottom - (2 + padTop + content)
  dashedLine(ctx, 72, 1008, top)
  const y = top + 2 + padTop
  if (maskedName) drawText(ctx, `โดย ${maskedName}`, 72, y, { size: 28, kind: 'hand', boxHeight: content })
  drawText(ctx, 'สมุดระบายความรู้สึก', 1008, y, { size: 22, kind: 'body', color: C.soft, align: 'right', boxHeight: content })
}

// ภาพสีน้ำจำลอง (ใช้เมื่อ entry ไม่มีภาพจริง เช่นข้อมูลจำลอง): หยดซ้อน 4 ก้อนจากสีของภาพ ตามดีไซน์ 7a (viewBox 170×120 → w×h)
export const renderPlaceholder = (ctx, x, y, w, h, colors) => drawPlaceholderPainting(ctx, x, y, w, h, colors)
const drawPlaceholderPainting = (ctx, x, y, w, h, colors) => {
  const s = w / 170
  const spots = [
    { tx: -26, ty: -10, k: 1.2, a: 0.55, i: 0 },
    { tx: 40, ty: 20, k: 0.62, a: 0.55, i: 1 },
    { tx: -10, ty: 62, k: 0.4, a: 0.6, i: 2 },
    { tx: 110, ty: 64, k: 0.42, a: 0.45, i: 3 },
  ]
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const base = flattenPath(BLOB_PATHS.small)
  spots.forEach((p, n) => {
    const hex = colors[p.i % colors.length]?.hex ?? '#B7A6CF'
    const pts = wobble(placePoints(base, p.tx, p.ty, p.k), { amp: 15, freq: 0.014, seed: 5 + n })
    fillPoints(ctx, placePoints(pts, 0, 0, 1).map(([px, py]) => [x + px * s, y + py * s]), hex, p.a)
  })
  ctx.restore()
}

// รายการสีของภาพ: สูงสุด 5 สี เรียงมากไปน้อย เปอร์เซ็นต์รวม 100 (ตรงกับแผง "สีในภาพนี้" ในแอป)
const topColors = (entry) => [...entry.colors].sort((a, b) => b.ratio - a.ratio).slice(0, 5)

export const photoCaption = (entry) => `${entry.local_time} · ${emotionLabel(entry)}${entry.shifted ? ' → มีแสงขึ้น' : ''} · ${INTENSITY_LABELS[entry.intensity]}`

// ---- การ์ดภาพพร้อมชาร์ตสี (7a) ----
// image = ภาพที่ผู้ใช้ระบาย (ImageBitmap/Image/canvas) หรือ null (ใช้ภาพจำลองจากสี)
export const renderPhotoCard = async ({ entry, image = null, userName = '' }) => {
  await loadCardFonts()
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const colors = topColors(entry)
  const pct = percentsOf(colors)
  const date = formatThaiDate(parseLocalDate(entry.local_date))
  drawHeader(ctx, colors[0].hex, date)

  // โพลารอยด์ 820×706 วางที่ (130,150) หมุน −1.5° รอบกึ่งกลาง ขอบขาว padding 22 22 90
  const box = { x: 130, y: 150, w: 820, h: 706 }
  ctx.save()
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2)
  ctx.rotate(-1.5 * RAD)
  ctx.translate(-box.w / 2, -box.h / 2)
  ctx.save()
  ctx.shadowColor = 'rgba(45, 43, 51, 0.20)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, box.w, box.h)
  ctx.restore()

  // ภาพ 776×548 แบบ cover
  ctx.fillStyle = C.paper
  ctx.fillRect(22, 22, 776, 548)
  if (image) drawCover(ctx, image, 22, 22, 776, 548)
  else drawPlaceholderPainting(ctx, 22, 22, 776, 548, colors)

  // แถบสีรวมใต้ภาพ สูง 28 ตามสัดส่วนสี ขอบไม่เรียบเล็กน้อย
  const strip = wobblyCapsule(22, 22 + 548 + 18, 776, 28)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(strip[0][0], strip[0][1])
  strip.slice(1).forEach(([px, py]) => ctx.lineTo(px, py))
  ctx.closePath()
  ctx.clip()
  let sx = 22
  colors.forEach((c, i) => {
    const w = i === colors.length - 1 ? 22 + 776 - sx : Math.round((776 * pct[i]) / 100)
    ctx.fillStyle = c.hex
    ctx.fillRect(sx, 22 + 548 + 18 - 4, w + 0.5, 28 + 8)
    sx += w
  })
  ctx.restore()

  // คำบรรยาย Mali 40px ชิดล่างซ้าย (left 30, bottom 22) ย่อให้พอดีถ้าอารมณ์เปลี่ยนหลายครั้งจนยาว
  const caption = photoCaption(entry)
  const size = fitSize(ctx, caption, box.w - 60, { size: 40, min: 26, kind: 'hand' })
  drawText(ctx, caption, 30, box.h - 22 - size * LINE.hand.box, { size, kind: 'hand', color: C.ink2 })

  // เทปกลางด้านบน (ซ้อนหมุนต่อจากโพลารอยด์ −1.5° รวมเป็น −3°)
  drawTape(ctx, 320 + 90, -22 + 22, 180, 44, -1.5)
  ctx.restore()

  // "สีในภาพนี้" เริ่ม y=900 (ซ้าย 112 กว้าง 856)
  const left = 112
  const right = left + 856
  const titleBox = 34 * LINE.hand.box
  drawText(ctx, 'สีในภาพนี้', left, 900, { size: 34, weight: 700, kind: 'hand' })
  const ruleY = 900 + titleBox + 14
  dashedLine(ctx, left, right, ruleY)
  const maxPct = Math.max(...pct)
  const rowBox = Math.max(28, 28 * LINE.hand.box, 20 * LINE.mono.box)
  colors.forEach((c, i) => {
    const top = ruleY + 2 + 16 + i * (rowBox + 14)
    const bw = Math.max(140, Math.round((580 * pct[i]) / maxPct))
    fillPoints(ctx, wobblyCapsule(left, top + (rowBox - 28) / 2, bw, 28, { amp: 1.8, seed: 4 + i }), c.hex)
    // กลุ่มขวา: hex (mono 20) + % (Mali 700 28 กว้าง 70 ชิดขวา) จัดตาม baseline เดียวกับ %
    const baseline = top + 28 * LINE.hand.base
    ctx.save()
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = C.ink
    ctx.textAlign = 'right'
    ctx.font = '700 28px Mali, "Itim", system-ui, sans-serif'
    ctx.fillText(`${pct[i]}%`, right, baseline)
    ctx.fillStyle = C.ink2
    ctx.font = '400 20px ui-monospace, Menlo, monospace'
    ctx.fillText(c.hex.toUpperCase(), right - 70 - 16, baseline)
    ctx.restore()
  })

  drawFooter(ctx, maskName(userName), 48, 20)
  drawGrain(ctx, CARD_W, CARD_H)
  return canvasToBlob(canvas)
}

// ---- การ์ดจานสีของวัน (7b) ----

// หลุมผสมสี (viewBox 200×200 → 420×420 ที่ (x,y)): เหมือน MixingWell.vue ในแอป หยดเป็นวงซ้อนโปร่งใสหลายชั้นขอบไม่เรียบ
const drawWell = (ctx, x, y, size, entries) => {
  const k = size / 200
  const px = (v) => x + v * k
  const cy = (v) => y + v * k
  ctx.save()
  ctx.fillStyle = 'rgba(45, 43, 51, 0.10)'
  ctx.beginPath()
  ctx.ellipse(px(104), cy(108), 94 * k, 92 * k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(px(100), cy(100), 94 * k, 0, Math.PI * 2)
  ctx.fillStyle = '#F1EEE8'
  ctx.fill()
  ctx.lineWidth = 2 * k
  ctx.strokeStyle = '#DCD6CC'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(px(100), cy(100), 78 * k, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.lineWidth = 3 * k
  ctx.strokeStyle = '#E4DFD6'
  ctx.stroke()

  // หยดสีในวงใน (r 76) จากสีของวันชุดเดียวกับหน้าสมุด
  ctx.save()
  ctx.beginPath()
  ctx.arc(px(100), cy(100), 76 * k, 0, Math.PI * 2)
  ctx.clip()
  const blobs = wellBlobs(entries)
  const base = flattenPath(BLOB_PATHS.small)
  blobs.forEach((b, n) => {
    const pts = wobble(placePoints(base, b.x, b.y, b.scale), { amp: 9, freq: 0.03, seed: 3 + n })
    const placed = pts.map(([qx, qy]) => [px(qx), cy(qy)])
    // วงซ้อนโปร่งใส 3 ชั้น (ใหญ่-จาง → เล็ก-เข้ม) ให้ขอบนุ่มแบบน้ำซึม
    const mid = placed.reduce((s, p) => [s[0] + p[0] / placed.length, s[1] + p[1] / placed.length], [0, 0])
    ;[
      { s: 1.07, a: 0.2 },
      { s: 1.0, a: 0.38 },
      { s: 0.9, a: 0.18 },
    ].forEach((layer) => fillPoints(ctx, placed.map(([qx, qy]) => [mid[0] + (qx - mid[0]) * layer.s, mid[1] + (qy - mid[1]) * layer.s]), b.hex, layer.a))
  })
  if (blobs.length) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = blobs[0].hex
    ctx.lineWidth = 12 * k
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px(40), cy(130))
    ctx.bezierCurveTo(px(66), cy(92), px(118), cy(90), px(150), cy(122))
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  // เงาสะท้อนบนหลุม
  ctx.save()
  ctx.translate(px(70), cy(52))
  ctx.rotate(-32 * RAD)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(0, 0, 24 * k, 9 * k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.restore()
}

// เส้นเวลาของวัน (viewBox 412×118 วาดที่ (x,y) ขยาย scale): ใช้ฟังก์ชันตำแหน่งเดียวกับ DayTimeline.vue
const drawTimeline = (ctx, x, y, scale, entries) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#8E8A93'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.stroke(new Path2D('M2 82 C80 78 160 86 240 81 S360 84 410 81'))
  const ticks = [0, 6, 12, 18, 24].map((h) => ({ label: `${String(h).padStart(2, '0')}:00`, x: Math.round(TIMELINE_LEFT + (h / 24) * TIMELINE_WIDTH) }))
  ctx.font = '400 12px "IBM Plex Sans Thai Looped", "Noto Sans Thai", system-ui, sans-serif'
  ctx.fillStyle = C.soft
  ctx.textAlign = 'center'
  ticks.forEach((t) => {
    ctx.stroke(new Path2D(`M${t.x} 76 V88`))
    ctx.fillText(t.label, t.x, 110)
  })

  const xs = spreadXs(entries.map((e) => Math.round(timelineX(e.local_time))))
  entries.forEach((e, i) => {
    const pts = wobble(flattenPath(timelineDrop(xs[i]), 10), { amp: 3.5, freq: 0.09, seed: 4 + i })
    // ภาพที่ปรับโทนไล่สีแนวตั้งจากสีเด่นไปสีที่ซึมเข้ามา (ล่างขึ้นบน) ภาพปกติสีเดียว
    const stops = e.shifted ? rankedColors(e.colors).slice(0, 3).map((c) => c.hex) : [rankedColors(e.colors)[0].hex]
    let fill = stops[0]
    if (stops.length > 1) {
      const g = ctx.createLinearGradient(0, 80, 0, 28)
      stops.forEach((s, k) => g.addColorStop(k / (stops.length - 1), s))
      fill = g
    }
    fillPoints(ctx, pts, fill, 0.82)
  })

  // ชื่ออารมณ์เหนือหยด เมื่อมีไม่เกิน 3 ภาพ (เหมือนในแอป) วางสลับแถว 22/12 และถ้าทับป้ายก่อนหน้าให้เลื่อนไปทางขวา
  if (entries.length <= 3) {
    ctx.font = '600 13px Mali, "Itim", system-ui, sans-serif'
    ctx.fillStyle = C.ink2
    ctx.textAlign = 'left'
    const placed = []
    entries.forEach((e, i) => {
      const label = EMOTION_BY_KEY[e.emotion].th + (e.shifted ? ' → มีแสงขึ้น' : '')
      const w = ctx.measureText(label).width
      let left = xs[i] - w / 2
      let row = [22, 12][i % 2]
      const clash = (r, l) => placed.some((p) => p.row === r && l < p.left + p.w + 6 && l + w + 6 > p.left)
      if (clash(row, left)) row = row === 22 ? 12 : 22
      let guard = 0
      while (clash(row, left) && guard++ < 6) left += 8
      left = Math.min(left, 410 - w)
      placed.push({ left, w, row })
      ctx.fillText(label, left, row)
    })
  }
  ctx.restore()
}

const PHOTO_SLOTS = [
  { r: -3, tape: -4, dy: 10 },
  { r: 2, tape: 4, dy: 22 },
  { r: -1.5, tape: -3, dy: 6 },
]

// thumbs: Map entryId → ภาพย่อ (ImageBitmap) หรือไม่มี (ใช้ภาพจำลองจากสี)
export const renderDayCard = async ({ date, entries, thumbs = new Map(), userName = '' }) => {
  const list = [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))
  const day = dayColor(list)
  if (!day) throw new Error('ไม่มีภาพของวันนี้')
  await loadCardFonts()
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const parsed = parseLocalDate(date)
  const isToday = date === localDateStr()
  drawHeader(ctx, day.mix.toUpperCase(), formatThaiDate(parsed))
  drawText(ctx, isToday ? 'จานสีของวันนี้' : `จานสีของ ${thaiDateShort(parsed)}`, 72, 136, { size: 56, weight: 600, kind: 'hand' })

  // หลุมผสมสี 420×420 ซ้าย + ข้อความ 5 บรรทัดขวา กึ่งกลางแนวตั้งเดียวกัน (container top 236)
  drawWell(ctx, 60, 236, 420, list)
  const moods = new Set(list.map((e) => e.emotion)).size
  const col = [
    { h: 24 * LINE.body.box, gap: 12 },
    { h: 2 * 64 * 1.2, gap: 12 },
    { h: 60, gap: 12 },
    { h: Math.max(24 * LINE.mono.box, 24 * LINE.body.box), gap: 0 },
  ]
  const colH = col.reduce((s, c) => s + c.h + c.gap, 0)
  let y = 236 + (420 - colH) / 2
  const tx = 60 + 420 + 40
  drawText(ctx, isToday ? 'สีของวันนี้' : 'สีของวัน', tx, y, { size: 24, kind: 'body', color: C.soft })
  y += col[0].h + col[0].gap
  // ชื่อสีของวัน 2 บรรทัด Mali 600 64px line-height 1.2
  ;[day.name.colorPart, day.name.periodPart].forEach((line, i) => {
    drawText(ctx, line, tx, y + i * 76.8, { size: 64, weight: 600, kind: 'hand', boxHeight: 76.8 })
  })
  y += col[1].h + col[1].gap
  // ปาดสีของวัน (svg 320×60, viewBox 170×36 → ย่อเท่ากันทั้งสองแกน กึ่งกลาง)
  const k = Math.min(320 / 170, 60 / 36)
  const sx = tx + (320 - 170 * k) / 2
  const sy = y + (60 - 36 * k) / 2
  ctx.save()
  ctx.strokeStyle = day.mix
  ctx.lineWidth = 20 * k
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(sx + 10 * k, sy + 20 * k)
  ctx.bezierCurveTo(sx + 50 * k, sy + 12 * k, sx + 110 * k, sy + 26 * k, sx + 160 * k, sy + 16 * k)
  ctx.stroke()
  // ซ้อนเส้นบาง ๆ อีกชั้นเหลื่อมกัน ให้ขอบเหมือนรอยพู่กัน ไม่เป็นท่อนเรียบ
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 17 * k
  ctx.beginPath()
  ctx.moveTo(sx + 12 * k, sy + 22 * k)
  ctx.bezierCurveTo(sx + 52 * k, sy + 14 * k, sx + 108 * k, sy + 28 * k, sx + 158 * k, sy + 14 * k)
  ctx.stroke()
  ctx.restore()
  y += col[2].h + col[2].gap
  // hex + "N ภาพ · M อารมณ์" baseline เดียวกัน
  const baseline = y + 24 * LINE.body.base
  const hexW = drawTextAt(ctx, day.mix.toUpperCase(), tx, baseline, { size: 24, kind: 'mono', color: C.soft })
  drawTextAt(ctx, `${list.length} ภาพ · ${moods} อารมณ์`, tx + hexW + 18, baseline, { size: 24, kind: 'body', color: C.soft })

  // ช่วงเวลาของวัน: ชื่อหัวข้อ (top 690) แล้ว svg 760×218 กึ่งกลางความกว้าง 936
  drawText(ctx, 'ช่วงเวลาของวัน', 72, 690, { size: 30, weight: 600, kind: 'hand' })
  const tlScale = 760 / 412
  drawTimeline(ctx, 72 + (936 - 760) / 2, 690 + 30 * LINE.hand.box + 8, tlScale, list)

  // ภาพย่อโพลารอยด์ 3 ใบล่าสุด (ถ้ามีมากกว่า 3 ใส่ป้าย "+N ภาพ")
  const shown = list.slice(-3)
  const more = list.length - shown.length
  const pitch = 324
  const groupW = 272 + (shown.length - 1) * pitch
  const originX = 72 + (936 - groupW) / 2
  shown.forEach((e, i) => {
    const slot = PHOTO_SLOTS[i]
    const px = originX + i * pitch
    const py = 958 + slot.dy
    const w = 272
    const h = 11 + 176 + 44
    ctx.save()
    ctx.translate(px + w / 2, py + h / 2)
    ctx.rotate(slot.r * RAD)
    ctx.translate(-w / 2, -h / 2)
    ctx.save()
    ctx.shadowColor = 'rgba(45, 43, 51, 0.18)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    ctx.fillStyle = C.paper
    ctx.fillRect(11, 11, 250, 176)
    const thumb = thumbs.get(e.id)
    if (thumb) drawCover(ctx, thumb, 11, 11, 250, 176)
    else drawPlaceholderPainting(ctx, 11, 11, 250, 176, e.colors)
    const caption = `${e.local_time} · ${emotionLabel(e)}${e.shifted ? ' → มีแสงขึ้น' : ''}`
    const size = fitSize(ctx, caption, w - 28, { size: 20, min: 14, kind: 'hand' })
    drawText(ctx, caption, 14, h - 10 - size * LINE.hand.box, { size, kind: 'hand', color: C.soft })
    drawTape(ctx, 86 + 50, -12 + 13, 100, 26, slot.tape)
    ctx.restore()
  })
  if (more > 0) {
    const label = `+${more} ภาพ`
    ctx.save()
    ctx.font = '600 22px Mali, "Itim", system-ui, sans-serif'
    const tw = ctx.measureText(label).width
    const bw = tw + 28
    const bx = originX + groupW - bw + 6
    const by = 958 + 6 + 231 - 20
    ctx.translate(bx + bw / 2, by + 17)
    ctx.rotate(3 * RAD)
    ctx.fillStyle = C.paper
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    roundRectPath(ctx, -bw / 2, -17, bw, 34, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 0, 1)
    ctx.restore()
  }

  drawFooter(ctx, maskName(userName), 52, 22)
  drawGrain(ctx, CARD_W, CARD_H)
  return canvasToBlob(canvas)
}

// วางข้อความที่ baseline ที่กำหนด คืนความกว้าง (ใช้กับแถวที่ผสมฟอนต์ต่างกัน)
const drawTextAt = (ctx, text, x, baseline, { size, weight = 400, kind, color }) => {
  const family = kind === 'mono' ? 'ui-monospace, Menlo, monospace' : '"IBM Plex Sans Thai Looped", "Noto Sans Thai", system-ui, sans-serif'
  ctx.save()
  ctx.font = `${weight} ${size}px ${family}`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, baseline)
  const w = ctx.measureText(text).width
  ctx.restore()
  return w
}
