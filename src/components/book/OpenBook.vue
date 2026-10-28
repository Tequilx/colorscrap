<template>
  <!-- สมุดเปิดเต็มเล่ม 1012×640 (SPEC §5.5) ใช้ทั้งหน้า book และหน้า saved (saved แค่ซูมที่หน้าซ้าย) -->
  <div class="relative h-[640px] w-[1012px]">
    <DateTabs v-if="mode === 'book'" :tabs="tabs" :current="date" @pick="app.turnToDay($event)" />

    <!-- ปกสมุดเป็นขอบรอบหน้ากว้าง 14px -->
    <div class="absolute inset-0 rounded-xl bg-cover shadow-[0_24px_48px_rgba(45,43,51,0.28)]"></div>
    <!-- สายรัดพร้อมกระดุมด้านขวา -->
    <div class="absolute right-[-26px] top-[284px] flex h-[76px] w-11 items-center justify-center rounded-[0_12px_12px_0] bg-cover-strap">
      <span class="h-[18px] w-[18px] rounded-full bg-line"></span>
    </div>

    <!-- ห่อหน้าซ้าย/ขวาด้วย display: contents (ไม่มีกล่อง ตำแหน่งลูกเหมือนเดิม) ให้เก็บภาพหน้าเดิมและซ่อนระหว่างพลิกได้ -->
    <div ref="leftWrap" class="contents">
    <PhotoPage
      v-if="date"
      :date="date"
      :leaves="leaves"
      :leaf-index="app.leafIndex"
      :new-id="mode === 'saved' ? app.lastSavedEntryId : null"
      :fresh-index="app.freshLeaf && app.freshLeaf.date === date ? app.freshLeaf.index : null"
      :mode="mode"
      @leaf="app.setLeaf"
      @photo="(p) => app.openPhoto(p.id, p.origin)"
    />
    </div>
    <div ref="rightWrap" class="contents">
    <DailyPalette
      v-if="date"
      :date="date"
      :entries="entriesOfDay"
      :prev-date="prevDate"
      :next-date="nextDate"
      :new-id="mode === 'saved' ? app.lastSavedEntryId : null"
      :hidden="mode === 'saved'"
      @day="app.turnToDay($event)"
    />
    </div>

    <!-- หน้าเก่าฝั่งที่แผ่นจะไปลง (สำเนา) คงอยู่ใต้แผ่นจนแผ่นลงถึง แล้วจางให้เห็นหน้าใหม่ -->
    <div ref="turnUnder" class="turn-snap pointer-events-none invisible absolute top-[14px] z-[30] h-[612px] w-[492px] overflow-hidden" inert :class="turnSide === 'right' ? 'left-[14px]' : 'left-[506px]'" aria-hidden="true"></div>

    <!-- z-[30]/[31] (ข้อ 61b): ชั้นของหน้ามี z-index ในตัว (.leaf-layer 1, ปุ่ม/LeafPager 10) ต้องให้สำเนาหน้าเก่าและแผ่นที่พลิกอยู่เหนือทั้งหมดเสมอ ทั้ง next และ prev
    พลิกหน้าหนังสือรอบสันกลางตอนเปลี่ยนวัน (ข้อ 38): แผ่นกระดาษหน้าเดิม (หน้าหน้า = สำเนาของหน้าเก่า หลัง = กระดาษ) -->
    <div ref="turnEl" class="pointer-events-none invisible absolute top-[14px] z-[31] h-[612px] w-[492px]" inert :class="turnSide === 'right' ? 'left-[506px]' : 'left-[14px]'" aria-hidden="true">
      <div ref="turnShadow" class="absolute inset-0 opacity-0" :style="{ background: turnSide === 'right' ? 'linear-gradient(to left, rgba(45,43,51,.5), rgba(45,43,51,0) 70%)' : 'linear-gradient(to right, rgba(45,43,51,.5), rgba(45,43,51,0) 70%)' }"></div>
      <div ref="turnFade" class="absolute inset-0">
        <div ref="turnBoard" class="absolute inset-0" :style="{ transformOrigin: turnSide === 'right' ? '0 50%' : '100% 50%', transformStyle: 'preserve-3d' }">
          <div ref="turnFront" class="turn-snap absolute inset-0 overflow-hidden bg-paper [backface-visibility:hidden]"></div>
          <!-- หลังแผ่น = สำเนาหน้าใหม่ที่แผ่นจะไปลง (ข้อ 62) พลิกไปพร้อมแผ่น ตอนลงถึงหน้าจริงเหมือนกันทุกพิกเซล ไม่มีของโผล่ -->
          <div ref="turnBack" class="turn-snap absolute inset-0 overflow-hidden bg-paper [backface-visibility:hidden]" style="transform: rotateY(180deg)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import DateTabs from '@/components/book/DateTabs.vue'
