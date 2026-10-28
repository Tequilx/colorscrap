<template>
  <!-- รูปที่ไม่กะพริบ: รูปที่พร้อมแล้วตอนติดตั้ง (หรือโหลดเสร็จเร็วกว่า FAST_MS) แสดงทันทีไม่เฟด · รูปที่ยังไม่พร้อม แสดงพื้นกระดาษของกรอบก่อน (opacity 0) แล้ว decode เสร็จค่อย opacity 0→1 200 ms ease-out
       เปลี่ยน src ภายหลัง (เช่น ภาพย่อ → ภาพเต็ม) ไม่เฟดซ้ำ reduced-motion: ไม่เฟด (ปรากฏทันทีเมื่อพร้อม) -->
  <img ref="el" :src="src" :alt="alt" draggable="false" :class="[cls, pending ? 'opacity-0' : 'opacity-100', fading ? 'reveal-fade' : '']" @load="onLoad" @error="pending = false" />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { reducedMotion } from '@/lib/motion'

const FAST_MS = 50 // โหลด+decode เสร็จภายในเท่านี้ (รูปในเครื่อง/แคช) ถือว่าพร้อม ไม่เฟด

defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  cls: { type: [String, Array, Object], default: '' },
})

const el = ref(null)
const pending = ref(false)
const fading = ref(false)
let t0 = 0

onMounted(() => {
  const i = el.value
  if (i && !(i.complete && i.naturalWidth)) {
    pending.value = true
    t0 = performance.now()
  }
})

const onLoad = () => {
  if (!pending.value) return
  const i = el.value
  const show = () => {
    fading.value = !reducedMotion.value && performance.now() - t0 > FAST_MS
    pending.value = false
  }
  ;(i?.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(show)
}
</script>
