// ชื่อไฟล์ของรูปที่เก็บ (SPEC ส่วนที่ 2 §7) ใช้วัน/เวลาท้องถิ่นของภาพ (local_date 'YYYY-MM-DD', local_time 'HH:mm')

const hhmm = (localTime) => localTime.replace(':', '').slice(0, 4)

export const cardPhotoFileName = (entry) => `colorscrap-${entry.local_date}-${hhmm(entry.local_time)}.png`
export const photoOnlyFileName = (entry) => `colorscrap-photo-${entry.local_date}-${hhmm(entry.local_time)}.png`
export const dayCardFileName = (localDate) => `colorscrap-day-${localDate}.png`
