<template>
  <!-- ช่องเส้นประที่รอภาพ (ภาพใหม่ลอยลงมาตรงนี้ SPEC §5.4) -->
  <div class="absolute box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-faint p-4 text-center font-hand text-15 text-mute" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
    ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้
  </div>
</template>

<script setup>
defineProps({ pos: { type: Object, required: true } })
</script>
