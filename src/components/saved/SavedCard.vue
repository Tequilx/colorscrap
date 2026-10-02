<template>
  <!-- การ์ดหลังบันทึก (SPEC §5.4) -->
  <div class="absolute left-[790px] top-[110px] box-border flex w-[400px] flex-col gap-[18px] rounded-[22px_26px_20px_24px] border-2 border-ink bg-white px-[30px] py-7 shadow-[0_24px_44px_rgba(45,43,51,0.24)]" :class="app.savePhase === 'idle' ? '' : 'pointer-events-none'">
    <div class="flex items-center gap-3">
      <span class="filter-wob flex h-11 w-11 items-center justify-center rounded-full text-ink" :style="{ background: emotion.hex }">
        <Doodle name="check" :size="24" />
      </span>
      <div role="status" class="flex flex-col">
        <span class="font-hand text-26 font-semibold leading-[1.2]">แปะลงสมุดแล้ว</span>
        <span class="text-14 text-ink-soft">{{ entry.local_time }} · {{ emotionLabel(entry) }} · {{ INTENSITY_LABELS[entry.intensity] }}</span>
      </div>
    </div>

    <!-- สีในภาพนี้: หยดสีน้ำไม่เกิน 5 หยด ขนาดตาม ratio พร้อม % -->
    <div class="flex flex-col gap-2 border-t-[1.5px] border-dashed border-line pt-4">
      <span class="font-hand text-17 font-semibold">สีในภาพนี้</span>
      <ul class="m-0 flex list-none items-end justify-between gap-1 p-0">
        <li v-for="(c, i) in entry.colors.slice(0, 5)" :key="c.hex" class="flex w-[60px] flex-col items-center gap-0.5" :aria-label="`${hueGroup(c.hex)} ${pct[i]}%`">
          <WatercolorBlob :color="c.hex" :width="blobSize(c.ratio)" :height="Math.round(blobSize(c.ratio) * 120 / 170)" :opacity="0.75" />
          <span class="text-13 text-ink-2">{{ pct[i] }}%</span>
        </li>
      </ul>
    </div>

    <div class="flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-line pt-4">
      <span class="font-hand text-17 font-semibold">{{ !before.length ? 'สีแรกของวันนี้' : unchanged ? 'สีของวันนี้ยังคงเดิม' : 'สีของวันนี้เปลี่ยนไปนิดหนึ่ง' }}</span>
      <!-- หยดสีตกลงหลุมผสมสี มีวงคลื่นกระจาย -->
      <!-- หลุมผสมสีย่อลง (80%) ให้การ์ดที่มีหัวข้อสีในภาพนี้เพิ่มยังสูงไม่เกินพื้นที่ -->
      <svg width="272" height="125" viewBox="0 0 340 156" class="self-center" role="img" :aria-label="`หยดสี${emotion.th}กำลังตกลงในหลุมผสมสีของวันนี้`">
        <defs><clipPath :id="clipId"><circle cx="170" cy="96" r="44" /></clipPath></defs>
        <path d="M170 6 C170 6 160 20 160 27 A10 10 0 0 0 180 27 C180 20 170 6 170 6 Z" :fill="entry.colors[0].hex" stroke="#2D2B33" stroke-width="1.6" />
        <path d="M150 12 V30 M190 16 V34" stroke="#8E8A93" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 5" />
        <ellipse cx="173" cy="102" rx="58" ry="56" fill="rgba(45, 43, 51, 0.10)" />
        <circle cx="170" cy="96" r="56" fill="#F1EEE8" stroke="#DCD6CC" stroke-width="2" />
        <circle cx="170" cy="96" r="45" fill="#FFFFFF" stroke="#E4DFD6" stroke-width="2.5" />
        <g :clip-path="`url(#${clipId})`">
          <g class="filter-wcm">
            <path v-for="(g, i) in groups" :key="i" :d="BLOB_PATHS.small" :transform="SPOTS[i]" :fill="g.hex" fill-opacity="0.58" />
          </g>
        </g>
        <circle cx="170" cy="78" r="10" fill="none" :stroke="entry.colors[0].hex" stroke-width="2" />
        <circle cx="170" cy="78" r="18" fill="none" :stroke="entry.colors[0].hex" stroke-opacity="0.45" stroke-width="1.6" />
      </svg>
      <!-- สีก่อนและหลังบันทึก -->
      <div class="flex items-center gap-2.5">
        <template v-if="before.length && !unchanged">
          <div class="flex flex-grow flex-col items-center gap-0.5">
            <svg width="120" height="34" viewBox="0 0 170 36" aria-hidden="true"><g class="filter-wct"><path d="M14 20 C54 12 110 26 156 16" fill="none" :stroke="beforeMix" stroke-width="20" stroke-linecap="round" /></g></svg>
            <span class="font-hand text-15 text-ink-soft">{{ beforeName }}</span>
          </div>
          <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true"><path d="M2 10 H24 M17 3 L25 10 L17 17" fill="none" stroke="#2D2B33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </template>
        <div class="flex flex-grow flex-col items-center gap-0.5">
          <svg width="120" height="34" viewBox="0 0 170 36" aria-hidden="true"><g class="filter-wct"><path d="M14 20 C54 12 110 26 156 16" fill="none" :stroke="afterMix" stroke-width="20" stroke-linecap="round" /></g></svg>
          <span class="font-hand text-15 font-semibold">{{ afterName }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 pt-1">
      <HandButton class="!min-h-[56px] !text-[18px]" @click="app.go('book')">ดูสมุดทั้งเล่ม</HandButton>
      <HandButton variant="secondary" class="!min-h-[52px]" @click="app.go('pick')">ระบายต่ออีกแผ่น</HandButton>
    </div>
  </div>
</template>

<script setup>
import { computed, useId } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import WatercolorBlob from '@/components/ui/WatercolorBlob.vue'
import { BLOB_PATHS } from '@/lib/doodles'
import { EMOTION_BY_KEY, INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { colorWeightsOfDay, dayColor, hueGroup, percentsOf, sameColorName } from '@/lib/palette'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entriesStore = useEntriesStore()
const clipId = useId()

const entry = computed(() => entriesStore.entries.find((e) => e.id === app.lastSavedEntryId) ?? entriesStore.entries.at(-1))
const emotion = computed(() => EMOTION_BY_KEY[entry.value.emotion])
const pct = computed(() => percentsOf(entry.value.colors.slice(0, 5)))
// ขนาดหยด 28–60px ตาม ratio (สีที่มากที่สุดใหญ่สุด)
const blobSize = (ratio) => Math.round(28 + 32 * Math.sqrt(ratio / Math.max(...entry.value.colors.slice(0, 5).map((c) => c.ratio))))
const day = computed(() => entriesStore.entriesOfDay(entry.value.local_date))
const before = computed(() => day.value.filter((e) => e.id !== entry.value.id))

const beforeColor = computed(() => dayColor(before.value))
const afterColor = computed(() => dayColor(day.value))
const beforeMix = computed(() => beforeColor.value?.mix ?? '#8E8A93')
const afterMix = computed(() => afterColor.value?.mix ?? '#8E8A93')
const beforeName = computed(() => beforeColor.value?.name.full ?? '')
const afterName = computed(() => afterColor.value?.name.full ?? '')
// ส่วนสีของชื่อ (กลุ่มสี + ตัวขยาย) ก่อนและหลังบันทึกเหมือนกัน ไม่นับช่วงเวลา แสดงว่ายังคงเดิมแทนลูกศร
const unchanged = computed(() => before.value.length > 0 && sameColorName(beforeColor.value, afterColor.value))

// หยดในหลุมเล็ก (รัศมี 44): ตำแหน่งตายตัว 3 จุด ตามสีที่หนักที่สุดของวัน
const groups = computed(() => colorWeightsOfDay(day.value).slice(0, 3))
const SPOTS = ['translate(98 44) scale(0.75)', 'translate(142 52) scale(0.5)', 'translate(150 90) scale(0.3)']
</script>
