<template>
  <!-- ผ้าใบน้ำไหล (webgl-fluid-enhanced) ครอบเต็มกระดาษ ขนาดคงที่ 1112×612 บน stage -->
  <!-- ไลบรารีเขียนทับ style ของ container (position: relative; display: flex) จึงต้องมีกล่องนอกที่ absolute inset-0 คอยกำหนดขนาด
       ไม่งั้น canvas สูง 100% ของ container ที่ความสูงไม่แน่นอน แล้วถูกคำนวณจากอัตราส่วน 2:1 แทน -->
  <div class="absolute inset-0">
    <div ref="containerRef" class="h-full w-full" aria-label="ผ้าใบระบายสี ลากเพื่อปาดและกวนสี" role="img"></div>
    <!-- ชั้นรับ pointer: ดัก event ไว้ไม่ให้ถึง canvas (ไลบรารีใช้ pageX/pageY ซึ่งผิดตำแหน่งเมื่อ Stage ถูก scale) -->
    <div
      ref="inputRef"
      class="absolute inset-0 cursor-crosshair touch-none"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @lostpointercapture="onUp"
    ></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import WebGLFluid from 'webgl-fluid-enhanced'
import { emotionShades, FLUID_PARAMS, DENSITY_DISSIPATION, INK_CELL, INK_CAP, INITIAL_SPLATS, INTENSITY_FACTOR, SHIFT_TARGETS } from '@/lib/emotions'
import { PALETTE } from '@/lib/tokens'
import { dyeSetting, invertedHex } from '@/lib/dye'
import { warmTune as tune, noteDebug as debug, DEV_PARAMS_EVENT } from '@/lib/devState'

const props = defineProps({
  emotion: { type: String, required: true },
  intensity: { type: Number, default: 1 },
  // เครื่องมือที่เลือก: smear (ปาดสี) | drop (เติมหยด) | warm (สีอุ่น เฉพาะอารมณ์ลบ)
  tool: { type: String, default: 'smear' },
  // false = หยุด loop ของ simulation (ไม่อยู่ในหน้า paint) แต่ยังคง WebGL context ไว้ (SPEC §4.3)
  running: { type: Boolean, default: true },
  // เพิ่มค่าเพื่อสั่งล้างผ้าใบ
  clearTick: { type: Number, default: 0 },
  // เพิ่มค่าเพื่อสั่งหยดสีเริ่มต้นของอารมณ์ที่เลือก (หยดทับของเดิมได้) store เป็นผู้ตัดสินว่าเมื่อไหร่ควรหยด (SPEC §5.3)
  dropTick: { type: Number, default: 0 },
  // เพิ่มค่าเมื่อกด "ลองดู" ในโน้ตชวน: หยดสีอุ่น 1 หยดที่ขอบกระดาษ
  warmTick: { type: Number, default: 0 },
  // อารมณ์ล่าสุดของแผ่นเป็นอารมณ์ลบ (ใช้ตัดสินว่าจะชวนหรือไม่)
  warmAvailable: { type: Boolean, default: false },
})

// shifted: ผู้ใช้หยดสีอุ่นเองหยดแรกของแผ่น | invite: ระบายรวมครบและพักมือ ควรโผล่โน้ตชวน (SPEC §6.4)
const emit = defineEmits(['shifted', 'invite'])

const SIZE = { w: 1112, h: 612 }
const HOLD_MS = 400 // กดค้างเกินนี้ = หยดต่อเนื่อง (SPEC §6.5)
const HOLD_INTERVAL = 120
const HOLD_STRENGTH = 0.1
const HOLD_MOVE_LIMIT = 8 // ขยับเกินนี้ (px) ถือว่าเป็นการลาก ไม่ใช่กดค้าง
const SMEAR_RADIUS = 0.25
const DROP_RADIUS_SCALE = 3 // splatRadius ของ SPEC เล็กเกินไปบนกระดาษ 1112×612 ปรับให้หยดมีเนื้อสีพอ
const SMEAR_FORCE = 1500
const CLEAR_FRAMES = 8

