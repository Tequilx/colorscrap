// โลโก้ ColorScrap ที่เดียวของทั้งแอป: กระดาษแผ่นเล็กติดเทป มีหยดสีน้ำไล่สีอยู่ตรงกลาง
// เปลี่ยนโลโก้ = แก้ไฟล์นี้ไฟล์เดียว (BrandMark.vue, favicon, การ์ดเก็บรูปทั้งสองแบบ อ่านจากที่นี่หมด)
import { EMOTION_COLORS, PALETTE } from '@/lib/tokens'

export const BRAND_NAME = 'ColorScrap'
export const BRAND_VIEWBOX = '0 0 40 40'

// ภายใน <svg> ของโลโก้ (พื้นที่ 40×40) idPrefix กัน id ของ gradient ซ้ำเมื่อวางหลายจุดในหน้าเดียว
export const brandMarkInner = (idPrefix = 'bm') => `
<defs><linearGradient id="${idPrefix}-g" x1="0" y1="0" x2="0.35" y2="1">
<stop offset="0" stop-color="${EMOTION_COLORS.calm}"/><stop offset="0.55" stop-color="#8F7FBF"/><stop offset="1" stop-color="${EMOTION_COLORS.excited}"/>
</linearGradient></defs>
<g transform="rotate(-4 20 21)">
<rect x="6" y="7" width="29" height="30" rx="2.5" fill="${PALETTE.card}" stroke="${PALETTE.ink}" stroke-width="1.7" stroke-linejoin="round"/>
<path d="M20.5 13 C20.5 13 28 21.5 28 26.5 A7.5 7.5 0 0 1 13 26.5 C13 21.5 20.5 13 20.5 13Z" fill="url(#${idPrefix}-g)"/>
<rect x="12" y="3.2" width="14" height="6" rx="0.8" fill="${PALETTE.tape}" transform="rotate(-6 19 6)"/>
</g>`

// ข้อความ SVG ทั้งก้อน (ใช้เป็น favicon / แปลงเป็นภาพวาดลงการ์ด canvas)
export const brandMarkSvg = (size = 40, idPrefix = 'bm') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${BRAND_VIEWBOX}">${brandMarkInner(idPrefix)}</svg>`

export const brandMarkDataUrl = (size = 64) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(brandMarkSvg(size, 'bmf'))}`

// favicon จาก SVG เดียวกับโลโก้ (เรียกครั้งเดียวตอนเริ่มแอป)
export const installFavicon = () => {
  if (typeof document === 'undefined') return
  document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove())
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/svg+xml'
  link.href = brandMarkDataUrl(64)
  document.head.appendChild(link)
}
