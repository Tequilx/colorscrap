<template>
  <!-- หยดน้ำไล่สีเหลือง→พีช ไอคอนของเครื่องมือ "สีอุ่น" และโน้ตชวน (gradient `warmGrad` อยู่ใน SvgDefs.vue) -->
  <svg :width="note ? 30 : size" :height="note ? 36 : size" :viewBox="note ? '0 0 24 28' : '0 0 24 24'" aria-hidden="true">
    <path
      :d="note ? NOTE_D : ICONS.drop.d"
      fill="url(#warmGrad)"
      stroke="currentColor"
      :stroke-width="note ? 1.8 : 2"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup>
import { ICONS } from '@/lib/doodles'

defineProps({
  size: { type: Number, default: 24 },
  // ขนาดใหญ่ของโน้ตชวน (30×36)
  note: { type: Boolean, default: false },
})

const NOTE_D = 'M12 2 C12 2 3.5 12 3.5 17.5 A8.5 8.5 0 0 0 20.5 17.5 C20.5 12 12 2 12 2 Z'
</script>