// สีอุ่นของอารมณ์ลบ (SPEC §6.4) ผู้ใช้เลือกหยดเอง ไม่มีการหยดอัตโนมัติ
// ขนาด/ความเข้ม/จำนวนหยดตัวอย่างของสีอุ่นอยู่ใน lib/devState.js (warmTune) ปรับสดได้จากแผง ?debug
const WARM_SAMPLE_GAP = 280 // ms ห่างกันระหว่างหยดตัวอย่าง
const SHIFT_SPEED = 200 // ความเร็วต่ำ (initial = 220 × speed ของอารมณ์)
const WARM_TAP_SPEED = 60 // หยดที่ตำแหน่งแตะ ความเร็วเท่าหยดอารมณ์
// โน้ตชวน: ครบเท่านี้นับจาก pointerdown ครั้งแรกของแผ่น + พักมือ (ไม่มี pointerdown และไม่มีปุ่มกดค้าง) เท่านี้ (ms ของเวลาที่ผ้าใบวิ่งอยู่) ถามครั้งเดียวต่อแผ่น
const NOTE_PAINT_MS = 20000
const NOTE_IDLE_MS = 2000
const NOTE_TICK = 250
// เร่งเวลาโน้ตตอน dev เพื่อทดสอบ (เร่งทั้ง 20 วินาทีและ 2 วินาที): เปิดหน้าด้วย ?shiftSpeed=10 (ไม่ยุ่งกับ simulation) และ ?debug เปิดแผงปรับค่า (src/dev/DebugPanel.vue)
const DEBUG = import.meta.env.DEV && new URLSearchParams(location.search).has('debug')
const NOTE_TIME_SCALE = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('shiftSpeed')) || 1 : 1
// prefers-reduced-motion: หยดสีอุ่นตอนกดค้างช้าลงครึ่งหนึ่ง (ห่างขึ้น 2 เท่า)
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')

// webgl-fluid-enhanced v0.8 รับ "container" (ไม่ใช่ canvas) แล้วหา <canvas> ข้างในเอง
const containerRef = ref(null)
const inputRef = ref(null)

// สำคัญมาก: ใช้ตัวแปรธรรมดา (let) ไม่ใช้ ref() เพื่อป้องกัน Vue Proxy เข้าไปแทรกแซง WebGL
let fluid = null
// มีคำสั่งหยดสีเริ่มต้นค้างอยู่ รอจนผ้าใบวิ่งอยู่และล้างเสร็จก่อนค่อยหยด
let wantDrop = false
let clearing = false
let gravityTimer = null
let gravityStop = null
let noteTimer = null
// สถานะของแผ่นปัจจุบัน (รีเซ็ตเมื่อล้างผ้าใบ): เวลาที่ระบายรวม เวลาที่พักมือ ชวนไปแล้วหรือยัง จำนวนครั้งที่หยดสีอุ่น (ไล่สีตามนี้)
const newSheetState = () => ({ started: false, elapsed: 0, idle: 0, invited: false, warmGestures: 0, warmDropped: false })
let sheet = newSheetState()
const timers = new Set() // timeout ของหยดเริ่มต้นแบบเป็นจังหวะ
const pointers = new Map() // pointerId → { x, y, downX, downY, hold, holdStart }

const shadeWeights = () => {
  const s = emotionShades(props.emotion)
  return [s.base, s.base, s.base, s.deep, s.light] // เนื้อสี 60% ขอบเข้ม 20% สีจาง 20% (SPEC §6.3)
}
const pickShade = () => {
  const list = shadeWeights()
  return list[Math.floor(Math.random() * list.length)]
}

// ปริมาณสีที่ลงแล้วต่อช่อง (รีเซ็ตเมื่อล้างผ้าใบ) ใช้ลดแรงของหยดที่ซ้ำที่เดิมไม่ให้สะสมจนดำ
const inkCols = Math.ceil(SIZE.w / INK_CELL)
let ink = new Float32Array(inkCols * Math.ceil(SIZE.h / INK_CELL))
const takeInk = (x, y, strength) => {
  const i = Math.min(ink.length - 1, Math.floor(y / INK_CELL) * inkCols + Math.floor(x / INK_CELL))
  const eff = strength * Math.max(0, 1 - ink[i] / INK_CAP)
  ink[i] += eff
  return eff
}

// ตั้งสีของหยดถัดไป: ไลบรารีสุ่มจาก colorPalette (hue/saturation) และใช้ brightness เป็นความเข้ม
const useShade = (hex, strength = 1) => {
  const dye = dyeSetting(hex, params().brightness * INTENSITY_FACTOR[props.intensity] * strength)
  if (dye) fluid.setConfig({ colorPalette: [dye.hex], brightness: dye.brightness })
  return !!dye
}

