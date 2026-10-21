<template>
  <!-- หน้าขวา: จานสีประจำวัน (SPEC §5.7) -->
  <div class="absolute left-[506px] top-[14px] h-[612px] w-[492px] rounded-[0_6px_6px_0] bg-paper shadow-[inset_18px_0_22px_-16px_rgba(45,43,51,0.35)]">
    <!-- หน้า saved: การ์ดทับหน้านี้อยู่ ซ่อนเนื้อหาทั้งหมด เหลือแต่กระดาษ -->
    <!-- ออก: fade, เข้า: ทีละส่วนตาม bookTick (ไม่เล่นซ้ำตอนพลิกแผ่น/เปลี่ยนวัน เพราะ key เปลี่ยนเฉพาะตอนเข้า book) -->
    <Transition leave-active-class="fade-leave-active" leave-to-class="fade-leave-to">
    <div v-if="!hidden" class="absolute inset-0">
    <!-- key = bookTick: เข้า book ใหม่แล้วสร้างเนื้อหาใหม่ (แทนที่ทันที ไม่มี fade ซ้อน) เพื่อเล่นการปรากฏทีละส่วนใหม่ -->
    <div :key="app.bookTick" class="absolute inset-0">
      <!-- หัวข้อ + จำนวนภาพใต้หัวข้อ (ซ้าย) กับปุ่ม "เก็บรูป" ที่เก็บการ์ดจานสีของวันที่เปิดอยู่ (ขวา) วันที่ไม่มีภาพปุ่มกดไม่ได้ -->
      <div class="absolute left-10 top-[22px] flex w-[412px] items-center justify-between">
        <div class="flex flex-col">
          <span class="whitespace-nowrap font-hand text-26 font-semibold leading-[1.25]">{{ title }}</span>
          <span v-if="entries.length" class="whitespace-nowrap text-13 text-ink-soft">{{ entries.length }} ภาพ · {{ moodCount }} อารมณ์</span>
        </div>
        <button
          type="button"
          class="relative inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent py-0 pl-2.5 pr-3.5 font-hand text-15 font-semibold text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
          aria-label="เก็บจานสีวันนี้เป็นรูป"
          :aria-disabled="canSave ? undefined : 'true'"
          @click="saveCard"
        >
          <span class="pointer-events-none absolute inset-0 rounded-[14px_18px_12px_16px] border-2 border-ink bg-white filter-wob" aria-hidden="true"></span>
          <span class="relative inline-flex items-center gap-1.5"><Doodle name="download" :size="20" /> {{ share.busy.day ? 'กำลังทำรูป…' : 'เก็บรูป' }}</span>
        </button>
      </div>

      <p v-if="!entries.length" class="pal-rise absolute left-10 top-[120px] m-0 w-[412px] text-16 leading-[1.7] text-ink-soft" :style="reveal(1, 'rise')">ยังไม่มีสีของวันนี้ ลองระบายสักภาพแล้วสีจะมารวมกันตรงนี้</p>

      <template v-else>
        <!-- สีของวัน: ก้อนสีน้ำก้อนเดียว (สีผสมของวัน ก้อนเล็กข้างในเป็นสีเด่น) + ชื่อสี + hex (แบบ 11-book-v2) -->
        <div class="absolute left-10 top-[88px] flex w-[412px] items-center gap-5">
          <div class="pal-seep relative h-[112px] w-[150px] shrink-0 bg-paper-deep" :style="reveal(0, 'seep')">
            <WatercolorBlob class="absolute left-[6px] top-[2px]" :color="mix" :width="138" :height="98" :opacity="0.85" />
            <WatercolorBlob v-if="dominant" class="absolute left-[44px] top-[30px]" :color="dominant" :width="62" :height="44" :opacity="0.7" />
          </div>
          <div class="pal-rise flex min-w-0 flex-col gap-1" :style="reveal(1, 'rise')">
            <span class="text-13 text-ink-soft">{{ isToday ? 'สีของวันนี้' : 'สีของวัน' }}</span>
            <span class="font-hand text-26 font-semibold leading-[1.25]">{{ name.colorPart }}<br />{{ name.periodPart }}</span>
            <code class="font-mono text-13 text-ink-soft">{{ mix.toUpperCase() }}</code>
          </div>
        </div>

        <!-- แถบสีของวันตามลำดับเวลา: ไล่จากซ้ายไปขวาตอนเข้าสมุด (DayRibbon animate reveal ตาม bookTick เหมือน stagger เดิม) -->
        <div class="absolute left-10 top-[230px] flex w-[412px] flex-col gap-2">
          <span class="pal-fade font-hand text-17 font-semibold" :style="reveal(3, 'fade')">สีของวันตามลำดับเวลา</span>
          <DayRibbon :entries="entries" animate="reveal" :delay="ribbonDelay" :width="412" />
        </div>

        <p class="pal-rise absolute left-10 top-[472px] m-0 w-[412px] text-16 leading-[1.7] text-ink-2" :style="reveal(2, 'rise')">{{ summary }}</p>
      </template>

      <div class="absolute inset-x-10 bottom-[22px] flex items-center justify-between border-t-[1.5px] border-dashed border-line pt-2">
        <button v-if="prevDate" type="button" class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-hand text-16 font-semibold text-ink" @click="$emit('day', prevDate)">
          <Doodle name="back" :size="20" /> {{ shortLabel(prevDate) }}
        </button>
        <span v-else></span>
        <button v-if="nextDate" type="button" class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-hand text-16 font-semibold text-ink" @click="$emit('day', nextDate)">
          {{ shortLabel(nextDate) }} <Doodle name="forward" :size="20" />
        </button>
        <span v-else class="text-14 text-ink-soft">หน้าล่าสุด</span>
      </div>
    </div>
    </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DayRibbon from '@/components/book/DayRibbon.vue'
