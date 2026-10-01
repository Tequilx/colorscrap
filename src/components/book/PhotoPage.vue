<template>
  <!-- หน้าซ้าย: ภาพของวัน แบ่งเป็นแผ่นละ 4 ภาพ (SPEC §5.5–5.6) -->
  <div class="absolute left-[14px] top-[14px] h-[612px] w-[492px] rounded-[6px_0_0_6px] bg-paper shadow-[inset_-18px_0_22px_-16px_rgba(45,43,51,0.35)]">
    <!-- ขอบกระดาษซ้อนกันตามจำนวนแผ่นที่เหลือ -->
    <span v-for="n in Math.max(0, leaves.length - 1)" :key="n" class="absolute inset-x-1.5 h-1.5 rounded-bl border-b-[1.5px] border-l-[1.5px] border-[#DCD6CC]" :style="{ bottom: 34 - (n - 1) * 5 + 'px' }" aria-hidden="true"></span>

    <!-- แผ่นที่ 1 คือตัวหน้ากระดาษเอง -->
    <template v-if="leafIndex === 0">
      <div class="absolute left-9 top-10 flex flex-col gap-0.5">
        <span class="font-hand text-26 font-semibold">{{ dateText }}</span>
        <span class="text-14 text-ink-soft">{{ subtitle }}</span>
      </div>
      <PhotoSlot v-for="(e, i) in leaf" :key="e.id" :entry="e" :slot-pos="FIRST_LEAF_SLOTS[i]" :is-new="e.id === newId" :interactive="mode === 'book'" @open="$emit('photo', $event)" />
      <!-- ว่างทั้งวัน -->
      <div v-if="!leaf.length" class="absolute left-[140px] top-[180px] box-border flex h-[165px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]">ยังไม่มีภาพของวันนี้</div>
      <div v-else-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[165px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]" :style="{ left: FIRST_LEAF_SLOTS[leaf.length].x + 'px', top: FIRST_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>

      <!-- แผ่นแทรกที่ม้วนค้างอยู่ด้านบน -->
      <template v-if="leaves.length > 1">
        <div class="absolute left-2 top-0 h-[30px] w-[470px] rounded-b-[18px] border-b-[1.5px] border-[#DCD6CC] bg-[#F1EEE8] shadow-[0_6px_8px_-2px_rgba(45,43,51,0.22)]"></div>
        <Tape class="left-[176px] top-[-10px] !h-[26px] !w-[140px]" :rotate="-1.5" />
      </template>
    </template>

    <!-- แผ่นแทรก (แผ่นที่ 2 ขึ้นไป) พลิกขึ้นด้านบนด้วย rotateX ไม่พลิกไปทางขวาเพื่อไม่บังจานสี -->
    <template v-else>
      <div class="absolute left-2 top-[18px] h-[548px] w-[470px] rounded-sm bg-[#FDFCF9] shadow-[0_4px_12px_rgba(45,43,51,0.2)] [transform-origin:top] animate-[leaf-flip_600ms_cubic-bezier(.2,.8,.2,1)]">
        <div class="absolute left-7 top-[34px] flex flex-col gap-0.5">
          <span class="font-hand text-26 font-semibold">{{ dateTextShort }} (ต่อ)</span>
          <span class="text-14 text-ink-soft">แผ่นที่ {{ leafIndex + 1 }}</span>
        </div>
        <PhotoSlot v-for="(e, i) in leaf" :key="e.id" :entry="e" :slot-pos="INSERT_LEAF_SLOTS[i]" :is-new="e.id === newId" :interactive="mode === 'book'" @open="$emit('photo', $event)" />
        <div v-if="leaf.length < PHOTOS_PER_LEAF && isLatestLeaf" class="absolute box-border flex h-[165px] w-[196px] rotate-1 items-center justify-center border-2 border-dashed border-[#C4C0B7] p-4 text-center font-hand text-15 text-[#8E8A93]" :style="{ left: INSERT_LEAF_SLOTS[leaf.length].x + 'px', top: INSERT_LEAF_SLOTS[leaf.length].y + 'px' }">ภาพถัดไปของวันนี้<br />จะมาอยู่ตรงนี้</div>
      </div>
      <!-- เทปของแผ่นที่เพิ่งงอกในวันนั้น มีป้าย "แผ่นใหม่" จนกว่าผู้ใช้จะพลิกดูแผ่นอื่น -->
      <div v-if="isFreshLeaf" class="absolute left-[166px] top-1 flex h-[30px] w-40 -rotate-[1.5deg] items-center justify-center bg-tape font-hand text-14 font-bold text-[#6B5A33]">แผ่นใหม่</div>
      <Tape v-else class="left-[176px] top-0 !h-[26px] !w-[140px]" :rotate="-1.5" />
    </template>

    <LeafPager v-if="leaves.length > 1" :index="leafIndex" :total="leaves.length" @go="$emit('leaf', $event)" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PhotoSlot from '@/components/book/PhotoSlot.vue'
import LeafPager from '@/components/book/LeafPager.vue'
import Tape from '@/components/ui/Tape.vue'
import { FIRST_LEAF_SLOTS, INSERT_LEAF_SLOTS } from '@/lib/photos'
import { PHOTOS_PER_LEAF } from '@/stores/app'
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
@keyframes leaf-flip {
  from {
    transform: rotateX(70deg);
    opacity: 0;
  }
  to {
    transform: rotateX(0);
    opacity: 1;
  }
}
</style>
