// ฟังก์ชันวันที่/เวลาตามเครื่องผู้ใช้ (ใช้ local_date, local_time ตาม SPEC §7.2)

const DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const pad = (n) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' ตามเวลาเครื่อง
export const localDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// "พฤหัสบดี 1 ตุลาคม"
export const thaiDayFull = (d) => `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`

// "29 ก.ย." (ป้ายแท็บ)
export const thaiDateShort = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`

export const thaiWeekdayShort = (d) => DAYS_SHORT[d.getDay()]

// คำทักทายตามเวลา (SPEC §5.1)
export const greetingFor = (hour) => {
  if (hour >= 5 && hour < 11) return 'สวัสดีตอนเช้า'
  if (hour >= 11 && hour < 16) return 'สวัสดีตอนบ่าย'
  if (hour >= 16 && hour < 19) return 'สวัสดีตอนเย็น'
  return 'ดึกแล้วนะ'
}
