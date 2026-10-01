<template>
  <div class="absolute inset-x-0 bottom-0.5 flex items-center justify-center gap-2.5">
    <button type="button" aria-label="แผ่นก่อนหน้า" :disabled="index === 0" class="flex h-8 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink disabled:cursor-not-allowed disabled:opacity-30" @click="$emit('go', index - 1)">
      <Doodle name="back" :size="20" />
    </button>
    <span class="min-w-[70px] text-center font-hand text-15 font-semibold" aria-live="polite">แผ่น {{ index + 1 }} / {{ total }}</span>
    <button type="button" aria-label="แผ่นถัดไป" :disabled="index === total - 1" class="flex h-8 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink disabled:cursor-not-allowed disabled:opacity-30" @click="$emit('go', index + 1)">
      <Doodle name="forward" :size="20" />
    </button>
  </div>
</template>

<script setup>
import Doodle from '@/components/ui/Doodle.vue'

defineProps({ index: { type: Number, required: true }, total: { type: Number, required: true } })
defineEmits(['go'])
</script>