import WatercolorBlob from '@/components/ui/WatercolorBlob.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { dayColor, dominantColorOfDay, nameOfDay } from '@/lib/palette'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { localDateStr, parseLocalDate, thaiDateShort } from '@/lib/dates'
import { useAppStore } from '@/stores/app'
import { useShareStore } from '@/stores/share'
import { ms, scaled } from '@/lib/motion'
import { MOTION } from '@/lib/tokens'

const props = defineProps({
  date: { type: String, required: true },
  entries: { type: Array, required: true }, // ของวันนั้น เรียงตามเวลา
  prevDate: { type: String, default: null },
  nextDate: { type: String, default: null },
  newId: { type: String, default: null },
  // หน้า saved: ซ่อนเนื้อหาทั้งหมด (การ์ดทับอยู่)
  hidden: { type: Boolean, default: false },
})

defineEmits(['day'])

const app = useAppStore()
const share = useShareStore()

// ปรากฏทีละส่วน: เริ่มหลังสมุดเข้าที่ (settle + lead) แล้วเรียงห่างกัน step (รวม ~850ms นับจากเริ่มส่วนแรก ไม่เกิน ~1s)
// ลำดับ 0 หยดสีผสม (ซึมลง) → 1 ชื่อสี → 2 ข้อความสรุป → 3 timeline
const reveal = (order, kind) => ({
  '--d': scaled(MOTION.settle + MOTION.reveal.lead + order * MOTION.reveal.step),
  '--dur': scaled(MOTION.reveal[kind]),
})

// แถบสีเริ่มไล่หลังลำดับที่ 3 ของ stagger (หัวข้อ "สีของวันตามลำดับเวลา" ขึ้นพร้อมกัน)
const ribbonDelay = ms(MOTION.settle + MOTION.reveal.lead + 3 * MOTION.reveal.step)
const dominant = computed(() => dominantColorOfDay(props.entries))

