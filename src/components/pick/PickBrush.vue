<template>
  <!-- พู่กันจุ่มสีบนหน้าเลือกความรู้สึก (วาดใหม่ ใหญ่ ปลายขนมนไม่แหลม ~66×330px): เลื่อนไปการ์ดอารมณ์ที่เลือก ยกขึ้น จุ่มลง
       แตะน้ำที่ ~55% ของท่าจุ่ม: ปลายขนเปลี่ยนเป็นสีอารมณ์ + ขนบานออกแล้วคืนรูป + วงน้ำ + เสียง
       ไม่รับ pointer (ไม่บล็อกการ์ดหรือปุ่ม "เริ่มระบาย") เลือกเร็ว ๆ ต่อกันพู่กันตามไปช่องใหม่ทันทีจากตำแหน่งปัจจุบัน
       ด้ามชี้ออกด้านนอก (ช่องซ้ายเอียงซ้าย ช่องขวาเอียงขวา) ไม่บังชื่ออารมณ์ของช่องที่เลือก
       reduced-motion: พู่กันอยู่นิ่งที่ขวาของกล่อง เปลี่ยนแค่สีปลายขน (ไม่มีวงน้ำ ไม่มีขนบาน) -->
  <div class="pointer-events-none absolute left-0 top-0 z-30" aria-hidden="true">
    <span
      v-for="r in rings"
      :key="r.id"
      class="ring absolute rounded-full border-[3px]"
      :style="{ left: r.x - 45 + 'px', top: r.y - 45 + 'px', width: '90px', height: '90px', borderColor: r.hex, animationDelay: r.delay + 'ms' }"
    ></span>
    <!-- เงาตกขวาล่าง (ไม่หมุนตามพู่กัน: filter อยู่ที่กล่องนอก ส่วนการหมุนอยู่กล่องใน) ให้ดูลอยเหนือการ์ด -->
    <div class="absolute left-0 top-0" :style="{ filter: SHADOW }">
      <div ref="el" class="absolute left-0 top-0 will-change-transform">
        <svg :width="W" :height="H" viewBox="0 0 60 300" class="absolute" :style="{ left: -W * 0.5 + 'px', top: -H * (299 / 300) + 'px' }" fill="none">
          <!-- ด้ามไม้ -->
          <path d="M24 4 C24 0 36 0 36 4 L39 168 L21 168 Z" :fill="BRUSH.wood" />
          <path d="M25.5 6 L27.5 6 L25 166 L23 166 Z" :fill="BRUSH['wood-hi']" opacity=".8" />
          <path d="M34 6 L36 6 L39 168 L35 168 Z" :fill="BRUSH['wood-shade']" />
          <!-- ปลอกโลหะ -->
          <path d="M18 166 L42 166 L41 214 L19 214 Z" :fill="BRUSH.metal" />
          <path d="M18.3 174 L41.7 174 M18.6 181 L41.4 181" :stroke="BRUSH['metal-line']" stroke-width="1.6" />
          <path d="M21 168 L24 168 L23.5 212 L20.5 212 Z" :fill="BRUSH['metal-hi']" opacity=".8" />
          <!-- ขน: บานออกตอนจุ่ม (scale จากปลายขน) ปลายขนเป็นสีอารมณ์ -->
          <g ref="bristlesRef" class="bristles">
            <path d="M19 212 C11 236 13 262 25 285 C27.5 291 29 296 30 299 C31 296 32.5 291 35 285 C47 262 49 236 41 212 Z" :fill="BRUSH.bristle" />
            <path class="tip" d="M15.4 252 C17 268 21 279 25 285 C27.5 291 29 296 30 299 C31 296 32.5 291 35 285 C39 279 43 268 44.6 252 C36 258 24 258 15.4 252 Z" :fill="tipHex" />
            <ellipse cx="24" cy="236" rx="2.6" ry="13" :fill="BRUSH['bristle-hi']" opacity=".22" />
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BRUSH, PALETTE } from '@/lib/tokens'
import { hexToRgb } from '@/lib/color'
import { EMOTIONS, EMOTION_BY_KEY } from '@/lib/emotions'
import { useAppStore } from '@/stores/app'
import { reducedMotion } from '@/lib/motion'
import { sound } from '@/lib/sound'

const app = useAppStore()

// ขนาดพู่กันบนเวที (viewBox 60×300 ขยาย 1.1 เท่า) ปลายขนอยู่ล่างสุดที่ (30, 299) = จุดจุ่ม
const W = 66
const H = 330
const [sr, sg, sb] = hexToRgb(PALETTE.ink)
const SHADOW = `drop-shadow(12px 12px 7px rgba(${sr}, ${sg}, ${sb}, 0.28))`

