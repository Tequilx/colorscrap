// วาดการ์ด PNG 1080×1350 สองแบบ (SPEC ส่วนที่ 2 §3–§4) ตามไฟล์ดีไซน์ docs/design/screens/7a-card-photo.dc.html และ 7b-card-day.dc.html
// พิกัดทั้งหมดคือพิกัดในดีไซน์ (px ของการ์ด) ข้อมูลจริงมาจากผู้เรียก: ภาพตัวอย่างสีม่วงในดีไซน์เป็นแค่ตัวอย่าง
import { BLOB_PATHS } from '@/lib/doodles'
import { INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { DIVIDER_COLOR, brandIconSvg, brandWordmarkSvg, lockupLayout } from '@/lib/brand'
import { CROP_BOX, dayFrameSvg } from '@/lib/dayFrame'
import { RIBBON_H, layoutRibbon, ribbonSvg } from '@/lib/dayRibbon'
import { svgToImage } from '@/lib/share/svgImage'
import { dayColor, dominantColorOfDay, nameForCrop, percentsOf } from '@/lib/palette'
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
  drawGrain,
  drawTape,
  drawFitted,
  drawMasked,
  drawText,
  fillPoints,
  fitLines,
  fitSize,
  flattenPath,
  loadCardFonts,
  makeCanvas,
  measureText,
  placePoints,
  wobble,
  wobblyCapsule,
} from '@/lib/share/cardDraw'

const RAD = Math.PI / 180

// ส่วนหัว (ใช้ร่วมสองการ์ด): ซ้าย lockup โลโก้ (icon | เส้นคั่น | wordmark จาก lib/brand.js แปลง SVG เป็นภาพ) ขวา วันที่ไทย
const BRAND = { h: 64, top: 52 }
let brandImages = null
const loadBrand = () =>
  (brandImages ??= Promise.all([
    svgToImage(brandIconSvg(BRAND.h * 2, { p: 'bci' })),
    svgToImage(brandWordmarkSvg(lockupLayout(BRAND.h).word * 2, 'bcw')),
  ]).then(([icon, word]) => ({ icon, word })))
const drawHeader = (ctx, brand, dateText) => {
  const L = lockupLayout(BRAND.h)
  ctx.drawImage(brand.icon, 72, BRAND.top, L.icon, L.icon)
  ctx.fillStyle = DIVIDER_COLOR
  ctx.fillRect(72 + L.divider.x, BRAND.top + (BRAND.h - L.divider.h) / 2, L.divider.w, L.divider.h)
  ctx.drawImage(brand.word, 72 + L.wordX, BRAND.top + (BRAND.h - L.word) / 2, L.wordW, L.word)
  // วันที่ชิดขอบในขวา (1008) ห้ามล้นเข้าไปในโลโก้: กว้างได้เท่าที่เหลือหลัง lockup เว้น 28px ย่อได้ถึง 70% แล้วตัดเป็น 2 บรรทัด
  const maxWidth = 1008 - (72 + L.width) - 28
  drawFitted(ctx, dateText, 1008, BRAND.top, { maxWidth, size: 26, kind: 'body', color: C.soft, align: 'right', boxHeight: BRAND.h, maxLines: 2, lineHeight: 1.3 })
}

