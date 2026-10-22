<template>
  <!-- แถบสีของวัน: รอยพู่กันแนวนอนเส้นเดียว ภาพที่อยู่ติดกัน อารมณ์เดียวกัน รวมเป็นช่วงเดียว กว้าง ∝ น้ำหนัก รอยต่อซึมเข้าหากัน
       วาด 3 ชั้น (ไม่มีชั้นอื่น): ฮาโลจางซึมออก (ฟิลเตอร์ -fh) → ตัวแถบเป็นรอยพู่กัน (ฟิลเตอร์ -fm) ฟิลเตอร์อยู่ใน <defs> ของ SVG นี้เอง → เกรนกระดาษบาง ๆ gradient เส้นเดียวตลอดแถบ ช่วงละไม่เกิน 2 สีไล่นุ่ม ๆ
       ป้ายเวลา + อารมณ์ใต้กลางช่วง ป้ายที่ชนกันเยื้องเป็นแถวล่างแทนการซ่อน (ซ่อนเฉพาะช่วงที่แคบกว่า 40px) lib/dayRibbon.js
       animate: 'none' | 'reveal' (ไล่จากซ้ายไปขวา) | 'paintLast' (ปาดเฉพาะช่วงสุดท้าย) ขอบนำสั่นแบบรอยพู่กัน (clip-path polygon เคลื่อนด้วย WAAPI)
       reduced-motion: ไม่ปาด จางเข้า 150ms -->
  <div class="relative" :style="{ width: width + 'px' }" role="img" :aria-label="aria">
    <div ref="paintRef" class="relative" :style="{ width: width + 'px', height: HEIGHT + 'px' }">
      <!-- รอยพู่กัน 3 ชั้น (ฮาโล → ตัวแถบ → เกรน) ฟิลเตอร์/gradient อยู่ใน defs ของ svg นี้เอง markup มาจาก lib/dayRibbon.js ตัวเดียวกับการ์ดเก็บรูป -->
      <svg :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`" style="overflow: visible" aria-hidden="true" v-html="markup"></svg>
    </div>

    <!-- ป้าย: ขีดบอกกลางช่วง + เวลา + อารมณ์ (เยื้องเป็นแถวเมื่อชนกัน) -->
    <div class="relative" :style="{ width: width + 'px', height: labelsH + 'px' }">
      <template v-for="s in labelled" :key="'l' + s.id">
        <span
          data-ribbon-tick
          class="absolute w-px bg-ink-soft transition-opacity duration-450 ease-desk"
          :class="hiddenLabel(s) ? 'opacity-0' : 'opacity-100'"
          :style="{ left: s.cx + 'px', top: '0px', height: s.box.y0 + 'px' }"
        ></span>
        <div
          data-ribbon-label
          class="absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap leading-tight transition-opacity duration-450 ease-desk"
          :class="[lastHighlight(s) ? 'text-ink' : 'text-ink-2', hiddenLabel(s) ? 'opacity-0' : 'opacity-100']"
          :style="{ left: (s.box.x0 + s.box.x1) / 2 + 'px', top: s.box.y0 + 'px' }"
        >
          <span class="inline-flex items-center gap-1 font-body text-14" :class="lastHighlight(s) ? 'font-semibold' : 'font-normal text-ink-soft'">
            <Doodle :name="s.icon" :size="14" /> {{ s.time }}
          </span>
          <span v-if="s.level === 2" class="mt-0.5 font-hand text-15" :class="lastHighlight(s) ? 'font-bold' : 'font-semibold'">{{ s.caption }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import Doodle from '@/components/ui/Doodle.vue'
import { BLEND_FRAC, RIBBON_H, jaggedOffsets, labelsHeight, layoutRibbon, ribbonSvgMarkup, sweepPolygon } from '@/lib/dayRibbon'
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

const HEIGHT = RIBBON_H
const uid = `rb${useId().replace(/[^\w]/g, '')}`
const paintRef = ref(null)

const segs = computed(() => layoutRibbon(props.entries, props.width))
const labelled = computed(() => segs.value.filter((s) => s.level > 0))
const markup = computed(() => ribbonSvgMarkup(segs.value, props.width, uid))
const labelsH = computed(() => labelsHeight(segs.value))
const lastHighlight = (s) => props.highlightLast && s === segs.value.at(-1)
const aria = computed(() => segs.value.map((s) => `${s.time} ${s.caption}`).join(', '))

// ---- อนิเมชัน ----
const offsets = jaggedOffsets()
const labelsHidden = ref(false) // paintLast: ป้ายช่วงสุดท้ายรอให้การปาดผ่านก่อน
const labelsAllHidden = ref(false) // reveal: ป้ายทั้งหมดรอให้แถบไล่ผ่านไปก่อนค่อยจางเข้า
const hiddenLabel = (s) => labelsAllHidden.value || (labelsHidden.value && s === segs.value.at(-1))
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
  const lastSeg = segs.value.at(-1)
  const from = last ? Math.max(0, lastSeg.x - props.width * BLEND_FRAC * 0.5) - amp - 6 : -amp - 12
  const to = props.width + amp + 24
  const duration = last ? 1100 : 1000
  const delay = last ? 500 : props.delay
  el.style.clipPath = sweepPolygon(from, HEIGHT, offsets)
  if (last) labelsHidden.value = true
  else labelsAllHidden.value = true
  anim = el.animate([{ clipPath: sweepPolygon(from, HEIGHT, offsets) }, { clipPath: sweepPolygon(to, HEIGHT, offsets) }], {
    duration,
    delay,
    easing: 'cubic-bezier(0.45, 0.1, 0.3, 1)',
    fill: 'both',
  })
  if (!last) timers.push(setTimeout(() => (labelsAllHidden.value = false), delay + duration * 0.55))
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
