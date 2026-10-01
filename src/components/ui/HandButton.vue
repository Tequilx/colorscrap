<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href || undefined"
    :type="href ? undefined : 'button'"
    :aria-pressed="pressed === null ? undefined : String(pressed)"
    class="relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap no-underline transition-transform duration-450 ease-desk disabled:cursor-not-allowed disabled:opacity-40"
    :class="[sizes, textColor, tilt ? 'hover:-rotate-[6deg] hover:scale-105' : '']"
  >
    <!-- กรอบทรงลายมือเป็น element แยก ใส่ filter wob ที่กรอบเท่านั้น ตัวหนังสือไม่โดน (SPEC §3.5) -->
    <span class="pointer-events-none absolute inset-0 -z-0" :class="[frame, frameFilter ? 'filter-wob' : '']" aria-hidden="true"></span>
    <span class="relative z-10 inline-flex items-center gap-2.5"><slot /></span>
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // primary: พื้น ink ตัวหนังสือ paper | secondary: พื้นโปร่ง ขอบ ink | chip: แคปซูล
  variant: { type: String, default: 'primary', validator: (v) => ['primary', 'secondary', 'chip'].includes(v) },
  href: { type: String, default: '' },
  // ใช้กับชิปและปุ่มเลือก: null = ปุ่มธรรมดา
  pressed: { type: Boolean, default: null },
  // hover แล้วหมุน -6° ขยาย 1.05 (ปุ่มอารมณ์)
  tilt: { type: Boolean, default: false },
})

const sizes = computed(
  () =>
    ({
      primary: 'min-h-[58px] px-8 font-hand text-19 font-semibold',
      secondary: 'min-h-[48px] px-[18px] font-hand text-17 font-semibold',
      chip: 'min-h-[44px] px-4 font-body text-15 font-medium',
    })[props.variant],
)

const isOn = computed(() => props.variant === 'primary' || props.pressed === true)

const textColor = computed(() => (isOn.value ? 'text-paper' : 'text-ink'))

const frame = computed(() => {
  const radius = props.variant === 'chip' ? 'rounded-chip' : 'rounded-hand'
  return `${radius} border-2 border-ink ${isOn.value ? 'bg-ink' : 'bg-transparent'}`
})

// ชิปเล็กไม่ใส่ wob เพื่อลดงานของ filter
const frameFilter = computed(() => props.variant !== 'chip')
</script>
