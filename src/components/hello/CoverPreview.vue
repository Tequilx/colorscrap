<template>
  <!-- ฝั่งขวาของหน้า hello เรียงแบบ flow (ข้อ 68): ป้ายกำกับ → ตัวอย่างปก → ปุ่มบันทึก/เริ่มใช้สมุด → (ช่องว่าง) → กลุ่มบัญชี (โหมดแก้ไข + ต่อ Supabase จริงเท่านั้น)
       ตัวปกเองคือ Scrapbook ที่เลื่อนมาอยู่ตรงนี้ (ตำแหน่ง/สเกล `CLOSED.hello` ใน Scrapbook.vue ต้องสอดคล้องกับช่องว่างด้านล่าง) · ห่างขอบล่างเวที ≥ 24px + safe-area (บวกไม่เกิน 24px เพราะ env เป็นพิกเซลจอ ไม่ใช่หน่วยเวที) -->
  <div class="absolute bottom-[calc(24px+min(env(safe-area-inset-bottom),24px))] left-[790px] top-[56px] flex w-[420px] flex-col items-center">
    <span class="text-14 text-ink-soft">ตัวอย่างปกของคุณ</span>
    <!-- เว้นที่ให้ปก 302×389 (วางโดย Scrapbook: scale 0.72 ของชั้นปก 420×540) -->
    <div class="mt-7 h-[389px] w-[302px] shrink-0" aria-hidden="true"></div>
    <HandButton class="mt-7" :disabled="!canStart" @click="start">
      {{ app.helloEditing ? 'บันทึก' : 'เริ่มใช้สมุด' }}
      <Doodle name="forward" :size="22" />
    </HandButton>
    <span v-if="!canStart" class="mt-2 text-14 text-ink-soft">{{ profile.likesTooMany ? 'เอา "ใจฟู" ออกให้เหลือ 3 อย่างก่อนนะ' : 'ใส่ชื่อก่อนนะ' }}</span>
    <span v-else-if="profile.saveError" role="alert" class="mt-2 text-14 text-ink-soft">{{ profile.saveError }}</span>
    <!-- กลุ่มบัญชี: ห่างปุ่มบันทึกอย่างน้อย 32px (pt-8) ดันลงไปติดขอบล่างด้วย mt-auto -->
    <div data-account-slot class="mt-auto w-full pt-8">
      <AccountActions v-if="app.helloEditing && !USE_MOCK" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import AccountActions from '@/components/hello/AccountActions.vue'
import { USE_MOCK } from '@/lib/supabase'
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'

const app = useAppStore()
const profile = useProfileStore()

// ตาราง profiles บังคับชื่อ 1–20 ตัวอักษร (SPEC §7.2) จึงต้องมีชื่อก่อน
const canStart = computed(() => profile.shownName.length > 0 && !profile.likesTooMany)

const start = async () => {
  if (await profile.save()) app.finishHello()
}
</script>
