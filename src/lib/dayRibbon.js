// เรขาคณิตของแถบสีของวัน (components/book/DayRibbon.vue) ฟังก์ชันล้วน ทดสอบได้
// เรียงตามเวลาจากซ้ายไปขวา (ตามลำดับ ไม่ใช่แกน 24 ชม.) ความกว้างช่วง ∝ น้ำหนัก (palette.js entryWeight)
// ภาพที่อยู่ติดกัน อารมณ์เดียวกัน และสถานะ shifted เหมือนกัน "รวมเป็นช่วงเดียว" น้ำหนักรวมกัน (เป็นการแสดงผลเท่านั้น ไม่แก้ข้อมูลในสมุด)
import { WARM_TONES, emotionLabel } from '@/lib/emotions'
import { entryWeight, rankedColors } from '@/lib/palette'
import { hexToRgb } from '@/lib/color'

export const BLEND_FRAC = 0.07 // รอยต่อซึมเข้าหากัน ~7% ของความกว้างแถบ (สองฝั่งรวมกัน)
export const LABEL_FULL_MIN = 72 // ช่วงแคบกว่านี้ใช้ป้ายเวลาอย่างเดียว (ระดับ 1)
export const LABEL_NONE_MIN = 32 // ซ่อนป้ายได้เฉพาะช่วงที่แคบกว่านี้ (ป้ายเล็กลงครึ่งหนึ่งในข้อ 44 จึงลดจาก 40)
export const LABEL_GAP = 2 // ระยะห่างขั้นต่ำระหว่างป้าย (px) ความกว้างที่ประมาณเผื่อไว้เกินจริง ~2–6px อยู่แล้ว ระยะจริงจึง ≥ 4px
export const LABEL_TOP = 5 // ขอบบนของป้ายแถวแรก นับจากใต้แถบ (ที่ว่างสำหรับขีดบอกกลางช่วง)
export const ROW_STEP = 19 // ป้ายเยื้องกันทีละแถว (วางสลับบน/ล่างแทนการซ่อน)
export const MAX_ROWS = 4
export const H1 = 17 // สูงของป้ายเวลาอย่างเดียว (11px × leading-thai 1.5 = 16.5)
export const H2 = 37 // สูงของป้ายเวลา + อารมณ์ (16.5 + 1 + 12px × 1.5)
export const CHAR_W = 8 // (ข้อ 44: ตัวอักษร 12px จาก 15px) เดิม 10 // ความกว้างต่อ 1 ตัวอักษรฐานที่ 15px Mali ตัวหนา (วัดที่ 16px ได้ 9.8–11.3 → ที่ 15px ราว 9.2–10.6; สระ/วรรณยุกต์ที่ซ้อนอยู่ไม่นับ)
export const TIME_W = 52 // ไอคอน + HH:MM
export const RANGE_W = 88 // ไอคอน + HH:MM–HH:MM

// ความกว้างข้อความโดยประมาณ: นับเฉพาะตัวอักษรฐาน (ไม่นับสระบน/ล่างและวรรณยุกต์ของภาษาไทยที่ไม่กินความกว้าง)
export const textWidth = (str) => [...str].filter((c) => !/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(c)).length * CHAR_W

export const sortedByTime = (entries) => [...entries].sort((a, b) => a.local_time.localeCompare(b.local_time))

// ไอคอนช่วงเวลา: 06:00–18:59 ดวงอาทิตย์ ที่เหลือพระจันทร์
export const timeIcon = (time) => {
  const h = Number(time.slice(0, 2))
  return h >= 6 && h < 19 ? 'sun' : 'moon'
}

// ข้อความบรรทัดที่ 2 ของภาพเดียว: "เหนื่อย → มีแสงขึ้น" (ภาพที่ปรับด้วยแต้มแสงต่อท้าย "→ มีแสงขึ้น")
export const ribbonCaption = (entry) => `${emotionLabel(entry)}${entry.shifted ? ' → มีแสงขึ้น' : ''}`

