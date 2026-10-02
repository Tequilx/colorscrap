<template>
  <!-- กล่องสีน้ำเลือกอารมณ์ อยู่บนโต๊ะตลอด ซ่อนเมื่อไม่ใช่ view pick (SPEC §4.3, §5.2) -->
  <div
    class="absolute inset-0 transition-[opacity,transform] duration-600 ease-desk"
    :class="active ? 'opacity-100' : 'pointer-events-none translate-y-6 opacity-0 motion-reduce:translate-y-0'"
    :inert="!active"
    :aria-hidden="!active"
  >
    <div class="absolute left-8 top-7">
      <HandButton variant="secondary" @click="app.go('cover')">
        <Doodle name="back" :size="22" /> หน้าแรก
      </HandButton>
    </div>

    <div class="absolute left-0 top-16 flex w-[1280px] flex-col items-center gap-2">
      <h1 class="m-0 font-hand text-44 font-semibold leading-[1.2]">ตอนนี้รู้สึกแบบไหน?</h1>
      <p class="m-0 text-[18px] text-ink-soft">เลือกสีที่ใกล้ที่สุดหนึ่งสี ไม่มีคำตอบผิด</p>
    </div>

    <div class="absolute left-[200px] top-[196px] h-[364px] w-[880px]">
      <!-- กรอบใส่ wob ที่ element แยก ไม่ครอบปุ่ม -->
      <div class="filter-wob absolute inset-0 rounded-hand-lg border-2 border-ink bg-paper-deep shadow-[0_10px_24px_rgba(45,43,51,0.12)]"></div>
      <div role="group" aria-label="เลือกความรู้สึก" class="absolute inset-[22px] grid grid-cols-4 gap-4">
        <button
          v-for="e in EMOTIONS"
          :key="e.key"
          type="button"
          :aria-pressed="app.selection.emotion === e.key"
          class="flex h-[150px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px_22px_16px_20px] border-2 p-0 font-hand text-19 font-semibold text-ink transition-[transform,background-color,border-color,box-shadow] duration-450 ease-desk"
          :class="app.selection.emotion === e.key ? 'border-ink -translate-y-[5px] -rotate-1' : 'border-transparent bg-paper hover:-rotate-[6deg] hover:scale-105 active:scale-[0.98] motion-reduce:hover:rotate-0 motion-reduce:hover:scale-100'"
          :style="app.selection.emotion === e.key ? { background: e.hex + '2E', boxShadow: `0 8px 0 -2px ${e.hex}80` } : {}"
          @click="app.selectEmotion(e.key)"
        >
          <EmotionBlob :name="e.key" :size="88" />
          <span :class="app.selection.emotion === e.key ? 'underline decoration-wavy underline-offset-[6px]' : ''">{{ e.th }}</span>
        </button>
      </div>
    </div>

    <div class="absolute left-0 top-[590px] flex w-[1280px] items-center justify-center gap-3.5">
      <span class="mr-1.5 font-hand text-17 font-semibold">เข้มข้นแค่ไหน</span>
      <div role="group" aria-label="ความเข้มข้น" class="flex gap-3.5">
        <HandButton
          v-for="(label, i) in INTENSITY_LABELS"
          :key="label"
          variant="chip"
          class="!min-h-[48px] !px-[18px] !text-16"
          :pressed="app.selection.intensity === i"
          @click="app.selectIntensity(i)"
        >
          <svg :width="14 + i * 7" :height="14 + i * 7" viewBox="0 0 170 120" aria-hidden="true">
            <g class="filter-wcs"><path :d="BLOB_PATHS.small" :fill="current.hex" /></g>
          </svg>
          {{ label }}
        </HandButton>
      </div>
    </div>

    <div v-if="!choosing" class="absolute left-0 top-[672px] flex w-[1280px] items-center justify-center gap-6">
      <span class="text-17 text-ink-2">
        <b class="font-hand text-19 text-ink">{{ current.th }}</b> · {{ current.pigment }} · {{ INTENSITY_LABELS[app.selection.intensity] }}
      </span>
      <HandButton @click="start">เริ่มระบาย <Doodle name="forward" :size="22" /></HandButton>
    </div>

    <!-- มีภาพที่ยังไม่บันทึกอยู่บนผ้าใบ: ถามว่าจะระบายต่อหรือเริ่มแผ่นใหม่ (SPEC §5.2) -->
    <div v-else role="group" aria-label="ผ้าใบมีภาพที่ยังไม่ได้บันทึก" class="absolute left-0 top-[660px] flex w-[1280px] flex-col items-center gap-2.5">
      <span class="text-17 text-ink-2">บนผ้าใบยังมีภาพที่ยังไม่ได้บันทึก</span>
      <div class="flex items-center gap-4">
        <HandButton variant="secondary" @click="app.continueSheet()">ระบายต่อแผ่นเดิม</HandButton>
        <HandButton @click="app.newSheet()">เริ่มแผ่นใหม่</HandButton>
        <button type="button" class="min-h-[44px] cursor-pointer border-0 bg-transparent px-2 font-hand text-16 font-semibold text-ink-soft underline underline-offset-4" @click="choosing = false">ยกเลิก</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import EmotionBlob from '@/components/ui/EmotionBlob.vue'
import { EMOTIONS, EMOTION_BY_KEY, INTENSITY_LABELS } from '@/lib/emotions'
import { BLOB_PATHS } from '@/lib/doodles'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const active = computed(() => app.view === 'pick')

// true = กำลังแสดงตัวเลือก "ระบายต่อแผ่นเดิม / เริ่มแผ่นใหม่"
const choosing = ref(false)
const start = () => {
  choosing.value = app.beginPaint() === 'choose'
}
// ออกจากหน้า pick หรือเปลี่ยนอารมณ์แล้วให้กลับมาเป็นปุ่มปกติ
watch(active, () => (choosing.value = false))
watch(() => app.selection.emotion, () => (choosing.value = false))
const current = computed(() => EMOTION_BY_KEY[app.selection.emotion])
</script>
