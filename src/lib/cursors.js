// เคอร์เซอร์วาดมือ (เฉพาะอุปกรณ์ที่มีเมาส์/แทร็กแพด: media query `pointer: fine`; จอสัมผัสไม่เปลี่ยนอะไร)
// - ทั่วแอป: นิ้วชี้ 32px จุดคลิกอยู่ที่ปลายนิ้ว (ตัวแปร CSS --cursor-finger ใช้ใน assets/app.css)
// - บนผ้าใบ: ปาดสี = นิ้วที่มีสีอารมณ์ติดปลาย · เติมหยด = ปลายพู่กันสีอารมณ์ · สีอุ่น = ปลายพู่กันสีอุ่น (FluidCanvas ตั้ง style.cursor)
// สีเส้น/พื้น/วัสดุพู่กันมาจาก tokens.js เท่านั้น สีปลายนิ้ว/ปลายขนเป็นสีอารมณ์ที่ส่งเข้ามา
import { ref } from 'vue'
import { BRUSH, PALETTE } from '@/lib/tokens'

export const CURSOR_SIZE = 32
export const FINGER_HOTSPOT = [13, 3] // ปลายนิ้วชี้
export const BRUSH_HOTSPOT = [4, 28] // ปลายขนพู่กัน

const stroke = (w) => `stroke="${PALETTE.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`

// นิ้วชี้ (viewBox 32): tipHex = สีที่ติดปลายนิ้ว (null = ไม่มี)
export const fingerSvg = (tipHex = null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 32 32" fill="none">` +
  `<path d="M9.5 7 C9.5 4.8 11 3.2 12.8 3.2 C14.6 3.2 16 4.8 16 7 V14 C16.6 13.2 17.6 12.8 18.6 13 C19.6 12.2 21 12.4 21.8 13.2 C22.6 12.8 23.8 13 24.5 14 C25.2 14.8 25.4 15.8 25.4 17 V22 C25.4 26.4 22.2 29.5 18.4 29.5 H15.2 C12.2 29.5 10.2 28 8.8 25.6 L4.6 18.4 C4 17.3 4.4 16.2 5.4 15.8 C6.6 15.4 7.6 16 8.2 16.8 L9.5 18.6 Z" fill="${PALETTE.paper}" ${stroke(1.8)}/>` +
  `<path d="M18.6 13 V18 M21.8 13.2 V18" ${stroke(1.3)}/>` +
  (tipHex ? `<path d="M10.9 6.6 C10.9 5 11.7 4.4 12.8 4.4 C13.9 4.4 14.6 5 14.6 6.6 C14.6 8.4 13.9 9.2 12.8 9.2 C11.7 9.2 10.9 8.4 10.9 6.6 Z" fill="${tipHex}" stroke="none"/>` : '') +
  `</svg>`

// พู่กันเอียง ปลายขนชี้ลงซ้าย (ด้ามไปขวาบน) ปลายขนเป็นสี hex
export const brushSvg = (hex) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 32 32" fill="none">` +
  `<g transform="translate(4 28) rotate(40) scale(0.145) translate(-35 -198)" stroke-linejoin="round" stroke-linecap="round">` +
  `<defs><clipPath id="t"><rect x="0" y="168" width="70" height="32"/></clipPath></defs>` +
  `<path d="M31 6 Q35 1 39 6 L44 104 L26 104 Z" fill="${BRUSH.wood}" stroke="${PALETTE.ink}" stroke-width="9"/>` +
  `<path d="M25 104 H45 L43.5 140 H26.5 Z" fill="${BRUSH.metal}" stroke="${PALETTE.ink}" stroke-width="9"/>` +
  `<path d="M27 140 H43 C46.5 158 42.5 178 35 198 C27.5 178 23.5 158 27 140 Z" fill="${BRUSH.bristle}" stroke="${PALETTE.ink}" stroke-width="9"/>` +
  `<path d="M27 140 H43 C46.5 158 42.5 178 35 198 C27.5 178 23.5 158 27 140 Z" fill="${hex}" stroke="none" clip-path="url(#t)"/>` +
  `</g></svg>`

// ค่า CSS ของ cursor: url(...) x y, auto
export const cursorValue = (svg, [x, y]) => `url("data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}") ${x} ${y}, auto`
export const fingerCursor = (tipHex = null) => cursorValue(fingerSvg(tipHex), FINGER_HOTSPOT)
export const brushCursor = (hex) => cursorValue(brushSvg(hex), BRUSH_HOTSPOT)

// เคอร์เซอร์บนผ้าใบตามเครื่องมือ: smear | drop | warm (warm = สีอุ่น ใช้ warmHex แทนสีอารมณ์)
export const canvasCursor = (tool, emotionHex, warmHex) => {
  if (tool === 'warm') return brushCursor(warmHex)
  if (tool === 'drop') return brushCursor(emotionHex)
  return fingerCursor(emotionHex)
}

const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: fine)') : null
export const finePointer = ref(Boolean(mq?.matches))

const apply = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (finePointer.value) root.style.setProperty('--cursor-finger', fingerCursor())
  else root.style.removeProperty('--cursor-finger')
}
// เรียกครั้งเดียวตอนเริ่มแอป: ตั้ง --cursor-finger เมื่อเป็นเมาส์ (และตามเมื่อสลับอุปกรณ์รับเข้า)
export const installCursors = () => {
  apply()
  mq?.addEventListener?.('change', (e) => {
    finePointer.value = e.matches
    apply()
  })
}
