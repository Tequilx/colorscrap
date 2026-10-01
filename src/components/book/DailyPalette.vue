<template>
  <!-- หน้าขวา: จานสีประจำวัน (SPEC §5.7) -->
  <div class="absolute left-[506px] top-[14px] h-[612px] w-[492px] rounded-[0_6px_6px_0] bg-paper shadow-[inset_18px_0_22px_-16px_rgba(45,43,51,0.35)]">
    <div class="absolute left-10 top-7 flex w-[412px] items-baseline justify-between">
      <span class="whitespace-nowrap font-hand text-26 font-semibold" :class="placeholder ? 'text-[#B9B4AC]' : ''">{{ title }}</span>
      <span v-if="!placeholder && entries.length" class="whitespace-nowrap text-14 text-ink-soft">{{ entries.length }} ภาพ · {{ moodCount }} อารมณ์</span>
    </div>

    <template v-if="!placeholder">
      <p v-if="!entries.length" class="absolute left-10 top-[120px] m-0 w-[412px] text-16 leading-[1.7] text-ink-soft">ยังไม่มีสีของวันนี้ ลองระบายสักภาพแล้วสีจะมารวมกันตรงนี้</p>

      <template v-else>
        <div class="absolute left-[34px] top-[82px] flex w-[418px] items-center gap-5">
          <MixingWell :entries="entries" />
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-13 text-ink-soft">{{ isToday ? 'สีของวันนี้' : 'สีของวัน' }}</span>
            <span class="font-hand text-26 font-semibold leading-[1.25]">{{ name.colorPart }}<br />{{ name.periodPart }}</span>
            <svg width="170" height="36" viewBox="0 0 170 36" aria-hidden="true">
              <g class="filter-wct"><path d="M10 20 C50 12 110 26 160 16" fill="none" :stroke="mix" stroke-width="20" stroke-linecap="round" /></g>
            </svg>
            <code class="font-mono text-13 text-ink-soft">{{ mix.toUpperCase() }}</code>
          </div>
        </div>

        <div class="absolute left-10 top-[306px] flex w-[412px] flex-col gap-1">
          <span class="font-hand text-17 font-semibold">ช่วงเวลาของวัน</span>
          <DayTimeline :entries="entries" :new-id="newId" />
        </div>

        <p class="absolute left-10 top-[458px] m-0 w-[412px] text-16 leading-[1.7] text-ink-2">{{ summary }}</p>
      </template>

      <div class="absolute inset-x-10 bottom-[22px] flex items-center justify-between border-t-[1.5px] border-dashed border-line pt-2">
        <button v-if="prevDate" type="button" class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-hand text-16 font-semibold text-ink" @click="$emit('day', prevDate)">
          <Doodle name="back" :size="20" /> {{ shortLabel(prevDate) }}
        </button>
        <span v-else></span>
        <button v-if="nextDate" type="button" class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-hand text-16 font-semibold text-ink" @click="$emit('day', nextDate)">
          {{ shortLabel(nextDate) }} <Doodle name="forward" :size="20" />
        </button>
        <span v-else class="text-14 text-ink-soft">หน้าล่าสุด</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MixingWell from '@/components/book/MixingWell.vue'
import DayTimeline from '@/components/book/DayTimeline.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { mixColors, nameOfDay } from '@/lib/palette'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { localDateStr, parseLocalDate, thaiDateShort } from '@/lib/dates'

const props = defineProps({
  date: { type: String, required: true },
  entries: { type: Array, required: true }, // ของวันนั้น เรียงตามเวลา
  prevDate: { type: String, default: null },
  nextDate: { type: String, default: null },
  newId: { type: String, default: null },
  // หน้า saved: การ์ดบังหน้านี้อยู่ แสดงแค่หัวข้อสีจาง
  placeholder: { type: Boolean, default: false },
})

defineEmits(['day'])

const isToday = computed(() => props.date === localDateStr())
const title = computed(() => (isToday.value ? 'จานสีของวันนี้' : `จานสีของ ${thaiDateShort(parseLocalDate(props.date))}`))
const shortLabel = (d) => thaiDateShort(parseLocalDate(d))

const mix = computed(() => mixColors(props.entries) ?? '#8E8A93')
const name = computed(() => nameOfDay(mix.value, props.entries.at(-1)?.local_time ?? '12:00'))

const counts = computed(() => {
  const map = new Map()
  props.entries.forEach((e) => map.set(e.emotion, (map.get(e.emotion) ?? 0) + 1))
  return map
})
const moodCount = computed(() => counts.value.size)

// ช่วงเวลาสั้น ๆ ในประโยคสรุป เช่น "ตอนบ่าย"
const dayPart = (time) => {
  const h = Number(time.slice(0, 2))
  if (h >= 5 && h < 11) return 'เช้า'
  if (h >= 11 && h < 14) return 'เที่ยง'
  if (h >= 14 && h < 17) return 'บ่าย'
  if (h >= 17 && h < 19) return 'เย็น'
  return 'ค่ำ'
}

// สรุปท้ายหน้า: ข้อความสั้นหนึ่งบรรทัดจาก template ไม่ใช้ AI (SPEC §5.7)
const summary = computed(() => {
  const list = props.entries
  if (!list.length) return ''
  const th = (key) => EMOTION_BY_KEY[key].th
  // เรียงตามจำนวนมาก→น้อย เสมอกันใช้ภาพล่าสุด
  const lastIndex = (key) => list.map((e) => e.emotion).lastIndexOf(key)
  const ranked = [...counts.value.entries()].sort((a, b) => b[1] - a[1] || lastIndex(b[0]) - lastIndex(a[0]))
  if (list.length >= 5) return `${ranked.map(([k, n]) => `${th(k)} ${n}`).join(' · ')} วันนี้แวะมาบ่อยเลยนะ`
  const [main, second] = ranked
  if (!second) return list.length === 1 ? `${th(main[0])} ตอน${dayPart(list[0].local_time)}` : `${th(main[0])}ทั้งวันเลย`
  const secondEntry = list[lastIndex(second[0])]
  const shiftedNote = secondEntry.shifted ? 'ที่ค่อย ๆ อุ่นขึ้น' : ''
  return `ส่วนใหญ่${th(main[0])} มีช่วง${th(second[0])}ตอน${dayPart(secondEntry.local_time)}${shiftedNote}`
})
</script>
