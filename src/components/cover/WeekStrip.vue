<!-- แถบ 7 วันล่าสุดบนหน้าปก: ก้อนสีเด่นของวันที่มีบันทึก -->
<template>
  <div class="flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-faint pt-[22px]">
    <span class="text-14 text-ink-soft">7 วันล่าสุด</span>
    <ul class="m-0 flex list-none gap-3 p-0">
      <li v-for="d in days" :key="d.date" class="flex w-[46px] flex-col items-center gap-1">
        <svg v-if="d.hex" width="42" height="42" viewBox="0 0 170 120" role="img" :aria-label="`${d.label} มีบันทึก`">
          <g class="filter-wcs">
            <path :d="BLOB_PATHS.small" :fill="d.hex" :fill-opacity="d.isToday ? 0.8 : 0.6" :stroke="d.hex" stroke-opacity="0.4" stroke-width="3" />
          </g>
        </svg>
        <!-- ไม่มีบันทึก: วงเส้นประ -->
        <span v-else class="flex h-[42px] w-[42px] items-center justify-center" role="img" :aria-label="`${d.label} ไม่มีบันทึก`">
          <span class="block h-[30px] w-[30px] rounded-full border-2 border-dashed border-line"></span>
        </span>
        <span class="font-hand text-14" :class="d.isToday ? 'font-bold text-ink' : 'text-ink-soft'">{{ d.label }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { BLOB_PATHS } from '@/lib/doodles'

// [{ date, label, isToday, hex | null }] เก่า → ใหม่
defineProps({ days: { type: Array, required: true } })
</script>
