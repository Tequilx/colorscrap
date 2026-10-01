<template>
  <!-- ภาพโพลารอยด์กว้าง 196px มีเทปและคำบรรยายลายมือ (SPEC §5.5) -->
  <figure class="relative m-0 box-border w-[196px] bg-white px-[9px] pb-8 pt-[9px] shadow-photo" :style="{ transform: `rotate(${rotate}deg)` }">
    <Tape class="left-[56px] top-[-11px]" :rotate="tapeRotate" />
    <div class="h-[124px] w-[178px] bg-paper">
      <slot>
        <!-- ค่าเริ่มต้น: หยดสีน้ำสองก้อนจากสีที่ส่งมา -->
        <svg width="178" height="124" viewBox="0 0 170 120" role="img" :aria-label="alt">
          <g class="filter-wcm">
            <path :d="BLOB_PATHS.small" transform="translate(-14 4)" :fill="colors[0]" fill-opacity="0.6" :stroke="colors[0]" stroke-width="2" />
            <path :d="BLOB_PATHS.small" transform="translate(52 34) scale(0.62)" :fill="colors[1] ?? colors[0]" fill-opacity="0.6" />
          </g>
        </svg>
      </slot>
    </div>
    <figcaption class="absolute bottom-1.5 left-3 font-hand text-15 text-ink-soft">{{ caption }}</figcaption>
    <span v-if="badge" class="absolute bottom-2 right-2 bg-cover px-2 font-hand text-13 font-semibold text-white" :style="{ borderRadius: '10px' }">{{ badge }}</span>
  </figure>
</template>

<script setup>
import Tape from '@/components/ui/Tape.vue'
import { BLOB_PATHS } from '@/lib/doodles'

defineProps({
  caption: { type: String, default: '' },
  alt: { type: String, default: 'ภาพระบายสีน้ำ' },
  // สีที่ใช้วาดหยด (ส่ง hex 1–2 สี)
  colors: { type: Array, default: () => ['#5FA3C8', '#F1BE48'] },
  rotate: { type: Number, default: 0 },
  tapeRotate: { type: Number, default: -3 },
  // ป้าย "ใหม่" ที่มุมขวาล่าง
  badge: { type: String, default: '' },
})
</script>