// รวมภาพติดกันที่อารมณ์เดียวกันและ shifted เหมือนกัน → [{ entries, weight, count }]
export const groupRuns = (entries) => {
  const groups = []
  for (const entry of sortedByTime(entries)) {
    const last = groups.at(-1)
    const lastEntry = last?.entries.at(-1)
    if (last && lastEntry.emotion === entry.emotion && Boolean(lastEntry.shifted) === Boolean(entry.shifted)) {
      last.entries.push(entry)
      last.weight += entryWeight(entry)
      last.count++
    } else groups.push({ entries: [entry], weight: entryWeight(entry), count: 1 })
  }
  return groups
}

const colorDistance = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
const FAR_FROM_TONE = 70 // ระยะ RGB ที่ถือว่า "ไม่ใช่สีแต้มแสง"

// สีของภาพหนึ่งภาพ: สีหลัก (rankedColors: สัดส่วน × ความอิ่มสี สีใกล้กระดาษถูกตัดโดย extractColors แล้ว) + (shifted) สีแต้มแสงของอารมณ์
export const entryColors = (entry) => {
  const ranked = rankedColors(entry.colors)
  if (!entry.shifted) return { main: ranked[0].hex, to: null }
  const tone = WARM_TONES[entry.emotion] ?? WARM_TONES[entry.emotions?.[0]] ?? null
  // สีแต้มแสงเองมักเป็นสีสดที่เด่นอยู่ใน colors แล้ว ถ้าเอามาเป็นสีหลักแถบจะไม่ไล่ (เหลือง→เหลือง) จึงเลือกสีเด่นที่ห่างจากสีแต้มแสงก่อน
  const base = tone ? ranked.find((c) => colorDistance(c.hex, tone) > FAR_FROM_TONE) : null
  return { main: (base ?? ranked[0]).hex, to: tone }
}

// สีของช่วง (รวมหลายภาพ): ใช้สีของภาพที่หนักที่สุดในช่วง (เท่ากันใช้ภาพล่าสุด) ได้อย่างมาก 2 สี: สีหลัก (+ สีแต้มแสงถ้า shifted)
export const segmentColors = (group) => {
  const entry = group.entries.reduce((best, e) => (entryWeight(e) >= entryWeight(best) ? e : best), group.entries[0])
  return entryColors(entry)
}

// ข้อความป้ายของช่วง: ภาพเดียว "04:05" + "ตื่นเต้น" · หลายภาพ "04:05–04:08" + "ตื่นเต้น ×3"
export const groupLabel = (group) => {
  const first = group.entries[0]
  const last = group.entries.at(-1)
  const time = group.count > 1 && first.local_time !== last.local_time ? `${first.local_time}–${last.local_time}` : first.local_time
  const caption = group.count > 1 ? `${ribbonCaption(last)} ×${group.count}` : ribbonCaption(first)
  return { time, caption, icon: timeIcon(first.local_time) }
}

