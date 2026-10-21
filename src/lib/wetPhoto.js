// "ภาพยังเปียก": ภาพที่เพิ่งแปะ (ตอนการ์ดขึ้น) และภาพที่เปิดดูเดี่ยว (ตอนเปิด) พลิ้วเบา ๆ เหมือนสียังไม่แห้ง
// ฟิลเตอร์บิดภาพ (#wet ใน SvgDefs.vue: feTurbulence + feDisplacementMap) ไล่ความแรงลงแบบ ease-out จนนิ่งใน WET_MS แล้ว "ถอดฟิลเตอร์ออกทั้งหมด"
// (ภาพหลังนิ่งจึงเหมือนต้นฉบับทุกพิกเซล) เล่นทีละภาพเท่านั้น: เริ่มภาพใหม่ = หยุดภาพเดิมทันที reduced-motion: ไม่เล่น
import { reducedMotion } from '@/lib/motion'
import { WET_MS, WET_PEAK, wetStrength } from '@/lib/wetCurve'

export { WET_MS, WET_PEAK, wetStrength }

let current = null

export const stopWet = () => {
  if (!current) return
  cancelAnimationFrame(current.raf)
  current.el.style.filter = ''
  current.disp?.setAttribute('scale', '0')
  current = null
}

export const isWet = () => current !== null

// el = องค์ประกอบที่ตั้งตัวกรอง (ช่องภาพของโพลารอยด์ [data-wet-target])
export const startWet = (el) => {
  stopWet()
  if (!el || reducedMotion.value) return
  const turb = document.getElementById('wet-turb')
  const disp = document.getElementById('wet-disp')
  if (!turb || !disp) return
  el.style.filter = 'url(#wet)'
  const t0 = performance.now()
  const state = { el, disp, raf: 0 }
  current = state
  const step = (now) => {
    const t = now - t0
    if (t >= WET_MS) {
      stopWet()
      return
    }
    const s = wetStrength(t)
    disp.setAttribute('scale', s.toFixed(2))
    // พลิ้ว: ความถี่ของลายน้ำแกว่งเบา ๆ ตามเวลา (แกว่งน้อยลงตามความแรง)
    const k = 0.0035 * Math.sin((t / 1400) * Math.PI * 2) * (s / WET_PEAK)
    turb.setAttribute('baseFrequency', `${(0.012 + k).toFixed(5)} ${(0.018 - k).toFixed(5)}`)
    state.raf = requestAnimationFrame(step)
  }
  state.raf = requestAnimationFrame(step)
}
