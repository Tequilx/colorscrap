<template>
  <!-- การ์ดหลังบันทึก (SPEC §5.4, แบบ 10-saved-v2) อยู่ในหน้าขวาของสมุดที่ซูมอยู่ทั้งหมด (หน้าขวา = x 622–1188, y 48–752 ในพิกัด stage) -->
  <div
    class="absolute box-border flex flex-col rounded-hand border-2 border-ink bg-card px-[30px] pb-[24px] pt-[26px] shadow-card"
    :class="app.savePhase === 'idle' ? '' : 'pointer-events-none'"
    :style="{ left: CARD.x + 'px', top: CARD.y + 'px', width: CARD.w + 'px' }"
  >
    <!-- 1. เครื่องหมายถูกในวงหมึกวาดมือ (สีปกสมุด) + หัวข้อ + เวลา · อารมณ์ · ระดับ -->
    <div class="flex items-center gap-3.5 pb-[22px]">
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true" class="shrink-0" style="stroke: var(--cover)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 4.5 C34 4 42 12.5 41.5 23.5 C41 34.5 33 42 22.5 41.5 C12 41 4.5 33 5 22.5 C5.4 13 12.5 5 23 4.5 C26 4.4 28 5 29.5 5.6" />
        <path d="M13.5 23.5 L20 30 L32.5 15.5" />
      </svg>
      <div role="status" class="flex min-w-0 flex-col gap-1">
        <span class="font-hand text-26 font-semibold leading-head">แปะลงสมุดแล้ว</span>
        <span class="text-14 text-ink-soft">{{ entry.local_time }} · {{ emotionLabel(entry) }} · {{ INTENSITY_LABELS[entry.intensity] }}</span>
      </div>
    </div>

    <!-- 2. สีในภาพนี้: หยดสีน้ำไม่เกิน 5 หยด ขนาดตาม ratio พร้อม % -->
    <div class="flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-line py-[22px]">
      <span class="font-hand text-17 font-semibold">สีในภาพนี้</span>
      <ul class="m-0 flex list-none items-end justify-between gap-1 p-0">
        <li v-for="(c, i) in entry.colors.slice(0, 5)" :key="c.hex" class="flex w-[60px] flex-col items-center gap-0.5" :aria-label="`${hueGroup(c.hex)} ${pct[i]}%`">
          <WatercolorBlob :color="c.hex" :width="blobSize(c.ratio)" :height="Math.round(blobSize(c.ratio) * 120 / 170)" :opacity="0.75" />
          <span class="text-13 text-ink-2">{{ pct[i] }}%</span>
        </li>
      </ul>
    </div>

    <!-- 3. สีของวันนี้: แถบสีของวันปาดช่วงสุดท้าย + ก้อนสีของวันเปลี่ยนจากสีก่อนบันทึกเป็นสีใหม่ที่ ~1.5 วิ (ชื่อเก่าเทาขีดฆ่า ชื่อใหม่ตัวหนา) -->
    <div class="flex flex-col gap-1 border-t-[1.5px] border-dashed border-line py-[22px]">
      <div class="flex items-baseline gap-2">
        <span class="font-hand text-17 font-semibold">{{ !before.length ? 'สีแรกของวันนี้' : unchanged ? 'สีของวันนี้ยังคงเดิม' : 'สีของวันนี้' }}</span>
        <span v-if="before.length && !unchanged" class="text-13 text-ink-soft">เติมเข้าไปอีกหนึ่งช่วง</span>
      </div>
      <DayRibbon :entries="day" highlight-last animate="paintLast" :width="RIBBON_W" />
      <div class="relative mt-1 h-[64px]">
        <!-- ก้อนสีของวัน: สีเก่าจางออก สีใหม่จางเข้า -->
        <WatercolorBlob class="absolute left-0 top-2 transition-opacity duration-600 ease-desk" :class="changed ? 'opacity-0' : 'opacity-100'" :color="beforeMix" :width="76" :height="54" :opacity="0.85" />
        <WatercolorBlob class="absolute left-0 top-2 transition-opacity duration-600 ease-desk" :class="changed || !before.length ? 'opacity-100' : 'opacity-0'" :color="afterMix" :width="76" :height="54" :opacity="0.85" />
        <!-- ชื่อ: ก่อนเปลี่ยนแสดงชื่อตัวหนา หลังเปลี่ยนเหลือชื่อเก่าเทาขีดฆ่าตัวเล็ก + ชื่อใหม่ตัวหนา -->
        <div class="absolute left-[92px] right-0 top-0 flex h-full flex-col justify-center transition-opacity duration-450 ease-desk" :class="showOld ? 'opacity-100' : 'opacity-0'">
          <span class="font-hand text-[22px] font-semibold leading-stack">{{ beforeName }}</span>
        </div>
        <div class="absolute left-[92px] right-0 top-0 flex h-full flex-col justify-center transition-opacity duration-450 ease-desk" :class="showOld ? 'opacity-0' : 'opacity-100'">
          <span v-if="before.length && !unchanged" class="text-14 text-ink-soft line-through">{{ beforeName }}</span>
          <span class="font-hand text-[22px] font-semibold leading-stack">{{ afterName }}</span>
        </div>
      </div>
    </div>

    <!-- 4. ปุ่ม -->
    <div class="flex gap-3.5 border-t-[1.5px] border-dashed border-line pt-[22px]">
      <HandButton class="!min-h-[52px] !text-[18px]" @click="app.go('book')">ดูสมุดทั้งเล่ม</HandButton>
      <HandButton variant="secondary" class="!min-h-[52px]" @click="app.go('pick')">ระบายต่ออีกแผ่น</HandButton>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import WatercolorBlob from '@/components/ui/WatercolorBlob.vue'