// ช่วงทั้งหมดของแถบกว้าง width: [{ group, id, x, w, cx, time, icon, caption, count, main, to, level, row, box, tick }]
// level ของป้าย: 2 = เวลา + อารมณ์, 1 = เวลาอย่างเดียว, 0 = ไม่มีป้าย (เฉพาะช่วงที่แคบกว่า LABEL_NONE_MIN จนวางไม่ได้)
// ป้ายที่ชนกันจะเยื้องลงเป็นแถวถัดไป (row) แทนการซ่อน box = { x0, x1, y0, y1 } (y นับจากใต้แถบ) tick = ขีดจากแถบลงถึงป้าย
export const layoutRibbon = (entries, width, { measure } = {}) => {
  const groups = groupRuns(entries)
  const total = groups.reduce((s, g) => s + g.weight, 0) || 1
  let x = 0
  const segs = groups.map((group) => {
    const w = (width * group.weight) / total
    const label = groupLabel(group)
    const seg = { group, id: group.entries[0].id, x, w, cx: x + w / 2, count: group.count, ...label, ...segmentColors(group), level: 0, row: 0, box: null, tick: null }
    x += w
    return seg
  })
  const boxWidth = measure ?? ((seg, level) => (level === 2 ? Math.max(seg.time.includes('–') ? RANGE_W : TIME_W, textWidth(seg.caption)) : seg.time.includes('–') ? RANGE_W : TIME_W))
  const wanted = (seg) => (seg.w >= LABEL_FULL_MIN ? 2 : 1)
  const hit = (a, b, gap) => !(a.x1 + gap <= b.x0 || a.x0 >= b.x1 + gap || a.y1 + gap <= b.y0 || a.y0 >= b.y1 + gap)
  const taken = []
  // ตัดสินจากขวาไปซ้าย (ช่วงล่าสุดเลือกที่ก่อน): ระดับสูงสุดที่ทำได้ ลองแถวบนสุดก่อน ไม่ทับป้ายและขีดของช่วงอื่น (2 มิติ)
  for (let i = segs.length - 1; i >= 0; i--) {
    const seg = segs[i]
    if (seg.w < LABEL_NONE_MIN) continue
    placing: for (let level = wanted(seg); level >= 1; level--) {
      const half = boxWidth(seg, level) / 2
      // ป้ายอยู่ในแถบเสมอ (ชิดขอบแถบถ้าช่วงอยู่ริม) ขีดบอกยังอยู่กลางช่วง
      const cxBox = Math.min(Math.max(seg.cx, half), Math.max(half, width - half))
      for (let row = 0; row < MAX_ROWS; row++) {
        const y0 = LABEL_TOP + row * ROW_STEP
        const box = { x0: cxBox - half, x1: cxBox + half, y0, y1: y0 + (level === 2 ? H2 : H1) }
        const tick = { x0: seg.cx - 1, x1: seg.cx + 1, y0: 0, y1: y0 }
        if (taken.every((t) => !hit(box, t, LABEL_GAP) && !hit(tick, t, 0))) {
          seg.level = level
          seg.row = row
          seg.box = box
          seg.tick = tick
          taken.push(box, tick)
          break placing
        }
      }
    }
  }
  return segs
}

// ความสูงของพื้นที่ป้ายใต้แถบ (px) ตามป้ายที่วางจริง
export const labelsHeight = (segs) => Math.max(0, ...segs.filter((s) => s.box).map((s) => s.box.y1)) + 4

// ขอบนำสั่นแบบรอยพู่กัน: ค่าเยื้อง x ของแต่ละจุดตามความสูง (px) ผลคงที่ (ไม่สุ่มใหม่ทุกครั้ง) ใช้กับ clip-path polygon
export const jaggedOffsets = (teeth = 14, amp = 7) =>
  Array.from({ length: teeth + 1 }, (_, i) => Math.round((Math.sin(i * 2.1) * 0.55 + Math.sin(i * 5.3 + 1) * 0.45) * amp * 10) / 10)

// polygon() ที่คลุมทุกอย่างทางซ้ายของ x (ขอบขวาสั่นตาม offsets) สูง h
export const sweepPolygon = (x, h, offsets) => {
  const n = offsets.length - 1
  const pts = ['0px -20px']
  offsets.forEach((dx, i) => pts.push(`${(x + dx).toFixed(1)}px ${(-20 + ((h + 40) * i) / n).toFixed(1)}px`))
  pts.push(`0px ${h + 20}px`)
  return `polygon(${pts.join(', ')})`
}

// จุดหยุดของ gradient แนวนอนเส้นเดียวตลอดแถบ: แต่ละช่วงมีสีไม่เกิน 2 สี (สีหลัก → สีแต้มแสงถ้า shifted) ไล่นุ่ม ๆ ตลอดช่วง
// รอยต่อระหว่างช่วงซึมกันกว้าง blend (px, สองฝั่งรวม) ไม่มีแถบสีตัดคม คืน [{ offset 0..1, color }]
export const gradientStops = (segs, width) => {
  const b = width * BLEND_FRAC
  const stops = []
  segs.forEach((s, i) => {
    const first = i === 0
    const last = i === segs.length - 1
    const mid = s.x + s.w / 2
    // ปลายช่วงที่ซึมเข้าหาช่วงข้างเคียงถอยเข้า b/2 (ช่วงที่แคบกว่า b ยุบเหลือจุดกลาง)
    const a = first ? s.x : Math.min(s.x + b / 2, mid)
    const e = last ? s.x + s.w : Math.max(s.x + s.w - b / 2, mid)
    stops.push({ offset: a / width, color: s.main })
    stops.push({ offset: e / width, color: s.to ?? s.main })
  })
  // offset ต้องไม่ลดลง (ช่วงบางมากอาจทำให้ซ้อนกัน)
  stops.forEach((st) => (st.offset = Math.min(1, Math.max(0, st.offset))))
  for (let i = 1; i < stops.length; i++) stops[i].offset = Math.max(stops[i].offset, stops[i - 1].offset)
  return stops
}