// พิกัด css px บนกระดาษ (0..SIZE) → ไลบรารี (x เป็น px จริง ×dpr, y เป็น css px และกลับแกนเอง)
const splat = (x, y, dx, dy, { hex, radius, noColor, strength = 1 } = {}) => {
  if (!fluid) return
  fluid.setConfig({ splatRadius: radius })
  if (noColor) {
    fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx, dy, '#000000') // สี 0 = ใส่แรงอย่างเดียว
  } else if (useShade(hex ?? pickShade(), takeInk(x, y, strength))) {
    fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx, dy)
  }
}

const params = () => FLUID_PARAMS[props.emotion]

const applyParams = () => {
  if (!fluid) return
  const p = params()
  fluid.setConfig({
    curl: p.curl,
    densityDissipation: DENSITY_DISSIPATION,
    velocityDissipation: p.velDiss,
  })
}

const rand = (min, max) => min + Math.random() * (max - min)

// หยดเริ่มต้นตามอารมณ์และความเข้ม (SPEC §6.3)
const dropInitial = () => {
  if (!fluid) return
  const p = params()
  const count = Math.max(1, Math.round(INITIAL_SPLATS[props.emotion] * INTENSITY_FACTOR[props.intensity]))
  const mag = 220 * p.speed
  for (let i = 0; i < count; i++) {
    const drop = () => {
      if (!fluid) return
      let x = rand(SIZE.w * 0.15, SIZE.w * 0.85)
      let y = rand(SIZE.h * 0.15, SIZE.h * 0.85)
      let angle = rand(0, Math.PI * 2)
      let m = mag
      if (p.pattern === 'scatter') {
        x = rand(30, SIZE.w - 30)
        y = rand(30, SIZE.h - 30)
      } else if (p.pattern === 'fall') {
        angle = -Math.PI / 2 + rand(-0.4, 0.4) // ลง (แกน y ของไลบรารีชี้ขึ้น)
      } else if (p.pattern === 'still') {
        m = mag * rand(0, 1)
      }
      splat(x, y, Math.cos(angle) * m, Math.sin(angle) * m, { radius: p.radius * DROP_RADIUS_SCALE })
    }
    // angry พุ่งเป็นจังหวะ: เหลื่อมเวลาของแต่ละหยด
    if (p.pattern === 'pulse') {
      const t = setTimeout(() => {
        timers.delete(t)
        drop()
      }, i * 260)
      timers.add(t)
    } else drop()
  }
}

// แรงถ่วงของ sad: ปาดลงเบา ๆ แบบไม่เติมสี เป็นระยะ เฉพาะช่วงหลังหยดเริ่มต้น (ไม่งั้นผ้าใบไม่มีวันนิ่ง)
const GRAVITY_MS = 4000
const startGravity = () => {
  stopGravity()
  if (params().pattern !== 'fall') return
  gravityTimer = setInterval(() => {
    splat(rand(0, SIZE.w), rand(0, SIZE.h * 0.7), 0, -220, { radius: 0.3, noColor: true })
  }, 700)
  gravityStop = setTimeout(stopGravity, GRAVITY_MS)
}
const stopGravity = () => {
  clearInterval(gravityTimer)
  clearTimeout(gravityStop)
  gravityTimer = gravityStop = null
}

// หยดสีเริ่มต้นของอารมณ์ที่เลือกลงบนผ้าใบ (ทับของเดิมได้) ทำเมื่อผ้าใบวิ่งอยู่และไม่ได้กำลังล้าง
const tryDrop = () => {
  if (!wantDrop || !fluid || !props.running || clearing) return
  wantDrop = false
  dropInitial()
  startGravity()
}

// ---- สีอุ่นของอารมณ์ลบ (SPEC §6.4) ----

// สีปลายทางของการหยดครั้งนี้: ไล่ตามลำดับใน SHIFT_TARGETS ของอารมณ์ล่าสุด หนึ่งครั้ง (แตะหนึ่งที กดค้างหนึ่งรอบ ลองดูหนึ่งครั้ง) = หนึ่งสี วนกลับเมื่อครบ
const warmHex = () => {
  const targets = SHIFT_TARGETS[props.emotion]
  return targets ? targets[sheet.warmGestures % targets.length] : null
}

// ความเข้มสีอุ่นตามความเข้มของอารมณ์เดิมเหมือนเครื่องมือ "เติมหยด" (useShade คูณ INTENSITY_FACTOR ให้เอง)
const warmStrength = (strength = 1) => strength * tune.strength