import DayRibbon from '@/components/book/DayRibbon.vue'
import { INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { dayColor, hueGroup, percentsOf, sameColorName } from '@/lib/palette'
import { ms } from '@/lib/motion'
import { PALETTE } from '@/lib/tokens'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entriesStore = useEntriesStore()

// ตำแหน่งการ์ด: ภายในหน้าขวาของสมุดซูม (Scrapbook saved: translate(40,32) scale 1.15 → หน้าขวา x 622–1188, y 48–752) เว้นขอบ ~30px ไม่ล้นขอบเล่ม/ไม่ทับสายรัด
const CARD = { x: 652, y: 70, w: 506 }
const RIBBON_W = CARD.w - 60 - 4 // ความกว้างในการ์ด (padding 30 ซ้ายขวา + เส้นขอบ 2px)

const entry = computed(() => entriesStore.entries.find((e) => e.id === app.lastSavedEntryId) ?? entriesStore.entries.at(-1))
const pct = computed(() => percentsOf(entry.value.colors.slice(0, 5)))
// ขนาดหยด 28–60px ตาม ratio (สีที่มากที่สุดใหญ่สุด)
const blobSize = (ratio) => Math.round(28 + 32 * Math.sqrt(ratio / Math.max(...entry.value.colors.slice(0, 5).map((c) => c.ratio))))
const day = computed(() => entriesStore.entriesOfDay(entry.value.local_date))
const before = computed(() => day.value.filter((e) => e.id !== entry.value.id))

const beforeColor = computed(() => dayColor(before.value))
const afterColor = computed(() => dayColor(day.value))
const beforeMix = computed(() => beforeColor.value?.mix ?? afterColor.value?.mix ?? PALETTE['paper-deep'])
const afterMix = computed(() => afterColor.value?.mix ?? PALETTE['paper-deep'])
const beforeName = computed(() => beforeColor.value?.name.full ?? afterColor.value?.name.full ?? '')
const afterName = computed(() => afterColor.value?.name.full ?? '')
// ส่วนสีของชื่อ (กลุ่มสี + ตัวขยาย) ก่อนและหลังบันทึกเหมือนกัน ไม่นับช่วงเวลา แสดงว่ายังเป็นสีเดิมแทนที่จะขีดฆ่า
const unchanged = computed(() => before.value.length > 0 && sameColorName(beforeColor.value, afterColor.value))

// ที่ ~1.5 วิ (หลังแถบปาดช่วงสุดท้ายเกือบจบ) ก้อนสี/ชื่อของวันเปลี่ยนเป็นของใหม่ ภาพแรกของวันหรือชื่อไม่เปลี่ยนก็ไม่ต้องรอ
const changed = ref(false)
const showOld = computed(() => before.value.length > 0 && !unchanged.value && !changed.value)
let timer = 0
onMounted(() => {
  timer = setTimeout(() => (changed.value = true), ms(1500))
})
onBeforeUnmount(() => clearTimeout(timer))
</script>
