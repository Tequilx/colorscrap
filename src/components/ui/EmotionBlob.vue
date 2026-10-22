<template>
  <!-- หยดสีอารมณ์พร้อมใบหน้า (SPEC §11.1) -->
  <svg :width="size" :height="size" viewBox="0 0 100 100" role="img" :aria-label="aria ? emotion.th : undefined" :aria-hidden="aria ? undefined : true">
    <g class="filter-wob">
      <path :d="EMOTION_BLOB_PATH" :fill="emotion.hex" fill-opacity="0.85" :stroke="PALETTE.ink" stroke-width="2.4" />
      <path :d="emotion.face.eyes" fill="none" :stroke="PALETTE.ink" :stroke-width="emotion.face.eyeW" stroke-linecap="round" />
      <path v-if="emotion.face.brows" :d="emotion.face.brows" fill="none" :stroke="PALETTE.ink" stroke-width="2.4" stroke-linecap="round" />
      <path
        :d="emotion.face.mouth"
        :fill="emotion.face.mouthFill === 'ink' ? PALETTE.ink : 'none'"
        :stroke="PALETTE.ink"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { EMOTION_BLOB_PATH } from '@/lib/doodles'
import { PALETTE } from '@/lib/tokens'

const props = defineProps({
  // key อารมณ์: happy, calm, excited, warm, sad, angry, anxious, tired
  name: { type: String, required: true },
  size: { type: Number, default: 88 },
  // true = อ่านชื่ออารมณ์ให้ screen reader (ใช้เมื่อไม่มีชื่อเขียนอยู่ข้าง ๆ)
  aria: { type: Boolean, default: false },
})

const emotion = computed(() => EMOTION_BY_KEY[props.name])
</script>
