// FLIP ของภาพหน้า photo (SPEC §5.8): บินระหว่างตำแหน่งจริงในสมุดกับตำแหน่งขยายกลางโต๊ะ ใช้ transform อย่างเดียว
import { STAGE } from '@/lib/tokens'

// ท่าสุดท้ายของโพลารอยด์ในหน้า photo (ต้องตรงกับ class ของ PhotoView: scale-[2.2] -rotate-2)
export const PHOTO_POSE = { scale: 2.2, rotate: -2 }

const stageEl = () => document.querySelector('[data-stage]')

// จุดกึ่งกลางของ element ในพิกัด stage 1280×800 (หักล้างการ scale ของ Stage) rotate/scale ของ element รอบจุดกลางไม่ทำให้จุดกลางเลื่อน
export const centerInStage = (el) => {
  const stage = stageEl()?.getBoundingClientRect()
  if (!stage || !stage.width) return null
  const s = stage.width / STAGE.width
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2 - stage.left) / s, y: (r.top + r.height / 2 - stage.top) / s }
}

// from: ตำแหน่ง/มุมในสมุด { x, y, rotate } (scale 1) to: จุดกึ่งกลางปลายทาง { x, y } → keyframe transform [เริ่ม, จบ]
// ฟังก์ชัน transform ลำดับเดียวกันทั้งคู่ (translate → rotate → scale) เบราว์เซอร์จึง interpolate ทีละตัวได้
export const flightTransforms = (from, to, pose = PHOTO_POSE) => [
  `translate(${from.x - to.x}px, ${from.y - to.y}px) rotate(${from.rotate}deg) scale(1)`,
  `translate(0px, 0px) rotate(${pose.rotate}deg) scale(${pose.scale})`,
]
