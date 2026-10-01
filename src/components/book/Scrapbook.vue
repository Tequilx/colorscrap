<template>
  <!-- สมุดตัวเดียวที่อยู่บนโต๊ะตลอด ย้ายตำแหน่ง/ขนาดตาม view (SPEC §4.3) -->
  <div
    class="pointer-events-none absolute left-0 top-0 h-[540px] w-[420px] transition-[transform,opacity] duration-600 ease-desk"
    :style="placement"
    :aria-hidden="!visible"
  >
    <BookCover
      :name="profile.shownName"
      :avatar="profile.avatar"
      :likes="profile.likes"
      :tabs="view === 'cover' ? entries.recentTabs : []"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BookCover from '@/components/book/BookCover.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const profile = useProfileStore()
const entries = useEntriesStore()

const view = computed(() => app.view)

// translate คือมุมซ้ายบนของกล่อง 420×540 ก่อนย่อ (ย่อรอบจุดกลาง) ค่าอิงพิกัด stage 1280×800
const PLACEMENTS = {
  // ปกตัวอย่างฝั่งขวา: 340×440 กึ่งกลางที่ (1000, 349)
  hello: { transform: 'translate(790px, 79px) scale(0.8095) rotate(2deg)', opacity: 1 },
  // ปกปิดซ้าย-กลาง 420×540
  cover: { transform: 'translate(162px, 130px) rotate(-2.5deg)', opacity: 1 },
  // ซ่อนนอกจอ
  hidden: { transform: 'translate(-520px, 130px) rotate(-8deg)', opacity: 0 },
}

const placement = computed(() => PLACEMENTS[view.value] ?? PLACEMENTS.hidden)
const visible = computed(() => view.value in PLACEMENTS)
</script>
