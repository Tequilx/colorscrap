<template>
  <!-- โพลารอยด์หนึ่งใบในตำแหน่ง slot: มุมเอียงสุ่มจาก entry.id ให้ผลเหมือนเดิมทุกครั้ง -->
  <div ref="root" class="absolute" :class="app.photoHiddenId === entry.id ? 'invisible' : ''" :data-entry-id="entry.id" :style="{ left: slotPos.x + 'px', top: slotPos.y + 'px' }">
    <!-- ปุ่มโปร่งใสทับโพลารอยด์ เปิดดูภาพเดี่ยว (figure อยู่ใน button ไม่ได้) -->
    <button v-if="interactive" type="button" class="absolute inset-0 z-10 cursor-zoom-in border-0 bg-transparent p-0" :aria-label="`ดูภาพ ${caption} ขยาย`" @click="open"></button>
    <Polaroid
      :caption="caption"
      :alt="`ภาพสีน้ำ ${emotion.th}`"
      :src="thumbUrl"
      :colors="entry.colors.slice(0, 2).map((c) => c.hex)"
      :palette="entry.colors"
      :rotate="rot.rotate"
      :tape-rotate="rot.tape"
      :badge="isNew ? 'ใหม่' : ''"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Polaroid from '@/components/ui/Polaroid.vue'
import { EMOTION_BY_KEY, emotionLabel } from '@/lib/emotions'
import { photoRotation } from '@/lib/photos'
import { useEntryImage } from '@/lib/useEntryImage'
import { centerInStage } from '@/lib/flip'
import { useAppStore } from '@/stores/app'

const props = defineProps({
  entry: { type: Object, required: true },
  slotPos: { type: Object, required: true },
  isNew: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])

const app = useAppStore()
const root = ref(null)

// ส่งตำแหน่งจริงของภาพในสมุดไปด้วย ให้หน้า photo บินออกมาจากตรงนี้ (SPEC §5.8)
const open = () => {
  const center = root.value && centerInStage(root.value.querySelector('figure'))
  emit('open', { id: props.entry.id, origin: center ? { ...center, rotate: rot.value.rotate } : null })
}

const emotion = computed(() => EMOTION_BY_KEY[props.entry.emotion])
// โพลารอยด์ในสมุดใช้ thumb (ไม่มี = mock แสดงหยดสีจำลอง)
const thumbUrl = useEntryImage(() => props.entry, 'thumb')
const rot = computed(() => photoRotation(props.entry.id))
// "{HH:mm} · {อารมณ์}" และต่อท้าย " → อุ่นขึ้น" ถ้าถูกปรับโทน (SPEC §5.5)
const caption = computed(() => `${props.entry.local_time} · ${emotionLabel(props.entry)}${props.entry.shifted ? ' → อุ่นขึ้น' : ''}`)
</script>