const isToday = computed(() => props.date === localDateStr())
const title = computed(() => (isToday.value ? 'จานสีของวันนี้' : `จานสีของ ${thaiDateShort(parseLocalDate(props.date))}`))
const shortLabel = (d) => thaiDateShort(parseLocalDate(d))

const color = computed(() => dayColor(props.entries))
const mix = computed(() => color.value?.mix ?? '#8E8A93')
const name = computed(() => color.value?.name ?? nameOfDay(mix.value, '12:00'))

const counts = computed(() => {
  const map = new Map()
  props.entries.forEach((e) => map.set(e.emotion, (map.get(e.emotion) ?? 0) + 1))
  return map
})
const moodCount = computed(() => counts.value.size)

// เก็บการ์ดจานสีของวันที่เปิดดูอยู่ (ไม่มีเมนู) วันที่ไม่มีภาพ หรือกำลังทำรูปอยู่ = กดไม่ได้
const canSave = computed(() => props.entries.length > 0 && !share.busy.day)
const saveCard = () => {
  if (canSave.value) share.dayCard(props.date, props.entries)
}

// ช่วงเวลาสั้น ๆ ในประโยคสรุป เช่น "ตอนบ่าย"
const dayPart = (time) => {
  const h = Number(time.slice(0, 2))
  if (h >= 5 && h < 11) return 'เช้า'
  if (h >= 11 && h < 14) return 'เที่ยง'
  if (h >= 14 && h < 17) return 'บ่าย'
  if (h >= 17 && h < 19) return 'เย็น'
  return 'ค่ำ'
}

// สรุปท้ายหน้า: ข้อความสั้นหนึ่งบรรทัดจาก template ไม่ใช้ AI (SPEC §5.7)
const summary = computed(() => {
  const list = props.entries
  if (!list.length) return ''
  const th = (key) => EMOTION_BY_KEY[key].th
  // เรียงตามจำนวนมาก→น้อย เสมอกันใช้ภาพล่าสุด
  const lastIndex = (key) => list.map((e) => e.emotion).lastIndexOf(key)
  const ranked = [...counts.value.entries()].sort((a, b) => b[1] - a[1] || lastIndex(b[0]) - lastIndex(a[0]))
  if (list.length >= 5) return `${ranked.map(([k, n]) => `${th(k)} ${n}`).join(' · ')} วันนี้แวะมาบ่อยเลยนะ`
  const [main, second] = ranked
  if (!second) return list.length === 1 ? `${th(main[0])} ตอน${dayPart(list[0].local_time)}` : `${th(main[0])}ทั้งวันเลย`
  const secondEntry = list[lastIndex(second[0])]
  const shiftedNote = secondEntry.shifted ? 'ที่ค่อย ๆ มีแสงขึ้น' : ''
  return `ส่วนใหญ่${th(main[0])} มีช่วง${th(second[0])}ตอน${dayPart(secondEntry.local_time)}${shiftedNote}`
})
</script>

<style>
/* animation-fill-mode: backwards ให้ซ่อนอยู่ระหว่างรอ delay โดยไม่ต้องมี state และไม่ขวางการกดปุ่ม */
.pal-seep {
  animation: pal-seep var(--dur) cubic-bezier(0.2, 0.8, 0.2, 1) var(--d) backwards;
}
.pal-rise {
  animation: pal-rise var(--dur) cubic-bezier(0.2, 0.8, 0.2, 1) var(--d) backwards;
}
.pal-fade {
  animation: pal-fade var(--dur) cubic-bezier(0.2, 0.8, 0.2, 1) var(--d) backwards;
}
@keyframes pal-seep {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}
@keyframes pal-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes pal-fade {
  from {
    opacity: 0;
  }
}
/* reduced-motion: ทั้งก้อน fade ครั้งเดียว ≤150ms พร้อมกัน (duration/delay ถูกบีบใน app.css) ตัด scale และการเลื่อน */
@media (prefers-reduced-motion: reduce) {
  .pal-seep,
  .pal-rise {
    animation-name: pal-fade;
  }
}
</style>
