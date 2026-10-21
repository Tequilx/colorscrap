<template>
  <!-- ดูภาพเดี่ยว (SPEC §5.8): ชั้นสี desk ทึบ 85% ทับทั้งโต๊ะ ภาพลอยขึ้นมาคู่กับการ์ดชาร์ตสีกลางจอ -->
  <!-- เข้า/ออกด้วย WAAPI (css=false): ภาพบินระหว่างตำแหน่งในสมุดกับกลางโต๊ะ ส่วนฉากหลังและการ์ด fade -->
  <Transition :css="false" @enter="onEnter" @leave="onLeave" @enter-cancelled="onCancel" @leave-cancelled="onCancel">
    <div v-if="active && entry" class="absolute inset-0" role="dialog" aria-modal="true" aria-label="ดูภาพและชาร์ตสี" @keydown="onTrap">
      <!-- พื้นที่ว่าง: คลิกเพื่อปิด -->
      <div data-photo="backdrop" class="absolute inset-0 bg-desk/85" @click="close"></div>

      <!-- ภาพกับการ์ดอยู่กึ่งกลางแนวตั้งทั้งคู่ วางคู่กันกลางจอ ห่างกัน 56px -->
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center gap-14">
        <!-- โพลารอยด์ขยาย ~2.2 เท่า (กล่อง 196×193 ขยายเป็น ~431×425) -->
        <div class="relative h-[425px] w-[431px] shrink-0">
          <div data-photo="polaroid" class="pointer-events-auto absolute left-1/2 top-1/2 -ml-[98px] -mt-[96px] w-[196px] origin-center -rotate-2 scale-[2.2]">
            <Polaroid :caption="caption" :alt="`ภาพสีน้ำ ${emotion.th}`" :src="shownUrl" :colors="entry.colors.slice(0, 2).map((c) => c.hex)" :palette="entry.colors" :tape-rotate="-3" />
          </div>
        </div>

        <!-- การ์ดชาร์ตสี (สไตล์บัตรตัวอย่างสี) -->
        <div ref="cardRef" data-photo="card" class="pointer-events-auto box-border w-[460px] shrink-0 rounded-[22px_26px_20px_24px] border-2 border-ink bg-white px-7 pb-6 pt-5 shadow-[0_24px_44px_rgba(45,43,51,0.24)]">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col">
              <h2 class="m-0 font-hand text-26 font-semibold leading-[1.2]">สีในภาพนี้</h2>
              <span class="text-14 text-ink-soft">{{ entry.local_time }} · {{ emotion.th }}{{ entry.shifted ? ' → มีแสงขึ้น' : '' }} · {{ INTENSITY_LABELS[entry.intensity] }}</span>
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

          <!-- เก็บรูปไว้ (SPEC ส่วนที่ 2 §1): สร้างรูปในเครื่อง iPad เปิดหน้าแชร์ เครื่องอื่นดาวน์โหลดเป็น PNG -->
          <div class="mt-3 flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-line pt-3.5">
            <span class="font-hand text-16 font-semibold">เก็บรูปไว้</span>
            <div class="flex gap-2.5">
              <button type="button" :disabled="share.busy['photo-card']" class="save-btn grow" @click="share.photoCard(entry)">
                <span class="save-frame border-ink bg-ink" aria-hidden="true"></span>
                <span class="relative inline-flex items-center gap-2 text-paper"><Doodle name="download" :size="20" /> {{ share.busy['photo-card'] ? 'กำลังทำรูป…' : 'การ์ดพร้อมชาร์ตสี' }}</span>
              </button>
              <button type="button" :disabled="share.busy['photo-only']" class="save-btn px-4" @click="share.photoOnly(entry)">
                <span class="save-frame border-ink bg-white" aria-hidden="true"></span>
                <span class="relative inline-flex items-center gap-2 text-ink"><Doodle name="image" :size="20" /> {{ share.busy['photo-only'] ? 'กำลังทำรูป…' : 'เฉพาะภาพ' }}</span>
              </button>
            </div>
            <span class="text-[12px] text-ink-soft">{{ saveHint }}</span>
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
import { useEntryImage } from '@/lib/useEntryImage'
import { photoRotation } from '@/lib/photos'
import { centerInStage, flightTransforms } from '@/lib/flip'
import { ms, reducedMotion } from '@/lib/motion'
import { MOTION } from '@/lib/tokens'
import { startWet, stopWet } from '@/lib/wetPhoto'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'
import { useShareStore } from '@/stores/share'

