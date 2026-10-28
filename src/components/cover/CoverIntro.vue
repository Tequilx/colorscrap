<template>
  <!-- หน้า cover: ข้อความและปุ่มฝั่งขวา (สมุดปิดฝั่งซ้ายคือ Scrapbook) — SPEC §5.1 -->
  <div>
    <!-- ปรับแต่งหน้าตาสมุด: ปุ่มพื้นทึบ 56px + ป้ายใต้ปุ่ม เด่นกว่าปุ่มเสียงที่เป็นกรอบเส้น และแยกกลุ่มจากปุ่มเสียง -->
    <div class="absolute right-9 top-6 flex flex-col items-center gap-1">
      <HandButton variant="icon" filled large aria-label="ปรับแต่งหน้าตาสมุด" @click="app.openSettings()">
        <Doodle name="settings" :size="26" />
      </HandButton>
      <span class="font-hand text-14 font-semibold leading-thai text-ink" aria-hidden="true">ปรับแต่ง</span>
    </div>

    <div class="absolute left-[678px] top-0 flex h-[800px] w-[440px] flex-col justify-center gap-[22px]">
      <span class="text-15 font-medium text-ink-soft">{{ dateText }}</span>
      <h1 class="m-0 font-hand text-52 font-semibold leading-head">{{ greeting }}</h1>
      <p class="m-0 text-19 leading-[1.7] text-ink-2">วันนี้คุณรู้สึกอย่างไร<br />ไม่ต้องหาคำพูดอะไรมาอธิบาย<br />แค่ลองเลือกสี แล้วปลดปล่อยมันออกมา</p>
      <div class="flex items-center gap-3.5 pt-1.5">
        <HandButton @click="app.go('pick')">เลือกความรู้สึกวันนี้</HandButton>
        <HandButton variant="secondary" @click="app.go('book')"><Doodle name="book" :size="22" /> เปิดสมุด</HandButton>
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
import { greetingHour } from '@/lib/daylight'

const app = useAppStore()
const entries = useEntriesStore()

// คำนวณครั้งเดียวตอนเปิดหน้า (ไม่ต้องอัปเดตทุกนาที)
const now = new Date()
const dateText = thaiDayFull(now)
const greeting = computed(() => greetingFor(greetingHour(now.getHours())))
</script>
