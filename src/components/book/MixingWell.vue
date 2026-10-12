<template>
  <!-- หลุมผสมสีกลม 200px: วางหยดสีที่ดูดได้จากทุกภาพของวัน ขนาดตามน้ำหนักรวม (SPEC §5.7) -->
  <svg width="200" height="200" viewBox="0 0 200 200" role="img" :aria-label="label">
    <defs>
      <clipPath :id="clipId"><circle cx="100" cy="100" r="76" /></clipPath>
    </defs>
    <ellipse cx="104" cy="108" rx="94" ry="92" fill="rgba(45, 43, 51, 0.10)" />
    <circle cx="100" cy="100" r="94" fill="#F1EEE8" stroke="#DCD6CC" stroke-width="2" />
    <circle cx="100" cy="100" r="78" fill="#FFFFFF" stroke="#E4DFD6" stroke-width="3" />
    <g :clip-path="`url(#${clipId})`">
      <g class="filter-wcm">
        <path v-for="(b, i) in blobs" :key="b.hex + i" :d="BLOB_PATHS.small" :transform="b.transform" :fill="b.hex" fill-opacity="0.58" />
        <path v-if="blobs.length" d="M40 130 C66 92 118 90 150 122" fill="none" :stroke="blobs[0].hex" stroke-opacity="0.35" stroke-width="12" stroke-linecap="round" />
      </g>
    </g>
    <ellipse cx="70" cy="52" rx="24" ry="9" transform="rotate(-32 70 52)" fill="#FFFFFF" fill-opacity="0.55" />
  </svg>
</template>

<script setup>
import { computed, useId } from 'vue'
import { BLOB_PATHS } from '@/lib/doodles'
import { wellBlobs } from '@/lib/mixingWell'

const props = defineProps({ entries: { type: Array, required: true } })

const clipId = useId()

const blobs = computed(() => wellBlobs(props.entries).map((b) => ({ hex: b.hex, transform: `translate(${b.x} ${b.y}) scale(${b.scale})` })))

const label = computed(() => `หลุมผสมสีของวัน มี ${blobs.value.length} สี`)
</script>