const app = useAppStore()
const entries = useEntriesStore()
const share = useShareStore()
// เครื่องที่แชร์ไฟล์ได้ (iPad) จะเปิดหน้าแชร์ เครื่องอื่นดาวน์โหลดไฟล์ ข้อความกำกับจึงต่างกัน
const saveHint = share.canShare() ? 'บน iPad จะเปิดหน้าแชร์ กด "บันทึกรูปภาพ" เพื่อเก็บลงคลังรูป' : 'ไฟล์จะถูกดาวน์โหลดเป็น PNG'
const closeRef = ref(null)
const cardRef = ref(null)
let opener = null // ปุ่มที่เปิดภาพ (คืนโฟกัสให้ตอนปิด)

const active = computed(() => app.view === 'photo')
const entry = computed(() => entries.entries.find((e) => e.id === app.photoEntryId) ?? null)
const emotion = computed(() => EMOTION_BY_KEY[entry.value?.emotion ?? 'calm'])
const caption = computed(() => (entry.value ? `${entry.value.local_time} · ${emotionLabel(entry.value)}${entry.value.shifted ? ' → มีแสงขึ้น' : ''}` : ''))
// หน้า photo ใช้ภาพเต็ม สร้าง URL เฉพาะตอนเปิดดู (ปิดแล้วคืนหน่วยความจำ)
const imageUrl = useEntryImage(() => (active.value ? entry.value : null), 'image')
// ระหว่างบินใช้ thumb ก่อน (เดียวกับที่เห็นในสมุด) แล้วสลับเป็นภาพเต็มหลังบินจบและ decode เสร็จ ไม่สลับกลางทางให้ decode ไม่ทำให้กระตุก
const thumbUrl = useEntryImage(() => (active.value ? entry.value : null), 'thumb')
const fullReady = ref(false)
const shownUrl = computed(() => (fullReady.value ? imageUrl.value ?? thumbUrl.value : thumbUrl.value ?? imageUrl.value))
const showFull = async () => {
  const url = imageUrl.value
  if (url) {
    try {
      const img = new Image()
      img.src = url
      await img.decode()
    } catch {
      // decode ไม่สำเร็จ: สลับเลยก็ได้ ภาพจะโหลดตามปกติ
    }
  }
  if (active.value) fullReady.value = true
}
const pct = computed(() => (entry.value ? percentsOf(entry.value.colors) : []))

// เส้นรอยพู่กันยาวตาม ratio (สีที่มากที่สุดยาวเต็ม)
const swab = (ratio) => {
  const max = Math.max(...entry.value.colors.map((c) => c.ratio))
  const end = 20 + 210 * (0.3 + 0.7 * (ratio / max))
  return `M20 24 C${20 + (end - 20) * 0.35} 14 ${20 + (end - 20) * 0.7} 32 ${end} 22`
}

// ปิดแล้วกลับไป book ที่แผ่นเดิม (store ไม่รีเซ็ตวัน/แผ่นเมื่อกลับจาก photo)
// ระหว่างภาพบิน ปิดซ้ำไม่ได้ (สถานะจะซ้อน)
const close = () => {
  if (active.value && !app.photoFlying) app.go('book')
}

const onKey = (e) => {
  if (e.key === 'Escape' && active.value) close()
}

// --- แอนิเมชันเข้า/ออก (SPEC §5.8) ---
let running = [] // animation ที่กำลังเล่น ไว้ยกเลิกเมื่อถูกตัดกลางทาง
const parts = (el) => ({
  backdrop: el.querySelector('[data-photo="backdrop"]'),
  polaroid: el.querySelector('[data-photo="polaroid"]'),
  card: el.querySelector('[data-photo="card"]'),
})
const play = (node, frames, options) => {
  const a = node.animate(frames, { easing: MOTION.ease, ...options })
  running.push(a)
  return a.finished
}
const onCancel = () => {
  stopWet()
  running.forEach((a) => a.cancel())
  running = []
  app.photoFlying = false
}
const fade = (from, to) => [{ opacity: from }, { opacity: to }]
// จุดกึ่งกลางของช่องภาพในสมุดตอนนี้ (ปิด: วัดใหม่กันรีไซส์หน้าต่าง) ไม่มี = บินไม่ได้ ใช้ท่าลอยขึ้นแบบเดิม
const bookPose = () => {
  const figure = document.querySelector(`[data-entry-id="${app.photoEntryId}"] figure`)
  const center = figure && centerInStage(figure)
  return center ? { ...center, rotate: photoRotation(app.photoEntryId).rotate } : app.photoOrigin
}

