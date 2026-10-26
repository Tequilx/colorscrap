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
        <div class="flex flex-col gap-1">
          <span class="whitespace-nowrap font-hand text-26 font-semibold leading-head">{{ title }}</span>
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
        <!-- สีของวัน: ก้อนสีน้ำก้อนเดียว (สีผสมของวัน ก้อนเล็กข้างในเป็นสีเด่น) ในกรอบกระดาษ bg-card ขอบเท่ากันทุกด้าน (~8%) เอียง −3° เงา card ไม่มีเทป (แบบ 11/12) -->
        <div class="absolute left-10 top-[80px] flex w-[412px] items-center gap-6">
          <div class="pal-seep relative h-[138px] w-[138px] shrink-0 -rotate-3 bg-card p-[11px] shadow-card" data-day-frame :style="reveal(0, 'seep')">
            <div class="relative h-full w-full bg-paper-deep">
              <WatercolorBlob class="absolute left-[-4px] top-[10px]" :color="mix" :width="124" :height="96" :opacity="0.85" />
              <WatercolorBlob v-if="dominant" class="absolute left-[28px] top-[34px]" :color="dominant" :width="58" :height="42" :opacity="0.7" />
            </div>
          </div>
          <div class="pal-rise flex min-w-0 flex-col gap-1" :style="reveal(1, 'rise')">
            <span class="text-13 text-ink-soft">{{ isToday ? 'สีของวันนี้' : 'สีของวัน' }}</span>
            <span class="font-hand text-26 font-semibold leading-stack">{{ name.colorPart }}<br />{{ name.periodPart }}</span>
          </div>
        </div>

        <!-- แถบสีของวันตามลำดับเวลา: ไล่จากซ้ายไปขวาตอนเข้าสมุด (DayRibbon animate reveal ตาม bookTick เหมือน stagger เดิม) -->
        <div class="absolute left-10 top-[230px] flex w-[412px] flex-col gap-2">
          <span class="pal-fade font-hand text-17 font-semibold" :style="reveal(3, 'fade')">สีของวันตามลำดับเวลา</span>
          <DayRibbon :entries="entries" animate="reveal" :delay="ribbonDelay" :width="412" />
        </div>

        <!-- สรุปอารมณ์ของวัน (ข้อ 39): ประโยคทักบรรทัดบน + รายการ หยดสี · ชื่ออารมณ์ · จำนวนภาพ เรียงมาก→น้อย
             เกินพื้นที่ → เลื่อนได้ในกล่อง (ขอบจางด้านล่างบอกว่ายังมีต่อ) กล่องสูงคงที่ ไม่ดันส่วนอื่น -->
        <div class="pal-rise absolute left-10 top-[452px] flex h-[84px] w-[412px] flex-col gap-0.5 text-ink-2" :style="reveal(2, 'rise')">
          <p class="m-0 text-15 leading-thai">{{ summary.greeting }}</p>
          <ul
            ref="moodList"
            class="mood-list m-0 min-h-0 flex-1 list-none overflow-y-auto p-0 pr-1"
            :class="moreBelow ? 'mood-fade' : ''"
            aria-label="อารมณ์ของวันนี้ เรียงจากมากไปน้อย"
            tabindex="0"
            @scroll="checkScroll"
          >
            <li v-for="row in summary.rows" :key="row.key" class="flex h-[26px] items-center gap-2 text-15 leading-thai">
              <WatercolorBlob :color="row.hex" :width="22" :height="16" :opacity="0.85" />
              <span class="font-hand font-semibold">{{ row.th }}</span>
              <span class="text-ink-soft">{{ row.n }} ภาพ</span>
            </li>
          </ul>
        </div>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import DayRibbon from '@/components/book/DayRibbon.vue'
import WatercolorBlob from '@/components/ui/WatercolorBlob.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { dayColor, dominantColorOfDay, nameOfDay } from '@/lib/palette'
import { EMOTION_BY_KEY } from '@/lib/emotions'
import { localDateStr, parseLocalDate, thaiDateShort } from '@/lib/dates'
import { useAppStore } from '@/stores/app'
import { useShareStore } from '@/stores/share'
import { ms, scaled } from '@/lib/motion'
import { MOTION, PALETTE } from '@/lib/tokens'

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
const mix = computed(() => color.value?.mix ?? PALETTE.mute)
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

// สรุปท้ายหน้า (SPEC §5.7): ประโยคทักจาก template (ไม่ใช้ AI) + รายการอารมณ์ เรียงมาก→น้อย เสมอกันใช้ภาพล่าสุด
const summary = computed(() => {
  const list = props.entries
  if (!list.length) return { greeting: '', rows: [] }
  const th = (key) => EMOTION_BY_KEY[key].th
  const lastIndex = (key) => list.map((e) => e.emotion).lastIndexOf(key)
  const ranked = [...counts.value.entries()].sort((a, b) => b[1] - a[1] || lastIndex(b[0]) - lastIndex(a[0]))
  const rows = ranked.map(([key, n]) => ({ key, n, th: th(key), hex: EMOTION_BY_KEY[key].hex }))
  if (list.length >= 5) return { greeting: 'วันนี้แวะมาบ่อยเลยนะ', rows }
  const [main, second] = ranked
  if (!second) return { greeting: list.length === 1 ? `${th(main[0])} ตอน${dayPart(list[0].local_time)}` : `${th(main[0])}ทั้งวันเลย`, rows }
  const secondEntry = list[lastIndex(second[0])]
  const shiftedNote = secondEntry.shifted ? 'ที่ค่อย ๆ มีแสงขึ้น' : ''
  return { greeting: `ส่วนใหญ่${th(main[0])} มีช่วง${th(second[0])}ตอน${dayPart(secondEntry.local_time)}${shiftedNote}`, rows }
})

// ขอบจางด้านล่างของรายการ: แสดงเมื่อยังเลื่อนลงได้อีก
const moodList = ref(null)
const moreBelow = ref(false)
const checkScroll = () => {
  const el = moodList.value
  moreBelow.value = Boolean(el) && el.scrollHeight - el.scrollTop - el.clientHeight > 2
}
watch(() => [props.entries, props.date], () => nextTick(checkScroll), { immediate: false })
onMounted(() => nextTick(checkScroll))
</script>

<style>
/* รายการอารมณ์: scrollbar บางสีตาม token (ink-soft/line) เลื่อนด้วยนิ้วได้ ขอบจางด้านล่างเมื่อยังมีต่อ */
.mood-list {
  scrollbar-width: thin;
  scrollbar-color: theme('colors.faint') transparent;
  touch-action: pan-y;
  overscroll-behavior: contain;
}
.mood-list::-webkit-scrollbar {
  width: 4px;
}
.mood-list::-webkit-scrollbar-thumb {
  @apply rounded-full bg-faint;
}
.mood-fade {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
}
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