const markWarmDropped = () => {
  if (sheet.warmDropped) return
  sheet.warmDropped = true
  emit('shifted')
}

// หยดสีอุ่นที่ตำแหน่งใดก็ได้ (ผู้ใช้แตะ หรือกดค้างเบา ๆ)
const dropWarmAt = (x, y, hex, strength = 1) => {
  const a = rand(0, Math.PI * 2)
  splat(x, y, Math.cos(a) * WARM_TAP_SPEED, Math.sin(a) * WARM_TAP_SPEED, { hex, radius: tune.size, strength: warmStrength(strength) })
  markWarmDropped()
}

// "ลองดู": หยดตัวอย่าง tune.samples หยดเรียงตามขอบกระดาษ (ห่างกันตามเส้นรอบกระดาษ เริ่มจากด้านสุ่ม) ไล่สีตาม SHIFT_TARGETS พุ่งเข้าด้านในช้า ๆ
const dropWarmSamples = () => {
  const targets = SHIFT_TARGETS[props.emotion]
  if (!targets || !fluid) return
  const margin = 40
  const n = Math.round(tune.samples)
  const perimeter = 2 * (SIZE.w + SIZE.h - 4 * margin)
  const start = rand(0, perimeter)
  const base = sheet.warmGestures
  sheet.warmGestures += n
  for (let i = 0; i < n; i++) {
    const t = setTimeout(() => {
      timers.delete(t)
      if (!fluid) return
      // ตำแหน่งบนเส้นรอบกระดาษ (วนตามเข็มจากมุมบนซ้าย) แล้วแปลงเป็นขอบกับทิศเข้ากลาง (แกน y ของไลบรารีชี้ขึ้น)
      let d = (start + (i * perimeter) / n) % perimeter
      const w = SIZE.w - 2 * margin
      const h = SIZE.h - 2 * margin
      let x, y, inward
      if (d < w) [x, y, inward] = [margin + d, margin, Math.PI / 2]
      else if ((d -= w) < h) [x, y, inward] = [SIZE.w - margin, margin + d, Math.PI]
      else if ((d -= h) < w) [x, y, inward] = [SIZE.w - margin - d, SIZE.h - margin, -Math.PI / 2]
      else [x, y, inward] = [margin, SIZE.h - margin - (d - w), 0]
      const angle = inward + rand(-0.3, 0.3)
      splat(x, y, Math.cos(angle) * SHIFT_SPEED, Math.sin(angle) * SHIFT_SPEED, { hex: targets[(base + i) % targets.length], radius: tune.size, strength: warmStrength() })
      markWarmDropped()
    }, i * WARM_SAMPLE_GAP)
    timers.add(t)
  }
}

// ตัวจับเวลาของโน้ตชวน: นับเฉพาะตอนผ้าใบวิ่งอยู่ (ออกจากหน้า paint = หยุด กลับมานับต่อ)
// elapsed = เวลาตั้งแต่ pointerdown ครั้งแรกของแผ่น (ไม่ต้องกดค้างตลอด) idle = เวลาที่ไม่มี pointerdown และไม่มี pointer กดค้าง
// pointermove ที่ไม่ได้กด (hover) ไม่ถูกนับ เพราะ onMove ข้าม pointer ที่ไม่อยู่ใน pointers
const noteTick = () => {
  if (!fluid || !props.running || clearing || !sheet.started) return
  const dt = NOTE_TICK * NOTE_TIME_SCALE
  sheet.elapsed += dt
  sheet.idle = pointers.size ? 0 : sheet.idle + dt
  if (DEBUG) {
    debug.elapsed = (sheet.elapsed / 1000).toFixed(1) + ' วิ'
    debug.idle = (sheet.idle / 1000).toFixed(1) + ' วิ'
  }
  if (!sheet.invited && sheet.elapsed >= NOTE_PAINT_MS && sheet.idle >= NOTE_IDLE_MS && props.warmAvailable) {
    sheet.invited = true
    emit('invite')
  }
}

const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers.clear()
}

