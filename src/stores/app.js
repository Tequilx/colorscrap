import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { localDateStr } from '@/lib/dates'
import { chunk } from '@/lib/palette'
import { extractColors } from '@/lib/extractColors'
import { exportImages } from '@/lib/exportImage'
import { EMOTION_COLORS } from '@/lib/tokens'

// สถานะของโต๊ะ (SPEC §4.1) แทนการใช้ router
export const VIEWS = Object.freeze({
  hello: 'hello',
  cover: 'cover',
  pick: 'pick',
  paint: 'paint',
  saved: 'saved',
  book: 'book',
  photo: 'photo', // ดูภาพเดี่ยว (ลอยขึ้นมาจากหน้าสมุด)
})

// จำนวนภาพต่อแผ่น (SPEC §5.6)
export const PHOTOS_PER_LEAF = 4

// การเปลี่ยนสถานะที่อนุญาต: จาก → รายการที่ไปได้ (ตามตารางใน SPEC §4.1)
const ALLOWED = {
  hello: ['cover'],
  cover: ['pick', 'book', 'hello'],
  pick: ['paint', 'cover'],
  paint: ['saved', 'pick', 'book', 'cover'],
  saved: ['book', 'pick'],
  book: ['paint', 'cover', 'photo'],
  photo: ['book'],
}