import PhotoPage from '@/components/book/PhotoPage.vue'
import DailyPalette from '@/components/book/DailyPalette.vue'
import { useAppStore, PHOTOS_PER_LEAF } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'
import { chunk, dominantColorOfDay } from '@/lib/palette'
import { parseLocalDate, thaiDateShort } from '@/lib/dates'
import { MOTION } from '@/lib/tokens'
import { TIME_SCALE, reducedMotion } from '@/lib/motion'
import { sound } from '@/lib/sound'
import { getDayCrop } from '@/lib/dayCrop'
import { useImageUrlsStore } from '@/stores/imageUrls'
import { warmEntries, within } from '@/lib/warmImages'

defineProps({ mode: { type: String, default: 'book' } })

const app = useAppStore()
const entries = useEntriesStore()
const imageUrls = useImageUrlsStore()

const date = computed(() => app.openDate)
const entriesOfDay = computed(() => (date.value ? entries.entriesOfDay(date.value) : []))
const leaves = computed(() => chunk(entriesOfDay.value, PHOTOS_PER_LEAF))

const idx = computed(() => entries.dates.indexOf(date.value))
const prevDate = computed(() => (idx.value > 0 ? entries.dates[idx.value - 1] : null))
const nextDate = computed(() => (idx.value >= 0 && idx.value < entries.dates.length - 1 ? entries.dates[idx.value + 1] : null))

// แท็บ 4 วัน (เก่า → ใหม่) ที่ครอบคลุมวันที่เปิดอยู่
const tabs = computed(() => {
  const all = entries.dates
  const window = idx.value >= all.length - 4 || idx.value < 0 ? all.slice(-4) : all.slice(idx.value, idx.value + 4)
  return window.map((d) => ({ date: d, hex: dominantColorOfDay(entries.entriesOfDay(d)), label: thaiDateShort(parseLocalDate(d)) }))
})

