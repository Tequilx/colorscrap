<template>
  <!-- การ์ดอารมณ์ที่เลือก (แทนพื้นที่ภาพจากกล้อง) ซ้อนทับขอบขวาของกระดาษ — SPEC §5.3 -->
  <!-- แตะผ้าใบครั้งแรกของแผ่น → โน้ตเลื่อนเข้าขอบขวาเหลือแถบเล็ก (app.moodFolded) กดแถบเพื่อกางกลับ เก็บเองได้ด้วยปุ่มบนโน้ต จำสถานะจนจบแผ่น
       reduced-motion: ไม่เลื่อน แค่จาง -->
  <div
    class="absolute left-[1000px] top-[124px] box-border flex w-[228px] rotate-[1.5deg] flex-col gap-2.5 bg-paper px-3 pb-4 pt-3 shadow-[0_6px_16px_rgba(45,43,51,0.18)] transition-[transform,opacity] duration-450 ease-desk"
    :style="cardStyle"
    :inert="app.moodFolded"
    :aria-hidden="app.moodFolded"
  >
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
    <div class="flex items-center justify-between">
      <button type="button" class="inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 font-hand text-15 font-semibold text-ink underline underline-offset-4" @click="app.go('pick')">เปลี่ยนสี</button>
      <button type="button" class="inline-flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink" aria-label="เก็บโน้ตอารมณ์" title="เก็บโน้ต" @click="app.foldMood(true)">
        <Doodle name="forward" :size="22" />
      </button>
    </div>
  </div>

  <!-- แถบที่เก็บแล้ว: อยู่บนขอบกระดานขวา (นอกผ้าใบ x ≥ 1196) พื้นที่กด 62×176 -->
  <button
    type="button"
    class="absolute left-[1204px] top-[124px] box-border flex h-[176px] w-[60px] cursor-pointer flex-col items-center justify-center gap-2.5 border-0 bg-paper p-0 text-ink shadow-[0_4px_12px_rgba(45,43,51,0.2)] transition-opacity duration-450 ease-desk"
    :class="app.moodFolded ? 'opacity-100' : 'pointer-events-none opacity-0'"
    :style="{ transitionDelay: app.moodFolded && !reducedMotion ? scaled(250) : '0ms' }"
    :tabindex="app.moodFolded ? 0 : -1"
    :aria-hidden="!app.moodFolded"
    :aria-label="`เปิดโน้ตอารมณ์ ${emotion.th}`"
    @click="app.foldMood(false)"
  >
    <Tape class="left-[10px] top-[-10px] !h-5 !w-[40px]" :rotate="-4" />
    <EmotionBlob :name="emotion.key" :size="34" />
    <span class="font-hand text-[18px] font-semibold [writing-mode:vertical-rl]">{{ emotion.th }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import Tape from '@/components/ui/Tape.vue'
import Doodle from '@/components/ui/Doodle.vue'
import EmotionBlob from '@/components/ui/EmotionBlob.vue'
import { EMOTION_BY_KEY, INTENSITY_LABELS } from '@/lib/emotions'
import { useAppStore } from '@/stores/app'
import { reducedMotion, scaled } from '@/lib/motion'

const app = useAppStore()
const emotion = computed(() => EMOTION_BY_KEY[app.selection.emotion])
const cardStyle = computed(() => ({
  transform: app.moodFolded && !reducedMotion.value ? 'translateX(268px) rotate(1.5deg)' : undefined,
  opacity: app.moodFolded ? 0 : 1,
  pointerEvents: app.moodFolded ? 'none' : undefined,
}))
</script>