// ท้ายการ์ด: เส้นประ + "โดย {ชื่อ}" (ซ่อนถ้าไม่มีชื่อ) + "สมุดระบายความรู้สึก"
// bottom = ระยะจากขอบล่างการ์ด, padTop = ช่องไฟใต้เส้นประ
const drawFooter = (ctx, maskedName, bottom, padTop) => {
  const content = Math.max(28 * LINE.hand.box, 22 * LINE.body.box)
  const top = CARD_H - bottom - (2 + padTop + content)
  dashedLine(ctx, 72, 1008, top)
  const y = top + 2 + padTop
  // สองฝั่งใช้ความกว้างในร่วมกัน 936px เว้นกลาง 32px: คำรองชิดขวาได้ไม่เกินครึ่งหนึ่ง ที่เหลือเป็นของชื่อ ทั้งคู่ย่อได้ถึง 70% แล้วตัดบรรทัด
  const GAP = 32
  const inner = 1008 - 72
  const tagline = fitLines(ctx, 'สมุดระบายความรู้สึก', inner * 0.5, { size: 22, kind: 'body', maxLines: 2 })
  const tagW = Math.max(...tagline.lines.map((t) => measureText(ctx, t, { size: tagline.size, kind: 'body' })))
  if (maskedName) {
    const byline = fitLines(ctx, `โดย ${maskedName}`, inner - tagW - GAP, { size: 28, kind: 'hand' })
    drawMasked(ctx, byline.lines[0], 72, y, { size: byline.size, kind: 'hand', boxHeight: content })
  }
  drawFitted(ctx, 'สมุดระบายความรู้สึก', 1008, y, { maxWidth: inner * 0.5, size: 22, kind: 'body', color: C.soft, align: 'right', boxHeight: content, maxLines: 2, lineHeight: 1.3 })
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

export const photoCaption = (entry) => `${entry.local_time} · ${emotionLabel(entry)}${entry.shifted ? ' → สดใสขึ้น' : ''} · ${INTENSITY_LABELS[entry.intensity]}`

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
  drawHeader(ctx, await loadBrand(), date)

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
  // ย่อได้ถึง 70% (28px) แล้วตัดเป็น 2 บรรทัด (แคบลงให้ไม่ชนแถบสี) ห้ามล้นกรอบโพลารอยด์
  const cap = fitLines(ctx, caption, box.w - 60, { size: 40, kind: 'hand', maxLines: 2 })
  const capLH = cap.lines.length > 1 ? cap.size * 1.2 : cap.size * LINE.hand.box
  cap.lines.forEach((line, i) => drawText(ctx, line, 30, box.h - 22 - capLH * (cap.lines.length - i), { size: cap.size, kind: 'hand', color: C.ink2, boxHeight: capLH }))

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
    drawText(ctx, `${pct[i]}%`, right, top, { size: 28, weight: 700, kind: 'hand', color: C.ink, align: 'right' })
    drawText(ctx, c.hex.toUpperCase(), right - 70 - 16, baseline - 20 * LINE.mono.base, { size: 20, kind: 'mono', color: C.ink2, align: 'right' })
  })

  drawFooter(ctx, maskName(userName), 48, 20)
  drawGrain(ctx, CARD_W, CARD_H)
  return canvasToBlob(canvas)
}

// ---- การ์ดจานสีของวัน (ภาพ 12-card-day-v2) ----
// กรอบสีของวันและแถบสีของวันเป็น SVG เดียวกับในสมุด (lib/dayFrame.js, lib/dayRibbon.js) แปลงเป็นภาพแล้ว drawImage: ไม่วาดแถบใหม่ด้วย Canvas 2D
// ป้ายเวลา/อารมณ์ใต้แถบใช้ layoutRibbon ตัวเดียวกับในแอป (รวมช่วง เยื้องแถว) วางที่สเกล RIB_K

const RIB_K = 1.8 // หน่วยของแถบในแอป → px ของการ์ด (ป้าย 11/12px ในแอป → ~20/22px บนการ์ด)
const RIB_X = 72
const RIB_W = 936

const PHOTO_SLOTS = [
  { r: -2, tape: -4, dy: 8 },
  { r: 1.5, tape: 4, dy: 18 },
  { r: -1.2, tape: -3, dy: 4 },
]
const PHOTO_W = 300
const PHOTO_PITCH = 318

// วันที่มีภาพเกิน 3: กระดาษโพลารอยด์เปล่า 2 แผ่นซ้อนใต้ใบที่สาม เยื้องลงล่างเล็กน้อย (ขอบโผล่ ~6–10px) เอียงต่างกัน
// เลื่อนไปทางซ้ายพอให้มุมที่เอียงไม่เลยขอบในขวา (1008) ส่วนขอบล่างอยู่เหนือเส้นประท้ายการ์ดเสมอ
const STACK_SHEETS = [
  { dx: -6, dy: 4, r: 3 },
  { dx: -6, dy: 8, r: -2 },
]
const DAY_POLAROID_H = 11 + 190 + 12 + 8 + 10 + 30 + 10

const drawBlankSheet = (ctx, x, y, { dx, dy, r }) => {
  const w = PHOTO_W
  const h = DAY_POLAROID_H
  ctx.save()
  ctx.translate(x + dx + w / 2, y + dy + h / 2)
  ctx.rotate(r * RAD)
  ctx.shadowColor = 'rgba(45, 43, 51, 0.14)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.restore()
}

