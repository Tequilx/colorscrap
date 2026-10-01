import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { EMOTION_COLORS } from '@/lib/tokens'
import { emotionShades, SHIFT_TARGETS } from '@/lib/emotions'
import { addDays, localDateStr, parseLocalDate, thaiWeekdayShort } from '@/lib/dates'
import { dominantColorOfDay } from '@/lib/palette'
import { emotionShades as shadesOf } from '@/lib/emotions'

// สีที่ "ดูดได้" ของภาพจำลอง: รูปแบบเดียวกับ entries.colors ใน SPEC §7.2 (ratio รวม 1)
const mockColors = (emotion, shifted) => {
  const shades = emotionShades(emotion)
  if (shifted) {
    const [t1, t2] = SHIFT_TARGETS[emotion]
    return [
      { hex: EMOTION_COLORS[emotion], ratio: 0.4 },
      { hex: t1, ratio: 0.25 },
      { hex: t2, ratio: 0.2 },
      { hex: shades.light, ratio: 0.15 },
    ]
  }
  return [
    { hex: shades.base, ratio: 0.55 },
    { hex: shades.light, ratio: 0.25 },
    { hex: shades.deep, ratio: 0.2 },
  ]
}

// [วันที่ย้อนหลัง, เวลา, อารมณ์, ความเข้ม, ปรับโทนแล้วไหม]
const MOCK = [
  [0, '09:12', 'calm', 1, false],
  [0, '13:40', 'tired', 1, true],
  [1, '20:10', 'sad', 2, false],
  // วันที่มีเกินแผ่นละ 4 ภาพ ไว้ทดสอบแผ่นแทรก (ช่วง C)
  [2, '08:05', 'happy', 1, false],
  [2, '10:30', 'excited', 2, false],
  [2, '12:15', 'happy', 0, false],
  [2, '15:40', 'anxious', 1, true],
  [2, '18:20', 'calm', 1, false],
  [2, '21:50', 'tired', 1, false],
  [4, '11:00', 'warm', 1, false],
  [4, '19:30', 'calm', 2, false],
  [5, '16:45', 'warm', 1, false],
  [6, '14:20', 'angry', 2, true],
]

const pad2 = (n) => String(n).padStart(2, '0')

// ภาพของวันนี้ต้องมีเวลาไม่เกินเวลาปัจจุบัน ภาพที่บันทึกใหม่จะได้อยู่ท้ายแผ่นเสมอ
// จึงกระจายเวลาของภาพวันนี้ไว้ในช่วง 00:00 ถึงเวลาปัจจุบัน ตามสัดส่วนของเวลาในรายการ MOCK
const todayTime = (time, now) => {
  const [h, m] = time.split(':').map(Number)
  const minutes = Math.floor(((h * 60 + m) / (24 * 60)) * (now.getHours() * 60 + now.getMinutes()))
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`
}

const buildMock = () => {
  const today = new Date()
  return MOCK.map(([back, time, emotion, intensity, shifted], i) => ({
    id: `mock-${i + 1}`,
    local_date: localDateStr(addDays(today, -back)),
    local_time: back === 0 ? todayTime(time, today) : time,
    emotion,
    emotions: [emotion],
    intensity,
    shifted,
    colors: mockColors(emotion, shifted),
  }))
}

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref(buildMock())

  const entriesOfDay = (date) =>
    entries.value.filter((e) => e.local_date === date).sort((a, b) => a.local_time.localeCompare(b.local_time))

  const todayCount = computed(() => entriesOfDay(localDateStr()).length)

  // 7 วันล่าสุด (เก่า → ใหม่) สำหรับแถบหน้า cover
  const lastSevenDays = computed(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6)
      const date = localDateStr(d)
      return {
        date,
        isToday: i === 6,
        label: i === 6 ? 'วันนี้' : thaiWeekdayShort(d),
        hex: dominantColorOfDay(entriesOfDay(date)),
      }
    })
  })

  // 3 วันล่าสุดที่มีบันทึก (เก่า → ใหม่) สำหรับแท็บคั่นหน้าบนปก
  const recentTabs = computed(() => {
    const dates = [...new Set(entries.value.map((e) => e.local_date))].sort().slice(-3)
    return dates.map((date) => ({ date, hex: dominantColorOfDay(entriesOfDay(date)), day: parseLocalDate(date) }))
  })

  // วันที่ที่มีบันทึก เรียงเก่า → ใหม่
  const dates = computed(() => [...new Set(entries.value.map((e) => e.local_date))].sort())

  // บันทึกภาพใหม่ลงสมุด (จำลอง; ขั้นที่ 7 จะส่งขึ้น Supabase)
  // colors: สีที่ดูดจากภาพจริง (SPEC §6.6) ถ้าไม่มีใช้สีอารมณ์
  // images: { image, thumb } Blob จากผ้าใบ เก็บเป็น object URL ชั่วคราว (ขั้นที่ 7 เปลี่ยนเป็นอัปโหลดแล้วเก็บ image_path/thumb_path)
  const addEntry = ({ emotions, intensity, shifted = false, colors, images = null }) => {
    const now = new Date()
    const emotion = emotions.at(-1) // emotion = อารมณ์ล่าสุดของแผ่น, emotions = ตามลำดับที่หยด (SPEC §7.2)
    const shades = shadesOf(emotion)
    const entry = {
      id: `local-${now.getTime()}`,
      local_date: localDateStr(now),
      local_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      emotion,
      emotions,
      intensity,
      shifted,
      image_url: images ? URL.createObjectURL(images.image) : null,
      thumb_url: images ? URL.createObjectURL(images.thumb) : null,
      colors: colors ?? [
        { hex: shades.base, ratio: 0.55 },
        { hex: shades.light, ratio: 0.25 },
        { hex: shades.deep, ratio: 0.2 },
      ],
    }
    entries.value.push(entry)
    return entry
  }

  return { entries, entriesOfDay, todayCount, lastSevenDays, recentTabs, dates, addEntry }
})
