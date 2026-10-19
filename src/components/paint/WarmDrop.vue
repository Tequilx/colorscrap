<template>
  <!-- หยดน้ำสีอุ่นของอารมณ์ปัจจุบัน ไอคอนของเครื่องมือ "สีอุ่น" และโน้ตชวน สีเดียวกับที่หยดจริงบนผ้าใบ (WARM_TONES) -->
  <svg :width="note ? 30 : size" :height="note ? 36 : size" :viewBox="note ? '0 0 24 28' : '0 0 24 24'" aria-hidden="true">
    <path
      :d="note ? NOTE_D : ICONS.drop.d"
      :fill="tone"
      stroke="currentColor"
      :stroke-width="note ? 1.8 : 2"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { ICONS } from '@/lib/doodles'
import { WARM_TONES } from '@/lib/emotions'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  size: { type: Number, default: 24 },
  // ขนาดใหญ่ของโน้ตชวน (30×36)
  note: { type: Boolean, default: false },
})

const app = useAppStore()
// ใช้อารมณ์ล่าสุดของแผ่น (เครื่องมือสีอุ่นมีเฉพาะอารมณ์ลบ) ไม่มีค่าให้ใช้สีเหลืองทองกลาง ๆ
const tone = computed(() => WARM_TONES[app.selection.emotion] ?? WARM_TONES.sad)

const NOTE_D = 'M12 2 C12 2 3.5 12 3.5 17.5 A8.5 8.5 0 0 0 20.5 17.5 C20.5 12 12 2 12 2 Z'
</script>
