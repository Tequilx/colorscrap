<template>
  <!-- เส้นเวลาของวัน 06:00–24:00: หยดสีตั้งขึ้นจากเส้นฐานตามเวลาที่บันทึก (SPEC §5.7) -->
  <svg width="412" height="118" viewBox="0 0 412 118" role="img" :aria-label="aria">
    <defs>
      <linearGradient v-for="d in drops" :key="d.id" :id="`${uid}-${d.id}`" x1="0" y1="1" x2="0" y2="0">
        <stop v-for="(c, i) in d.stops" :key="i" :offset="d.stops.length === 1 ? 0 : i / (d.stops.length - 1)" :stop-color="c" />
      </linearGradient>
    </defs>
    <path d="M2 82 C80 78 160 86 240 81 S360 84 410 81" fill="none" stroke="#8E8A93" stroke-width="1.6" stroke-linecap="round" />
    <path d="M2 76 V88 M137 76 V88 M275 76 V88 M410 76 V88" stroke="#8E8A93" stroke-width="1.6" stroke-linecap="round" />
    <text x="2" y="110" class="fill-ink-soft font-body text-[12px]">06:00</text>
    <text x="137" y="110" text-anchor="middle" class="fill-ink-soft font-body text-[12px]">12:00</text>
    <text x="275" y="110" text-anchor="middle" class="fill-ink-soft font-body text-[12px]">18:00</text>
    <text x="410" y="110" text-anchor="end" class="fill-ink-soft font-body text-[12px]">24:00</text>
    <g class="filter-wct">
      <path v-for="d in drops" :key="d.id" :d="d.path" :fill="d.stops.length > 1 ? `url(#${uid}-${d.id})` : d.stops[0]" fill-opacity="0.82" />
    </g>
    <!-- ชื่ออารมณ์เหนือหยด แสดงเมื่อมีไม่เกิน 3 ภาพ (มากกว่านั้นซ่อนเพื่อไม่ให้ซ้อนกัน) -->
    <template v-if="showNames">
      <text v-for="(d, i) in drops" :key="d.id" :x="d.x" :y="[22, 12, 22][i % 3]" text-anchor="middle" class="fill-ink-2 font-hand text-[13px] font-semibold">{{ d.name }}</text>
    </template>
    <!-- หน้า saved: ภาพใหม่มีวงเส้นประรอบและป้าย +1 -->
    <template v-for="d in drops" :key="'new' + d.id">
      <g v-if="d.isNew">
        <circle :cx="d.x" cy="52" r="26" fill="none" stroke="#2D2B33" stroke-opacity="0.45" stroke-width="1.6" stroke-dasharray="4 5" />
        <text :x="d.x + 24" y="26" class="fill-ink font-hand text-[13px] font-bold">+1</text>
      </g>
    </template>
  </svg>
</template>

<script setup>
import { computed, useId } from 'vue'
import { timelineDrop } from '@/lib/doodles'
import { timelineX } from '@/lib/palette'
import { EMOTION_BY_KEY } from '@/lib/emotions'

const props = defineProps({
  entries: { type: Array, required: true }, // เรียงตามเวลาแล้ว
  newId: { type: String, default: null },
})

const uid = useId()

const drops = computed(() =>
  props.entries.map((e) => {
    const x = Math.round(timelineX(e.local_time)) + 2
    const name = EMOTION_BY_KEY[e.emotion].th
    return {
      id: e.id,
      x,
      path: timelineDrop(x),
      // ภาพที่ปรับโทนไล่สีแนวตั้ง จากสีเด่นไปสีที่ซึมเข้ามา; ภาพปกติใช้สีเด่นสีเดียว
      stops: e.shifted ? e.colors.slice(0, 3).map((c) => c.hex) : [e.colors[0].hex],
      name: e.shifted ? `${name} → อุ่นขึ้น` : name,
      isNew: e.id === props.newId,
    }
  }),
)

const showNames = computed(() => props.entries.length <= 3)
const aria = computed(() => props.entries.map((e) => `${e.local_time} ${EMOTION_BY_KEY[e.emotion].th}`).join(', '))
</script>
