<template>
  <!-- หน้า cover: ข้อความและปุ่มฝั่งขวา (สมุดปิดฝั่งซ้ายคือ Scrapbook) — SPEC §5.1 -->
  <div>
    <div class="absolute right-9 top-7">
      <HandButton variant="icon" aria-label="ตั้งค่าข้อมูลของฉัน" @click="app.openSettings()">
        <Doodle name="settings" :size="22" />
      </HandButton>
    </div>

    <div class="absolute left-[678px] top-0 flex h-[800px] w-[440px] flex-col justify-center gap-[22px]">
      <span class="text-15 font-medium text-ink-soft">{{ dateText }}</span>
      <h1 class="m-0 font-hand text-52 font-semibold leading-[1.15]">{{ greeting }}</h1>
      <p class="m-0 text-19 leading-[1.7] text-ink-2">วันนี้รู้สึกยังไงบ้าง ไม่ต้องอธิบายเป็นคำพูด แค่เลือกสีแล้วปล่อยให้มันไหลไป</p>
      <div class="flex items-center gap-3.5 pt-1.5">
        <HandButton @click="app.go('pick')">เลือกความรู้สึกวันนี้</HandButton>
        <!-- สมุดทั้งเล่มทำในช่วง C -->
        <HandButton variant="secondary" disabled><Doodle name="book" :size="22" /> เปิดสมุด</HandButton>
      </div>
      <WeekStrip :days="entries.lastSevenDays" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import WeekStrip from '@/components/cover/WeekStrip.vue'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'
import { greetingFor, thaiDayFull } from '@/lib/dates'

const app = useAppStore()
const entries = useEntriesStore()

// คำนวณครั้งเดียวตอนเปิดหน้า (ไม่ต้องอัปเดตทุกนาที)
const now = new Date()
const dateText = thaiDayFull(now)
const greeting = computed(() => greetingFor(now.getHours()))
</script>
