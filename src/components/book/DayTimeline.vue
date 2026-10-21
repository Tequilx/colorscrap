<template>
  <!-- เส้นเวลาของวัน 06:00–24:00: หยดสีตั้งขึ้นจากเส้นฐานตามเวลาที่บันทึก (SPEC §5.7) -->
  <svg width="412" height="118" viewBox="0 0 412 118" role="img" :aria-label="aria">
    <defs>
      <linearGradient v-for="d in drops" :key="d.id" :id="`${uid}-${d.id}`" x1="0" y1="1" x2="0" y2="0">
        <stop v-for="(c, i) in d.stops" :key="i" :offset="d.stops.length === 1 ? 0 : i / (d.stops.length - 1)" :stop-color="c" />
      </linearGradient>
    </defs>
    <path d="M2 82 C80 78 160 86 240 81 S360 84 410 81" fill="none" stroke="#8E8A93" stroke-width="1.6" stroke-linecap="round" />
    <!-- ขีดบอกเวลา 00, 06, 12, 18, 24 -->
    <template v-for="t in TICKS" :key="t.label">
      <path :d="`M${t.x} 76 V88`" stroke="#8E8A93" stroke-width="1.6" stroke-linecap="round" />
      <text :x="t.x" y="110" text-anchor="middle" class="fill-ink-soft font-body text-[12px]">{{ t.label }}</text>
    </template>
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
import { timelineX, spreadXs, rankedColors, TIMELINE_LEFT, TIMELINE_WIDTH } from '@/lib/palette'
import { EMOTION_BY_KEY } from '@/lib/emotions'

const props = defineProps({
  entries: { type: Array, required: true }, // เรียงตามเวลาแล้ว
  newId: { type: String, default: null },
})

const uid = useId()

const TICKS = [0, 6, 12, 18, 24].map((h) => ({
  label: `${String(h).padStart(2, '0')}:00`,
  x: Math.round(TIMELINE_LEFT + (h / 24) * TIMELINE_WIDTH),
}))

// entries เรียงตามเวลาแล้ว จึงเรียง x จากน้อยไปมากอยู่แล้ว ใช้ spreadXs เลื่อนหยดที่ชิดกันเกินไป
const xs = computed(() => spreadXs(props.entries.map((e) => Math.round(timelineX(e.local_time)))))

const drops = computed(() =>
  props.entries.map((e, i) => {
    const x = xs.value[i]
    const name = EMOTION_BY_KEY[e.emotion].th
    return {
      id: e.id,
      x,
      path: timelineDrop(x),
      // ภาพที่ปรับโทนไล่สีแนวตั้ง จากสีเด่น (ratio × saturation) ไปสีที่ซึมเข้ามา; ภาพปกติใช้สีเด่นสีเดียว
      stops: e.shifted ? rankedColors(e.colors).slice(0, 3).map((c) => c.hex) : [rankedColors(e.colors)[0].hex],
      name: e.shifted ? `${name} → มีแสงขึ้น` : name,
      isNew: e.id === props.newId,
    }
  }),
)

const showNames = computed(() => props.entries.length <= 3)
const aria = computed(() => props.entries.map((e) => `${e.local_time} ${EMOTION_BY_KEY[e.emotion].th}`).join(', '))
</script>
