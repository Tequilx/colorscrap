<template>
  <!-- เทปกาวขอบหยัก: วางด้วย absolute จากคอมโพเนนต์แม่ ปรับตำแหน่งผ่าน class -->
  <span
    class="pointer-events-none absolute block bg-tape"
    :class="long ? 'h-[26px] w-[100px]' : 'h-[22px] w-[80px]'"
    :style="{ transform: `rotate(${rotate}deg)`, clipPath: CLIP }"
    aria-hidden="true"
  >
    <slot />
  </span>
</template>

<script setup>
defineProps({
  // เทปยาว 2 ความยาว (SPEC §9.2)
  long: { type: Boolean, default: false },
  rotate: { type: Number, default: -3 },
})

const CLIP =
  'polygon(0 8%,6% 0,12% 10%,20% 2%,30% 8%,42% 0,55% 9%,66% 1%,78% 8%,88% 0,100% 7%,98% 92%,90% 100%,80% 91%,68% 100%,56% 92%,44% 100%,32% 91%,20% 100%,10% 92%,2% 100%)'
</script>
