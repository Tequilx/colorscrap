<template>
  <!-- ทุกแท็บสูง 58px แท็บที่ไม่ได้เปิดเลื่อนลงซ่อนหลังปก 12px (animate เฉพาะ transform ไม่ animate height) -->
  <!-- แท็บคั่นหน้าที่ขอบบนของหน้าขวา ใช้วันที่เป็นป้าย สีแท็บคือสีเด่นของวันนั้น (SPEC §5.5) -->
  <nav aria-label="เลือกวันในสมุด" class="absolute left-[560px] top-[-38px] flex items-end gap-2">
    <button
      v-for="t in tabs"
      :key="t.date"
      type="button"
      :aria-current="t.date === current ? 'page' : undefined"
      class="relative box-border flex h-[58px] w-[84px] before:absolute before:inset-x-0 before:-top-[18px] before:h-[18px] before:content-[''] cursor-pointer items-start justify-center rounded-t-[10px] border-0 p-0 pt-2 font-hand text-14 transition-transform duration-450 ease-desk"
      :class="t.date === current ? 'font-bold' : 'font-semibold'"
      :style="{ background: t.hex, color: readableOn(t.hex), transform: t.date === current ? 'none' : 'translateY(12px)' }"
      @click="$emit('pick', t.date)"
    >
      {{ t.label }}
    </button>
    <!-- แท็บปฏิทิน (ต่อท้ายแท็บวัน) เปิดปฏิทินเลือกวันที่มีภาพ -->
    <button
      type="button"
      data-cal-tab
      aria-haspopup="dialog"
      :aria-expanded="calendarOpen"
      class="relative box-border flex h-[58px] w-[84px] before:absolute before:inset-x-0 before:-top-[18px] before:h-[18px] before:content-[''] cursor-pointer items-start justify-center gap-1 rounded-t-[10px] border-0 bg-well p-0 pt-2 font-hand text-14 font-semibold text-ink transition-transform duration-450 ease-desk"
      :style="{ transform: calendarOpen ? 'none' : 'translateY(12px)' }"
      @click="$emit('calendar')"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mt-[3px]"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7" /></svg>
      ปฏิทิน
    </button>
  </nav>
</template>

<script setup>
import { readableOn } from '@/lib/color'

// tabs: [{ date, hex, label }] เก่า → ใหม่
defineProps({ tabs: { type: Array, required: true }, current: { type: String, default: null }, calendarOpen: { type: Boolean, default: false } })
defineEmits(['pick', 'calendar'])
</script>
