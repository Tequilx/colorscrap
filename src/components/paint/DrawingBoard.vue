<template>
  <!-- กระดานวาดรูป อยู่บนโต๊ะตลอด (WebGL context ไม่หาย): paint = เต็มจอ, book = เหลือแถบซ้าย 92px — SPEC §4.3 -->
  <div
    class="absolute overflow-hidden transition-[left,top,width,height,opacity] duration-600 ease-desk"
    :style="wrapperStyle"
    :inert="!visible"
    :aria-hidden="!visible"
  >
    <!-- ชั้นขนาด stage 1280×800 เลื่อนเพื่อให้ขอบกระดาษขวาโผล่เป็นแถบเมื่ออยู่ใน book -->
    <div class="absolute left-0 top-0 h-[800px] w-[1280px] transition-transform duration-600 ease-desk" :style="{ transform: layerTransform }">
      <div class="absolute left-7 top-7 h-[744px] w-[1224px] rounded-xl bg-board shadow-[inset_0_0_0_2px_rgba(45,43,51,0.08)]"></div>

      <div class="absolute left-[84px] top-[92px] h-[612px] w-[1112px] bg-paper shadow-[0_2px_6px_rgba(45,43,51,0.16)]">
        <FluidCanvas ref="canvasRef" :emotion="app.selection.emotion" :intensity="app.selection.intensity" :running="app.view === 'paint'" :clear-tick="app.clearTick" />
        <Tape class="left-[-30px] top-[-10px] !h-[30px] !w-[110px]" :rotate="-38" />
        <Tape class="right-[-30px] top-[-10px] !h-[30px] !w-[110px]" :rotate="38" />
        <Tape class="bottom-[-10px] left-[-30px] !h-[30px] !w-[110px]" :rotate="38" />
        <Tape class="bottom-[-10px] right-[-30px] !h-[30px] !w-[110px]" :rotate="-38" />
      </div>

      <!-- ปุ่มและอุปกรณ์ของหน้า paint (ซ่อนเมื่อเหลือแถบ) -->
      <div class="transition-opacity duration-450 ease-desk" :class="app.view === 'paint' ? 'opacity-100' : 'pointer-events-none opacity-0'">
        <div class="absolute left-[52px] top-[50px]">
          <HandButton variant="secondary" solid @click="app.go('cover')"><Doodle name="back" :size="22" /> หน้าแรก</HandButton>
        </div>
        <div class="absolute right-[52px] top-[50px]">
          <HandButton variant="secondary" solid @click="app.go('book')">
            <Doodle name="book" :size="22" /> สมุด · วันนี้ {{ entries.todayCount }} ภาพ
          </HandButton>
        </div>
        <MoodCard />
        <ToolTray />
      </div>
    </div>
  </div>

  <!-- ทั้งแถบซ้ายในหน้า book เป็นปุ่มเดียว "กลับไประบาย" -->
  <button
    v-if="app.view === 'book'"
    type="button"
    aria-label="กลับไประบายสี"
    class="absolute left-0 top-[150px] z-10 h-[500px] w-[92px] cursor-pointer border-0 bg-transparent p-0"
    @click="app.go('paint')"
  >
    <span class="absolute left-[70px] top-0 flex h-[500px] items-center justify-center font-hand text-15 font-semibold text-ink [writing-mode:vertical-rl]">กลับไประบาย</span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue'
import FluidCanvas from '@/components/paint/FluidCanvas.vue'
import MoodCard from '@/components/paint/MoodCard.vue'
import ToolTray from '@/components/paint/ToolTray.vue'
import HandButton from '@/components/ui/HandButton.vue'
import Tape from '@/components/ui/Tape.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entries = useEntriesStore()
const canvasRef = ref(null)

const visible = computed(() => app.view === 'paint' || app.view === 'book')

// wrapper: paint = เต็มจอ | book = แถบซ้าย 92×500 | อื่น ๆ = ซ่อนนอกจอ
const wrapperStyle = computed(() => {
  if (app.view === 'paint') return { left: '0px', top: '0px', width: '1280px', height: '800px', opacity: 1 }
  if (app.view === 'book') return { left: '0px', top: '150px', width: '92px', height: '500px', opacity: 1 }
  return { left: '-1300px', top: '0px', width: '1280px', height: '800px', opacity: 0 }
})

// ใน book: ขอบขวาของกระดาษ (x=1196) ไปอยู่ที่ x=64 และเลื่อนขึ้น 150 ให้แถบแสดงช่วงกลางกระดาษ
const layerTransform = computed(() => (app.view === 'book' ? 'translate(-1132px, -150px)' : 'translate(0, 0)'))

defineExpose({ canvasRef })
</script>
