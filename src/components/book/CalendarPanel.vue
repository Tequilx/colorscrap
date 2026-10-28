<template>
  <!-- ปฏิทินเดือนเล็กแบบกระดาษแปะบนหน้าขวา: เลือกวันที่มีภาพแล้วพลิกไปวันนั้น -->
  <Teleport to="body" :disabled="!small">
  <Transition name="cal">
    <div v-if="open" ref="panel" role="dialog" aria-label="ปฏิทินเลือกวัน จุดสีคือสีเด่นของวันนั้น วันที่ไม่มีภาพกดไม่ได้" class="absolute top-[20px] z-[40] box-border w-[380px] rounded-[6px] border border-edge bg-card px-[18px] pb-3 pt-6 shadow-card" :style="placement" @keydown="onPanelKey">
      <Tape class="left-[150px] top-[-11px]" :rotate="-2" />

      <div class="flex items-center gap-1">
        <button type="button" class="cal-btn" :disabled="monthIdx <= range.min" aria-label="เดือนก่อนหน้า" @click="shift(-1)">‹</button>
        <h2 class="m-0 min-w-0 flex-1 text-center font-hand text-22 font-semibold leading-none text-ink" aria-live="polite">{{ title }}</h2>
        <button type="button" class="cal-btn" :disabled="monthIdx >= range.max" aria-label="เดือนถัดไป" @click="shift(1)">›</button>
        <button type="button" class="cal-btn ml-1" aria-label="ปิดปฏิทิน" @click="$emit('close')">✕</button>
      </div>

      <div class="mt-2 grid grid-cols-7 text-center text-13 text-ink-soft" aria-hidden="true">
        <span v-for="w in WEEK" :key="w" class="py-1">{{ w }}</span>
      </div>
      <div class="border-t border-dashed border-faint pt-1">
        <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7">
          <template v-for="(d, di) in week" :key="di">
            <span v-if="!d" class="h-[48px]"></span>
            <button
              v-else
              type="button"
              class="cal-day relative box-border h-[48px] min-w-[44px] cursor-pointer rounded-[10px] border-0 bg-transparent p-0 pb-2 font-hand text-16 font-semibold text-ink disabled:cursor-default disabled:font-normal disabled:text-faint"
              :class="[d === current ? 'bg-wash' : '', d === today ? 'ring-[1.5px] ring-ink' : '']"
              :disabled="!has.has(d)"
              :aria-label="labelOf(d)"
              :aria-current="d === current ? 'date' : undefined"
              :data-date="d"
              @click="$emit('pick', d)"
            >
              {{ Number(d.slice(8)) }}
              <span v-if="has.has(d)" class="absolute bottom-[7px] left-1/2 block h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-line" :style="{ background: hexOf(d) }" aria-hidden="true"></span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Tape from '@/components/ui/Tape.vue'
import { DAYS_FULL, MONTHS_FULL, parseLocalDate } from '@/lib/dates'
import { clampMonth, monthCells, monthIndex, monthOfIndex, monthRange } from '@/lib/dayTabs'

const props = defineProps({
  open: { type: Boolean, default: false },
  current: { type: String, default: null }, // วันที่เปิดอยู่
  dates: { type: Array, required: true }, // วันที่มีภาพทั้งหมด เก่า → ใหม่
  hexOf: { type: Function, required: true },
  today: { type: String, required: true },
})
const emit = defineEmits(['pick', 'close'])

const WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const panel = ref(null)

// เวที 1280×800 ย่อตามหน้าจอ (Stage.vue: min(กว้าง/1280, สูง/800)) บนจอเล็กหรือไอแพดแนวตั้ง (ย่อ < 0.8) ปุ่ม 44 หน่วยในเวทีจะเหลือต่ำกว่า 44 px จริง และเวทียัง clip ของที่ใหญ่กว่ากรอบ
// จึงย้ายปฏิทินออกไปที่ body เป็นแผ่นกลางจอหน่วย px จริง (ปุ่มวัน ≥ 44 px) · จอใหญ่อยู่บนหน้าขวาของสมุด
const stageScale = ref(1)
const fit = () => (stageScale.value = Math.min(window.innerWidth / 1280, window.innerHeight / 800))
fit()
if (typeof window !== 'undefined') window.addEventListener('resize', fit)
const small = computed(() => stageScale.value < 0.8)
const placement = computed(() =>
  small.value
    ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(380px, calc(100vw - 16px))', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', zIndex: 100 }
    : { right: '14px' },
)
const monthIdx = ref(0)
const has = computed(() => new Set(props.dates))
const range = computed(() => monthRange(props.dates, parseLocalDate(props.today)))
const weeks = computed(() => {
  const { year, month0 } = monthOfIndex(monthIdx.value)
  return monthCells(year, month0)
})
const title = computed(() => {
  const { year, month0 } = monthOfIndex(monthIdx.value)
  return `${MONTHS_FULL[month0]} ${year + 543}` // พ.ศ.
})
const shift = (n) => (monthIdx.value = clampMonth(monthIdx.value + n, range.value))
const labelOf = (d) => {
  const x = parseLocalDate(d)
  return `${DAYS_FULL[x.getDay()]} ${x.getDate()} ${MONTHS_FULL[x.getMonth()]} ${x.getFullYear() + 543}${has.value.has(d) ? '' : ' ไม่มีภาพ'}${d === props.today ? ' วันนี้' : ''}`
}

// แตะนอกกรอบ = ปิด (ยกเว้นแท็บปฏิทินเอง ที่สลับเปิด/ปิดเอง) · Esc = ปิด (อยู่ใน panel; ฟังที่ document ด้วยเผื่อโฟกัสหลุด)
const onOutside = (e) => {
  if (panel.value && !panel.value.contains(e.target) && !e.target.closest?.('[data-cal-tab]')) emit('close')
}
// โฟกัสวนอยู่ในปฏิทิน (Tab จากปุ่มสุดท้าย → ปุ่มแรก และกลับกัน) · Esc ปิด
const onPanelKey = (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const items = [...(panel.value?.querySelectorAll('button:not([disabled])') ?? [])]
  if (!items.length) return
  const first = items[0]
  const last = items.at(-1)
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
const onKey = (e) => {
  if (e.key === 'Escape') emit('close')
}
watch(
  () => props.open,
  async (on) => {
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKey)
    if (!on) return
    monthIdx.value = clampMonth(monthIndex(props.current ?? props.today), range.value)
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
    await nextTick()
    // โฟกัสวันที่เปิดอยู่ (ถ้ามีในเดือนนี้) ไม่งั้นวันแรกที่กดได้ ไม่งั้นปุ่มปิด
    const root = panel.value
    ;(root?.querySelector(`[data-date="${props.current}"]:not([disabled])`) ?? root?.querySelector('.cal-day:not([disabled])') ?? root?.querySelector('[aria-label="ปิดปฏิทิน"]'))?.focus()
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  document.removeEventListener('pointerdown', onOutside, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<style>
/* ปุ่มมุมหัวปฏิทิน: พื้นที่กด ≥ 44×44 */
.cal-btn {
  box-sizing: border-box;
  height: 48px;
  min-width: 44px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-family: inherit;
  font-size: 22px;
  line-height: 1;
}
.cal-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.cal-enter-active,
.cal-leave-active {
  transition:
    opacity calc(200ms * var(--motion-scale, 1)) cubic-bezier(0, 0, 0.2, 1),
    transform calc(200ms * var(--motion-scale, 1)) cubic-bezier(0, 0, 0.2, 1);
}
.cal-enter-from,
.cal-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .cal-enter-from,
  .cal-leave-to {
    transform: none;
  }
}
</style>