// ป้ายเวลา + อารมณ์ของแต่ละช่วงใต้แถบ (ขีดบอกกลางช่วง เยื้องเป็นแถวตาม layoutRibbon)
const drawRibbonLabels = (ctx, segs, top) => {
  const k = RIB_K
  ctx.save()
  ctx.strokeStyle = C.soft
  ctx.lineWidth = 1.5
  segs.filter((s) => s.level > 0).forEach((s) => {
    const x = RIB_X + s.cx * k
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, top + s.box.y0 * k)
    ctx.stroke()
    const cx = RIB_X + ((s.box.x0 + s.box.x1) / 2) * k
    const y = top + s.box.y0 * k
    drawText(ctx, s.time, cx, y, { size: 11 * k, kind: 'body', color: C.soft, align: 'center' })
    if (s.level === 2) drawText(ctx, s.caption, cx, y + 11 * k * 1.5 + 1 * k, { size: 12 * k, weight: 600, kind: 'hand', color: C.ink2, align: 'center' })
  })
  ctx.restore()
}

// โพลารอยด์ภาพย่อ 1 ใบ: ภาพ + แถบสีของภาพ + เวลา · อารมณ์
const drawDayPolaroid = (ctx, e, thumb, slot, x, y) => {
  const w = PHOTO_W
  const imgH = 190
  const h = DAY_POLAROID_H
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
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
  ctx.fillRect(11, 11, w - 22, imgH)
  if (thumb) drawCover(ctx, thumb, 11, 11, w - 22, imgH)
  else drawPlaceholderPainting(ctx, 11, 11, w - 22, imgH, e.colors)
  // แถบสีของภาพตามสัดส่วนสี
  const colors = topColors(e)
  const pct = percentsOf(colors)
  const sy = 11 + imgH + 12
  ctx.save()
  const strip = wobblyCapsule(11, sy, w - 22, 8)
  ctx.beginPath()
  ctx.moveTo(strip[0][0], strip[0][1])
  strip.slice(1).forEach(([px, py]) => ctx.lineTo(px, py))
  ctx.closePath()
  ctx.clip()
  let sx = 11
  colors.forEach((c, i) => {
    const cw = i === colors.length - 1 ? 11 + w - 22 - sx : Math.round(((w - 22) * pct[i]) / 100)
    ctx.fillStyle = c.hex
    ctx.fillRect(sx, sy - 2, cw + 0.5, 12)
    sx += cw
  })
  ctx.restore()
  const caption = `${e.local_time} · ${emotionLabel(e)}${e.shifted ? ' → สดใสขึ้น' : ''}`
  drawFitted(ctx, caption, 14, sy + 8 + 10, { maxWidth: w - 28, size: 20, kind: 'hand', color: C.soft })
  drawTape(ctx, w / 2, 0, 100, 26, slot.tape)
  ctx.restore()
  return h
}

