<template>
  <!-- ทุกแท็บสูง 58px แท็บที่ไม่ได้เปิดเลื่อนลงซ่อนหลังปก 12px (animate เฉพาะ transform ไม่ animate height) -->
  <!-- แท็บคั่นหน้าที่ขอบบนของหน้าขวา ใช้วันที่เป็นป้าย สีแท็บคือสีเด่นของวันนั้น (SPEC §5.5) -->
  <nav aria-label="เลือกวันในสมุด" class="absolute left-[640px] top-[-38px] flex items-end gap-2">
    <button
      v-for="t in tabs"
      :key="t.date"
      type="button"
      :aria-current="t.date === current ? 'page' : undefined"
      class="box-border flex h-[58px] w-[84px] cursor-pointer items-start justify-center rounded-t-[10px] border-0 p-0 pt-2 font-hand text-14 transition-transform duration-450 ease-desk"
      :class="t.date === current ? 'font-bold' : 'font-semibold'"
      :style="{ background: t.hex, color: readableOn(t.hex), transform: t.date === current ? 'none' : 'translateY(12px)' }"
      @click="$emit('pick', t.date)"
    >
      {{ t.label }}
    </button>
  </nav>
</template>

<script setup>
import { readableOn } from '@/lib/color'

// tabs: [{ date, hex, label }] เก่า → ใหม่
defineProps({ tabs: { type: Array, required: true }, current: { type: String, default: null } })
defineEmits(['pick'])
</script>
