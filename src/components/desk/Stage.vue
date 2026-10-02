<template>
  <!-- พื้นโต๊ะเต็มจอ พร้อมผิวกระดาษซ้ำเป็นภาพเดียว -->
  <div class="relative h-full w-full overflow-hidden bg-desk" :style="{ backgroundImage: grain }">
    <!-- stage ขนาดคงที่ 1280×800 ย่อ/ขยายทั้งก้อน วางกึ่งกลาง (SPEC §4.2) -->
    <div
      ref="stageRef"
      data-stage
      class="absolute left-1/2 top-1/2 overflow-hidden"
      :style="{
        width: STAGE.width + 'px',
        height: STAGE.height + 'px',
        transform: `translate(-50%, -50%) scale(${scale})`,
      }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { STAGE } from '@/lib/tokens'

const stageRef = ref(null)
const scale = ref(1)

// ผิวกระดาษ: SVG noise เป็น data URI ใช้เป็น background ซ้ำ (เบากว่า filter ทับทั้งโต๊ะบน iPad Safari)
const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const fit = () => {
  scale.value = Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height)
}

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
})

onBeforeUnmount(() => window.removeEventListener('resize', fit))

// ให้คอมโพเนนต์ลูก (เช่น ผ้าใบ) ใช้แปลงพิกัดกลับตามค่า scale ได้
defineExpose({ scale, stageRef })
</script>