// ---- พลิกหน้าหนังสือตอนเปลี่ยนวัน (ข้อ 38) ----
// next (วันใหม่กว่า): หน้าขวายกขึ้นแล้วพลิกไปทางซ้ายรอบสันกลาง ไปลงบนหน้าซ้าย · prev (วันเก่ากว่า): หน้าซ้ายยกขึ้นแล้วพลิกกลับไปทางขวา ไปลงบนหน้าขวา
// ข้อมูลเปลี่ยนทันที (อยู่ใต้แผ่น) หน้าที่แผ่นจะไปลงถูกซ่อนจนแผ่นลงถึงแล้วค่อยจางเผย เงาทอดลงหน้าที่ถูกเปิดเผย
const leftWrap = ref(null)
const rightWrap = ref(null)
const turnEl = ref(null)
const turnBoard = ref(null)
const turnFade = ref(null)
const turnFront = ref(null)
const turnBack = ref(null)
const turnShadow = ref(null)
const turnUnder = ref(null)
const turnSide = ref('right') // ด้านที่แผ่นเริ่มอยู่
let turnAnims = []
let currentTurn = 0 // รหัสการพลิกล่าสุด: พลิกใหม่ซ้อนระหว่างรอ → อันเก่าเลิก
const FLIP_WAIT_MS = 150 // รอหน้าปลายทางพร้อมได้ไม่เกินเท่านี้ก่อนเริ่มพลิก
const stopTurn = () => {
  turnAnims.forEach((a) => a.cancel())
  turnAnims = []
  if (turnEl.value) turnEl.value.style.visibility = ''
  if (turnUnder.value) turnUnder.value.style.visibility = ''
  turnBack.value?.replaceChildren()
  turnFront.value?.replaceChildren() // ทิ้งสำเนา (มี data-entry-id ซ้ำกับของจริง ต้องไม่ค้างใน DOM)
  turnUnder.value?.replaceChildren()
  ;[leftWrap.value, rightWrap.value].forEach((w) => w && (w.style.removeProperty('--hide'), w.firstElementChild && (w.firstElementChild.style.opacity = '')))
  app.leafFlipping = false
}
// สำเนาหน้าไว้แสดงอย่างเดียว: ตัด data-entry-id (flip.js หาช่องภาพด้วย attribute นี้) และปิดการโฟกัส
const snapshot = (el) => {
  const c = el.cloneNode(true)
  c.querySelectorAll('[data-entry-id]').forEach((e) => e.removeAttribute('data-entry-id'))
  c.querySelectorAll('button, a, input').forEach((e) => (e.tabIndex = -1))
  return c
}
const rot = (deg) => `perspective(${MOTION.flip.perspective}px) rotateY(${deg}deg)`
watch(
  () => app.pageTurn,
  async (t) => {
    if (!t || reducedMotion.value || !turnEl.value) return
    stopTurn()
    const next = t.dir === 'next'
    const from = (next ? rightWrap : leftWrap).value?.firstElementChild
    const landing = (next ? leftWrap : rightWrap).value?.firstElementChild
    if (!from || !landing) return
    // สำเนาหน้าเดิม (ก่อนข้อมูลเปลี่ยน: watcher นี้ทำงานก่อน render) ไปไว้หน้าหน้าของแผ่น
    const clone = snapshot(from)
    clone.style.left = '0px'
    clone.style.top = '0px'
    clone.style.boxShadow = 'none'
    const under = snapshot(landing) // หน้าเก่าฝั่งที่แผ่นไปลง
    under.style.left = '0px'
    under.style.top = '0px'
    under.style.boxShadow = 'none'
    turnSide.value = next ? 'right' : 'left'
    turnFront.value.replaceChildren(clone)
    turnUnder.value.replaceChildren(under)
    turnUnder.value.style.visibility = 'visible'
    turnEl.value.style.visibility = 'visible'
    landing.style.opacity = '0' // หน้าที่แผ่นจะไปลง ซ่อนไว้จนแผ่นลงถึง
    app.leafFlipping = true
    // ข้อ 62: แผ่นหยุดอยู่ที่เดิมคลุมหน้าเก่า (ภาพเหมือนก่อนกด) รอให้หน้าปลายทางพร้อมก่อน: ภาพย่อ + ชิ้นสีของวัน (ถ้ายังไม่เคยอุ่น) + decode รูปที่ render แล้ว รวมกันไม่เกิน FLIP_WAIT_MS ไม่ทันก็เริ่มพลิกเลย
    const turnId = ++currentTurn
    const t0 = performance.now()
    const left = () => FLIP_WAIT_MS - (performance.now() - t0)
    const leafNow = leaves.value[app.leafIndex] ?? []
    await within(Promise.all([warmEntries(leafNow, imageUrls), getDayCrop(entriesOfDay.value)]), left())
    await nextTick()
    await nextTick() // ชิ้นสีของวันที่เพิ่งเสร็จ render ลงหน้า
    if (turnId !== currentTurn) return
    const shown = [...landing.querySelectorAll('img'), ...from.querySelectorAll('img')]
    await within(Promise.all(shown.map((i) => i.decode?.().catch(() => {}))), left())
    if (turnId !== currentTurn) return
    // หลังแผ่น: สำเนาหน้าใหม่ (หน้าจริงยังซ่อนอยู่ ตัด opacity ที่ซ่อนออกจากสำเนา) ไม่ตัดเงาสัน เพื่อให้ตอนลงเหมือนหน้าจริง
    const back = snapshot(landing)
    back.style.opacity = ''
    back.style.left = '0px'
    back.style.top = '0px'
    turnBack.value.replaceChildren(back)
    sound.flip() // พลิกหน้า (ไฟล์ page)
    const T = MOTION.flip.turn * TIME_SCALE
    const opts = { duration: T, fill: 'both' }
    const end = next ? -180 : 180
    turnAnims = [
      turnBoard.value.animate([{ transform: rot(0), easing: 'cubic-bezier(0.45, 0, 0.25, 1)' }, { transform: rot(end) }], opts),
      turnFade.value.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.9 }, { opacity: 0, offset: 1 }], opts),
      turnShadow.value.animate([{ opacity: 0, offset: 0 }, { opacity: 0.45, offset: 0.5 }, { opacity: 0, offset: 1 }], opts),
      turnUnder.value.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.88 }, { opacity: 0, offset: 1 }], opts),
      landing.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.88 }, { opacity: 1, offset: 1 }], { ...opts, fill: 'none' }),
    ]
    await Promise.all(turnAnims.map((a) => a.finished.catch(() => {})))
    landing.style.opacity = ''
    if (turnAnims.length && turnAnims.every((a) => a.playState === 'finished')) stopTurn()
  },
  { flush: 'pre' },
)

// อุ่นภาพของวันก่อนหน้า/ถัดไปไว้ล่วงหน้า 1 วัน (แผ่นที่จะเห็นตอนเปิดวันนั้น = แผ่นล่าสุด) หลังหน้านิ่งแล้ว 300 ms ใช้ URL เดียวกับ <img> จริง ไม่เพิ่มคำขอ
let warmTimer = 0
watch(
  [date, prevDate, nextDate, () => entries.entries.length],
  () => {
    clearTimeout(warmTimer)
    warmTimer = setTimeout(() => {
      for (const d of [prevDate.value, nextDate.value]) {
        if (!d) continue
        const day = entries.entriesOfDay(d)
        const leaf = chunk(day, PHOTOS_PER_LEAF).at(-1) ?? []
        // ภาพย่อก่อน แล้วชิ้นสีของวัน (ใช้ภาพย่อที่อุ่นแล้ว + ภาพเต็มของภาพที่ชนะ 1 ภาพ ซึ่งต้องโหลดอยู่ดีเมื่อเปิดวันนั้น)
        warmEntries(leaf, imageUrls).then(() => getDayCrop(day))
      }
    }, 300)
  },
  { immediate: true },
)
</script>

<style>
/* สำเนาหน้าเดิมบนแผ่นที่พลิก: ห้ามเล่นแอนิเมชัน/ทรานซิชันซ้ำ (ไม่งั้นส่วนที่ปรากฏทีละส่วนจะซ่อนอยู่) */
.turn-snap * {
  animation: none !important;
  transition: none !important;
}
</style>
