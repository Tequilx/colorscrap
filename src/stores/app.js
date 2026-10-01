import { defineStore } from 'pinia'
import { ref } from 'vue'

// สถานะของโต๊ะ (SPEC §4.1) แทนการใช้ router
export const VIEWS = Object.freeze({
  hello: 'hello',
  cover: 'cover',
  pick: 'pick',
  paint: 'paint',
  saved: 'saved',
  book: 'book',
})

// การเปลี่ยนสถานะที่อนุญาต: จาก → รายการที่ไปได้ (ตามตารางใน SPEC §4.1)
const ALLOWED = {
  hello: ['cover'],
  cover: ['pick', 'book', 'hello'],
  pick: ['paint', 'cover'],
  paint: ['saved', 'pick', 'book'],
  saved: ['book', 'pick'],
  book: ['paint', 'cover'],
}

export const useAppStore = defineStore('app', () => {
  const view = ref(VIEWS.hello)
  // intensity: 0 นิดหน่อย, 1 พอประมาณ, 2 มากเลย
  const selection = ref({ emotion: 'calm', intensity: 1 })
  const openDate = ref(null) // วันที่กำลังเปิดดูในสมุด (YYYY-MM-DD)
  const leafIndex = ref(0) // แผ่นที่เปิดอยู่ในวันนั้น
  const lastSavedEntryId = ref(null)
  // โหมดแก้ไขโปรไฟล์: เปิด hello จากปุ่มตั้งค่าในหน้า cover
  const helloEditing = ref(false)

  // เปลี่ยนสถานะ ถ้าไม่อยู่ในตารางที่อนุญาตจะเมินและคืน false
  const go = (next) => {
    if (next === view.value) return true
    if (!ALLOWED[view.value]?.includes(next)) return false
    view.value = next
    return true
  }

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

  return {
    view,
    selection,
    openDate,
    leafIndex,
    lastSavedEntryId,
    helloEditing,
    go,
    boot,
    openSettings,
    finishHello,
    selectEmotion,
    selectIntensity,
  }
})