// thumbs: Map entryId → ภาพย่อ (ImageBitmap) หรือไม่มี (ใช้ภาพจำลองจากสี)
// crop: ภาพชิ้นสีของวัน (ImageBitmap จาก lib/dayCrop.js) หรือ null = วาดก้อนสี
export const renderDayCard = async ({ date, entries, thumbs = new Map(), crop = null, cropInfo = null, userName = '' }) => {
  const list = [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))
  const day = dayColor(list)
  if (!day) throw new Error('ไม่มีภาพของวันนี้')
  day.name = nameForCrop(day.name, cropInfo) // ชื่อเดียวกับหน้าจานสี (ทาง fallback ตั้งชื่อใหม่จากชิ้นครอป)
  await loadCardFonts()
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  const parsed = parseLocalDate(date)
  const isToday = date === localDateStr()
  drawHeader(ctx, await loadBrand(), formatThaiDate(parsed))
  drawFitted(ctx, isToday ? 'จานสีของวันนี้' : `จานสีของ ${thaiDateShort(parsed)}`, 72, 128, { maxWidth: CARD_W - 144, size: 80, weight: 700, kind: 'hand' })

  // กรอบสีของวัน (SVG 380×380 → ภาพ) ซ้าย + ข้อความขวา กึ่งกลางแนวตั้งเดียวกัน
  const frame = await svgToImage(dayFrameSvg({ mix: day.mix, dominant: dominantColorOfDay(list), p: 'dfc', crop: Boolean(crop) }).replace('width="380" height="380"', 'width="760" height="760"'))
  const frameTop = 240
  ctx.drawImage(frame, 52, frameTop, 380, 380)
  if (crop) {
    // ชิ้นสีของวัน (ผลครอปเดียวกับหน้าจานสี) วางในกรอบ เอียง −3° ตามกรอบ ไม่มี filter
    ctx.save()
    ctx.translate(52 + 190, frameTop + 190)
    ctx.rotate(-3 * RAD)
    ctx.translate(-190, -190)
    ctx.imageSmoothingQuality = 'high'
    drawCover(ctx, crop, CROP_BOX.x, CROP_BOX.y, CROP_BOX.w, CROP_BOX.h)
    ctx.restore()
  }
  const moods = new Set(list.map((e) => e.emotion)).size
  const tx = 480
  const nameSize = Math.min(72, fitSize(ctx, [day.name.colorPart, day.name.periodPart].sort((a, b) => b.length - a.length)[0], CARD_W - 72 - tx, { size: 72, min: 51, kind: 'hand', weight: 700 }))
  const NL = nameSize * 1.25 // สูงบรรทัดชื่อ (เผื่อสระบน/วรรณยุกต์)
  const colH = 26 * LINE.body.box + 24 + 2 * NL + 8 + 26 * LINE.body.box
  let y = frameTop + (380 - colH) / 2
  drawText(ctx, isToday ? 'สีของวันนี้' : 'สีของวัน', tx, y, { size: 26, kind: 'body', color: C.soft })
  y += 26 * LINE.body.box + 24
  ;[day.name.colorPart, day.name.periodPart].forEach((line, i) => {
    drawFitted(ctx, line, tx, y + i * NL, { maxWidth: CARD_W - 72 - tx, size: nameSize, minScale: 1, weight: 700, kind: 'hand', boxHeight: NL }) // ย่อถึง 70% แล้ว (บน) ที่เหลือตัดท้ายด้วย …
  })
  y += 2 * NL + 8
  drawText(ctx, `${list.length} ภาพ · ${moods} อารมณ์`, tx, y, { size: 26, kind: 'body', color: C.soft })

  // สีของวันตามลำดับเวลา: แถบ (SVG → ภาพ) เต็มความกว้าง + ป้าย
  const headTop = 640
  drawText(ctx, 'สีของวันตามลำดับเวลา', 72, headTop, { size: 36, weight: 700, kind: 'hand' })
  const segs = layoutRibbon(list, RIB_W / RIB_K)
  const ribTop = headTop + 36 * LINE.hand.box + 10
  const ribbon = await svgToImage(ribbonSvg(segs, RIB_W / RIB_K, 'rbc', RIB_K * 2))
  ctx.drawImage(ribbon, RIB_X, ribTop, RIB_W, RIBBON_H * RIB_K)
  const labelsTop = ribTop + RIBBON_H * RIB_K
  drawRibbonLabels(ctx, segs, labelsTop)
  const labelsH = Math.max(0, ...segs.filter((s) => s.box).map((s) => s.box.y1)) * RIB_K

  // ภาพย่อโพลารอยด์ 3 ใบล่าสุด (ถ้ามีมากกว่า 3 ใต้ใบที่สามมีกระดาษเปล่าซ้อน 2 แผ่น) วางใต้ป้ายของแถบ
  const shown = list.slice(-3)
  const groupW = PHOTO_W + (shown.length - 1) * PHOTO_PITCH
  const originX = 72 + (936 - groupW) / 2
  const photoTop = Math.max(912, labelsTop + labelsH + 14)
  if (list.length > shown.length) {
    const last = shown.length - 1
    STACK_SHEETS.forEach((sh) => drawBlankSheet(ctx, originX + last * PHOTO_PITCH, photoTop + PHOTO_SLOTS[last].dy, sh))
  }
  shown.forEach((e, i) => {
    const slot = PHOTO_SLOTS[i]
    drawDayPolaroid(ctx, e, thumbs.get(e.id), slot, originX + i * PHOTO_PITCH, photoTop + slot.dy)
  })

  drawFooter(ctx, maskName(userName), 52, 22)
  drawGrain(ctx, CARD_W, CARD_H)
  return canvasToBlob(canvas)
}