const fly = (el, done, opening) => {
  app.photoFlying = true
  running = []
  const { backdrop, polaroid, card } = parts(el)
  const settle = ms(MOTION.settle)
  const swap = ms(MOTION.swap)
  const calm = reducedMotion.value // reduced-motion: ทั้งหมด fade ≤150ms ไม่บิน ไม่เลื่อน
  const pose = calm ? null : bookPose()
  const target = pose && centerInStage(polaroid)
  const wait = []
  if (opening) {
    wait.push(play(backdrop, fade(0, 1), { duration: swap, fill: 'backwards' }))
    wait.push(play(card, calm ? fade(0, 1) : [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: swap, delay: calm ? 0 : ms(MOTION.reveal.step), fill: 'backwards' }))
    if (calm) wait.push(play(polaroid, fade(0, 1), { duration: swap, fill: 'backwards' }))
    else if (target) wait.push(play(polaroid, flightTransforms(pose, target).map((transform) => ({ transform })), { duration: settle, fill: 'backwards' }))
    else wait.push(play(polaroid, [{ opacity: 0, transform: 'translateY(48px) rotate(-2deg) scale(1.32)' }, { opacity: 1, transform: 'translateY(0) rotate(-2deg) scale(2.2)' }], { duration: settle, fill: 'backwards' }))
  } else {
    wait.push(play(backdrop, fade(1, 0), { duration: swap, fill: 'forwards' }))
    wait.push(play(card, calm ? fade(1, 0) : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }], { duration: calm ? swap : ms(MOTION.reveal.fade), fill: 'forwards' }))
    if (calm) wait.push(play(polaroid, fade(1, 0), { duration: swap, fill: 'forwards' }))
    else if (target) wait.push(play(polaroid, flightTransforms(pose, target).map((transform) => ({ transform })).reverse(), { duration: settle, fill: 'forwards' }))
    else wait.push(play(polaroid, [{ opacity: 1, transform: 'translateY(0) rotate(-2deg) scale(2.2)' }, { opacity: 0, transform: 'translateY(48px) rotate(-2deg) scale(1.32)' }], { duration: settle, fill: 'forwards' }))
  }
  // cancel ทำให้ finished reject: ถือว่าถูกตัดกลางทาง (onCancel เก็บกวาดแล้ว)
  Promise.all(wait).then(
    () => {
      running = []
      app.photoFlying = false
      done()
    },
    () => {},
  )
}

const onEnter = (el, done) => {
  fullReady.value = false
  fly(el, () => {
    done()
    showFull()
    // ภาพที่เปิดดูเดี่ยวพลิ้วเบา ๆ ~3 วิหลังลอยลงที่ (ภาพที่เพิ่งแปะถูกหยุดอัตโนมัติ: เล่นทีละภาพเท่านั้น)
    startWet(el.querySelector('[data-wet-target]'))
  }, true)
}

// ออก: ซ่อนช่องในสมุดไว้จนภาพบินถึง แล้วค่อยเลิกซ่อนพร้อมถอดภาพบิน (เฟรมเดียวกัน) แล้วคืนโฟกัสให้ปุ่มที่เปิด
const onLeave = (el, done) => {
  stopWet() // ปิดภาพ: เลิกพลิ้วทันที (ถอดฟิลเตอร์ก่อนภาพบินกลับ)
  app.photoHiddenId = app.photoEntryId
  fly(el, () => {
    app.photoHiddenId = null
    done()
    nextTick(() => {
      opener?.focus?.()
      opener = null
    })
  }, false)
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

// เปิดแล้วโฟกัสที่ปุ่มปิด (คืนโฟกัสให้ปุ่มที่เปิดภาพทำใน onLeave หลังช่องในสมุดกลับมามองเห็น)
watch(active, async (on) => {
  if (on) {
    opener = document.activeElement
    await nextTick()
    closeRef.value?.$el?.focus()
  }
})
</script>

<style scoped>
/* ปุ่มเก็บรูป: กรอบมุมโค้งไม่เท่ากันแบบวาดมือ ใส่ filter wob ที่กรอบเท่านั้น (ตัวหนังสือไม่โดน) hover เฉพาะอุปกรณ์ที่มีเมาส์ */
.save-btn {
  position: relative;
  display: inline-flex;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  padding: 0 14px;
  font-family: theme('fontFamily.hand');
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.save-btn:disabled {
  cursor: progress;
  opacity: 0.6;
}
.save-frame {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-width: 2px;
  border-radius: 16px 20px 14px 18px;
  filter: url(#wob);
}
@media (hover: hover) {
  .save-btn:not(:disabled):hover .save-frame {
    background-color: #3e3c45;
  }
}
</style>
