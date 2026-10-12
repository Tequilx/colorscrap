// วาดการ์ด PNG 1080×1350 สองแบบ (SPEC ส่วนที่ 2 §3–§4) ตามไฟล์ดีไซน์ docs/design/screens/7a-card-photo.dc.html และ 7b-card-day.dc.html
// พิกัดทั้งหมดคือพิกัดในดีไซน์ (px ของการ์ด) ข้อมูลจริงมาจากผู้เรียก: ภาพตัวอย่างสีม่วงในดีไซน์เป็นแค่ตัวอย่าง
import { BLOB_PATHS } from '@/lib/doodles'
import { INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { percentsOf } from '@/lib/palette'
import { parseLocalDate } from '@/lib/dates'
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

export const photoCaption = (entry) => `${entry.local_time} · ${emotionLabel(entry)}${entry.shifted ? ' → อุ่นขึ้น' : ''} · ${INTENSITY_LABELS[entry.intensity]}`

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