// เรขาคณิตของการ์ด (ต้องตรงกับ EmotionPalette.vue: กล่อง left 200 top 196 กว้าง 880 ช่องใน inset 22 กริด 4 คอลัมน์ ห่าง 16 การ์ดสูง 150)
const GRID = { left: 222, top: 218, col: 197, row: 150, gap: 16 }
const BLOB_DY = 56 // กลางภาพอารมณ์ในการ์ด นับจากขอบบนการ์ด
const HOME = { x: 1150, y: 440, rot: 14 } // reduced-motion: พู่กันอยู่นิ่งตรงนี้ (นอกกล่อง)

const tileCenter = (key) => {
  const i = Math.max(0, EMOTIONS.findIndex((e) => e.key === key))
  const c = i % 4
  const r = Math.floor(i / 4)
  return { c, x: GRID.left + c * (GRID.col + GRID.gap) + GRID.col / 2, y: GRID.top + r * (GRID.row + GRID.gap) + BLOB_DY }
}
// ท่าของพู่กัน: ปลายขนอยู่ที่ (x, y) หมุนรอบปลายขน ด้ามชี้ออกด้านนอก: คอลัมน์ซ้าย (0–1) เอียงซ้าย คอลัมน์ขวา (2–3) เอียงขวา
const poses = (key) => {
  const t = tileCenter(key)
  const d = t.c < 2 ? -1 : 1
  // คอลัมน์ซ้ายสุดเอียงน้อยลง: ด้ามเอียงมากจะพาดทับปุ่ม "หน้าแรก" มุมซ้ายบน (วัดจากภาพแล้ว)
  const tilt = t.c === 0 ? { hover: 22, dip: 10, rest: 14 } : { hover: 34, dip: 20, rest: 30 }
  return {
    hover: { x: t.x + d * 30, y: t.y - 80, rot: d * tilt.hover },
    dip: { x: t.x + d * 4, y: t.y + 6, rot: d * tilt.dip },
    rest: { x: t.x + d * 44, y: t.y - 6, rot: d * tilt.rest },
    ring: t,
  }
}

const el = ref(null)
const bristlesRef = ref(null)
const tipHex = ref(EMOTION_BY_KEY[app.selection.emotion].hex)
const rings = ref([])
let ringId = 0
const copyPose = (p) => ({ x: p.x, y: p.y, rot: p.rot })
const cur = copyPose(reducedMotion.value ? HOME : poses(app.selection.emotion).rest)
// ตำแหน่งตั้งด้วย JS ตรง ๆ ไม่ผูกกับ :style ใน template (re-render ตอนวงน้ำเพิ่ม/ลบจะเขียนทับด้วยค่าเก่า — เจอจริงตอนทดสอบ)
const apply = () => {
  if (el.value) el.value.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) rotate(${cur.rot}deg)`
}

const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
const easeIn = (u) => u * u * u
const easeOut = (u) => 1 - (1 - u) ** 3

let raf = 0
let flareAnim = null
const ringTimers = new Set()

// ขนบานออกจากปลายขนแล้วคืนรูป (scale 1.12, 0.9) ตอนแตะน้ำ
const flare = () => {
  flareAnim?.cancel()
  flareAnim = bristlesRef.value?.animate?.([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 0.9)', offset: 0.35 }, { transform: 'scale(1, 1)' }], { duration: 340, easing: 'ease-out' })
}

const touch = (key) => {
  const e = EMOTION_BY_KEY[key]
  tipHex.value = e.hex // ปลายขนเปลี่ยนสี (transition 0.7 วิ ใน CSS; reduced-motion: เปลี่ยนทันทีตาม app.css)
  sound.dip(key)
  flare()
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

const TOUCH_AT = 0.55 // แตะน้ำที่ 55% ของท่าจุ่ม

// ไปที่การ์ดของ key: ยกขึ้น → จุ่มลง (แตะน้ำที่ 55%) → ถอยขึ้นพัก เริ่มจากตำแหน่งปัจจุบันเสมอ (ขัดจังหวะได้)
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
  let touched = false
  const step = (now) => {
    const [to, d, ease] = segs[i]
    const u = Math.min(1, (now - t0) / d)
    const k = ease(u)
    cur.x = from.x + (to.x - from.x) * k
    cur.y = from.y + (to.y - from.y) * k
    cur.rot = from.rot + (to.rot - from.rot) * k
    apply()
    if (i === 1 && !touched && u >= TOUCH_AT) {
      touched = true
      touch(key)
    }
    if (u >= 1) {
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
  flareAnim?.cancel()
  ringTimers.forEach(clearTimeout)
})
</script>

<style scoped>
.bristles {
  transform-origin: 30px 299px; /* ปลายขน (หน่วยของ viewBox) */
}
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
