<template>
  <!-- ดูภาพเดี่ยว (SPEC §5.8): ภาพลอยขึ้นมาขยายกลางโต๊ะ หน้าสมุดด้านหลังจางลง -->
  <Transition name="photo">
    <div v-if="active && entry" class="absolute inset-0" role="dialog" aria-modal="true" aria-label="ดูภาพและชาร์ตสี">
      <!-- พื้นที่ว่าง: คลิกเพื่อปิด -->
      <div class="absolute inset-0 bg-ink/10" @click="close"></div>

      <!-- ภาพโพลารอยด์ขยาย ~2.2 เท่า -->
      <div class="photo-lift pointer-events-none absolute left-[258px] top-[300px] w-[196px]">
        <div class="pointer-events-auto origin-center -rotate-2 scale-[2.2]">
          <Polaroid :caption="caption" :alt="`ภาพสีน้ำ ${emotion.th}`" :colors="entry.colors.slice(0, 2).map((c) => c.hex)" :palette="entry.colors" :tape-rotate="-3" />
        </div>
      </div>

      <!-- บัตรตัวอย่างสี -->
      <div class="photo-lift absolute left-[680px] top-[96px] box-border w-[460px] rounded-[22px_26px_20px_24px] border-2 border-ink bg-white px-7 pb-6 pt-6 shadow-[0_24px_44px_rgba(45,43,51,0.24)]">
        <div class="flex items-baseline justify-between">
          <h2 class="m-0 font-hand text-26 font-semibold">สีในภาพนี้</h2>
          <span class="text-14 text-ink-soft">{{ entry.colors.length }} สี</span>
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
      </div>

      <!-- แถบล่าง: สัดส่วนรวม เวลา อารมณ์ ความเข้ม และปุ่มปิด -->
      <div class="photo-lift absolute left-[160px] top-[690px] box-border flex h-[72px] w-[960px] items-center gap-6 rounded-[20px_22px_18px_24px] bg-[#C8C2B7] px-5 shadow-[0_6px_14px_rgba(45,43,51,0.18)]">
        <div class="flex flex-col leading-tight">
          <span class="font-hand text-17 font-semibold">{{ entry.local_time }} · {{ emotion.th }}{{ entry.shifted ? ' → อุ่นขึ้น' : '' }}</span>
          <span class="text-14 text-ink-2">{{ INTENSITY_LABELS[entry.intensity] }}</span>
        </div>
        <ColorStrip class="flex-1" :colors="entry.colors" :height="16" rounded="rounded-[6px]" />
        <HandButton ref="closeRef" variant="secondary" solid @click="close"><Doodle name="close" :size="20" /> ปิด</HandButton>
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
import { EMOTION_BY_KEY, INTENSITY_LABELS } from '@/lib/emotions'
import { percentsOf } from '@/lib/palette'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entries = useEntriesStore()
const closeRef = ref(null)

const active = computed(() => app.view === 'photo')
const entry = computed(() => entries.entries.find((e) => e.id === app.photoEntryId) ?? null)
const emotion = computed(() => EMOTION_BY_KEY[entry.value?.emotion ?? 'calm'])
const caption = computed(() => (entry.value ? `${entry.value.local_time} · ${emotion.value.th}${entry.value.shifted ? ' → อุ่นขึ้น' : ''}` : ''))
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

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// เปิดแล้วโฟกัสที่ปุ่มปิด
watch(active, async (on) => {
  if (!on) return
  await nextTick()
  closeRef.value?.$el?.focus()
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
