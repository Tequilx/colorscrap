<template>
  <!-- ปุ่มเสียงมุมขวาบน (ข้อ 36): ปุ่มไอคอนสไตล์เดียวกับ "หน้าแรก"/ตั้งค่า (HandButton icon 48px กรอบวาดมือ) แถวเดียวกับปุ่มหน้าแรกฝั่งซ้าย (top 24)
       เพลง / เอฟเฟกต์ เปิดปิดแยกกัน aria-pressed = เปิดอยู่ ไอคอนปิดมีเส้นขีดทับ · หน้าแรกมีปุ่มตั้งค่าอยู่ขวาสุด จึงขยับเข้ามา 60px
       หน้า saved ซ่อน (การ์ดและสมุดซูมกินพื้นที่มุมขวาบน ไม่มีที่ให้วางโดยไม่ทับ) -->
  <div
    class="absolute top-6 z-[60] flex gap-3 transition-opacity duration-450 ease-desk"
    :class="[view === 'cover' ? 'right-[96px]' : 'right-9', view === 'saved' ? 'pointer-events-none opacity-0' : '']"
    :inert="view === 'saved'"
  >
    <HandButton variant="icon" solid aria-label="เพลง" :aria-pressed="String(musicOn)" @click="toggleMusic">
      <Doodle :name="musicOn ? 'music' : 'musicOff'" :size="22" />
    </HandButton>
    <HandButton variant="icon" solid aria-label="เสียงเอฟเฟกต์" :aria-pressed="String(soundOn)" @click="toggleEffects">
      <Doodle :name="soundOn ? 'sound' : 'mute'" :size="22" />
    </HandButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Doodle from '@/components/ui/Doodle.vue'
import HandButton from '@/components/ui/HandButton.vue'
import { musicOn, setMusic, soundOn, setSound, sound } from '@/lib/sound'
import { useAppStore } from '@/stores/app'

const view = computed(() => useAppStore().view)
const toggleMusic = () => setMusic(!musicOn.value)
const toggleEffects = () => {
  setSound(!soundOn.value)
  if (soundOn.value) sound.tap()
}
</script>
