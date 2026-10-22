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
</template>

<script setup>
import { computed } from 'vue'
import DateTabs from '@/components/book/DateTabs.vue'
import PhotoPage from '@/components/book/PhotoPage.vue'
import DailyPalette from '@/components/book/DailyPalette.vue'
import { useAppStore, PHOTOS_PER_LEAF } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'
import { chunk, dominantColorOfDay } from '@/lib/palette'
import { parseLocalDate, thaiDateShort } from '@/lib/dates'

defineProps({ mode: { type: String, default: 'book' } })

const app = useAppStore()
const entries = useEntriesStore()

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
</script>
