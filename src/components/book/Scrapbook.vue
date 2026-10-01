<template>
  <!-- สมุดตัวเดียวที่อยู่บนโต๊ะตลอด ย้ายตำแหน่ง/ขนาดตาม view (SPEC §4.3) -->
  <!-- ชั้นปกปิด: hello / cover -->
  <div
    class="pointer-events-none absolute left-0 top-0 h-[540px] w-[420px] transition-[transform,opacity] duration-600 ease-desk"
    :style="closedPlacement"
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
    :style="openPlacement"
    :inert="!openInteractive"
    :aria-hidden="!openVisible"
  >
    <OpenBook :mode="view === 'saved' ? 'saved' : 'book'" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BookCover from '@/components/book/BookCover.vue'
import OpenBook from '@/components/book/OpenBook.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'
import { useEntriesStore } from '@/stores/entries'

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

const OPEN = {
  // เปิดเต็มเล่ม ที่ (176, 112)
  book: { transform: 'translate(176px, 112px)', opacity: 1 },
  // ช็อตซูมเข้าหน้าซ้าย: ซูม 1.15 เท่า (SPEC §5.4)
  saved: { transform: 'translate(40px, 32px) scale(1.15)', opacity: 1, transformOrigin: 'top left' },
  // ดูภาพเดี่ยว: อยู่ที่เดิม ชั้นสี desk 85% ของ PhotoView ทับอยู่
  photo: { transform: 'translate(176px, 112px)', opacity: 1 },
}
const OPEN_HIDDEN = { transform: 'translate(176px, 140px) scale(0.9)', opacity: 0 }

const closedPlacement = computed(() => CLOSED[view.value] ?? CLOSED_HIDDEN)
const openPlacement = computed(() => ({ transformOrigin: 'top left', ...(OPEN[view.value] ?? OPEN_HIDDEN) }))
const closedVisible = computed(() => view.value in CLOSED)
const openVisible = computed(() => view.value in OPEN)
// กดได้เฉพาะตอน book/saved (ตอน photo จางลงและโฟกัสอยู่ที่ภาพ)
const openInteractive = computed(() => view.value === 'book' || view.value === 'saved')
</script>
