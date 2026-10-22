// ลำดับแอนิเมชันตอนบันทึก (SPEC §5.4, §5.6): ตารางเวลาและพิกัด เป็นฟังก์ชันล้วนเพื่อเทสต์ได้
// store ใช้ตารางนี้ตั้ง timer ของสถานะ ส่วน SavedFlight ใช้ตารางเดียวกันเล่น WAAPI ของโพลารอยด์
import { MOTION } from '@/lib/tokens'
import { FIRST_LEAF_SLOTS, INSERT_LEAF_SLOTS } from '@/lib/photos'

// กระดาษวาดบน stage และโพลารอยด์ (196 กว้าง, ช่องภาพ 178×98 ที่ offset 9,9, สูงรวมแถบสี ~167)
export const PAPER = { x: 84, y: 92, w: 1112, h: 612 }
export const POLAROID = { w: 196, h: 167, win: { x: 9, y: 9, w: 178, h: 98 } }
// ช็อตซูมของสมุดตอน saved (ต้องตรงกับ OPEN.saved ใน Scrapbook.vue)
export const ZOOM = { x: 40, y: 32, s: 1.15 }
// ที่พักของโพลารอยด์กลางโต๊ะระหว่างรอสมุดเข้า
export const PARK = { x: 640, y: 400, rotate: -3 }
// ภาพลอยขึ้นเหนือช่องก่อนแปะ (SPEC §5.4)
export const LIFT = 1.08

// scale = ตัวคูณเวลา (?motion=slow) → ตารางเวลาเป็น ms นับจากเริ่มบันทึก
export const saveSchedule = ({ newLeaf = false, scale = 1 } = {}) => {
  const S = MOTION.save
  // ช่วงสมุดเข้า = สมุดเลื่อนเข้า + พลิกปก 3D (flipExtra: เพิ่มจากเดิมไม่เกิน 0.3 วิ)
  const bookEnd = S.bookAt + MOTION.settle + S.flipExtra
  const leaf = newLeaf ? [bookEnd, bookEnd + MOTION.swap] : null // แผ่นแทรกพลิกลงมาก่อนวางภาพ (§5.6)
  const dropAt = leaf ? leaf[1] : bookEnd
  const tapeAt = dropAt + S.drop
  const cardAt = tapeAt + S.cardLead
  const raw = {
    shrink: [0, S.shrink],
    book: [S.bookAt, bookEnd],
    leaf,
    drop: [dropAt, tapeAt],
    tape: [tapeAt, tapeAt + S.tape],
    card: [cardAt, cardAt + S.card],
  }
  const out = {}
  for (const [key, span] of Object.entries(raw)) out[key] = span && span.map((t) => t * scale)
  out.total = out.card[1]
  return out
}

// จุดกึ่งกลางของโพลารอยด์ในช่อง slot ตอนสมุดอยู่ในช็อตซูม (พิกัด stage)
// insert: แผ่นแทรก (กระดาษ 470×548 ที่ offset (8,18) ในหน้า) ไม่ใช่แผ่นแรก
export const slotCenter = ({ slot, insert = false, height = POLAROID.h }) => {
  const pos = (insert ? INSERT_LEAF_SLOTS : FIRST_LEAF_SLOTS)[slot]
  const origin = insert ? { x: 14 + 8, y: 14 + 18 } : { x: 14, y: 14 }
  const lx = origin.x + pos.x + POLAROID.w / 2
  const ly = origin.y + pos.y + height / 2
  return { x: ZOOM.x + ZOOM.s * lx, y: ZOOM.y + ZOOM.s * ly }
}

// ท่าของ wrapper โพลารอยด์ (จุดกลางของตัวโพลารอยด์ทั้งใบ) ที่จุดสำคัญของลำดับ
// start: ช่องภาพของโพลารอยด์ทับกระดาษพอดี (ช่องภาพอยู่เหนือกึ่งกลางใบ จึงเลื่อนลง height/2 - (win.y + win.h/2))
export const flightPoses = ({ target, rotate, fromPaper = true, height = POLAROID.h }) => {
  const winCenterAbove = POLAROID.win.y + POLAROID.win.h / 2 - height / 2
  const paperCenter = { x: PAPER.x + PAPER.w / 2, y: PAPER.y + PAPER.h / 2 }
  return {
    start: fromPaper ? { x: paperCenter.x, y: paperCenter.y - winCenterAbove, rotate: 0, scale: 1 } : { ...PARK, scale: 1 },
    park: { ...PARK, scale: 1 },
    lift: { x: target.x, y: target.y, rotate, scale: ZOOM.s * LIFT },
    land: { x: target.x, y: target.y, rotate, scale: ZOOM.s },
    // ภาพบนกระดาษต้องขยายเท่านี้ ช่องภาพของโพลารอยด์จึงเต็มกระดาษ
    paperScale: PAPER.w / POLAROID.win.w,
  }
}

// transform ของ wrapper (กึ่งกลางที่ pose.x,y) ฟังก์ชันเรียงเหมือนกันทุกท่าให้ interpolate ได้
export const poseTransform = (pose, height = POLAROID.h) =>
  `translate(${pose.x - POLAROID.w / 2}px, ${pose.y - height / 2}px) rotate(${pose.rotate}deg) scale(${pose.scale})`
