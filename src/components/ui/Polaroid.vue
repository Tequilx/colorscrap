<template>
  <!-- ภาพโพลารอยด์กว้าง 196px มีเทปและคำบรรยายลายมือ (SPEC §5.5) -->
  <figure class="relative m-0 box-border w-[196px] bg-white px-[9px] pt-[9px] shadow-photo"
    :class="palette.length ? 'pb-[46px]' : 'pb-8'" :style="{ transform: `rotate(${rotate}deg)` }">
    <Tape v-if="tape" class="left-[56px] top-[-11px]" :rotate="tapeRotate" />
    <!-- ช่องภาพสัดส่วนเท่ากระดาษวาด 1112:612 ภาพจริงจึงไม่ถูกตัดขอบ (178×~98) -->
    <div class="aspect-[1112/612] w-[178px] overflow-hidden bg-paper">
      <!-- ภาพจริงของผู้ใช้: สัดส่วนเดียวกับช่อง -->
      <img v-if="src" :src="src" :alt="alt" draggable="false" class="block h-full w-full object-cover" />
      <slot v-else>
        <!-- ค่าเริ่มต้น: หยดสีน้ำสองก้อนจากสีที่ส่งมา -->
        <svg class="block h-full w-full" viewBox="0 0 170 94" role="img" :aria-label="alt">
          <g class="filter-wcm">
            <path :d="BLOB_PATHS.small" transform="translate(-14 -4)" :fill="colors[0]" fill-opacity="0.6" :stroke="colors[0]" stroke-width="2" />
            <path :d="BLOB_PATHS.small" transform="translate(52 22) scale(0.62)" :fill="colors[1] ?? colors[0]" fill-opacity="0.6" />
          </g>
        </svg>
      </slot>
    </div>
    <!-- คำบรรยายกับป้ายอยู่แถว flex เดียวกันคนละฝั่ง คำบรรยายยาวเกินให้ตัดด้วย ellipsis -->
    <!-- แถบสีที่ดูดได้จากภาพ ใต้ตัวภาพ เหนือคำบรรยาย -->
    <ColorStrip v-if="palette.length" :colors="palette" class="mt-1.5" />
    <figcaption class="absolute inset-x-3 bottom-1.5 flex items-center justify-between gap-2 font-hand text-15 text-ink-soft">
      <span class="min-w-0 flex-1 truncate" :class="caption.length > 24 ? 'text-13' : ''" :title="caption">{{ caption }}</span>
      <span v-if="badge" class="shrink-0 rounded-[10px] bg-cover px-2 text-13 font-semibold text-white">{{ badge }}</span>
    </figcaption>
  </figure>
</template>

<script setup>
import Tape from '@/components/ui/Tape.vue'
import ColorStrip from '@/components/ui/ColorStrip.vue'
import { BLOB_PATHS } from '@/lib/doodles'

defineProps({
  caption: { type: String, default: '' },
  // URL ภาพจริง (object URL) ถ้าไม่ใส่แสดงหยดสีจำลองจาก colors
  src: { type: String, default: null },
  alt: { type: String, default: 'ภาพระบายสีน้ำ' },
  // สีที่ใช้วาดหยด (ส่ง hex 1–2 สี)
  colors: { type: Array, default: () => ['#5FA3C8', '#F1BE48'] },
  rotate: { type: Number, default: 0 },
  tapeRotate: { type: Number, default: -3 },
  // สีที่ดูดได้ทั้งหมด [{ hex, ratio }] ถ้าใส่จะแสดงแถบสีใต้ภาพ
  palette: { type: Array, default: () => [] },
  // ป้าย "ใหม่" ที่มุมขวาล่าง
  badge: { type: String, default: '' },
  // false = ไม่ใส่เทป (ลำดับบันทึกแปะเทปเองทีหลัง)
  tape: { type: Boolean, default: true },
})
</script>