export const useAppStore = defineStore('app', () => {
  const view = ref(VIEWS.hello)
  // intensity: 0 นิดหน่อย, 1 พอประมาณ, 2 มากเลย
  const selection = ref({ emotion: 'calm', intensity: 1 })
  const tool = ref('smear') // smear | drop
  const openDate = ref(null) // วันที่กำลังเปิดดูในสมุด (YYYY-MM-DD)
  const leafIndex = ref(0) // แผ่นที่เปิดอยู่ในวันนั้น
  const lastSavedEntryId = ref(null)
  const photoEntryId = ref(null) // ภาพที่กำลังดูแบบเดี่ยว (view photo)
  // แผ่นแทรกที่เพิ่งงอกจากการบันทึก (แสดงป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น)
  const freshLeaf = ref(null) // { date, index } | null
  // โหมดแก้ไขโปรไฟล์: เปิด hello จากปุ่มตั้งค่าในหน้า cover
  const helloEditing = ref(false)
  // เพิ่มทุกครั้งที่กด "เริ่มใหม่" ให้ผ้าใบล้างตัวเอง
  const clearTick = ref(0)
  const saving = ref(false) // กำลังจับภาพ/ดูดสีตอนบันทึก (กันกดซ้ำ)
  // ผ้าใบ (FluidCanvas) ลงทะเบียนตัวเองไว้ที่นี่ ใช้ตัวแปรธรรมดาไม่ใช้ ref เพื่อไม่ให้ Vue ครอบ proxy
  let painter = null

  const leavesOf = (date) => chunk(useEntriesStore().entriesOfDay(date), PHOTOS_PER_LEAF)

  // เปิดวันที่ในสมุดแล้วไปที่แผ่นล่าสุดของวันนั้นเสมอ (SPEC §5.6)
  const openDay = (date) => {
    openDate.value = date
    leafIndex.value = Math.max(0, leavesOf(date).length - 1)
    freshLeaf.value = null
  }

  // เปิดสมุด: วันนี้ถ้ามีภาพ ไม่งั้นวันล่าสุดที่มีภาพ
  const openBook = () => {
    const entries = useEntriesStore()
    const today = localDateStr()
    const date = entries.entriesOfDay(today).length ? today : (entries.dates.at(-1) ?? today)
    openDay(date)
  }

  // ผลข้างเคียงตอนเข้า view ใหม่ (ใช้ร่วมกันระหว่าง go() กับปุ่ม back ของเบราว์เซอร์)
  const enter = (next) => {
    const from = view.value
    // กลับจาก saved/photo คงวันและแผ่นเดิมไว้ ไม่รีเซ็ตไปแผ่นล่าสุด
    if (next === VIEWS.book && from !== VIEWS.saved && from !== VIEWS.photo) openBook()
    view.value = next
  }

  // เปลี่ยนสถานะ ถ้าไม่อยู่ในตารางที่อนุญาตจะเมินและคืน false
  const go = (next) => {
    if (next === view.value) return true
    if (!ALLOWED[view.value]?.includes(next)) return false
    enter(next)
    return true
  }

  // สำหรับ useHashView (ปุ่ม back ข้ามตารางได้)
  const setView = (next) => enter(next)

  // ตั้งค่าเริ่มต้นตอนโหลดแอป: ไม่มีโปรไฟล์ → hello, มีแล้ว → cover
  const boot = (hasProfile) => {
    view.value = hasProfile ? VIEWS.cover : VIEWS.hello
  }

  const openSettings = () => {
    if (go(VIEWS.hello)) helloEditing.value = true
  }

  const finishHello = () => {
    if (go(VIEWS.cover)) helloEditing.value = false
  }

  const selectEmotion = (emotion) => {
    selection.value = { ...selection.value, emotion }
  }

  const selectIntensity = (intensity) => {
    selection.value = { ...selection.value, intensity }
  }

  const openPhoto = (id) => {
    photoEntryId.value = id
    go(VIEWS.photo)
  }

  // พลิกแผ่นโดยผู้ใช้ (ล้างป้าย "แผ่นใหม่")
  const setLeaf = (index) => {
    leafIndex.value = index
    freshLeaf.value = null
  }

  const clearCanvas = () => {
    clearTick.value += 1
  }

  const registerPainter = (instance) => {
    painter = instance
  }

  // จับภาพจากผ้าใบ → ดูดสี (SPEC §6.6) ถ้าจับภาพไม่ได้ (ไม่มี WebGL) ใช้สีอารมณ์แทน
  const grabPainting = async () => {
    const fallback = EMOTION_COLORS[selection.value.emotion]
    const canvas = await painter?.capture()
    if (!canvas) return { colors: [{ hex: fallback, ratio: 1 }], images: null }
    return { colors: extractColors(canvas, fallback), images: await exportImages(canvas) }
  }

  // บันทึกภาพบนผ้าใบลงสมุด (SPEC §5.3 → §5.4)
  const saveToBook = async () => {
    if (saving.value) return null
    saving.value = true
    let grabbed
    try {
      grabbed = await grabPainting()
    } finally {
      saving.value = false
    }
    const entries = useEntriesStore()
    const today = localDateStr()
    const entry = entries.addEntry({
      emotion: selection.value.emotion,
      intensity: selection.value.intensity,
      colors: grabbed.colors,
      images: grabbed.images,
    })
    // ตำแหน่งของภาพใหม่ในวัน (เรียงตามเวลา) → แผ่นที่ภาพอยู่
    const position = entries.entriesOfDay(today).findIndex((e) => e.id === entry.id)
    const index = Math.floor(position / PHOTOS_PER_LEAF)
    openDate.value = today
    leafIndex.value = index
    // ภาพแรกของแผ่นแทรกใหม่ → ป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น
    freshLeaf.value = position > 0 && position % PHOTOS_PER_LEAF === 0 ? { date: today, index } : null
    lastSavedEntryId.value = entry.id
    clearTick.value += 1 // ผ้าใบเริ่มใหม่สำหรับภาพถัดไป
    go(VIEWS.saved)
    return entry
  }

  return {
    view,
    selection,
    tool,
    openDate,
    leafIndex,
    lastSavedEntryId,
    photoEntryId,
    freshLeaf,
    helloEditing,
    clearTick,
    saving,
    registerPainter,
    go,
    setView,
    boot,
    openDay,
    openSettings,
    finishHello,
    selectEmotion,
    selectIntensity,
    setLeaf,
    openPhoto,
    clearCanvas,
    saveToBook,
  }
})
