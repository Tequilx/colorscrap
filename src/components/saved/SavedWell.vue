<template>
  <!-- บ่อผสมสีของวันในการ์ดหลังบันทึก (แยกเป็นคอมโพเนนต์ให้ย้ายไปใช้ที่อื่นได้ ขนาด/เลย์เอาต์เท่าเดิม 272×125)
       เล่นครั้งเดียวหลังขึ้นการ์ด: หยดสีของภาพใหม่ตกลงบ่อ → วงน้ำกระเพื่อม 3 วง → สีในบ่อค่อย ๆ ผสมจากสีเดิมของวันเป็นสีใหม่ ~1.2 วิ
       เลื่อนเฉพาะ transform/opacity เท่านั้น reduced-motion: ไม่มีหยดตก/วงน้ำ มีแค่สีจางเปลี่ยน (ช่วงเวลาถูกจำกัดโดย app.css) -->
  <svg width="272" height="125" viewBox="0 0 340 156" role="img" :aria-label="`หยดสี${emotion.th}กำลังตกลงในหลุมผสมสีของวันนี้`">
    <defs>
      <clipPath :id="wellClip"><circle cx="170" cy="96" r="44" /></clipPath>
    </defs>

    <!-- หยดที่กำลังจะตก (ตกแล้วถูกดูดเข้าบ่อ) -->
    <g class="drop-group" :class="{ falling: phase >= 1, gone: phase >= 2 }">
      <path d="M170 6 C170 6 160 20 160 27 A10 10 0 0 0 180 27 C180 20 170 6 170 6 Z" :fill="dropHex" class="stroke-ink" stroke-width="1.6" />
      <path d="M150 12 V30 M190 16 V34" class="motion-lines stroke-line" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="3 5" :class="{ hidden: phase >= 1 }" />
    </g>

    <ellipse cx="173" cy="102" rx="58" ry="56" fill="rgba(45, 43, 51, 0.10)" />
    <circle cx="170" cy="96" r="56" fill="#F1EEE8" stroke="#DCD6CC" stroke-width="2" />
    <circle cx="170" cy="96" r="45" fill="#FFFFFF" stroke="#E4DFD6" stroke-width="2.5" />

    <g :clip-path="`url(#${wellClip})`">
      <!-- สีเดิมของวัน (ก่อนภาพนี้) จางออก / สีของวันหลังรวมภาพนี้จางเข้า -->
      <g class="layer" :class="{ off: mixing }">
        <g class="filter-wcm">
          <path v-for="(g, i) in beforeGroups" :key="'b' + i" :d="BLOB_PATHS.small" :transform="SPOTS[i]" :fill="g.hex" fill-opacity="0.58" />
        </g>
      </g>
      <g class="layer after" :class="{ on: mixing }">
        <g class="filter-wcm">
          <path v-for="(g, i) in afterGroups" :key="'a' + i" :d="BLOB_PATHS.small" :transform="SPOTS[i]" :fill="g.hex" fill-opacity="0.58" />
        </g>
      </g>
      <!-- วงน้ำกระเพื่อมจากจุดที่หยดตก (อยู่ในบ่อเท่านั้น) -->
      <circle v-for="k in 3" v-show="rippling" :key="'r' + k" class="ripple" cx="170" cy="82" r="10" fill="none" :stroke="dropHex" stroke-width="2" :style="{ animationDelay: (k - 1) * 140 + 'ms' }" />
    </g>

    <!-- วงคลื่นนิ่ง (ภาพเดิมของการ์ด) แสดงเมื่อไม่มีอนิเมชันหยดตก (reduced-motion) -->
    <g v-if="calm" aria-hidden="true">
      <circle cx="170" cy="78" r="10" fill="none" :stroke="dropHex" stroke-width="2" />
      <circle cx="170" cy="78" r="18" fill="none" :stroke="dropHex" stroke-opacity="0.45" stroke-width="1.6" />
    </g>
  </svg>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { BLOB_PATHS } from '@/lib/doodles'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { colorWeightsOfDay } from '@/lib/palette'
import { reducedMotion } from '@/lib/motion'
import { sound } from '@/lib/sound'

const props = defineProps({
  // ภาพที่เพิ่งบันทึก (ใช้สีและอารมณ์ของหยด)
  entry: { type: Object, required: true },
  // ภาพของวันนี้ก่อนภาพนี้ / ทุกภาพของวันนี้รวมภาพนี้
  before: { type: Array, default: () => [] },
  day: { type: Array, required: true },
  // เล่นอนิเมชันเองหลัง mount (ปิดได้เมื่อจะควบคุมจากข้างนอก)
  autoplay: { type: Boolean, default: true },
})

const wellClip = useId()
const emotion = computed(() => EMOTION_BY_KEY[props.entry.emotion])
const dropHex = computed(() => props.entry.colors[0].hex)

// หยดในหลุมเล็ก (รัศมี 44): ตำแหน่งตายตัว 3 จุด ตามสีที่หนักที่สุดของวัน
const SPOTS = ['translate(98 44) scale(0.75)', 'translate(142 52) scale(0.5)', 'translate(150 90) scale(0.3)']
const beforeGroups = computed(() => colorWeightsOfDay(props.before).slice(0, 3))
const afterGroups = computed(() => colorWeightsOfDay(props.day).slice(0, 3))

const calm = computed(() => reducedMotion.value)
// phase 0 = นิ่ง, 1 = หยดกำลังตก, 2 = ถึงผิวน้ำแล้ว (วงน้ำ + เริ่มผสม)
const phase = ref(0)
const mixing = ref(false)
const rippling = ref(false)

const START_MS = 350 // รอให้การ์ดขึ้นเสร็จก่อน (card 300ms)
const FALL_MS = 380 // ต้องตรงกับ transition ของ .falling
const timers = []
const at = (t, fn) => timers.push(setTimeout(fn, t))

const play = () => {
  if (calm.value) {
    at(START_MS, () => (mixing.value = true)) // ไม่มีหยดตก/วงน้ำ: สีจางเปลี่ยนอย่างเดียว
    return
  }
  at(START_MS, () => (phase.value = 1))
  at(START_MS + FALL_MS, () => {
    phase.value = 2
    rippling.value = true
    mixing.value = true
    sound.drop(props.entry.emotion, { strength: 0.6, size: 1.3 })
  })
}

onMounted(() => {
  if (props.autoplay) play()
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
defineExpose({ play })
</script>

<style scoped>
.drop-group {
  transition:
    transform 380ms cubic-bezier(0.55, 0, 1, 0.7),
    opacity 140ms linear 380ms;
}
.drop-group.falling {
  transform: translateY(41px);
}
.drop-group.gone {
  opacity: 0;
}
.motion-lines {
  transition: opacity 150ms linear;
}
.motion-lines.hidden {
  opacity: 0;
}
.layer {
  opacity: 1;
  transition: opacity 1200ms ease-in-out;
}
.layer.off {
  opacity: 0;
}
.layer.after {
  opacity: 0;
}
.layer.after.on {
  opacity: 1;
}
.ripple {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: well-ripple 1000ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
@keyframes well-ripple {
  from {
    opacity: 0.8;
    transform: scale(0.3);
  }
  to {
    opacity: 0;
    transform: scale(3.6);
  }
}
</style>
