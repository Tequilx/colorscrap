<template>
  <!-- พู่กันจุ่มสีบนหน้าเลือกความรู้สึก: เลื่อนไปการ์ดอารมณ์ที่เลือก ยกขึ้น จุ่มลง วงน้ำกระเพื่อม ปลายขนเปลี่ยนเป็นสีอารมณ์
       ไม่รับ pointer (ไม่บล็อกการ์ดหรือปุ่ม "เริ่มระบาย") เลือกเร็ว ๆ ต่อกันพู่กันตามไปช่องใหม่ทันทีจากตำแหน่งปัจจุบัน
       reduced-motion: พู่กันอยู่นิ่งที่มุมขวาของกล่อง เปลี่ยนแค่สีปลายขน (ไม่มีวงน้ำ ไม่มีเสียงจุ่มที่ตรงกับการเคลื่อนไหว) -->
  <div class="pointer-events-none absolute left-0 top-0 z-30" aria-hidden="true">
    <span
      v-for="r in rings"
      :key="r.id"
      class="ring absolute rounded-full border-[3px]"
      :style="{ left: r.x - 45 + 'px', top: r.y - 45 + 'px', width: '90px', height: '90px', borderColor: r.hex, animationDelay: r.delay + 'ms' }"
    ></span>
    <div ref="el" class="absolute left-0 top-0 will-change-transform">
      <svg width="70" height="200" viewBox="0 0 70 200" class="absolute" style="left: -35px; top: -198px" fill="none" stroke-linejoin="round" stroke-linecap="round">
        <defs>
          <clipPath id="brush-tip"><rect x="0" y="170" width="70" height="30" /></clipPath>
        </defs>
        <!-- ด้ามไม้ -->
        <path d="M31 6 Q35 1 39 6 L44 104 L26 104 Z" :fill="BRUSH.wood" :stroke="PALETTE.ink" stroke-width="2.2" />
        <path d="M33 14 L33.8 98 M37.5 20 L38 96" :stroke="BRUSH['wood-line']" stroke-width="1.4" />
        <!-- ปลอกโลหะ -->
        <path d="M25 104 H45 L43.5 140 H26.5 Z" :fill="BRUSH.metal" :stroke="PALETTE.ink" stroke-width="2.2" />
        <path d="M26 114 H44 M26.5 124 H43.5" :stroke="PALETTE.ink" stroke-width="1.4" />
        <!-- ขน: ชี้ลง ปลายขนเป็นสีอารมณ์ -->
        <path :d="BRISTLE" :fill="BRUSH.bristle" :stroke="PALETTE.ink" stroke-width="2.2" />
        <path :d="BRISTLE" class="tip" :fill="tipHex" stroke="none" clip-path="url(#brush-tip)" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BRUSH, PALETTE } from '@/lib/tokens'
import { EMOTIONS, EMOTION_BY_KEY } from '@/lib/emotions'
import { useAppStore } from '@/stores/app'
import { reducedMotion } from '@/lib/motion'
import { sound } from '@/lib/sound'

const app = useAppStore()
const BRISTLE = 'M27 140 H43 C46.5 158 42.5 178 35 198 C27.5 178 23.5 158 27 140 Z'

// เรขาคณิตของการ์ด (ต้องตรงกับ EmotionPalette.vue: กล่อง left 200 top 196 กว้าง 880 ช่องใน inset 22 กริด 4 คอลัมน์ ห่าง 16 การ์ดสูง 150)
const GRID = { left: 222, top: 218, col: 197, row: 150, gap: 16 }
const BLOB_DY = 56 // กลางภาพอารมณ์ในการ์ด นับจากขอบบนการ์ด
const SCALE = 0.75 // ขนาดพู่กัน (ยาวราว 150px) ไม่ให้บังหัวข้อ
const HOME = { x: 1150, y: 430, rot: 24 } // reduced-motion: พู่กันอยู่นิ่งตรงนี้ (นอกกล่อง)

