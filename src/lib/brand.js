// โลโก้ ColorScrap ที่เดียวของทั้งแอป (ข้อ 48): เปลี่ยนโลโก้ = แก้ไฟล์นี้ไฟล์เดียว
// BrandMark.vue, favicon (scripts/make-favicons.mjs), การ์ดเก็บรูปทั้งสองแบบ (lib/share/cards.js) อ่านจากที่นี่หมด
// มี 3 รูปแบบ: wordmark ("ColorScrap" — l ใน Color เป็นพู่กัน, "Scrap" บนแถบเทปเอียง −3°) · icon (ตัว C + พู่กันเอียง ~40° ปลายขนแตะปลายล่างของ C) · lockup (icon | เส้นคั่น | wordmark)
// ตัวอักษรเป็นเวกเตอร์ล้วน (lib/brandGlyphs.js สร้างจาก Mali 700 ด้วย scripts/make-brand-glyphs.mjs) จึงไม่พึ่งฟอนต์ตอนแสดง ใช้ได้ใน favicon.svg และภาพ SVG ที่วาดลง canvas
import { BRAND_GLYPHS as G } from '@/lib/brandGlyphs'
import { LOGO, PALETTE } from '@/lib/tokens'

export const BRAND_NAME = 'ColorScrap'
export const BRAND_TAGLINE = 'สมุดระบายความรู้สึก'

// ---- พู่กัน (พิกัดเฉพาะ: ปลายขนอยู่ที่ (0,0) ตั้งขึ้นไปทางแกน y ลบ ยาว 842 หน่วย (1000 หน่วย = 1 em)) ----
const BRUSH_LEN = 842
const BRUSH_W = 1.4 // ขยายด้านกว้างให้ขนาดพู่กันสมดุลกับเส้นตัวอักษรหนา
const brushInner = (p) => `<g transform="scale(${BRUSH_W} 1)">
<defs><clipPath id="${p}-dip"><rect x="-80" y="-58" width="160" height="120"/></clipPath></defs>
<path d="M-32 -830 Q-32 -842 0 -842 Q32 -842 32 -830 L46 -390 L-46 -390 Z" fill="${LOGO.handle}"/>
<rect x="-52" y="-392" width="104" height="170" rx="8" fill="${LOGO.ferrule}"/>
<path d="M-52 -332 H52 M-52 -300 H52" stroke="${PALETTE.ink}" stroke-opacity="0.22" stroke-width="5" fill="none"/>
<path id="${p}-bris" d="M-52 -224 H52 C60 -140 44 -50 8 0 L-8 0 C-44 -50 -60 -140 -52 -224 Z" fill="${LOGO.bristle}"/>
<path d="M-52 -224 H52 C60 -140 44 -50 8 0 L-8 0 C-44 -50 -60 -140 -52 -224 Z" fill="${LOGO.dip}" clip-path="url(#${p}-dip)"/></g>`

// ---- wordmark (viewBox WORD_VB) ----
const ADV = (s) => [...s].reduce((w, c) => w + (G[c]?.adv ?? 0), 0)
const COLOR_W = G.C.adv + G.o.adv + G.l.adv + G.o.adv + G.r.adv // C o l o r (l = พู่กัน กว้างเท่าตัว l)
const SCRAP_X = COLOR_W + 10
const SCRAP_W = ADV('Scrap')
const TAPE = { x0: SCRAP_X - 90, x1: SCRAP_X + SCRAP_W + 160, top: -790, bottom: 240 }
const TAPE_ROT = -3
export const WORD_VB = [-30, -930, TAPE.x1 + 60, 1260] // x, y, w, h
export const WORD_ASPECT = WORD_VB[2] / WORD_VB[3]

const glyphs = (str, x0, fill) => {
  let x = x0
  return [...str]
    .map((c) => {
      const g = G[c]
      const out = `<path transform="translate(${x} 0)" d="${g.d}" fill="${fill}"/>`
      x += g.adv
      return out
    })
    .join('')
}

