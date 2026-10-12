import { DAYS_FULL, MONTHS_FULL } from '@/lib/dates'

// "อังคาร 13 ตุลาคม 2569" (ชื่อวันไม่มีคำว่า "วัน", ปี พ.ศ.) ใช้ปฏิทินท้องถิ่นของเครื่อง
export const formatThaiDate = (date) => `${DAYS_FULL[date.getDay()]} ${date.getDate()} ${MONTHS_FULL[date.getMonth()]} ${date.getFullYear() + 543}`