const tileCenter = (key) => {
  const i = Math.max(0, EMOTIONS.findIndex((e) => e.key === key))
  const c = i % 4
  const r = Math.floor(i / 4)
  return { x: GRID.left + c * (GRID.col + GRID.gap) + GRID.col / 2, y: GRID.top + r * (GRID.row + GRID.gap) + BLOB_DY }
}
// ท่าของพู่กัน: ปลายขนอยู่ที่ (x, y) หมุนรอบปลายขน
const poses = (key) => {
  const t = tileCenter(key)
  return {
    hover: { x: t.x + 22, y: t.y - 72, rot: 30 },
    dip: { x: t.x + 4, y: t.y + 4, rot: 14 },
    rest: { x: t.x + 34, y: t.y - 8, rot: 36 },
    ring: t,
  }
}

const el = ref(null)
const tipHex = ref(EMOTION_BY_KEY[app.selection.emotion].hex)
const rings = ref([])
let ringId = 0
const copyPose = (p) => ({ x: p.x, y: p.y, rot: p.rot })
const cur = copyPose(reducedMotion.value ? HOME : poses(app.selection.emotion).rest)
// ตำแหน่งตั้งด้วย JS ตรง ๆ ไม่ผูกกับ :style ใน template (re-render ตอนวงน้ำเพิ่ม/ลบจะเขียนทับด้วยค่าเก่า — เจอจริงตอนทดสอบ)
const apply = () => {
  if (el.value) el.value.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) rotate(${cur.rot}deg) scale(${SCALE})`
}

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
const easeIn = (u) => u * u * u
const easeOut = (u) => 1 - (1 - u) ** 3

let raf = 0
const ringTimers = new Set()
const contact = (key) => {
  const e = EMOTION_BY_KEY[key]
  tipHex.value = e.hex // ปลายขนเปลี่ยนสี (transition 0.7 วิ ใน CSS; reduced-motion: เปลี่ยนทันทีตาม app.css)
  sound.dip(key)
  const { ring } = poses(key)
  for (let k = 0; k < 3; k++) {
    const r = { id: ++ringId, x: ring.x, y: ring.y, hex: e.hex, delay: k * 130 }
    rings.value.push(r)
    const t = setTimeout(() => {
      ringTimers.delete(t)
      rings.value = rings.value.filter((x) => x.id !== r.id)
    }, 1200 + r.delay)
    ringTimers.add(t)
  }
}

// ไปที่การ์ดของ key: ยกขึ้น → จุ่มลง (สัมผัสน้ำสี: เปลี่ยนสีปลายขน + วงน้ำ + เสียง) → ถอยขึ้นพัก เริ่มจากตำแหน่งปัจจุบันเสมอ (ขัดจังหวะได้)
const goTo = (key) => {
  cancelAnimationFrame(raf)
  const p = poses(key)
  const dist = Math.hypot(p.hover.x - cur.x, p.hover.y - cur.y)
  const segs = [
    [p.hover, Math.min(420, Math.max(200, 160 + dist * 0.35)), easeInOut],
    [p.dip, 170, easeIn],
    [p.rest, 320, easeOut],
  ]
  let i = 0
  let from = { ...cur }
  let t0 = performance.now()
  const step = (now) => {
    const [to, d, ease] = segs[i]
    const u = Math.min(1, (now - t0) / d)
    const k = ease(u)
    cur.x = from.x + (to.x - from.x) * k
    cur.y = from.y + (to.y - from.y) * k
    cur.rot = from.rot + (to.rot - from.rot) * k
    apply()
    if (u >= 1) {
      if (i === 1) contact(key)
      i++
      if (i >= segs.length) return
      from = { ...cur }
      t0 = now
    }
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(
  () => app.selection.emotion,
  (key) => {
    if (reducedMotion.value) {
      tipHex.value = EMOTION_BY_KEY[key].hex // ไม่เคลื่อน แค่เปลี่ยนสีปลายขน
      return
    }
    goTo(key)
  },
)

onMounted(apply)
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ringTimers.forEach(clearTimeout)
})
</script>

<style scoped>
.tip {
  transition: fill 700ms linear;
}
.ring {
  opacity: 0;
  animation: ring-out 900ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
@keyframes ring-out {
  from {
    opacity: 0.7;
    transform: scale(0.25);
  }
  to {
    opacity: 0;
    transform: scale(1.7);
  }
}
</style>
