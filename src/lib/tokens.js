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
  note: '#FFFBEF', // กระดาษโน้ตชวนลองสีอุ่น
  'warm-tint': '#FFF4DE', // พื้นปุ่มเครื่องมือสีอุ่นตอนถูกเลือก
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
