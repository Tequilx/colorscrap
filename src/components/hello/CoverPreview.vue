<template>
  <!-- ฝั่งขวาของหน้า hello: ป้ายกำกับ + ปุ่มเริ่มใช้สมุด (ตัวปกเองคือ Scrapbook ที่เลื่อนมาอยู่ตรงนี้) -->
  <div class="absolute left-[790px] top-[80px] flex w-[420px] flex-col items-center">
    <span class="text-14 text-ink-soft">ตัวอย่างปกของคุณ</span>
    <!-- เว้นที่ให้ปก 340×440 (วางโดย Scrapbook) -->
    <div class="h-[440px] w-[340px] mt-7" aria-hidden="true"></div>
    <HandButton class="mt-7" :disabled="!canStart" @click="start">
      {{ app.helloEditing ? 'บันทึก' : 'เริ่มใช้สมุด' }}
      <Doodle name="forward" :size="22" />
    </HandButton>
    <span v-if="!canStart" class="mt-2 text-14 text-ink-soft">ใส่ชื่อก่อนนะ</span>
    <span v-else-if="profile.saveError" role="alert" class="mt-2 text-14 text-ink-soft">{{ profile.saveError }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'

const app = useAppStore()
const profile = useProfileStore()

// ตาราง profiles บังคับชื่อ 1–20 ตัวอักษร (SPEC §7.2) จึงต้องมีชื่อก่อน
const canStart = computed(() => profile.shownName.length > 0)

const start = async () => {
  if (await profile.save()) app.finishHello()
}
</script>
