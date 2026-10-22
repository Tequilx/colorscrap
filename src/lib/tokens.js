// แหล่งความจริงเดียวของ design tokens (SPEC §3)
// ใช้ร่วมกันทั้ง tailwind.config.js และโค้ดรันไทม์ จึงต้องเป็นข้อมูลล้วน ห้าม import Vue หรือ import.meta

export const PALETTE = {
  desk: '#E6E3DC', // พื้นโต๊ะ
  board: '#D3CEC4', // กระดานรองกระดาษ
  paper: '#FBFAF6', // กระดาษ หน้าสมุด การ์ด
  'paper-deep': '#EFEDE8', // กล่องสีและพื้นที่รอง
  ink: '#2D2B33', // เส้น ตัวหนังสือ ปุ่มหลัก
  'ink-2': '#3E3C45', // ข้อความเนื้อหา
  'ink-soft': '#5E5B66', // ข้อความรอง
  line: '#CFCBC3', // เส้นประ เส้นแบ่ง
  tape: 'rgba(230,215,176,0.9)', // เทปกาว
  card: '#FFFDF8', // การ์ดหลังบันทึก (SavedCard) บนหน้าขวาของสมุด
  note: '#FFFBEF', // กระดาษโน้ตชวนลองแต้มแสง
  'warm-tint': '#FFF4DE', // พื้นปุ่มเครื่องมือแต้มแสงตอนถูกเลือก
}

// แสงตามเวลาจริงบนพื้นโต๊ะ (components/desk/DeskLight.vue) อยู่ใต้กระดาษ ไม่แตะผ้าใบ/ภาพในสมุด/การ์ด
export const LIGHT = {
  day: '#DCE6EC', // แสงเฉียงจากหน้าต่าง 06–17
  dusk: '#F2D3A4', // แสงส้มอุ่น 17–19
  lamp: '#F6DDA8', // วงแสงโคมตอนกลางคืน 19–06
}

// พู่กันจุ่มสีในหน้าเลือกความรู้สึก (components/pick/PickBrush.vue): ด้ามไม้ ปลอกโลหะ ขนสีเข้ม (ปลายขนเปลี่ยนเป็นสีอารมณ์)
export const BRUSH = {
  wood: '#C9963A',
  'wood-hi': '#E2BC6A',
  'wood-shade': '#A9792A',
  metal: '#BDB6A8',
  'metal-line': '#8E877B',
  'metal-hi': '#E6E1D7',
  bristle: '#3B2418',
  'bristle-hi': '#FFF6E6',
}

// สีปกที่ผู้ใช้เลือกได้ (ตัวแรกคือค่าเริ่มต้น)
export const COVER_COLORS = [
  { hex: '#9E2F2A', label: 'แดงเข้ม' },
  { hex: '#2F5D50', label: 'เขียวเข้ม' },
  { hex: '#E0704A', label: 'ส้ม' },
  { hex: '#34323A', label: 'เทาถ่าน' },
]

// สีอารมณ์ 8 สี (SPEC §3.2)
export const EMOTION_COLORS = {
  happy: '#F1BE48',
  calm: '#5FA3C8',
  excited: '#E2688A',
  warm: '#CF8A4A',
  sad: '#4256A8',
  angry: '#D6453A',
  anxious: '#6E4FA0',
  tired: '#5B6773',
}

export const FONT_SIZES = {
  13: '13px',
  14: '14px',
  15: '15px',
  16: '16px',
  17: '17px',
  19: '19px',
  26: '26px',
  38: '38px',
  44: '44px',
  52: '52px',
}

export const STAGE = { width: 1280, height: 800 }

// เวลาและ easing ของการเคลื่อนไหว (SPEC §3.6) หน่วย ms
export const MOTION = {
  swap: 450, // เปลี่ยนสถานะเล็ก ๆ
  settle: 600, // วัตถุบนโต๊ะเปลี่ยนตำแหน่ง
  fade: 150, // เพดานของ prefers-reduced-motion
  ease: 'cubic-bezier(.2,.8,.2,1)',
  // จานสีประจำวันปรากฏทีละส่วนตอนเข้า book (เริ่มหลังสมุดเข้าที่ lead แล้วเรียงห่างกัน step)
  reveal: { lead: 170, step: 150, seep: 600, rise: 350, fade: 400 },
  // ลำดับตอนบันทึก (SPEC §5.4 รวม ~1.6s): ผ้าใบหดเป็นโพลารอยด์ → สมุดเข้า → (แผ่นแทรก) → ภาพลงช่อง → เทป → การ์ด
  save: { shrink: 400, bookAt: 150, drop: 400, tape: 200, cardLead: 100, card: 300, flipExtra: 300 },
  // พลิกปกสมุด 3D (ข้อ 22): full = หน้าแรก ↔ สมุด, short = ระบาย/บันทึก → สมุด (ปกอยู่บนหน้าขวาอยู่แล้ว) ปิดสมุดรอพลิกกลับก่อนจึงเลื่อนปกปิดกลับ
  flip: { full: 1300, short: 900, perspective: 1800 },
}
