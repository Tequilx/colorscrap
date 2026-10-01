<template>
  <!-- การ์ดอารมณ์ที่เลือก (แทนพื้นที่ภาพจากกล้อง) ซ้อนทับขอบขวาของกระดาษ — SPEC §5.3 -->
  <div class="absolute left-[1000px] top-[124px] box-border flex w-[228px] rotate-[1.5deg] flex-col gap-2.5 bg-paper px-3 pb-4 pt-3 shadow-[0_6px_16px_rgba(45,43,51,0.18)]">
    <Tape class="left-[72px] top-[-12px]" :rotate="-4" />
    <div class="flex h-[136px] items-center justify-center" :style="{ background: emotion.hex + '2E' }">
      <EmotionBlob :name="emotion.key" :size="96" />
    </div>
    <div class="flex items-baseline justify-between gap-2">
      <span class="font-hand text-[20px] font-semibold">{{ emotion.th }}</span>
      <span class="text-13 text-ink-soft">{{ INTENSITY_LABELS[app.selection.intensity] }}</span>
    </div>
    <div class="flex flex-col gap-1.5 border-t-[1.5px] border-dashed border-line pt-2.5 text-14 leading-[1.5] text-ink-2">
      <span>ลากนิ้วเพื่อปาดและกวนสี</span>
      <span>แตะค้างเพื่อเติมหยดสี</span>
    </div>
    <button type="button" class="inline-flex min-h-[32px] cursor-pointer items-center self-start border-0 bg-transparent p-0 font-hand text-15 font-semibold text-ink underline underline-offset-4" @click="app.go('pick')">เปลี่ยนสี</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Tape from '@/components/ui/Tape.vue'
import EmotionBlob from '@/components/ui/EmotionBlob.vue'
import { EMOTION_BY_KEY, INTENSITY_LABELS } from '@/lib/emotions'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const emotion = computed(() => EMOTION_BY_KEY[app.selection.emotion])
</script>
