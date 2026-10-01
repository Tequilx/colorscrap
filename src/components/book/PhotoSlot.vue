<template>
  <!-- โพลารอยด์หนึ่งใบในตำแหน่ง slot: มุมเอียงสุ่มจาก entry.id ให้ผลเหมือนเดิมทุกครั้ง -->
  <div class="absolute" :style="{ left: slotPos.x + 'px', top: slotPos.y + 'px' }">
    <Polaroid
      :caption="caption"
      :alt="`ภาพสีน้ำ ${emotion.th}`"
      :colors="entry.colors.slice(0, 2).map((c) => c.hex)"
      :rotate="rot.rotate"
      :tape-rotate="rot.tape"
      :badge="isNew ? 'ใหม่' : ''"
      :class="isNew ? '!shadow-[0_26px_34px_rgba(45,43,51,0.32)]' : ''"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Polaroid from '@/components/ui/Polaroid.vue'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { photoRotation } from '@/lib/photos'

const props = defineProps({
  entry: { type: Object, required: true },
  slotPos: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
})

const emotion = computed(() => EMOTION_BY_KEY[props.entry.emotion])
const rot = computed(() => photoRotation(props.entry.id))
// "{HH:mm} · {อารมณ์}" และต่อท้าย " → อุ่นขึ้น" ถ้าถูกปรับโทน (SPEC §5.5)
const caption = computed(() => `${props.entry.local_time} · ${emotion.value.th}${props.entry.shifted ? ' → อุ่นขึ้น' : ''}`)
</script>
