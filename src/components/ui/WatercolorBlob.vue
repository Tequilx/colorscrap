<template>
  <!-- หยดสีน้ำภาพนิ่ง: large (วาดบนปก), small (ภาพย่อ/หลุมผสมสี), timeline (หยดบนเส้นเวลา) -->
  <svg :width="width" :height="height" :viewBox="viewBox" aria-hidden="true">
    <g :filter="`url(#${filterId})`">
      <!-- ขอบสีเดียวกับเนื้อสี อยู่ใน group filter เดียวกัน ให้ขอบเข้มแบบสีน้ำแห้ง -->
      <path :d="d" :fill="color" :fill-opacity="opacity" :stroke="color" :stroke-opacity="strokeOpacity" :stroke-width="kind === 'timeline' ? 1 : 2" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { BLOB_PATHS, timelineDrop } from '@/lib/doodles'

const props = defineProps({
  color: { type: String, required: true },
  kind: { type: String, default: 'small', validator: (v) => ['large', 'small', 'timeline'].includes(v) },
  width: { type: Number, default: 170 },
  height: { type: Number, default: 120 },
  opacity: { type: Number, default: 0.6 },
  strokeOpacity: { type: Number, default: 0.4 },
})

const FILTERS = { large: 'wc', small: 'wcm', timeline: 'wct' }
const VIEWBOXES = { large: '0 0 300 260', small: '0 0 170 120', timeline: '0 0 40 100' }

const filterId = computed(() => FILTERS[props.kind])
const viewBox = computed(() => VIEWBOXES[props.kind])
// timeline: วางฐานหยดกลาง viewBox ของตัวเอง (กว้าง 40) ตำแหน่งบนเส้นเวลาให้แม่เลื่อนด้วย CSS
const d = computed(() => (props.kind === 'timeline' ? timelineDrop(20) : BLOB_PATHS[props.kind]))
</script>
