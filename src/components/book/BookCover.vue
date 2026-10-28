<template>
  <!-- สมุดปิด ขนาดจริง 420×540 (ย่อ/ขยายโดย Scrapbook) ใช้สี --cover จาก root -->
  <div class="relative h-[540px] w-[420px]">
    <!-- แท็บคั่นหน้า 3 อัน สีเด่นของ 3 วันล่าสุดที่มีบันทึก วันล่าสุดสูงกว่า -->
    <div v-if="tabs.length" class="absolute left-[196px] top-[-30px] flex gap-2">
      <span
        v-for="(t, i) in tabs"
        :key="t.date"
        class="block w-[46px] rounded-t-lg"
        :class="i === tabs.length - 1 ? 'mt-[-10px] h-[56px]' : 'h-[46px]'"
        :style="{ background: t.hex }"
      ></span>
    </div>

    <div class="absolute inset-0 overflow-hidden rounded-[6px_14px_14px_6px] bg-cover shadow-book">
      <span class="absolute inset-y-0 left-0 w-[30px] border-r-2 border-dashed border-white/[.14] bg-cover-spine"></span>
      <svg width="420" height="540" viewBox="0 0 420 540" class="absolute left-0 top-0" aria-hidden="true">
        <!-- รอยสีเลอะอยู่รอบขอบ ไม่ทับป้ายชื่อและสติกเกอร์ มีขอบกระดาษบาง ๆ ให้เห็นชัดทุกสีปก -->
        <g class="filter-wc" opacity="0.7" :stroke="PALETTE.paper" stroke-opacity="0.7" stroke-width="2.5">
          <path :d="BLOB_PATHS.large" transform="translate(292 6) scale(0.42)" vector-effect="non-scaling-stroke" :fill="EMOTION_COLORS.calm" />
          <path :d="BLOB_PATHS.large" transform="translate(262 408) scale(0.38)" vector-effect="non-scaling-stroke" :fill="EMOTION_COLORS.excited" />
          <path :d="BLOB_PATHS.large" transform="translate(48 420) scale(0.32)" vector-effect="non-scaling-stroke" :fill="EMOTION_COLORS.happy" />
        </g>
      </svg>
      <!-- ป้ายกระดาษ -->
      <div class="absolute left-[72px] top-[178px] box-border flex w-[284px] rotate-[1.2deg] flex-col gap-1.5 rounded bg-paper px-[26px] py-[22px] shadow-[0_3px_10px_rgba(0,0,0,0.22)]">
        <span class="text-13 text-ink-soft">สมุดระบายความรู้สึก</span>
        <BrandMark variant="wordmark" :size="44" />
        <span class="break-words border-t-2 border-dotted border-line pt-2 font-hand font-bold leading-stack" :class="name ? 'text-ink' : 'text-mute'" :style="{ fontSize: ownerSize + 'px' }">ของ {{ name || 'ชื่อของคุณ' }}</span>
      </div>
      <span class="absolute inset-y-0 right-[44px] w-[18px] bg-cover-strap shadow-[inset_2px_0_0_rgba(255,255,255,0.08)]"></span>
    </div>

    <!-- สติกเกอร์ตัวแทน: วงเล็ก ๆ แปะทับมุมซ้ายบนของป้ายชื่อ -->
    <div class="filter-wob absolute left-[38px] top-[146px] flex h-[58px] w-[58px] -rotate-[10deg] items-center justify-center rounded-full border-2 border-ink bg-paper text-ink shadow-[0_3px_6px_rgba(0,0,0,0.3)]">
      <Doodle :name="avatar" :size="38" />
    </div>

    <!-- ป้ายเทปของสิ่งที่ทำให้ใจฟู ไม่เกิน 3 อัน ที่ขอบขวา -->
    <div class="absolute bottom-[64px] right-[-16px] flex flex-col items-end gap-1.5">
      <span
        v-for="(l, i) in likes.slice(0, 3)"
        :key="l"
        class="bg-tape px-3 py-1 font-hand text-14 font-semibold shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
        :style="{ transform: `rotate(${[-4, 3, -2][i]}deg)` }"
      >{{ l }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BrandMark from '@/components/ui/BrandMark.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { BLOB_PATHS } from '@/lib/doodles'
import { EMOTION_COLORS, PALETTE } from '@/lib/tokens'

const props = defineProps({
  name: { type: String, default: '' },
  avatar: { type: String, default: 'cat' },
  likes: { type: Array, default: () => [] },
  // [{ date, hex }] เก่า → ใหม่
  tabs: { type: Array, default: () => [] },
})

// ชื่อเจ้าของใหญ่ที่สุดรองจากโลโก้ (Mali ตัวหนา) ชื่อยาวย่อลงให้ยังพอดีป้าย (ป้ายกว้างใน 232px)
const ownerSize = computed(() => {
  const n = [...(props.name || 'ชื่อของคุณ')].length
  return n <= 8 ? 26 : n <= 12 ? 22 : 18
})
</script>
