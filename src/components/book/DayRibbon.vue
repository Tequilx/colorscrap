<template>
  <!-- แถบสีของวัน: รอยพู่กันแนวนอนเส้นเดียว 1 ภาพ = 1 ช่วง เรียงตามเวลาจากซ้ายไปขวา กว้าง ∝ น้ำหนักภาพ รอยต่อซึมเข้าหากัน
       ป้ายเวลา (ไอคอนพระจันทร์/ดวงอาทิตย์) + อารมณ์ใต้กลางแต่ละช่วง ซ่อนตามความกว้าง/กันไม่ให้ทับ (lib/dayRibbon.js)
       animate: 'none' | 'reveal' (ไล่จากซ้ายไปขวา) | 'paintLast' (ปาดเฉพาะช่วงสุดท้าย) ขอบนำสั่นแบบรอยพู่กัน (clip-path polygon เคลื่อนด้วย WAAPI)
       reduced-motion: ไม่ปาด จางเข้า 150ms -->
  <div class="relative" :style="{ width: width + 'px' }" role="img" :aria-label="aria">
    <div ref="paintRef" class="relative" :style="{ width: width + 'px', height: HEIGHT + 'px' }">
      <svg :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`" aria-hidden="true">
        <defs>
          <linearGradient v-for="g in gradients" :id="`${uid}-${g.id}`" :key="g.id" gradientUnits="userSpaceOnUse" :x1="g.x0" y1="0" :x2="g.x1" y2="0">
            <stop v-for="(st, i) in g.stops" :key="i" :offset="st.o" :stop-color="st.c" :stop-opacity="st.a" />
          </linearGradient>
        </defs>
        <!-- ชั้นจางกว้างกว่าด้านหลัง -->
        <g style="filter: url(#wcr)" opacity="0.3">
          <path v-for="s in segs" :key="'b' + s.id" :d="shape(s, BACK_H)" :fill="`url(#${uid}-${s.id})`" />
        </g>
        <!-- ชั้นสีหลัก -->
        <g style="filter: url(#wcr)" opacity="0.92">
          <path v-for="s in segs" :key="s.id" :d="shape(s, BAR_H)" :fill="`url(#${uid}-${s.id})`" />
        </g>
      </svg>
    </div>

    <!-- ป้าย: ขีดบอกกลางช่วง + เวลา + อารมณ์ -->
    <div class="relative h-[64px]" :style="{ width: width + 'px' }">
      <div
        v-for="(s, i) in labelled"
        :key="'l' + s.id"
        data-ribbon-label
        class="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap leading-tight transition-opacity duration-450 ease-desk"
        :class="[lastHighlight(s) ? 'text-ink' : 'text-ink-2', labelsHidden && s === segs.at(-1) ? 'opacity-0' : 'opacity-100']"
        :style="{ left: s.cx + 'px' }"
      >
        <span class="mb-1 h-[7px] w-px bg-ink-soft"></span>
        <span class="inline-flex items-center gap-1 font-body text-14" :class="lastHighlight(s) ? 'font-semibold' : 'font-normal text-ink-soft'">
          <Doodle :name="s.icon" :size="14" /> {{ s.time }}
        </span>
        <span v-if="s.level === 2" class="mt-0.5 font-hand text-16" :class="lastHighlight(s) ? 'font-bold' : 'font-semibold'">{{ s.caption }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import Doodle from '@/components/ui/Doodle.vue'
import { BLEND_FRAC, jaggedOffsets, layoutRibbon, sweepPolygon } from '@/lib/dayRibbon'
import { MOTION } from '@/lib/tokens'
import { reducedMotion } from '@/lib/motion'
import { sound } from '@/lib/sound'

const props = defineProps({
  entries: { type: Array, required: true },
  highlightLast: { type: Boolean, default: false },
  animate: { type: String, default: 'none', validator: (v) => ['none', 'reveal', 'paintLast'].includes(v) },
  width: { type: Number, default: 360 },
  // เวลารอก่อนเริ่มปาด: paintLast ใช้ 500ms ตามแบบ reveal ใช้ค่านี้ (ให้ลำดับ stagger ของหน้าจานสีกำหนด)
  delay: { type: Number, default: 0 },
})

const HEIGHT = 84
const BAR_H = 46
const BACK_H = 64
const uid = useId()
const paintRef = ref(null)

const segs = computed(() => layoutRibbon(props.entries, props.width))
const labelled = computed(() => segs.value.filter((s) => s.level > 0))
const lastHighlight = (s) => props.highlightLast && s === segs.value.at(-1)
const aria = computed(() => segs.value.map((s) => `${s.time} ${s.caption}`).join(', '))

// รอยต่อซึม: แต่ละช่วงวาดกว้างออกไปครึ่งหนึ่งของรอยต่อทั้งสองข้าง ขอบในไล่โปร่งใส → ช่วงข้างเคียงซ้อนกันเป็นสีผสม
const blend = computed(() => props.width * BLEND_FRAC)
const edges = (s, i) => {
  const b = blend.value / 2
  return { x0: i === 0 ? s.x : s.x - b, x1: i === segs.value.length - 1 ? s.x + s.w : s.x + s.w + b }
}
const gradients = computed(() =>
  segs.value.map((s, i) => {
    const { x0, x1 } = edges(s, i)
    const span = x1 - x0
    const fade = (blend.value / span) * 1
    const first = i === 0
    const last = i === segs.value.length - 1
    const toColor = s.to ?? s.main
    // ช่วงที่มีแต้มแสง: สีหลักค้างครึ่งแรกแล้วไล่ไปสีแต้มแสง
    const stops = [
      { o: 0, c: s.main, a: first ? 1 : 0 },
      ...(first ? [] : [{ o: Math.min(fade, 0.45), c: s.main, a: 1 }]),
      ...(s.to ? [{ o: 0.5, c: s.main, a: 1 }, { o: last ? 1 : 1 - Math.min(fade, 0.45), c: toColor, a: 1 }] : [{ o: last ? 1 : 1 - Math.min(fade, 0.45), c: s.main, a: 1 }]),
      { o: 1, c: toColor, a: last ? 1 : 0 },
    ]
    return { id: s.id, x0, x1, stops }
  }),
)
// รูปทรงของช่วง: ปลายซ้ายสุด/ขวาสุดมนแบบปลายพู่กัน ด้านในเหลี่ยม (ถูกไล่ความโปร่งแสงกลืนกับช่วงข้างเคียง)
const shape = (s, h) => {
  const i = segs.value.indexOf(s)
  const { x0, x1 } = edges(s, i)
  const y0 = (HEIGHT - h) / 2
  const y1 = y0 + h
  const r = h / 2
  const first = i === 0
  const last = i === segs.value.length - 1
  const L = first ? `M${x0 + r} ${y0} A${r} ${r} 0 0 0 ${x0 + r} ${y1}` : `M${x0} ${y0} V${y1}`
  const R = last ? `H${x1 - r} A${r} ${r} 0 0 0 ${x1 - r} ${y0} Z` : `H${x1} V${y0} Z`
  return `${L} ${R}`
}

// ---- อนิเมชัน ----
const offsets = jaggedOffsets()
const labelsHidden = ref(false)
let anim = null
let timers = []

const startPaint = () => {
  const el = paintRef.value
  if (!el || props.animate === 'none' || !segs.value.length) return
  if (reducedMotion.value) {
    el.style.opacity = '0'
    anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.fade, delay: props.animate === 'paintLast' ? 0 : props.delay, fill: 'both' })
    anim.onfinish = () => {
      el.style.opacity = ''
      anim = null
    }
    return
  }
  const last = props.animate === 'paintLast'
  const amp = 8
  const from = last ? Math.max(0, edges(segs.value.at(-1), segs.value.length - 1).x0) - amp - 2 : -amp - 4
  const to = props.width + amp + 24
  const duration = last ? 1100 : 1000
  const delay = last ? 500 : props.delay
  el.style.clipPath = sweepPolygon(from, HEIGHT, offsets)
  if (last) labelsHidden.value = true
  anim = el.animate([{ clipPath: sweepPolygon(from, HEIGHT, offsets) }, { clipPath: sweepPolygon(to, HEIGHT, offsets) }], {
    duration,
    delay,
    easing: 'cubic-bezier(0.45, 0.1, 0.3, 1)',
    fill: 'both',
  })
  if (last) {
    timers.push(setTimeout(() => sound.stroke(duration), delay))
    timers.push(setTimeout(() => (labelsHidden.value = false), delay + duration * 0.7))
  }
  anim.onfinish = () => {
    el.style.clipPath = ''
    anim = null
  }
}

onMounted(startPaint)
onBeforeUnmount(() => {
  anim?.cancel()
  timers.forEach(clearTimeout)
})
</script>
