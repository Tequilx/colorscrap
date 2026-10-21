import { defineStore } from 'pinia'
import { ref, computed, watch, markRaw } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { useToastStore } from '@/stores/toast'
import { localDateStr } from '@/lib/dates'
import { chunk } from '@/lib/palette'
import { extractColors } from '@/lib/extractColors'
import { exportImages } from '@/lib/exportImage'
import { EMOTION_COLORS, MOTION } from '@/lib/tokens'
import { NEGATIVE_EMOTIONS } from '@/lib/emotions'
import { reducedMotion, sequenceActive, TIME_SCALE } from '@/lib/motion'
import { POLAROID, saveSchedule, slotCenter } from '@/lib/saveTimeline'
import { sound } from '@/lib/sound'

// สถานะของโต๊ะ (SPEC §4.1) แทนการใช้ router
export const VIEWS = Object.freeze({
  login: 'login', // เข้าสู่ระบบ (ไม่ใช้ในโหมดจำลอง)
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
  login: ['hello', 'cover'],
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
  const tool = ref('smear') // smear | drop | warm
  const openDate = ref(null) // วันที่กำลังเปิดดูในสมุด (YYYY-MM-DD)
  const leafIndex = ref(0) // แผ่นที่เปิดอยู่ในวันนั้น
  const lastSavedEntryId = ref(null)
  const photoEntryId = ref(null) // ภาพที่กำลังดูแบบเดี่ยว (view photo)
  const photoOrigin = ref(null) // { x, y, rotate } ตำแหน่งภาพในสมุดตอนกด (พิกัด stage) ใช้เป็นจุดบินออก
  const photoHiddenId = ref(null) // ช่องในสมุดที่ซ่อนอยู่ระหว่างภาพบินและตอนดูภาพเดี่ยว (ไม่ให้ซ้อนสองใบ)
  // แผ่นแทรกที่เพิ่งงอกจากการบันทึก (แสดงป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น)
  const freshLeaf = ref(null) // { date, index } | null
  // โหมดแก้ไขโปรไฟล์: เปิด hello จากปุ่มตั้งค่าในหน้า cover
  const helloEditing = ref(false)
  // เพิ่มทุกครั้งที่กด "เริ่มใหม่" ให้ผ้าใบล้างตัวเอง
  const clearTick = ref(0)
  // เพิ่มทุกครั้งที่ต้องหยดสีเริ่มต้นของอารมณ์ที่เลือกลงผ้าใบ
  const dropTick = ref(0)
  // ผ้าใบมีภาพที่ยังไม่บันทึก (หยดเริ่มต้นก็นับ) และอารมณ์ที่หยดลงแผ่นนี้ตามลำดับ (SPEC §5.3, §7.2)
  const canvasDirty = ref(false)
  const sheetEmotions = ref([])
  // ผู้ใช้หยดแต้มแสงเองลงแผ่นนี้แล้วอย่างน้อย 1 หยด (SPEC §6.4) ตั้งโดย FluidCanvas
  const sheetShifted = ref(false)
  // โน้ตชวนลองแต้มแสง ถามได้ครั้งเดียวต่อแผ่น: idle → open → done (เริ่มใหม่/แผ่นใหม่/บันทึก = กลับเป็น idle)
  const warmNote = ref('idle')
  // เพิ่มเมื่อกด "ลองดู" ให้ผ้าใบหยดแต้มแสง 1 หยดที่ขอบกระดาษ
  const warmTick = ref(0)
  let pickFrom = null // view ที่มาก่อนเข้า pick ใช้ตัดสินว่าเป็น "เปลี่ยนสี" หรือเริ่มระบายใหม่
  // เพิ่มทุกครั้งที่เข้า book จาก view อื่น (ไม่นับกลับจาก photo) ให้จานสีประจำวันเล่นการปรากฏทีละส่วนใหม่
  const bookTick = ref(0)
  const saving = ref(false) // กำลังจับภาพ/ดูดสีตอนบันทึก (กันกดซ้ำ)
  // ลำดับแอนิเมชันที่กินเวลา (ขั้น 9): ระหว่างนี้ปุ่มที่ทำให้สถานะพังต้องกดไม่ได้ (SPEC §5.4)
  // savePhase: idle → shrink → book → leaf → drop → tape → card → idle (ตัวขับอยู่ใน runSaveSequence)
  const savePhase = ref('idle')
  // ภาพที่กำลังบินตอนบันทึก (SavedFlight): { entry, canvas, target, schedule } | null
  const saveFlight = ref(null)
  const leafFlipping = ref(false) // แผ่นแทรกกำลังพลิก
  const photoFlying = ref(false) // ภาพกำลังบินเข้า/ออกหน้า photo
  watch(savePhase, (phase) => (sequenceActive.value = phase !== 'idle'), { flush: 'sync' }) // sync: อัปโหลดที่ตามหลัง addEntry ต้องเห็นค่านี้ทันที
  // กำลังสาดสีตอนเข้าหน้า paint (FluidCanvas ตั้งค่า): ยังไม่ให้บันทึกจนหยดลงครบ
  const splashing = ref(false)
  const busy = computed(() => savePhase.value !== 'idle' || leafFlipping.value || photoFlying.value || splashing.value)
  // ผู้ขับลำดับ (timer/WAAPI) ลงทะเบียนวิธียกเลิกตัวเองไว้ เรียกตอนปุ่ม back ข้ามหน้าหรือออกจากระบบกลางลำดับ
  const cancellers = new Set()
  const onCancel = (fn) => {
    cancellers.add(fn)
    return () => cancellers.delete(fn)
  }
  const cancelSequences = () => {
    cancellers.forEach((fn) => fn())
    savePhase.value = 'idle'
    leafFlipping.value = false
    photoFlying.value = false
    photoHiddenId.value = null
    saveFlight.value = null
  }
  // ผ้าใบ (FluidCanvas) ลงทะเบียนตัวเองไว้ที่นี่ ใช้ตัวแปรธรรมดาไม่ใช้ ref เพื่อไม่ให้ Vue ครอบ proxy
  let painter = null

  // อารมณ์ล่าสุดของแผ่นเป็นอารมณ์ลบ: เครื่องมือ "แต้มแสง" และโน้ตชวนจึงโผล่ (SPEC §6.4)
  const warmAvailable = computed(() => NEGATIVE_EMOTIONS.includes(sheetEmotions.value.at(-1) ?? selection.value.emotion))
  // เปลี่ยนไปอารมณ์บวกขณะเลือกเครื่องมือแต้มแสงอยู่ → กลับไปปาดสี
  watch(warmAvailable, (ok) => {
    if (!ok && tool.value === 'warm') tool.value = 'smear'
  })
  const warmNoteOpen = computed(() => warmNote.value === 'open' && warmAvailable.value)
  const resetWarmNote = () => {
    warmNote.value = 'idle'
  }
  // FluidCanvas แจ้งว่าระบายรวมครบและพักมือแล้ว
  const offerWarmNote = () => {
    if (warmNote.value === 'idle' && warmAvailable.value) warmNote.value = 'open'
  }
  const dismissWarmNote = () => {
    warmNote.value = 'done'
  }
  const tryWarm = () => {
    warmNote.value = 'done'
    tool.value = 'warm'
    warmTick.value += 1
  }
  // เลือกเครื่องมือจากถาด: เลือกแต้มแสงเองก็ปิดโน้ต
  const pickTool = (key) => {
    tool.value = key
    if (key === 'warm') warmNote.value = 'done'
  }

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
    if (next === VIEWS.book && from !== VIEWS.photo) bookTick.value += 1
    if (next === VIEWS.book && from !== VIEWS.saved && from !== VIEWS.photo) sound.flip({ long: true }) // เปิดสมุด
    if (next === VIEWS.pick) pickFrom = from
    // เข้า paint ตอนผ้าใบว่างหรือเพิ่งบันทึก: หยดสีของอารมณ์ที่เลือกทันที (SPEC §5.3)
    // ถ้ามีภาพค้างอยู่ beginPaint / continueSheet / newSheet เป็นผู้ตัดสินแล้ว
    if (next === VIEWS.paint && !canvasDirty.value) dropOnSheet()
    view.value = next
  }

  // หยดสีเริ่มต้นของอารมณ์ที่เลือกลงแผ่นปัจจุบัน และจดอารมณ์ลงรายการของแผ่น
  const dropOnSheet = () => {
    const emotion = selection.value.emotion
    if (sheetEmotions.value.at(-1) !== emotion) sheetEmotions.value.push(emotion)
    canvasDirty.value = true
    dropTick.value += 1
  }

  // ระบายต่อแผ่นเดิม: เปลี่ยน palette เป็นอารมณ์ใหม่ แล้วหยดทับ (ถ้าอารมณ์ไม่เปลี่ยนก็ไม่ต้องหยดซ้ำ)
  const continueSheet = () => {
    if (selection.value.emotion !== sheetEmotions.value.at(-1)) dropOnSheet()
    go(VIEWS.paint)
  }

  // เริ่มแผ่นใหม่: ล้างแล้วหยดสีของอารมณ์ที่เลือก
  const newSheet = () => {
    clearTick.value += 1
    sheetEmotions.value = []
    sheetShifted.value = false
    resetWarmNote()
    dropOnSheet()
    go(VIEWS.paint)
  }

  // ปุ่ม "เริ่มระบาย" ในหน้า pick (SPEC §5.2) คืน 'choose' เมื่อต้องถามผู้ใช้ว่าจะระบายต่อหรือเริ่มแผ่นใหม่
  const beginPaint = () => {
    if (pickFrom === VIEWS.paint && canvasDirty.value) {
      continueSheet() // มาจากปุ่ม "เปลี่ยนสี" ในหน้า paint
      return 'paint'
    }
    if (canvasDirty.value) return 'choose' // มาจาก cover/book และมีภาพที่ยังไม่บันทึก
    go(VIEWS.paint)
    return 'paint'
  }

  // เปลี่ยนสถานะ ถ้าไม่อยู่ในตารางที่อนุญาตจะเมินและคืน false
  const go = (next) => {
    if (savePhase.value !== 'idle') return false // กำลังเล่นลำดับบันทึก: ไม่ให้เปลี่ยนหน้าแทรก
    if (next === view.value) return true
    if (!ALLOWED[view.value]?.includes(next)) return false
    enter(next)
    return true
  }

  // สำหรับ useHashView (ปุ่ม back ข้ามตารางได้)
  // ข้ามตารางได้ จึงต้องตัดลำดับแอนิเมชันที่ค้างอยู่ก่อน ไม่งั้นค้างครึ่งทาง
  const setView = (next) => {
    cancelSequences()
    enter(next)
  }

  // ตั้งค่าเริ่มต้นตอนโหลดแอป: ยังไม่ล็อกอิน → login, ไม่มีโปรไฟล์ → hello, มีแล้ว → cover
  const boot = (hasProfile, loggedIn = true) => {
    view.value = !loggedIn ? VIEWS.login : hasProfile ? VIEWS.cover : VIEWS.hello
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

  const openPhoto = (id, origin = null) => {
    if (busy.value) return
    photoEntryId.value = id
    photoOrigin.value = origin
    photoHiddenId.value = id
    if (!go(VIEWS.photo)) photoHiddenId.value = null
  }

  // พลิกแผ่นโดยผู้ใช้ (ล้างป้าย "แผ่นใหม่")
  const setLeaf = (index) => {
    if (leafFlipping.value || savePhase.value !== 'idle') return // กำลังพลิก/บันทึก: กดซ้ำจะข้ามแผ่น
    if (leafIndex.value !== index) sound.flip()
    leafIndex.value = index
    freshLeaf.value = null
  }

  // "เริ่มใหม่": ล้างแล้วหยดสีเริ่มต้นของอารมณ์ที่เลือกอยู่ (SPEC §5.3)
  const clearCanvas = () => {
    if (savePhase.value !== 'idle') return
    clearTick.value += 1
    sheetEmotions.value = []
    sheetShifted.value = false
    resetWarmNote()
    dropOnSheet()
  }

  // ล้างสถานะของผู้ใช้คนก่อนทั้งหมด (ตอนออกจากระบบ/ลบข้อมูล) ให้คนถัดไปเริ่มจากโต๊ะว่าง
  const resetSession = () => {
    cancelSequences()
    selection.value = { emotion: 'calm', intensity: 1 }
    tool.value = 'smear'
    openDate.value = null
    leafIndex.value = 0
    lastSavedEntryId.value = null
    photoEntryId.value = null
    photoOrigin.value = null
    freshLeaf.value = null
    helloEditing.value = false
    clearTick.value += 1 // ล้างผ้าใบ
    splashing.value = false
    canvasDirty.value = false
    sheetEmotions.value = []
    sheetShifted.value = false
    resetWarmNote()
  }

  const registerPainter = (instance) => {
    painter = instance
  }

  // จับภาพจากผ้าใบ → ดูดสี (SPEC §6.6) ถ้าจับภาพไม่ได้ (ไม่มี WebGL) ใช้สีอารมณ์แทน
  const grabPainting = async () => {
    const fallback = EMOTION_COLORS[sheetEmotions.value.at(-1) ?? selection.value.emotion]
    const canvas = await painter?.capture()
    if (!canvas) return { colors: [{ hex: fallback, ratio: 1 }], images: null, canvas: null }
    // canvas ส่งต่อให้ SavedFlight ใช้เป็นภาพที่หดลงเป็นโพลารอยด์ (ไม่ต้อง decode ภาพใหม่)
    return { colors: extractColors(canvas, fallback), images: await exportImages(canvas), canvas: markRaw(canvas) }
  }

  // ลำดับแอนิเมชันหลังบันทึก (SPEC §5.4 ≈1.6s): state/timer อยู่ที่นี่ ตัวภาพบินเล่นเองใน SavedFlight ด้วยตารางเวลาเดียวกัน
  // ผ้าใบหด → สมุดเข้า (view saved) → (แผ่นแทรกพลิกลงมา) → ภาพลงช่อง → เทปแปะ → การ์ดโผล่ → idle
  // ต้องจบได้เสมอ: ปุ่ม back/ออกจากระบบกลางทางเรียก cancelSequences → ทำให้สถานะปลายทางครบแล้วหยุด
  const runSaveSequence = ({ entry, today, index, newLeaf, slot, canvas }) => {
    const reduced = reducedMotion.value
    const sch = reduced ? null : saveSchedule({ newLeaf, scale: TIME_SCALE })
    const timers = []
    let cleared = false
    const clearPaper = () => {
      if (cleared) return
      cleared = true
      clearTick.value += 1 // ผ้าใบเริ่มใหม่สำหรับภาพถัดไป (ว่าง: เข้า paint ครั้งหน้าจะหยดสีเอง)
    }
    const settleLeaf = () => {
      leafIndex.value = index
      freshLeaf.value = newLeaf ? { date: today, index } : null
    }
    const finish = () => {
      timers.forEach(clearTimeout)
      dispose()
      clearPaper()
      settleLeaf()
      photoHiddenId.value = null
      saveFlight.value = null
    }
    const dispose = onCancel(finish)
    const at = (t, fn) => timers.push(setTimeout(fn, t))

    openDate.value = today
    if (view.value !== VIEWS.paint) {
      // ผู้ใช้ออกจากหน้า paint ระหว่างจับภาพ (เช่นกด back): บันทึกแล้วแต่ไม่พาไปหน้า saved
      finish()
      return
    }
    if (reduced) {
      // reduced-motion: ไม่มีภาพบิน ทุกอย่างเปลี่ยนพร้อมกันแล้ว fade (SPEC §3.6)
      clearPaper()
      settleLeaf()
      enter(VIEWS.saved)
      sound.tape()
      savePhase.value = 'card'
      at(MOTION.fade, () => {
        savePhase.value = 'idle'
        dispose()
      })
      return
    }
    // แผ่นแทรกใหม่: ค้างที่แผ่นเดิมที่เต็มอยู่ก่อน แล้วค่อยพลิกไปแผ่นใหม่ตอนเฟส leaf
    leafIndex.value = newLeaf ? index - 1 : index
    freshLeaf.value = null
    photoHiddenId.value = entry.id // ช่องจริงซ่อนจนภาพบินลงถึง (PhotoPage แสดงช่องเส้นประแทน)
    saveFlight.value = {
      entry,
      canvas,
      target: { ...slotCenter({ slot, insert: index > 0, height: POLAROID.h }) },
      schedule: sch,
    }
    savePhase.value = 'shrink'
    sound.paperRise(MOTION.save.shrink + MOTION.save.bookAt)
    at(32, clearPaper) // ให้ภาพบินขึ้นจอก่อนค่อยล้างผ้าใบ (ไม่เห็นกะพริบ)
    at(sch.book[0], () => {
      enter(VIEWS.saved) // กระดานเลื่อนซ้าย สมุดเลื่อนเข้า
      savePhase.value = 'book'
    })
    if (sch.leaf) {
      at(sch.leaf[0], () => {
        sound.flip()
        settleLeaf()
        savePhase.value = 'leaf'
      })
    }
    at(sch.drop[0], () => {
      savePhase.value = 'drop'
    })
    at(sch.tape[0], () => {
      sound.tape()
      savePhase.value = 'tape'
    })
    at(sch.tape[1], () => {
      // ภาพลงถึงช่องแล้ว: เลิกซ่อนช่องจริงพร้อมถอดภาพบิน (เฟรมเดียวกัน ตำแหน่งตรงกันไม่มี pop)
      photoHiddenId.value = null
      saveFlight.value = null
    })
    at(sch.card[0], () => {
      savePhase.value = 'card'
    })
    at(sch.total, () => {
      savePhase.value = 'idle'
      dispose()
    })
  }

  // บันทึกภาพบนผ้าใบลงสมุด (SPEC §5.3 → §5.4)
  const saveToBook = async () => {
    if (saving.value || splashing.value) return null
    saving.value = true
    // ล็อกกดซ้ำไว้ตลอดจนจบ และปลดเสมอ (finally) ไม่ให้ปุ่มบันทึกค้างเงียบ ๆ ถ้าพลาดกลางทาง
    try {
      const grabbed = await grabPainting()
      const entries = useEntriesStore()
      const today = localDateStr()
      const emotions = sheetEmotions.value.length ? [...sheetEmotions.value] : [selection.value.emotion]
      const entry = entries.addEntry({
        emotions,
        intensity: selection.value.intensity,
        shifted: sheetShifted.value,
        colors: grabbed.colors,
        images: grabbed.images,
      })
      // ตำแหน่งของภาพใหม่ในวัน (เรียงตามเวลา) → แผ่นที่ภาพอยู่
      const position = entries.entriesOfDay(today).findIndex((e) => e.id === entry.id)
      const index = Math.floor(position / PHOTOS_PER_LEAF)
      // ภาพแรกของแผ่นแทรกใหม่ → แผ่นแทรกเลื่อนลงมาแปะก่อนวางภาพ (SPEC §5.6) และมีป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น
      const newLeaf = position > 0 && position % PHOTOS_PER_LEAF === 0
      lastSavedEntryId.value = entry.id
      canvasDirty.value = false
      sheetEmotions.value = []
      sheetShifted.value = false
      resetWarmNote()
      runSaveSequence({ entry, today, index, newLeaf, slot: position % PHOTOS_PER_LEAF, canvas: grabbed.canvas })
      return entry
    } catch (error) {
      console.error('บันทึกภาพลงสมุดไม่สำเร็จ:', error)
      useToastStore().show('บันทึกไม่สำเร็จ ลองอีกครั้งนะ')
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    view,
    selection,
    tool,
    openDate,
    leafIndex,
    lastSavedEntryId,
    photoEntryId,
    photoOrigin,
    photoHiddenId,
    freshLeaf,
    helloEditing,
    clearTick,
    dropTick,
    canvasDirty,
    sheetEmotions,
    sheetShifted,
    warmAvailable,
    warmNote,
    warmNoteOpen,
    warmTick,
    offerWarmNote,
    dismissWarmNote,
    tryWarm,
    pickTool,
    saving,
    bookTick,
    savePhase,
    saveFlight,
    leafFlipping,
    photoFlying,
    busy,
    splashing,
    onCancel,
    cancelSequences,
    registerPainter,
    resetSession,
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
    beginPaint,
    continueSheet,
    newSheet,
    saveToBook,
  }
})