const createFluid = () => {
  if (!containerRef.value) return
  try {
    fluid = new WebGLFluid(containerRef.value)
    fluid.setConfig({
      simResolution: 128,
      dyeResolution: navigator.maxTouchPoints > 1 ? 512 : 1024,
      pressure: 0.8,
      splatForce: SMEAR_FORCE,
      hover: false, // pointer ทั้งหมดรับผ่านชั้นของเราเอง
      colorful: true, // ต้องเป็น true เสมอ ไม่งั้น library ไม่ใช้ colorPalette
      colorPalette: [invertedHex(PALETTE.paper)],
      // สีลบแบบสีน้ำ: canvas ทึบ พื้น = สีกระดาษที่กลับสีแล้ว และ CSS invert ทั้ง canvas (ดู lib/dye.js)
      transparent: false,
      backgroundColor: invertedHex(PALETTE.paper),
      inverted: true,
      shading: false,
      bloom: false,
      sunrays: false,
    })
    applyParams()
    fluid.start()
    if (!props.running) fluid.stop()
  } catch (error) {
    // เครื่องที่ไม่มี WebGL: แอปส่วนอื่นยังใช้ได้
    console.error('เริ่มผ้าใบไม่สำเร็จ:', error)
    fluid = null
  }
}

const nextFrames = (n) =>
  new Promise((resolve) => {
    const tick = () => (n-- <= 0 ? resolve() : requestAnimationFrame(tick))
    tick()
  })

// ไลบรารีไม่มีคำสั่งล้าง: ตั้ง dissipation สูงมากไม่กี่เฟรมให้ dye และ velocity เหลือ 0 แล้วคืนค่า (ไม่สร้างตัวใหม่ จึงไม่รั่ว FBO)
const clear = async () => {
  if (!fluid || clearing) return
  debug.elapsed = debug.idle = '-'
  clearing = true
  releaseAll()
  clearTimers()
  sheet = newSheetState()
  ink.fill(0)
  fluid.start() // no-op ถ้ากำลังวิ่งอยู่ (ถ้าถูกสั่งล้างตอนหยุด loop จะต้องวิ่งก่อนถึงจะล้างได้)
  fluid.setConfig({ densityDissipation: 1000, velocityDissipation: 1000 })
  await nextFrames(CLEAR_FRAMES)
  clearing = false
  if (!fluid) return
  applyParams()
  if (!props.running) fluid.stop()
  tryDrop() // หยดที่รอจนล้างเสร็จ (เริ่มแผ่นใหม่ / เริ่มใหม่)
}

// ---- Pointer ----

const toCanvas = (e) => {
  const rect = inputRef.value.getBoundingClientRect()
  // ชดเชย scale ของ Stage: rect เป็นขนาดบนจอ ส่วน SIZE เป็นขนาดจริงบนกระดาษ
  return { x: ((e.clientX - rect.left) / rect.width) * SIZE.w, y: ((e.clientY - rect.top) / rect.height) * SIZE.h }
}

// strength < 1 ใช้กับการกดค้าง: หยดซ้ำทุก 120ms ถ้าเต็มแรงจะทับกันจนดำ
const dropAt = (x, y, strength = 1) => {
  const p = params()
  const a = rand(0, Math.PI * 2)
  const m = 60 * p.speed
  splat(x, y, Math.cos(a) * m, Math.sin(a) * m, { radius: p.radius * DROP_RADIUS_SCALE, strength })
}

const stopHold = (pointer) => {
  clearTimeout(pointer.holdStart)
  clearInterval(pointer.hold)
  pointer.holdStart = pointer.hold = null
}

const releaseAll = () => {
  pointers.forEach(stopHold)
  pointers.clear()
}

const onDown = (e) => {
  if (!fluid || !props.running || clearing) return
  inputRef.value.setPointerCapture?.(e.pointerId)
  sheet.started = true
  sheet.idle = 0
  const { x, y } = toCanvas(e)
  const pointer = { x, y, downX: x, downY: y, hold: null, holdStart: null }
  pointers.set(e.pointerId, pointer)
  // สีอุ่น: แตะ = หยดสีปลายทางตรงจุดนั้น กดค้าง = หยดเบา ๆ ต่อเนื่องด้วยสีเดียวกัน (ไม่ใช่สีอารมณ์)
  const warm = props.tool === 'warm' && props.warmAvailable ? warmHex() : null
  if (warm) {
    sheet.warmGestures++
    dropWarmAt(x, y, warm)
  } else if (props.tool === 'drop') dropAt(x, y)
  // กดค้างเกิน 400ms (เครื่องมือไหนก็ได้) = หยดต่อเนื่องที่ตำแหน่งปัจจุบัน
  const holdDrop = () => (warm ? dropWarmAt(pointer.x, pointer.y, warm, HOLD_STRENGTH) : dropAt(pointer.x, pointer.y, HOLD_STRENGTH))
  pointer.holdStart = setTimeout(() => {
    holdDrop()
    pointer.hold = setInterval(holdDrop, warm && reducedMotion?.matches ? HOLD_INTERVAL * 2 : HOLD_INTERVAL)
  }, HOLD_MS)
}

