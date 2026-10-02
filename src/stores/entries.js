import { defineStore } from 'pinia'
import { ref, computed, markRaw } from 'vue'
import { saveRecord, loadRecords, deleteRecord } from '@/lib/imageStore'
import { USE_MOCK } from '@/lib/supabase'
import { fetchEntries, uploadEntry } from '@/lib/remote'
import { useAuthStore } from '@/stores/auth'
import { useImageUrlsStore } from '@/stores/imageUrls'
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
  const auth = useAuthStore()
  const imageUrls = useImageUrlsStore()
  const entries = ref(USE_MOCK ? buildMock() : [])

  // ต้องส่ง object แบบ plain เข้า IndexedDB (reactive proxy ถูก structured clone ไม่ได้)
  // โหมดจริงใส่ user_id ไว้ ให้ผู้ใช้คนอื่นบนเครื่องเดียวกันไม่เห็น/ไม่ส่งภาพของเจ้าของ
  const toRecord = (entry) => ({
    id: entry.id,
    user_id: auth.user?.id,
    local_date: entry.local_date,
    local_time: entry.local_time,
    emotion: entry.emotion,
    emotions: [...entry.emotions],
    intensity: entry.intensity,
    shifted: entry.shifted,
    colors: entry.colors.map((c) => ({ hex: c.hex, ratio: c.ratio })),
    image: entry.image,
    thumb: entry.thumb,
  })

  const withBlobs = (r) => ({ ...r, image: r.image ? markRaw(r.image) : null, thumb: r.thumb ? markRaw(r.thumb) : null })

  // โหมดจำลอง: entries ที่บันทึกไว้ใน IndexedDB (ไม่มี user_id) mock ไม่เก็บ เพราะสร้างใหม่ทุกครั้งตามวันที่ปัจจุบัน
  // โหมดจริง: ดึงจากตาราง entries + ภาพย่อ (signed URL ทีเดียวทั้งชุด) แล้วเติม entry ของผู้ใช้นี้ที่ยังค้างในเครื่องไม่ได้อัปโหลด
  const load = async () => {
    if (USE_MOCK) {
      ;(await loadRecords()).forEach((r) => {
        if (!r.user_id && !entries.value.some((e) => e.id === r.id)) entries.value.push(withBlobs(r))
      })
      return
    }
    const uid = auth.user.id
    const rows = await fetchEntries()
    const pending = (await loadRecords()).filter((r) => r.user_id === uid)
    const done = new Set(rows.map((e) => e.id))
    pending.filter((r) => done.has(r.id)).forEach((r) => deleteRecord(r.id)) // อัปโหลดสำเร็จไปแล้วแต่ยังไม่ได้ลบ record
    entries.value = [...rows, ...pending.filter((r) => !done.has(r.id)).map(withBlobs)]
    await imageUrls.prefetch(rows.map((e) => e.thumb_path))
  }

  const hydrated = USE_MOCK ? load() : Promise.resolve()

  // ออกจากระบบ: ลืมข้อมูลของคนก่อนทั้งหมด (ไฟล์ค้างใน IndexedDB ยังอยู่ แต่เป็นของเจ้าของและจะไม่ถูกแสดงให้คนอื่น)
  const reset = () => {
    entries.value = USE_MOCK ? buildMock() : []
    imageUrls.clear()
  }

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

  // อัปโหลด entry ที่ยังมี Blob (โหมดจริง) สำเร็จ → จด path, ขอ signed URL ไว้ก่อน แล้วค่อยปล่อย Blob (ภาพไม่กะพริบ) และลบ record ในเครื่อง
  // ล้มเหลว → โยน error ทิ้งไว้ใน IndexedDB (ขั้นที่ 5 จะลองใหม่อัตโนมัติ)
  const upload = async (entry) => {
    const paths = await uploadEntry(entry.user_id ?? auth.user.id, entry)
    await imageUrls.prefetch([paths.thumb_path])
    const live = entries.value.find((e) => e.id === entry.id)
    if (live) Object.assign(live, paths, { image: null, thumb: null })
    await deleteRecord(entry.id)
  }

  // บันทึกภาพใหม่ลงสมุด
  // colors: สีที่ดูดจากภาพจริง (SPEC §6.6) ถ้าไม่มีใช้สีอารมณ์
  // images: { image, thumb } Blob จากผ้าใบ โหมดจริงเก็บลง IndexedDB ก่อนแล้วอัปโหลด (เห็นในสมุดทันที ไม่รอเครือข่าย)
  const addEntry = ({ emotions, intensity, shifted = false, colors, images = null }) => {
    const now = new Date()
    const emotion = emotions.at(-1) // emotion = อารมณ์ล่าสุดของแผ่น, emotions = ตามลำดับที่หยด (SPEC §7.2)
    const shades = shadesOf(emotion)
    const entry = {
      id: crypto.randomUUID(), // uuid ตั้งแต่ตอนสร้าง ให้ path ใน Storage ล่วงหน้าได้ก่อน insert
      local_date: localDateStr(now),
      local_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      emotion,
      emotions,
      intensity,
      shifted,
      // Blob ภาพเต็มและ thumb (markRaw ไม่ให้ Vue ครอบ proxy) ไม่มีภาพ = null → แสดงหยดสีจำลอง
      image: images ? markRaw(images.image) : null,
      thumb: images ? markRaw(images.thumb) : null,
      image_path: null,
      thumb_path: null,
      colors: colors ?? [
        { hex: shades.base, ratio: 0.55 },
        { hex: shades.light, ratio: 0.25 },
        { hex: shades.deep, ratio: 0.2 },
      ],
    }
    entries.value.push(entry)
    // บันทึกลงเครื่องก่อนเสมอ: โหมดจริงเป็นคิวอัปโหลด (ลบเมื่อสำเร็จ) โหมดจำลองเป็นที่เก็บถาวร
    const record = toRecord(entry)
    const saved = saveRecord(record)
    if (!USE_MOCK && images) {
      saved.then(() => upload({ ...record, user_id: record.user_id })).catch((e) => console.error('อัปโหลดภาพไม่สำเร็จ (ยังเก็บไว้ในเครื่อง):', e))
    }
    return entry
  }

  return { entries, hydrated, load, reset, entriesOfDay, todayCount, lastSevenDays, recentTabs, dates, addEntry }
})
