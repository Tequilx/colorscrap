<template>
  <!-- ภาพตัวแทน (avatar) หรือไอคอนเส้น เลือกด้วย name -->
  <svg
    :width="size"
    :height="size"
    :viewBox="avatar ? '0 0 48 48' : '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g :class="{ 'filter-wob': wobble }">
      <path :d="d" />
      <circle v-for="(c, i) in circles" :key="i" :cx="c.cx" :cy="c.cy" :r="c.r" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { AVATAR_BY_KEY, ICONS } from '@/lib/doodles'

const props = defineProps({
  // ชื่อ avatar (cat, plant, ...) หรือไอคอน (back, forward, book, check, plus, settings, smear, drop, restart)
  name: { type: String, required: true },
  size: { type: Number, default: 24 },
  // ใส่ filter wob (ห้ามใช้กับของที่ขยับตลอด)
  wobble: { type: Boolean, default: false },
})

const avatar = computed(() => AVATAR_BY_KEY[props.name] ?? null)
const icon = computed(() => ICONS[props.name] ?? null)
const d = computed(() => avatar.value?.path ?? icon.value?.d ?? '')
const circles = computed(() => icon.value?.circles ?? [])
</script>
