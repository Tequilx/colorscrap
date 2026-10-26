// กรอบโพลารอยด์ขาวของ "สีของวัน" (เหมือน PolaroidFrame: ขอบขาว ขอบล่างหนากว่า เงา shadow-photo) เอียง −3° ไม่มีเทป (หน้าจานสีในสมุดวาดด้วย HTML/CSS ตัวนี้ใช้กับการ์ดเก็บรูป)
// คืน <svg> ทั้งก้อน 380×380 (กรอบ 340 อยู่กลาง เผื่อขอบให้เงาและการเอียง) ฟิลเตอร์อยู่ใน defs ของมันเอง
import { BLOB_PATHS } from '@/lib/doodles'
import { PALETTE } from '@/lib/tokens'

export const DAY_FRAME_SIZE = 380

// crop = true: ไม่วาดก้อนสี (การ์ดวางภาพครอปของวันลงในกรอบเอง ที่ CROP_BOX) · ไม่งั้นวาดก้อนสีจาก mix/dominant
export const CROP_BOX = { x: 45, y: 45, w: 290, h: 271 }

export const dayFrameSvg = ({ mix, dominant = null, p = 'df', crop = false }) => {
  const blob = (hex, k, opacity) => {
    const tx = 190 - 85 * k
    const ty = 190 - 60 * k
    return `<g filter="url(#${p}-w)"><path d="${BLOB_PATHS.small}" transform="translate(${tx} ${ty}) scale(${k})" fill="${hex}" fill-opacity="${opacity}" stroke="${hex}" stroke-opacity="0.4" stroke-width="${2 * k}"/></g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DAY_FRAME_SIZE}" height="${DAY_FRAME_SIZE}" viewBox="0 0 ${DAY_FRAME_SIZE} ${DAY_FRAME_SIZE}">
<defs>
<filter id="${p}-s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="12" flood-color="${PALETTE.ink}" flood-opacity="0.18"/></filter>
<filter id="${p}-w" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" result="d"/><feGaussianBlur in="d" stdDeviation="1.2"/></filter>
</defs>
<g transform="rotate(-3 190 190)">
<rect x="20" y="20" width="340" height="340" fill="#FFFFFF" filter="url(#${p}-s)"/>
<rect x="${CROP_BOX.x}" y="${CROP_BOX.y}" width="${CROP_BOX.w}" height="${CROP_BOX.h}" fill="${PALETTE.paper}"/>
${crop ? '' : blob(mix, 2.1, 0.85) + (dominant ? blob(dominant, 0.95, 0.7) : '')}
</g></svg>`
}
