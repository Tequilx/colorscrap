<template>
  <!-- ปุ่มเสียงมุมขวาบนของเวที: 2 ปุ่มข้างกัน (พื้นที่กด 44px ไอคอนอยู่ที่เดิม) (เพลง / เอฟเฟกต์) เปิดปิดแยกกัน จำค่าแยก ไอคอนเส้นลายมือชุดเดียวกับปุ่มอื่น -->
  <div class="absolute -right-[3px] -top-0.5 z-[60] flex">
    <button
      type="button"
      class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-soft transition-colors duration-450 ease-desk hover:text-ink"
      :aria-label="musicOn ? 'ปิดเพลง' : 'เปิดเพลง'"
      :aria-pressed="String(musicOn)"
      @click="toggleMusic"
    >
      <Doodle :name="musicOn ? 'music' : 'musicOff'" :size="20" />
    </button>
    <button
      type="button"
      class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-soft transition-colors duration-450 ease-desk hover:text-ink"
      :aria-label="soundOn ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'"
      :aria-pressed="String(soundOn)"
      @click="toggleEffects"
    >
      <Doodle :name="soundOn ? 'sound' : 'mute'" :size="20" />
    </button>
  </div>
</template>

<script setup>
import Doodle from '@/components/ui/Doodle.vue'
import { musicOn, setMusic, soundOn, setSound, sound } from '@/lib/sound'

const toggleMusic = () => setMusic(!musicOn.value)
const toggleEffects = () => {
  setSound(!soundOn.value)
  if (soundOn.value) sound.tap()
}
</script>
