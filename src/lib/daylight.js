// ช่วงเวลาของวัน ใช้กับเพลงคลอ (lib/music.js: day+dusk = เพลงกลางวัน, night = เพลงกลางคืน) และคำทักทายหน้าปก (ข้อ 66: เอาแสงบนโต๊ะ DeskLight ออกแล้ว ฉากเป็นแสงกลางวันคงที่)
// กลางวัน 06:00–16:59 · เย็น 17:00–18:59 · กลางคืน 19:00–05:59
// ?time=day|dusk|night บังคับช่วงเวลา มีผลแค่เพลงกับคำทักทาย (ใช้ตอนอัดวิดีโอ) ใช้ได้ทั้ง dev และ production
import { ref } from 'vue'

export const PERIODS = ['day', 'dusk', 'night']

export const periodOf = (hours) => (hours >= 6 && hours < 17 ? 'day' : hours >= 17 && hours < 19 ? 'dusk' : 'night')

export const forcedPeriod = (search = typeof location === 'undefined' ? '' : location.search) => {
  const v = new URLSearchParams(search).get('time')
  return PERIODS.includes(v) ? v : null
}

const forced = forcedPeriod()
export const period = ref(forced ?? periodOf(new Date().getHours()))

// ชั่วโมงที่ใช้เลือกคำทักทาย: ปกติเวลาจริง · ถ้าบังคับ ?time= แล้วเวลาจริงอยู่นอกช่วงนั้น ใช้ชั่วโมงตัวแทนของช่วง (day 09 เช้า / dusk 17 เย็น / night 22 ดึก)
const REPRESENTATIVE_HOUR = { day: 9, dusk: 17, night: 22 }
export const greetingHour = (hours, force = forced) => (!force || periodOf(hours) === force ? hours : REPRESENTATIVE_HOUR[force])

// เรียกซ้ำเป็นระยะ (ข้ามถ้าบังคับด้วย ?time)
export const refreshPeriod = () => {
  if (!forced) period.value = periodOf(new Date().getHours())
}

// เริ่มตรวจช่วงเวลาทุก 30 วินาทีและตอนกลับมาที่แท็บ (เพลงสลับกลางวัน↔กลางคืนตามนี้) เรียกครั้งเดียวจาก music.js
let timer = 0
export const startPeriodTimer = () => {
  if (timer || typeof document === 'undefined') return
  timer = setInterval(refreshPeriod, 30000)
  document.addEventListener('visibilitychange', refreshPeriod)
}
