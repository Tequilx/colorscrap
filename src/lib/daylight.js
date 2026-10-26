// ช่วงเวลาของวันสำหรับแสงบนพื้นโต๊ะ (components/desk/DeskLight.vue)
// กลางวัน 06:00–16:59 · เย็น 17:00–18:59 · กลางคืน 19:00–05:59
// ?time=day|dusk|night บังคับช่วงเวลา (ใช้ตอนอัดวิดีโอ) ใช้ได้ทั้ง dev และ production
import { ref } from 'vue'

export const PERIODS = ['day', 'dusk', 'night']

export const periodOf = (hours) => (hours >= 6 && hours < 17 ? 'day' : hours >= 17 && hours < 19 ? 'dusk' : 'night')

export const forcedPeriod = (search = typeof location === 'undefined' ? '' : location.search) => {
  const v = new URLSearchParams(search).get('time')
  return PERIODS.includes(v) ? v : null
}

let forced = forcedPeriod()
export const period = ref(forced ?? periodOf(new Date().getHours()))

// ตั้งค่าเอง (null = กลับไปตามเวลาจริง) ใช้ตอนทดสอบ/สคริปต์ถ่ายภาพ
export const setPeriod = (p) => {
  forced = PERIODS.includes(p) ? p : null
  period.value = forced ?? periodOf(new Date().getHours())
}

// เรียกซ้ำเป็นระยะ (ข้ามถ้าบังคับด้วย ?time)
export const refreshPeriod = () => {
  if (!forced) period.value = periodOf(new Date().getHours())
}
