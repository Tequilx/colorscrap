<template>
  <!-- ข้อความสั้น ๆ กลางล่างของโต๊ะ (SPEC §6.6) -->
  <Transition name="fade">
    <div
      v-if="toast.message"
      role="status"
      class="pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[18px_22px_16px_20px] border-2 border-ink bg-white px-6 py-3 font-hand text-19 shadow-card"
    >
      {{ toast.message }}
    </div>
  </Transition>
</template>

<script setup>
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>