export const wordmarkInner = (p = 'wm') => {
  const cx = (TAPE.x0 + TAPE.x1) / 2
  const cy = (TAPE.top + TAPE.bottom) / 2
  const brushX = G.C.adv + G.o.adv + G.l.adv / 2
  // แถบเทป: ปลายซ้ายตัดเฉียงตรง ปลายขวาเว้าเป็นรอยตัด
  const tape = `M${TAPE.x0 + 80} ${TAPE.top} L${TAPE.x1} ${TAPE.top} L${TAPE.x1 - 75} ${(TAPE.top + TAPE.bottom) / 2} L${TAPE.x1} ${TAPE.bottom} L${TAPE.x0} ${TAPE.bottom} Z`
  return `
${glyphs('C', 0, PALETTE.ink)}${glyphs('o', G.C.adv, PALETTE.ink)}
<g transform="translate(${brushX} 50) rotate(3)">${brushInner(p)}</g>
${glyphs('o', G.C.adv + G.o.adv + G.l.adv, PALETTE.ink)}${glyphs('r', G.C.adv + G.o.adv + G.l.adv + G.o.adv, PALETTE.ink)}
<g transform="rotate(${TAPE_ROT} ${cx} ${cy})"><path d="${tape}" fill="${PALETTE.tape}"/>${glyphs('Scrap', SCRAP_X, PALETTE.ink)}</g>`
}

// ---- icon: ตัว C + พู่กันเอียง ~40° ด้ามชี้ขึ้นขวา ปลายขนแตะปลายล่างของ C (เหมือนเพิ่งลาก C จบ) ----
const ICON_TIP = [672, -282] // ปลายล่างของตัว C (Mali 700)
const ICON_TILT = 40
const ICON_BRUSH_SCALE = 0.86
export const iconInner = (p = 'ic') => `
<path d="${G.C.d}" fill="${PALETTE.ink}"/>
<g transform="translate(${ICON_TIP[0]} ${ICON_TIP[1]}) rotate(${ICON_TILT}) scale(${ICON_BRUSH_SCALE})">${brushInner(p)}</g>`
// กรอบเนื้อหาของ icon (วัดจากพู่กันที่หมุนแล้ว) → viewBox สี่เหลี่ยมจัตุรัส เผื่อขอบ pad (สัดส่วน)
const ICON_BOX = (() => {
  const t = (ICON_TILT * Math.PI) / 180
  const L = BRUSH_LEN * ICON_BRUSH_SCALE
  const tipTop = [ICON_TIP[0] + Math.sin(t) * L, ICON_TIP[1] - Math.cos(t) * L]
  const minX = 40
  const maxX = tipTop[0] + 60
  const minY = tipTop[1] - 60
  const maxY = 20
  return { minX, maxX, minY, maxY }
})()
export const iconViewBox = (pad = 0.06) => {
  const w = ICON_BOX.maxX - ICON_BOX.minX
  const h = ICON_BOX.maxY - ICON_BOX.minY
  const side = Math.max(w, h) * (1 + pad * 2)
  const cx = (ICON_BOX.minX + ICON_BOX.maxX) / 2
  const cy = (ICON_BOX.minY + ICON_BOX.maxY) / 2
  return [cx - side / 2, cy - side / 2, side, side]
}

// ---- ข้อความ SVG ทั้งก้อน (ใช้เป็น favicon / แปลงเป็นภาพวาดลงการ์ด canvas) ----
const NS = 'xmlns="http://www.w3.org/2000/svg"'
// height = สูงของภาพ (px) ความกว้างตามสัดส่วน
export const brandWordmarkSvg = (height = 40, p = 'wm') => {
  const [x, y, w, h] = WORD_VB
  return `<svg ${NS} width="${(height * w) / h}" height="${height}" viewBox="${x} ${y} ${w} ${h}">${wordmarkInner(p)}</svg>`
}
// background = true: พื้นสี่เหลี่ยมมุมโค้ง paper (favicon/ไอคอนแอป) pad = ขอบรอบเนื้อหา
export const brandIconSvg = (size = 64, { p = 'ic', background = false, pad = background ? 0.12 : 0.04 } = {}) => {
  const [x, y, w, h] = iconViewBox(pad)
  const bg = background ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.22}" fill="${PALETTE.paper}"/>` : ''
  return `<svg ${NS} width="${size}" height="${size}" viewBox="${x} ${y} ${w} ${h}">${bg}${iconInner(p)}</svg>`
}

// ---- lockup: icon | เส้นคั่นบาง (เทาอุ่นอ่อน) | wordmark (+ คำรองใต้ wordmark เฉพาะขนาดใหญ่) ----
// เลย์เอาต์เป็นสัดส่วนของความสูง H ของ lockup (ใช้ร่วมกันทั้ง BrandMark.vue และการ์ด canvas)
export const lockupLayout = (H) => {
  const icon = H
  const gap = H * 0.28
  const word = H * 0.62
  const wordW = word * WORD_ASPECT
  const divX = icon + gap
  return { icon, gap, divider: { x: divX, h: H * 0.7, w: Math.max(1, H * 0.03) }, word, wordW, wordX: divX + gap, width: divX + gap + wordW }
}
export const DIVIDER_COLOR = PALETTE.line
