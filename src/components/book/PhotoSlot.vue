<template>
  <!-- โพลารอยด์หนึ่งใบในตำแหน่ง slot: มุมเอียงสุ่มจาก entry.id ให้ผลเหมือนเดิมทุกครั้ง -->
  <div class="absolute" :style="{ left: slotPos.x + 'px', top: slotPos.y + 'px' }">
    <!-- ปุ่มโปร่งใสทับโพลารอยด์ เปิดดูภาพเดี่ยว (figure อยู่ใน button ไม่ได้) -->
    <button v-if="interactive" type="button" class="absolute inset-0 z-10 cursor-zoom-in border-0 bg-transparent p-0" :aria-label="`ดูภาพ ${caption} ขยาย`" @click="$emit('open', entry.id)"></button>
    <Polaroid
      :caption="caption"
      :alt="`ภาพสีน้ำ ${emotion.th}`"
      :src="thumbUrl"
      :colors="entry.colors.slice(0, 2).map((c) => c.hex)"
      :palette="entry.colors"
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
import { EMOTION_BY_KEY, emotionLabel } from '@/lib/emotions'
import { photoRotation } from '@/lib/photos'
import { useBlobUrl } from '@/lib/useBlobUrl'

const props = defineProps({
  entry: { type: Object, required: true },
  slotPos: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
})

defineEmits(['open'])

const emotion = computed(() => EMOTION_BY_KEY[props.entry.emotion])
// โพลารอยด์ในสมุดใช้ thumb (ไม่มี = mock แสดงหยดสีจำลอง)
const thumbUrl = useBlobUrl(() => props.entry.thumb)
const rot = computed(() => photoRotation(props.entry.id))
// "{HH:mm} · {อารมณ์}" และต่อท้าย " → อุ่นขึ้น" ถ้าถูกปรับโทน (SPEC §5.5)
const caption = computed(() => `${props.entry.local_time} · ${emotionLabel(props.entry)}${props.entry.shifted ? ' → อุ่นขึ้น' : ''}`)
</script>
