<template>
  <!-- โลโก้ ColorScrap (รูปจาก lib/brand.js ที่เดียว) word = แสดงชื่อต่อท้าย -->
  <span class="inline-flex items-center gap-2" role="img" :aria-label="BRAND_NAME">
    <svg class="shrink-0" :width="size" :height="size" :viewBox="BRAND_VIEWBOX" aria-hidden="true" v-html="inner"></svg>
    <span v-if="word" class="font-hand font-semibold leading-none" :style="{ fontSize: size * 0.8 + 'px' }">{{ BRAND_NAME }}</span>
  </span>
</template>

<script setup>
import { useId } from 'vue'
import { BRAND_NAME, BRAND_VIEWBOX, brandMarkInner } from '@/lib/brand'

defineProps({
  size: { type: Number, default: 32 },
  word: { type: Boolean, default: false },
})
const inner = brandMarkInner(`bm${useId().replace(/[^\w]/g, '')}`)
</script>
