<template>
  <!-- แถบสีแบ่งช่องกว้างตาม ratio ของสีที่ดูดได้จากภาพ (SPEC §5.5) -->
  <div class="flex w-full overflow-hidden" :class="rounded" :style="{ height: height + 'px' }" role="img" :aria-label="label">
    <span v-for="c in colors" :key="c.hex" class="block h-full" :style="{ background: c.hex, flexGrow: c.ratio, flexBasis: 0 }"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { hueGroup, percentsOf } from '@/lib/palette'

const props = defineProps({
  colors: { type: Array, required: true }, // [{ hex, ratio }]
  height: { type: Number, default: 8 },
  rounded: { type: String, default: 'rounded-[3px]' },
})

// aria-label บอกสีกับเปอร์เซ็นต์ทุกสี เช่น "สีในภาพ: ฟ้า 55%, เทา 25%"
const label = computed(() => {
  const pct = percentsOf(props.colors)
  return 'สีในภาพ: ' + props.colors.map((c, i) => `${hueGroup(c.hex)} ${pct[i]}%`).join(', ')
})
</script>