const onMove = (e) => {
  const pointer = pointers.get(e.pointerId)
  if (!pointer || !fluid || clearing) return
  // เมาส์ที่ปล่อยปุ่มไปแล้วแต่ไม่ได้รับ pointerup (เช่น ปล่อยนอกหน้าต่าง) ต้องไม่ค้างเป็น "กดอยู่" ไม่งั้นตัวนับพักมือไม่เดิน
  if (e.pointerType === 'mouse' && e.buttons === 0) return onUp(e)
  const { x, y } = toCanvas(e)
  const dx = x - pointer.x
  const dy = y - pointer.y
  pointer.x = x
  pointer.y = y
  // ลากไกลจากจุดแตะ = ไม่ใช่กดค้าง
  if (pointer.holdStart && Math.hypot(x - pointer.downX, y - pointer.downY) > HOLD_MOVE_LIMIT) {
    clearTimeout(pointer.holdStart)
    pointer.holdStart = null
  }
  if (props.tool === 'smear' && !pointer.hold) {
    const k = SMEAR_FORCE / SIZE.w // เท่ากับแรงของไลบรารีในแนวนอน และเท่ากันทุกทิศ
    splat(x, y, dx * k, -dy * k, { radius: SMEAR_RADIUS, noColor: true })
  }
}

const onUp = (e) => {
  const pointer = pointers.get(e.pointerId)
  if (!pointer) return
  stopHold(pointer)
  pointers.delete(e.pointerId)
}

onMounted(() => {
  createFluid()
  // แผง dev ปรับ FLUID_PARAMS สด: ตัวแปรเหล่านั้นถูกแก้ตรง ๆ ที่นี่แค่ตั้งค่าให้ไลบรารีใหม่
  if (DEBUG) window.addEventListener(DEV_PARAMS_EVENT, applyParams)
  noteTimer = setInterval(noteTick, NOTE_TICK)
})

watch(
  () => [props.emotion, props.intensity],
  applyParams,
)

watch(
  () => props.running,
  (running) => {
    if (!fluid) return
    if (running) {
      fluid.start()
      tryDrop()
    } else {
      releaseAll()
      stopGravity()
      clearTimers()
      if (!clearing) fluid.stop() // ถ้ากำลังล้างอยู่ clear() จะหยุดเองเมื่อเสร็จ
    }
  },
)

watch(() => props.clearTick, clear)

watch(
  () => props.warmTick,
  () => {
    if (props.running && !clearing) dropWarmSamples()
  },
)

watch(
  () => props.dropTick,
  () => {
    wantDrop = true
    tryDrop()
  },
)

// อ่านภาพจากผ้าใบเป็น canvas 2D สีตรงกับที่เห็นบนจอ (ย้อนการกลับสีของ CSS ด้วย difference กับสีขาว)
// ต้องอ่านใน requestAnimationFrame เพราะ WebGL ไม่เก็บ drawing buffer (preserveDrawingBuffer = false)
// canvas ทึบเสมอ ถ้า alpha ของ pixel เป็น 0 แปลว่า buffer ถูกล้างไปแล้ว ให้ลองใหม่ในเฟรมถัดไป
const capture = (retries = 3) =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      const source = containerRef.value?.querySelector('canvas')
      if (!source) return resolve(null)
      const out = document.createElement('canvas')
      out.width = source.width
      out.height = source.height
      const ctx = out.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(source, 0, 0)
      if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) {
        return retries > 0 ? resolve(capture(retries - 1)) : resolve(null)
      }
      ctx.globalCompositeOperation = 'difference'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, out.width, out.height)
      resolve(out)
    })
  })

defineExpose({ clear, capture })

onBeforeUnmount(() => {
  if (DEBUG) window.removeEventListener(DEV_PARAMS_EVENT, applyParams)
  releaseAll()
  stopGravity()
  clearTimers()
  clearInterval(noteTimer)
  fluid?.stop()
  fluid = null
})
</script>
