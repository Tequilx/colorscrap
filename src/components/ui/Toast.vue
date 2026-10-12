<template>
  <!-- ข้อความสั้น ๆ กลางล่างของโต๊ะ (SPEC §6.6) -->
  <Transition name="fade">
    <div
      v-if="toast.message"
      role="status"
      class="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-[18px_22px_16px_20px] border-2 border-ink bg-white px-6 py-3 font-hand text-19 shadow-card"
      :class="toast.action ? 'pointer-events-auto' : 'pointer-events-none'"
    >
      {{ toast.message }}
      <!-- ข้อความที่ต้องกดต่อ (เช่น แชร์รูปที่ทำเสร็จหลังหลุดจังหวะกด) ปุ่มนี้เรียก share ใหม่ใน gesture ของการกดจริง -->
      <button v-if="toast.action" type="button" class="min-h-[44px] cursor-pointer rounded-[14px_18px_12px_16px] border-2 border-ink bg-ink px-4 font-hand text-17 font-semibold text-paper" @click="toast.runAction()">
        {{ toast.action.label }}
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>
