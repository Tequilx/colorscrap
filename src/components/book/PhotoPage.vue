<template>
  <!-- หน้าซ้าย: ภาพของวัน แบ่งเป็นแผ่นละ 4 ภาพ (SPEC §5.5–5.6) -->
  <div class="absolute left-[14px] top-[14px] h-[612px] w-[492px] rounded-[6px_0_0_6px] bg-paper shadow-[inset_-18px_0_22px_-16px_rgba(45,43,51,0.35)]">
    <!-- ขอบกระดาษซ้อนกันตามจำนวนแผ่นที่เหลือ -->
    <span v-for="n in Math.max(0, leaves.length - 1)" :key="n" class="absolute inset-x-1.5 h-1.5 rounded-bl border-b-[1.5px] border-l-[1.5px] border-[#DCD6CC]" :style="{ bottom: 34 - (n - 1) * 5 + 'px' }" aria-hidden="true"></span>

    <!-- แต่ละแผ่นเป็น layer ของตัวเอง (:key) เพื่อให้พลิกด้วย rotateX ทุกครั้งที่เปลี่ยนแผ่น (SPEC §5.6) -->
    <Transition :name="flipName" :css="flipAnimated" :duration="flipDuration" @before-enter="flipStart" @after-enter="flipEnd" @enter-cancelled="flipEnd" @leave-cancelled="flipEnd">
      <div :key="leafIndex" class="leaf-layer absolute inset-0">
        <!-- แผ่นที่ 1 คือตัวหน้ากระดาษเอง -->
        <template v-if="leafIndex === 0">
          <div class="absolute left-9 top-10 flex flex-col gap-0.5">
            <span class="font-hand text-26 font-semibold">{{ dateText }}</span>
            <span class="text-14 text-ink-soft">{{ subtitle }}</span>
          </div>
            <template v-for="(e, i) in leaf" :key="e.id">
            <EmptySlot v-if="landing(e)" :pos="FIRST_LEAF_SLOTS[i]" />
            <PhotoSlot :entry="e" :slot-pos="FIRST_LEAF_SLOTS[i]" :is-new="e.id === newId" :interactive="mode === 'book'" @open="$emit('photo', $event)" />
          </template>
          <!-- ว่างทั้งวัน -->
          <div v-if="!leaf.length" class="absolute left-[140px] top-[180px] box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]">ยังไม่มีภาพของวันนี้</div>
          <div v-else-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]" :style="{ left: FIRST_LEAF_SLOTS[leaf.length].x + 'px', top: FIRST_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>

          <!-- แผ่นแทรกที่ม้วนค้างอยู่ด้านบน -->
          <template v-if="leaves.length > 1">
            <div class="absolute left-2 top-0 h-[30px] w-[470px] rounded-b-[18px] border-b-[1.5px] border-[#DCD6CC] bg-[#F1EEE8] shadow-[0_6px_8px_-2px_rgba(45,43,51,0.22)]"></div>
            <Tape class="left-[176px] top-[-10px] !h-[26px] !w-[140px]" :rotate="-1.5" />
          </template>
        </template>

        <!-- แผ่นแทรก (แผ่นที่ 2 ขึ้นไป) พลิกขึ้นด้านบนด้วย rotateX ไม่พลิกไปทางขวาเพื่อไม่บังจานสี -->
        <template v-else>
          <div class="leaf-sheet absolute left-2 top-[18px] h-[548px] w-[470px] rounded-sm bg-[#FDFCF9] shadow-[0_4px_12px_rgba(45,43,51,0.2)]">
            <div class="absolute left-7 top-[34px] flex flex-col gap-0.5">
              <span class="font-hand text-26 font-semibold">{{ dateTextShort }} (ต่อ)</span>
              <span class="text-14 text-ink-soft">แผ่นที่ {{ leafIndex + 1 }}</span>
            </div>
            <template v-for="(e, i) in leaf" :key="e.id">
            <EmptySlot v-if="landing(e)" :pos="INSERT_LEAF_SLOTS[i]" />
            <PhotoSlot :entry="e" :slot-pos="INSERT_LEAF_SLOTS[i]" :is-new="e.id === newId" :interactive="mode === 'book'" @open="$emit('photo', $event)" />
          </template>
            <div v-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]" :style="{ left: INSERT_LEAF_SLOTS[leaf.length].x + 'px', top: INSERT_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>
          </div>
          <!-- เทปของแผ่นที่เพิ่งงอกในวันนั้น มีป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น -->
          <div v-if="isFreshLeaf" class="absolute left-[166px] top-1 flex h-[30px] w-40 -rotate-[1.5deg] items-center justify-center bg-tape font-hand text-14 font-bold text-[#6B5A33]">แผ่นใหม่</div>
          <Tape v-else class="left-[176px] top-0 !h-[26px] !w-[140px]" :rotate="-1.5" />
        </template>
      </div>
    </Transition>

    <LeafPager v-if="leaves.length > 1" :index="leafIndex" :total="leaves.length" @go="$emit('leaf', $event)" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PhotoSlot from '@/components/book/PhotoSlot.vue'
import EmptySlot from '@/components/book/EmptySlot.vue'
import LeafPager from '@/components/book/LeafPager.vue'
import Tape from '@/components/ui/Tape.vue'
import { FIRST_LEAF_SLOTS, INSERT_LEAF_SLOTS } from '@/lib/photos'
import { PHOTOS_PER_LEAF, useAppStore } from '@/stores/app'
import { ms } from '@/lib/motion'
import { parseLocalDate, thaiDayFull, thaiDateShort } from '@/lib/dates'

const props = defineProps({
  date: { type: String, required: true },
  leaves: { type: Array, required: true }, // chunk(entriesOfDay, 4)
  leafIndex: { type: Number, required: true },
  newId: { type: String, default: null }, // ภาพที่เพิ่งบันทึก (ป้าย "ใหม่")
  freshIndex: { type: Number, default: null }, // แผ่นที่เพิ่งงอก
  // saved: บรรทัดรองเป็น "ภาพที่ n ของวันนี้"
  mode: { type: String, default: 'book' },
})

defineEmits(['leaf', 'photo'])

const app = useAppStore()

// ภาพที่กำลังบินลงช่อง (ลำดับบันทึก): ช่องจริงซ่อนอยู่ แสดงช่องเส้นประแทนจนภาพลงถึง
const landing = (e) => app.savePhase !== 'idle' && app.photoHiddenId === e.id

// ทิศทางการพลิก: ไปแผ่นถัดไป = แผ่นใหม่ลงมาทับ, ย้อนกลับ = แผ่นบนพลิกขึ้นเผยแผ่นล่าง
// เปลี่ยนวันแล้วแผ่นเปลี่ยนตาม (openDay) ไม่เล่นแอนิเมชัน เพราะ layer เก่าจะโชว์ข้อมูลของวันใหม่ค้างอยู่ระหว่างพลิก
const flipName = ref('leaf-fwd')
const flipAnimated = ref(false)
watch(
  () => [props.date, props.leafIndex],
  ([date, index], [oldDate, oldIndex]) => {
    flipAnimated.value = date === oldDate && index !== oldIndex
    flipName.value = index > oldIndex ? 'leaf-fwd' : 'leaf-back'
  },
  { flush: 'pre' },
)
// Transition วัดเวลาจาก transition ของ layer เอง ไม่เห็นของลูก (.leaf-sheet) จึงบอกเวลาเอง
const flipDuration = computed(() => ({ enter: ms(450), leave: ms(450) }))
// ระหว่างพลิก กดลูกศรซ้ำไม่ได้ (store.setLeaf เช็ค leafFlipping)
const flipStart = () => {
  if (flipAnimated.value) app.leafFlipping = true
}
const flipEnd = () => {
  app.leafFlipping = false
}

const leaf = computed(() => props.leaves[props.leafIndex] ?? [])
const total = computed(() => props.leaves.flat().length)
const isLatestLeaf = computed(() => props.leafIndex === props.leaves.length - 1)
const isFreshLeaf = computed(() => props.freshIndex === props.leafIndex)
const day = computed(() => parseLocalDate(props.date))
const dateText = computed(() => thaiDayFull(day.value))
const dateTextShort = computed(() => `${day.value.getDate()} ${thaiDayFull(day.value).split(' ')[2]}`)
const subtitle = computed(() => {
  if (props.mode === 'saved') return `ภาพที่ ${total.value} ของวันนี้`
  if (props.leaves.length > 1) return `แผ่นที่ 1 · เต็มแล้ว ${PHOTOS_PER_LEAF} ภาพ · ทั้งวัน ${total.value} ภาพ`
  return total.value ? `${total.value} ภาพ` : 'ยังไม่มีภาพ'
})
</script>

<style>
/* แผ่นแทรกพลิกด้วย rotateX รอบขอบบน (ไม่พลิกไปทางขวา เพื่อไม่บังจานสี) — perspective ใส่ใน transform เอง เพราะ .leaf-sheet เป็นหลานของแม่ */
.leaf-layer {
  z-index: 1;
}
.leaf-fwd-enter-active,
.leaf-back-leave-active {
  z-index: 2;
}
.leaf-fwd-enter-active .leaf-sheet,
.leaf-back-leave-active .leaf-sheet {
  transform-origin: top;
  backface-visibility: hidden;
  will-change: transform, opacity;
  transition:
    transform calc(450ms * var(--motion-scale, 1)) cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity calc(300ms * var(--motion-scale, 1)) cubic-bezier(0.2, 0.8, 0.2, 1);
}
.leaf-fwd-enter-from .leaf-sheet {
  transform: perspective(1200px) rotateX(70deg);
  opacity: 0;
}
.leaf-back-leave-to .leaf-sheet {
  transform: perspective(1200px) rotateX(80deg);
  opacity: 0;
}
/* layer ที่ถูกทับ/เผยอยู่ข้างใต้คงที่ไว้จนแผ่นบนพลิกเสร็จ แล้วจางหายตอนท้าย (ไม่ pop แถบม้วนด้านบนของแผ่นแรก) */
.leaf-fwd-leave-active {
  transition: opacity calc(120ms * var(--motion-scale, 1)) linear calc(330ms * var(--motion-scale, 1));
}
.leaf-fwd-leave-to {
  opacity: 0;
}
</style>
