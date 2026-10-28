<template>
  <!-- ภาพโพลารอยด์กว้าง 196px มีเทปและคำบรรยายลายมือ (SPEC §5.5) -->
  <PolaroidFrame class="w-[196px] px-[9px] pt-[9px]" :style="{ paddingBottom: padBottom }" :rotate="rotate">
    <Tape v-if="tape" class="left-[56px] top-[-11px]" :rotate="tapeRotate" />
    <!-- ช่องภาพสัดส่วนเท่ากระดาษวาด 1112:612 ภาพจริงจึงไม่ถูกตัดขอบ (178×~98) -->
    <div data-wet-target class="aspect-[1112/612] w-[178px] overflow-hidden bg-paper">
      <!-- ภาพจริงของผู้ใช้: สัดส่วนเดียวกับช่อง -->
      <RevealImg v-if="src" :src="src" :alt="alt" cls="block h-full w-full object-cover" />
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
    <!-- คำบรรยาย 16px (ข้อ 52e แทนข้อ 51a; การ์ดดาวน์โหลดใช้ขนาดของตัวเอง) ยาวมี "→" ตัดสองบรรทัดที่ลูกศร ขอบล่างขยายตามให้ไม่แน่น -->
    <figcaption class="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2 font-hand text-16 leading-thai text-ink-soft">
      <span class="min-w-0 flex-1" :title="caption">
        <span class="block truncate">{{ lines[0] }}</span>
        <span v-if="lines[1]" class="block truncate">{{ lines[1] }}</span>
      </span>
      <span v-if="badge" class="shrink-0 rounded-[10px] bg-cover px-2 text-13 font-semibold text-white">{{ badge }}</span>
    </figcaption>
  </PolaroidFrame>
</template>

<script setup>
import { computed } from 'vue'
import PolaroidFrame from '@/components/ui/PolaroidFrame.vue'
import Tape from '@/components/ui/Tape.vue'
import RevealImg from '@/components/ui/RevealImg.vue'
import ColorStrip from '@/components/ui/ColorStrip.vue'
import { BLOB_PATHS } from '@/lib/doodles'

const props = defineProps({
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

// ตัดสองบรรทัดที่ " → " (บรรทัดสองขึ้นต้นด้วยลูกศร) ไม่ตัดกลางคำ
const lines = computed(() => {
  const k = props.caption.indexOf(' → ')
  return k < 0 ? [props.caption] : [props.caption.slice(0, k), props.caption.slice(k + 1)]
})
// ขอบล่าง: แถบสี 14 + คำบรรยาย 24 ต่อบรรทัด + เว้น 8 (ไม่มีแถบสี: 8 + บรรทัด)
const padBottom = computed(() => {
  const base = props.palette.length ? 14 : 0
  return `${base + 24 * lines.value.length + 8}px`
})
</script>
