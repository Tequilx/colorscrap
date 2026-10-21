<template>
  <!-- ปุ่มเปิด/ปิดเสียง (มุมขวาบนของเวที) พื้นที่แตะ 40px ไอคอนเส้นลายมือชุดเดียวกับปุ่มอื่น -->
  <button
    type="button"
    class="absolute right-1 top-1 z-[60] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-soft transition-colors duration-450 ease-desk hover:text-ink"
    :aria-label="soundOn ? 'ปิดเสียง' : 'เปิดเสียง'"
    :aria-pressed="String(soundOn)"
    @click="toggle"
  >
    <Doodle :name="soundOn ? 'sound' : 'mute'" :size="22" />
  </button>
</template>

<script setup>
import Doodle from '@/components/ui/Doodle.vue'
import { soundOn, setSound, sound } from '@/lib/sound'

const toggle = () => {
  setSound(!soundOn.value)
  if (soundOn.value) sound.tap()
}
</script>
