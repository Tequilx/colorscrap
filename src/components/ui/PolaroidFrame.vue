<template>
  <!-- กรอบโพลารอยด์ขาว (ขอบขาว + เงาบาง shadow-photo) ใช้ร่วมกันระหว่างภาพในสมุด (Polaroid) และกรอบ "สีของวัน" ขนาด/ขอบ/เทปให้ผู้ใช้กำหนดเองผ่าน class + slot -->
  <figure class="relative m-0 box-border bg-white shadow-photo" :style="{ transform: `rotate(${rotate}deg)` }">
    <slot />
  </figure>
</template>

<script setup>
defineProps({ rotate: { type: Number, default: 0 } })
</script>
