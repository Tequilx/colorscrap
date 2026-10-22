<template>
  <!-- หน้าซ้าย: ภาพของวัน แบ่งเป็นแผ่นละ 4 ภาพ (SPEC §5.5–5.6) -->
  <div class="absolute left-[14px] top-[14px] h-[612px] w-[492px] rounded-[6px_0_0_6px] bg-paper shadow-[inset_-18px_0_22px_-16px_rgba(45,43,51,0.35)]">
    <!-- ขอบกระดาษซ้อนกันตามจำนวนแผ่นที่เหลือ -->
    <span v-for="n in Math.max(0, leaves.length - 1)" :key="n" class="absolute inset-x-1.5 h-1.5 rounded-bl border-b-[1.5px] border-l-[1.5px] border-edge" :style="{ bottom: 34 - (n - 1) * 5 + 'px' }" aria-hidden="true"></span>

    <!-- แต่ละแผ่นเป็น layer ของตัวเอง (:key = วัน + แผ่น) พลิกรอบสันกลาง (ขอบขวาของหน้าซ้าย) ทุกครั้งที่เปลี่ยนแผ่นหรือเปลี่ยนวัน (ข้อ 22) -->
    <Transition :name="flipName" :css="flipAnimated" :duration="flipDuration" @before-enter="flipStart" @after-enter="flipEnd" @enter-cancelled="flipEnd" @leave-cancelled="flipEnd">
      <div :key="`${date}#${leafIndex}`" class="leaf-layer absolute inset-0">
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
          <div v-if="!leaf.length" class="absolute left-[140px] top-[180px] box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-faint p-4 text-center font-hand text-15 text-mute">ยังไม่มีภาพของวันนี้</div>
          <div v-else-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-faint p-4 text-center font-hand text-15 text-mute" :style="{ left: FIRST_LEAF_SLOTS[leaf.length].x + 'px', top: FIRST_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>

          <!-- แผ่นแทรกที่ม้วนค้างอยู่ด้านบน -->
          <template v-if="leaves.length > 1">
            <div class="absolute left-2 top-0 h-[30px] w-[470px] rounded-b-[18px] border-b-[1.5px] border-edge bg-well shadow-[0_6px_8px_-2px_rgba(45,43,51,0.22)]"></div>
            <Tape class="left-[176px] top-[-10px] !h-[26px] !w-[140px]" :rotate="-1.5" />
          </template>
        </template>

        <!-- แผ่นแทรก (แผ่นที่ 2 ขึ้นไป) พลิกขึ้นด้านบนด้วย rotateX ไม่พลิกไปทางขวาเพื่อไม่บังจานสี -->
        <template v-else>
          <div class="leaf-sheet absolute left-2 top-[18px] h-[548px] w-[470px] rounded-sm bg-leaf shadow-[0_4px_12px_rgba(45,43,51,0.2)]">
            <div class="absolute left-7 top-[34px] flex flex-col gap-0.5">
              <span class="font-hand text-26 font-semibold">{{ dateTextShort }} (ต่อ)</span>
              <span class="text-14 text-ink-soft">แผ่นที่ {{ leafIndex + 1 }}</span>
            </div>
            <template v-for="(e, i) in leaf" :key="e.id">
            <EmptySlot v-if="landing(e)" :pos="INSERT_LEAF_SLOTS[i]" />
            <PhotoSlot :entry="e" :slot-pos="INSERT_LEAF_SLOTS[i]" :is-new="e.id === newId" :interactive="mode === 'book'" @open="$emit('photo', $event)" />
          </template>
            <div v-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[153px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-faint p-4 text-center font-hand text-15 text-mute" :style="{ left: INSERT_LEAF_SLOTS[leaf.length].x + 'px', top: INSERT_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>
          </div>
          <!-- เทปของแผ่นที่เพิ่งงอกในวันนั้น มีป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น -->
          <div v-if="isFreshLeaf" class="absolute left-[166px] top-1 flex h-[30px] w-40 -rotate-[1.5deg] items-center justify-center bg-tape font-hand text-14 font-bold text-tape-ink">แผ่นใหม่</div>
          <Tape v-else class="left-[176px] top-0 !h-[26px] !w-[140px]" :rotate="-1.5" />
        </template>
        <!-- เงาของแผ่นที่กำลังพลิก (จางเข้า/ออกพร้อมการพลิก) -->
        <span class="leaf-shade pointer-events-none absolute inset-0 rounded-[6px_0_0_6px]" aria-hidden="true"></span>
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
import { ms, reducedMotion } from '@/lib/motion'
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

// ทิศทางการพลิก (รอบสันกลาง ขอบขวาของหน้าซ้าย): ไปแผ่นถัดไป/วันถัดไป = แผ่นเก่าพลิกขึ้นออกไปเผยแผ่นใหม่ใต้มัน, ย้อนกลับ = แผ่นใหม่พลิกลงมาทับแผ่นเก่า
// เปลี่ยนวันด้วยแท็บ/ปุ่มวัน (app.turnToDay) พลิกด้วย ส่วนเปลี่ยนวันตอนเปิดสมุด (openBook) ไม่พลิก เพราะอยู่ใต้ปกที่กำลังพลิก
// reduced-motion: จางอย่างเดียว (leaf-fade)
const flipName = ref('leaf-fwd')
const flipAnimated = ref(false)
watch(
  () => [props.date, props.leafIndex],
  ([date, index], [oldDate, oldIndex]) => {
    const sameDay = date === oldDate
    flipAnimated.value = sameDay ? index !== oldIndex : app.dayTurn
    const forward = sameDay ? index > oldIndex : date > oldDate
    flipName.value = reducedMotion.value ? 'leaf-fade' : forward ? 'leaf-fwd' : 'leaf-back'
    app.dayTurn = false
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
/* พลิกหน้ากระดาษรอบสันกลาง: หน้าซ้ายผูกบานพับที่ขอบขวา perspective ใส่ใน transform เอง (transform/opacity เท่านั้น) */
.leaf-layer {
  z-index: 1;
  transform-origin: right center;
}
.leaf-shade {
  opacity: 0;
  background: linear-gradient(to left, rgba(45, 43, 51, 0.38), rgba(45, 43, 51, 0.04) 60%);
}
.leaf-fwd-leave-active,
.leaf-back-enter-active {
  z-index: 2;
  backface-visibility: hidden;
  will-change: transform, opacity;
  transition: transform calc(450ms * var(--motion-scale, 1)) cubic-bezier(0.45, 0, 0.25, 1);
}
/* แผ่นที่พลิกออกไปจางหายตอนท้าย (ใกล้ตั้งฉากแล้ว) */
.leaf-fwd-leave-active {
  transition:
    transform calc(450ms * var(--motion-scale, 1)) cubic-bezier(0.45, 0, 0.25, 1),
    opacity calc(150ms * var(--motion-scale, 1)) linear calc(300ms * var(--motion-scale, 1));
}
.leaf-fwd-leave-active .leaf-shade,
.leaf-back-enter-active .leaf-shade {
  transition: opacity calc(450ms * var(--motion-scale, 1)) cubic-bezier(0.45, 0, 0.25, 1);
}
.leaf-fwd-leave-to {
  transform: perspective(1800px) rotateY(90deg);
  opacity: 0;
}
.leaf-back-enter-from {
  transform: perspective(1800px) rotateY(90deg);
}
.leaf-fwd-leave-to .leaf-shade,
.leaf-back-enter-from .leaf-shade {
  opacity: 1;
}
/* เล่นกลับ (ย้อนแผ่น): แผ่นที่ถูกทับอยู่ใต้ คงที่ไว้จนแผ่นบนพลิกลงมาเสร็จ แล้วจางหายตอนท้าย */
.leaf-back-leave-active {
  transition: opacity calc(120ms * var(--motion-scale, 1)) linear calc(330ms * var(--motion-scale, 1));
}
.leaf-back-leave-to {
  opacity: 0;
}
/* reduced-motion: จางอย่างเดียว */
.leaf-fade-enter-active,
.leaf-fade-leave-active {
  transition: opacity 150ms linear;
}
.leaf-fade-enter-from,
.leaf-fade-leave-to {
  opacity: 0;
}
</style>
