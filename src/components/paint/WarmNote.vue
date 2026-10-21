<template>
  <!-- โน้ตชวนลองแต้มแสง (ครั้งเดียวต่อแผ่น) โผล่ใต้การ์ดอารมณ์ ตามแบบ 3b-warm-tool — SPEC §5.3 -->
  <Transition name="note">
    <div
      v-if="app.warmNoteOpen"
      role="status"
      aria-live="polite"
      class="absolute left-[990px] top-[456px] box-border flex w-[236px] -rotate-[1.8deg] flex-col gap-3 bg-note px-[18px] pb-4 pt-[22px] shadow-[0_10px_22px_rgba(45,43,51,0.22)]"
    >
      <Tape class="left-[30px] top-[-12px] !h-6 !w-[70px]" :rotate="-6" />
      <div class="flex items-start gap-2.5">
        <WarmDrop note class="shrink-0 text-ink" />
        <span class="font-hand text-19 font-semibold leading-[1.35]">อยากลองแต้มแสง<br />ลงไปสักนิดไหม</span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="min-h-[44px] flex-grow cursor-pointer rounded-[14px_16px_12px_18px] border-2 border-ink bg-ink font-hand text-16 font-semibold text-paper" @click="app.tryWarm()">ลองดู</button>
        <button type="button" class="min-h-[44px] cursor-pointer border-0 bg-transparent px-3 font-hand text-15 font-semibold text-ink underline underline-offset-4" @click="app.dismissWarmNote()">ไว้ก่อน</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import Tape from '@/components/ui/Tape.vue'
import WarmDrop from '@/components/paint/WarmDrop.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<style scoped>
.note-enter-active,
.note-leave-active {
  transition: opacity 0.3s, transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.note-enter-from,
.note-leave-to {
  opacity: 0;
  transform: translateY(10px) rotate(-1.8deg);
}
@media (prefers-reduced-motion: reduce) {
  .note-enter-active,
  .note-leave-active {
    transition: opacity 0.15s;
  }
  .note-enter-from,
  .note-leave-to {
    transform: rotate(-1.8deg);
  }
}
</style>
