<template>
  <!-- ดูภาพเดี่ยว (SPEC §5.8): ชั้นสี desk ทึบ 85% ทับทั้งโต๊ะ ภาพลอยขึ้นมาคู่กับการ์ดชาร์ตสีกลางจอ -->
  <Transition name="photo">
    <div v-if="active && entry" class="absolute inset-0" role="dialog" aria-modal="true" aria-label="ดูภาพและชาร์ตสี" @keydown="onTrap">
      <!-- พื้นที่ว่าง: คลิกเพื่อปิด -->
      <div class="absolute inset-0 bg-desk/85" @click="close"></div>

      <!-- ภาพกับการ์ดอยู่กึ่งกลางแนวตั้งทั้งคู่ วางคู่กันกลางจอ ห่างกัน 56px -->
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center gap-14">
        <!-- โพลารอยด์ขยาย ~2.2 เท่า (กล่อง 196×193 ขยายเป็น ~431×425) -->
        <div class="photo-lift relative h-[425px] w-[431px] shrink-0">
          <div class="pointer-events-auto absolute left-1/2 top-1/2 -ml-[98px] -mt-[96px] w-[196px] origin-center -rotate-2 scale-[2.2]">
            <Polaroid :caption="caption" :alt="`ภาพสีน้ำ ${emotion.th}`" :src="imageUrl" :colors="entry.colors.slice(0, 2).map((c) => c.hex)" :palette="entry.colors" :tape-rotate="-3" />
          </div>
        </div>

        <!-- การ์ดชาร์ตสี (สไตล์บัตรตัวอย่างสี) -->
        <div ref="cardRef" class="photo-lift pointer-events-auto box-border w-[460px] shrink-0 rounded-[22px_26px_20px_24px] border-2 border-ink bg-white px-7 pb-6 pt-5 shadow-[0_24px_44px_rgba(45,43,51,0.24)]">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col">
              <h2 class="m-0 font-hand text-26 font-semibold leading-[1.2]">สีในภาพนี้</h2>
              <span class="text-14 text-ink-soft">{{ entry.local_time }} · {{ emotion.th }}{{ entry.shifted ? ' → อุ่นขึ้น' : '' }} · {{ INTENSITY_LABELS[entry.intensity] }}</span>
            </div>
            <HandButton ref="closeRef" variant="secondary" @click="close"><Doodle name="close" :size="20" /> ปิด</HandButton>
          </div>

          <ul class="m-0 mt-3 flex list-none flex-col gap-1 border-t-[1.5px] border-dashed border-line p-0 pt-3">
            <li v-for="(c, i) in entry.colors" :key="c.hex" class="flex items-center gap-3">
              <!-- รอยพู่กันหนา ความยาวตาม ratio -->
              <svg width="250" height="44" viewBox="0 0 250 44" aria-hidden="true">
                <g class="filter-wct">
                  <path :d="swab(c.ratio)" fill="none" :stroke="c.hex" stroke-width="20" stroke-linecap="round" />
                </g>
              </svg>
              <span class="flex flex-col leading-tight">
                <code class="font-mono text-13 text-ink-2">{{ c.hex.toUpperCase() }}</code>
                <span class="font-hand text-17 font-semibold">{{ pct[i] }}%</span>
              </span>
            </li>
          </ul>

          <!-- แถบสัดส่วนรวมท้ายการ์ด -->
          <div class="mt-3 border-t-[1.5px] border-dashed border-line pt-3">
            <ColorStrip :colors="entry.colors" :height="16" rounded="rounded-[6px]" />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Polaroid from '@/components/ui/Polaroid.vue'
import ColorStrip from '@/components/ui/ColorStrip.vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { EMOTION_BY_KEY, INTENSITY_LABELS, emotionLabel } from '@/lib/emotions'
import { percentsOf } from '@/lib/palette'
import { useBlobUrl } from '@/lib/useBlobUrl'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entries = useEntriesStore()
const closeRef = ref(null)
const cardRef = ref(null)
let opener = null // ปุ่มที่เปิดภาพ (คืนโฟกัสให้ตอนปิด)

const active = computed(() => app.view === 'photo')
const entry = computed(() => entries.entries.find((e) => e.id === app.photoEntryId) ?? null)
const emotion = computed(() => EMOTION_BY_KEY[entry.value?.emotion ?? 'calm'])
const caption = computed(() => (entry.value ? `${entry.value.local_time} · ${emotionLabel(entry.value)}${entry.value.shifted ? ' → อุ่นขึ้น' : ''}` : ''))
// หน้า photo ใช้ภาพเต็ม สร้าง URL เฉพาะตอนเปิดดู (ปิดแล้วคืนหน่วยความจำ)
const imageUrl = useBlobUrl(() => (active.value ? entry.value?.image : null))
const pct = computed(() => (entry.value ? percentsOf(entry.value.colors) : []))

// เส้นรอยพู่กันยาวตาม ratio (สีที่มากที่สุดยาวเต็ม)
const swab = (ratio) => {
  const max = Math.max(...entry.value.colors.map((c) => c.ratio))
  const end = 20 + 210 * (0.3 + 0.7 * (ratio / max))
  return `M20 24 C${20 + (end - 20) * 0.35} 14 ${20 + (end - 20) * 0.7} 32 ${end} 22`
}

// ปิดแล้วกลับไป book ที่แผ่นเดิม (store ไม่รีเซ็ตวัน/แผ่นเมื่อกลับจาก photo)
const close = () => {
  if (active.value) app.go('book')
}

const onKey = (e) => {
  if (e.key === 'Escape' && active.value) close()
}

// focus trap: Tab วนอยู่ในการ์ด (ตอนนี้มีปุ่มเดียวคือ "ปิด" จึงวนอยู่ที่ปุ่มนั้น)
const focusables = () => [...(cardRef.value?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter((el) => !el.disabled)

const onTrap = (e) => {
  if (e.key !== 'Tab') return
  const items = focusables()
  if (!items.length) return e.preventDefault()
  const first = items[0]
  const last = items[items.length - 1]
  const current = document.activeElement
  if (!cardRef.value?.contains(current)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && current === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && current === last) {
    e.preventDefault()
    first.focus()
  }
}

// ถ้าโฟกัสหลุดออกนอกการ์ด (เช่น คลิกพื้นหลัง) ดึงกลับมาที่ปุ่มปิด
const onFocusIn = (e) => {
  if (active.value && cardRef.value && !cardRef.value.contains(e.target)) closeRef.value?.$el?.focus()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('focusin', onFocusIn)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('focusin', onFocusIn)
})

// เปิดแล้วโฟกัสที่ปุ่มปิด ปิดแล้วคืนโฟกัสให้ปุ่มที่เปิดภาพ
watch(active, async (on) => {
  if (on) {
    opener = document.activeElement
    await nextTick()
    closeRef.value?.$el?.focus()
  } else {
    await nextTick()
    opener?.focus?.()
    opener = null
  }
})
</script>

<style>
.photo-enter-active,
.photo-leave-active {
  transition: opacity 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.photo-enter-active .photo-lift,
.photo-leave-active .photo-lift {
  transition: transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.photo-enter-from,
.photo-leave-to {
  opacity: 0;
}
.photo-enter-from .photo-lift,
.photo-leave-to .photo-lift {
  transform: translateY(48px) scale(0.6);
}
</style>