// ---- markup ของรอยพู่กัน (ใช้ทั้ง DayRibbon.vue และการ์ดเก็บรูป: การ์ดแปลง SVG นี้เป็นภาพแล้ววาดลง canvas ไม่วาดแถบใหม่) ----
// ข้อ 44: แถบเตี้ยลงครึ่งหนึ่ง (เดิมพื้นที่ 84 / แถบ 56 / ฮาโล ±4 / ตัวแถบ ±4 / pad 20) ฟิลเตอร์ปรับตามสัดส่วน (ความถี่ ×2, scale/เบลอ ×½)
export const RIBBON_H = 42 // สูงพื้นที่แถบ
export const RIBBON_BAR_H = 28
export const RIBBON_PAD = 10 // เผื่อขอบ region ของฟิลเตอร์ (px)
const HALO_H = RIBBON_BAR_H + 4
const MAIN_H = RIBBON_BAR_H - 4
const HALO_Y = (RIBBON_H - HALO_H) / 2
const MAIN_Y = (RIBBON_H - MAIN_H) / 2
export const RIBBON_MAIN = { y: MAIN_Y, h: MAIN_H }

// ข้างในของ <svg> ขนาด width × RIBBON_H: defs (gradient/ฟิลเตอร์/คลิป ทุกอย่างเป็นของแถบนี้เอง id ขึ้นต้นด้วย p) + 3 ชั้น ฮาโล → ตัวแถบ → เกรน
// ฟิลเตอร์: บิดก่อนเบลอเสมอ region เป็นพิกเซลจริงเผื่อขอบ RIBBON_PAD
export const ribbonSvgMarkup = (segs, width, p) => {
  const region = `filterUnits="userSpaceOnUse" x="${-RIBBON_PAD}" y="${-RIBBON_PAD}" width="${width + RIBBON_PAD * 2}" height="${RIBBON_H + RIBBON_PAD * 2}"`
  const stops = gradientStops(segs, width)
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join('')
  const fill = `fill="url(#${p}-g)"`
  return `<defs>
<linearGradient id="${p}-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">${stops}</linearGradient>
<filter id="${p}-fm" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" result="d"/><feGaussianBlur in="d" stdDeviation="0.4"/></filter>
<filter id="${p}-fh" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="13" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" result="d"/><feGaussianBlur in="d" stdDeviation="1.1"/></filter>
<filter id="${p}-gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/></filter>
<clipPath id="${p}-c"><rect x="0" y="${MAIN_Y}" width="${width}" height="${MAIN_H}" rx="${MAIN_H * 0.4}"/></clipPath>
</defs>
<g filter="url(#${p}-fh)" opacity="0.35"><rect x="-2" y="${HALO_Y}" width="${width + 4}" height="${HALO_H}" rx="${HALO_H * 0.4}" ${fill}/></g>
<g filter="url(#${p}-fm)" opacity="0.85"><rect x="0" y="${MAIN_Y}" width="${width}" height="${MAIN_H}" rx="${MAIN_H * 0.4}" ${fill}/></g>
<g clip-path="url(#${p}-c)" opacity="0.5"><rect x="0" y="${MAIN_Y}" width="${width}" height="${MAIN_H}" fill="transparent" filter="url(#${p}-gr)"/></g>`
}

// <svg> ทั้งก้อนสำหรับแปลงเป็นภาพ (scale = ความละเอียดของภาพ ต่อ 1 หน่วย)
export const ribbonSvg = (segs, width, p = 'rb', scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${RIBBON_H * scale}" viewBox="0 0 ${width} ${RIBBON_H}" style="overflow:visible">${ribbonSvgMarkup(segs, width, p)}</svg>`
