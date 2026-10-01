<template>
  <!-- ถาดเครื่องมือ 620×80 ทับขอบล่างของกระดาษ — SPEC §5.3 -->
  <div class="absolute left-[330px] top-[690px] box-border flex h-20 w-[620px] items-center gap-2 rounded-[20px_22px_18px_24px] bg-[#C8C2B7] px-3 shadow-[0_6px_14px_rgba(45,43,51,0.18)]">
    <div role="group" aria-label="เครื่องมือ" class="flex gap-2">
      <button
        v-for="t in TOOLS"
        :key="t.key"
        type="button"
        :aria-pressed="t.mode ? app.tool === t.key : undefined"
        class="flex h-[60px] w-24 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 p-0 font-hand text-14 font-semibold text-ink"
        :class="t.mode && app.tool === t.key ? 'border-ink bg-paper' : 'border-transparent bg-transparent'"
        @click="t.mode ? (app.tool = t.key) : app.clearCanvas()"
      >
        <Doodle :name="t.icon" :size="24" />
        {{ t.label }}
      </button>
    </div>
    <span class="mx-1.5 h-11 w-0.5 bg-ink/20" aria-hidden="true"></span>
    <button
      type="button"
      class="flex min-h-[60px] flex-grow cursor-pointer items-center justify-center gap-2.5 rounded-[16px_20px_14px_22px] border-0 bg-ink font-hand text-19 font-semibold text-paper"
      @click="app.saveToBook()"
    >
      <Doodle name="check" :size="22" />
      บันทึกลงสมุด
    </button>
  </div>
</template>

<script setup>
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

// ปาดสี/เติมหยดเป็นโหมด ส่วน "เริ่มใหม่" ไม่ใช่โหมด กดแล้วล้างทันที (SPEC §5.3)
const TOOLS = [
  { key: 'smear', label: 'ปาดสี', icon: 'smear', mode: true },
  { key: 'drop', label: 'เติมหยด', icon: 'drop', mode: true },
  { key: 'clear', label: 'เริ่มใหม่', icon: 'restart', mode: false },
]
</script>
