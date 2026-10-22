<template>
  <!-- สมุดตัวเดียวที่อยู่บนโต๊ะตลอด ย้ายตำแหน่ง/ขนาดตาม view (SPEC §4.3) -->
  <!-- ชั้นปกปิด: hello / cover -->
  <div
    class="pointer-events-none absolute left-0 top-0 h-[540px] w-[420px] transition-[transform,opacity] duration-600 ease-desk"
    :style="{ ...closedPlacement, transitionDelay: closeDelay }"
    :aria-hidden="!closedVisible"
  >
    <BookCover
      :name="profile.shownName"
      :avatar="profile.avatar"
      :likes="profile.likes"
      :tabs="view === 'cover' ? entries.recentTabs : []"
    />
  </div>

  <!-- ชั้นเปิดเต็มเล่ม: book / saved -->
  <div
    class="absolute left-0 top-0 h-[640px] w-[1012px] transition-[transform,opacity] duration-600 ease-desk"
    :class="openInteractive ? '' : 'pointer-events-none'"
    :style="{ ...openPlacement, transitionDelay: closeDelay }"
    :inert="!openInteractive"
    :aria-hidden="!openVisible"
  >
    <div ref="bodyRef" class="absolute inset-0">
      <OpenBook :mode="view === 'saved' ? 'saved' : 'book'" />
    </div>
    <!-- ปกที่พลิกรอบสัน (ข้อ 22) ซ่อนอยู่เสมอ ยกเว้นช่วงพลิก -->
    <CoverFlip ref="flipRef" :name="profile.shownName" :avatar="profile.avatar" :likes="profile.likes" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BookCover from '@/components/book/BookCover.vue'
import OpenBook from '@/components/book/OpenBook.vue'
import CoverFlip from '@/components/book/CoverFlip.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'
import { useEntriesStore } from '@/stores/entries'
import { reducedMotion, TIME_SCALE } from '@/lib/motion'
import { MOTION } from '@/lib/tokens'
import { sound } from '@/lib/sound'

const app = useAppStore()
const profile = useProfileStore()
const entries = useEntriesStore()

const view = computed(() => app.view)

// translate คือมุมซ้ายบนของกล่องก่อนย่อ (ย่อรอบจุดกลาง) ค่าอิงพิกัด stage 1280×800
const CLOSED = {
  // ปกตัวอย่างฝั่งขวา: 340×440 กึ่งกลางที่ (1000, 349)
  hello: { transform: 'translate(790px, 79px) scale(0.8095) rotate(2deg)', opacity: 1 },
  // ปกปิดซ้าย-กลาง 420×540
  cover: { transform: 'translate(162px, 130px) rotate(-2.5deg)', opacity: 1 },
}
const CLOSED_HIDDEN = { transform: 'translate(-520px, 130px) rotate(-8deg)', opacity: 0 }
// ตอนสมุดเปิด ชั้นปกปิดเลื่อนไปทับตำแหน่งหน้าขวาของสมุดเปิด (บ่อนบน CoverFlip) แล้วจางหายให้ปกที่พลิกได้รับช่วงต่อ
// กล่อง 420×540 → หน้าขวา 506×640 ที่ (682,112): จุดกลาง (935,432) ศูนย์กลางเดิม (210,270) จึงเลื่อน (725,162)
const CLOSED_OPEN = { transform: `translate(725px, 162px) scale(${506 / 420}, ${640 / 540})`, opacity: 0 }

const OPEN = {
  // เปิดเต็มเล่ม ที่ (176, 112)
  book: { transform: 'translate(176px, 112px)', opacity: 1 },
  // ช็อตซูมเข้าหน้าซ้าย: ซูม 1.15 เท่า (SPEC §5.4)
  saved: { transform: 'translate(40px, 32px) scale(1.15)', opacity: 1, transformOrigin: 'top left' },
  // ดูภาพเดี่ยว: อยู่ที่เดิม ชั้นสี desk 85% ของ PhotoView ทับอยู่
  photo: { transform: 'translate(176px, 112px)', opacity: 1 },
}
const OPEN_HIDDEN = { transform: 'translate(176px, 140px) scale(0.9)', opacity: 0 }

// reduced-motion: ที่ซ่อนอยู่ไม่ย้ายตำแหน่ง แค่จางด้วย opacity (ไม่งั้นย้ายออกนอกจอก่อน fade จบ)
const closedHidden = computed(() => (reducedMotion.value ? { ...CLOSED.cover, opacity: 0 } : CLOSED_HIDDEN))
const openHidden = computed(() => (reducedMotion.value ? { ...OPEN.book, opacity: 0 } : OPEN_HIDDEN))
const closedPlacement = computed(() => CLOSED[view.value] ?? (view.value === 'book' && !reducedMotion.value ? CLOSED_OPEN : closedHidden.value))
const openPlacement = computed(() => ({ transformOrigin: 'top left', ...(OPEN[view.value] ?? openHidden.value) }))
const closedVisible = computed(() => view.value in CLOSED)
const openVisible = computed(() => view.value in OPEN)
// กดได้เฉพาะตอน book/saved (ตอน photo จางลงและโฟกัสอยู่ที่ภาพ)
const openInteractive = computed(() => view.value === 'book' || view.value === 'saved')

// ---- พลิกปกสมุด 3D (ข้อ 22) ----
// หน้าแรก → สมุด: ปกปิดเลื่อนไปทับหน้าขวาแล้วพลิก / ระบาย → สมุด และลำดับบันทึก → saved: ปกวางบนหน้าขวาแล้วพลิกทันที /
// สมุด → หน้าแรก: พลิกกลับก่อน แล้วชั้นสมุดเปิดจางหาย ชั้นปกปิดเลื่อนกลับ (transition-delay ตาม closeDelay)
// reduced-motion: ไม่พลิก ใช้ fade 150ms ตามเดิม
const flipRef = ref(null)
const bodyRef = ref(null)
const closing = ref(false)
const BACK_AT = 0.65 // สัดส่วนของเวลาพลิกเต็มที่ปกกลับมานอนบนหน้าขวา (ตรงกับ offset 0.35 ของ CoverFlip ที่ย้อนเวลา)
const closeDelay = computed(() => (closing.value ? `${Math.round(MOTION.flip.full * BACK_AT * TIME_SCALE)}ms` : '0ms'))
let closingTimer = 0
watch(
  view,
  (to, from) => {
    clearTimeout(closingTimer)
    flipRef.value?.stop()
    closing.value = false
    if (reducedMotion.value) return
    const opening = (to === 'book' || to === 'saved') && (from === 'cover' || from === 'paint')
    if (opening) {
      flipRef.value?.play(from === 'cover' ? 'open' : 'openShort', bodyRef.value)
      if (to === 'saved') sound.flip({ long: true }) // ไป book จาก paint store เล่นเสียงให้แล้ว
    } else if (from === 'book' && to === 'cover') {
      closing.value = true
      sound.flip({ long: true })
      flipRef.value?.play('close', bodyRef.value)
      closingTimer = setTimeout(() => (closing.value = false), (MOTION.flip.full * BACK_AT + MOTION.settle) * TIME_SCALE + 100)
    }
  },
  { flush: 'post' },
)
onBeforeUnmount(() => clearTimeout(closingTimer))
</script>
