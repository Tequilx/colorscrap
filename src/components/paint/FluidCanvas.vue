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
import { emotionShades, FLUID_PARAMS, DISSIPATION_SCALE, INITIAL_SPLATS, INTENSITY_FACTOR } from '@/lib/emotions'
import { PALETTE } from '@/lib/tokens'
import { dyeSetting, invertedHex } from '@/lib/dye'

const props = defineProps({
  emotion: { type: String, required: true },
  intensity: { type: Number, default: 1 },
  // เครื่องมือที่เลือก: smear (ปาดสี) | drop (เติมหยด)
  tool: { type: String, default: 'smear' },
  // false = หยุด loop ของ simulation (ไม่อยู่ในหน้า paint) แต่ยังคง WebGL context ไว้ (SPEC §4.3)
  running: { type: Boolean, default: true },
  // เพิ่มค่าเพื่อสั่งล้างผ้าใบ
  clearTick: { type: Number, default: 0 },
  // เพิ่มค่าเพื่อสั่งหยดสีเริ่มต้นของอารมณ์ที่เลือก (หยดทับของเดิมได้) store เป็นผู้ตัดสินว่าเมื่อไหร่ควรหยด (SPEC §5.3)
  dropTick: { type: Number, default: 0 },
})

const SIZE = { w: 1112, h: 612 }
const HOLD_MS = 400 // กดค้างเกินนี้ = หยดต่อเนื่อง (SPEC §6.5)
const HOLD_INTERVAL = 120
const HOLD_STRENGTH = 0.1
const HOLD_MOVE_LIMIT = 8 // ขยับเกินนี้ (px) ถือว่าเป็นการลาก ไม่ใช่กดค้าง
const SMEAR_RADIUS = 0.25
const DROP_RADIUS_SCALE = 3 // splatRadius ของ SPEC เล็กเกินไปบนกระดาษ 1112×612 ปรับให้หยดมีเนื้อสีพอ
const SMEAR_FORCE = 1500
const CLEAR_FRAMES = 8

// webgl-fluid-enhanced v0.8 รับ "container" (ไม่ใช่ canvas) แล้วหา <canvas> ข้างในเอง
const containerRef = ref(null)
const inputRef = ref(null)

// สำคัญมาก: ใช้ตัวแปรธรรมดา (let) ไม่ใช้ ref() เพื่อป้องกัน Vue Proxy เข้าไปแทรกแซง WebGL
let fluid = null
// มีคำสั่งหยดสีเริ่มต้นค้างอยู่ รอจนผ้าใบวิ่งอยู่และล้างเสร็จก่อนค่อยหยด
let wantDrop = false
let clearing = false
let gravityTimer = null
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

// ตั้งสีของหยดถัดไป: ไลบรารีสุ่มจาก colorPalette (hue/saturation) และใช้ brightness เป็นความเข้ม
const useShade = (hex, strength = 1) => {
  const dye = dyeSetting(hex, params().brightness * INTENSITY_FACTOR[props.intensity] * strength)
  if (dye) fluid.setConfig({ colorPalette: [dye.hex], brightness: dye.brightness })
  return !!dye
}

// พิกัด css px บนกระดาษ (0..SIZE) → ไลบรารี (x เป็น px จริง ×dpr, y เป็น css px และกลับแกนเอง)
const splat = (x, y, dx, dy, { hex, radius, noColor, strength } = {}) => {
  if (!fluid) return
  fluid.setConfig({ splatRadius: radius })
  if (noColor) {
    fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx, dy, '#000000') // สี 0 = ใส่แรงอย่างเดียว
  } else if (useShade(hex ?? pickShade(), strength)) {
    fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx, dy)
  }
}

const params = () => FLUID_PARAMS[props.emotion]

const applyParams = () => {
  if (!fluid) return
  const p = params()
  fluid.setConfig({
    curl: p.curl,
    densityDissipation: p.dissipation * DISSIPATION_SCALE * (props.intensity === 2 ? 0.8 : 1),
    velocityDissipation: 1.2,
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

// แรงถ่วงของ sad: ปาดลงเบา ๆ แบบไม่เติมสี เป็นระยะ
const startGravity = () => {
  stopGravity()
  if (params().pattern !== 'fall') return
  gravityTimer = setInterval(() => {
    splat(rand(0, SIZE.w), rand(0, SIZE.h * 0.7), 0, -220, { radius: 0.3, noColor: true })
  }, 700)
}
const stopGravity = () => {
  clearInterval(gravityTimer)
  gravityTimer = null
}

// หยดสีเริ่มต้นของอารมณ์ที่เลือกลงบนผ้าใบ (ทับของเดิมได้) ทำเมื่อผ้าใบวิ่งอยู่และไม่ได้กำลังล้าง
const tryDrop = () => {
  if (!wantDrop || !fluid || !props.running || clearing) return
  wantDrop = false
  dropInitial()
  startGravity()
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
    if (props.running) startGravity()
    else fluid.stop()
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
  clearing = true
  releaseAll()
  clearTimers()
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
  const { x, y } = toCanvas(e)
  const pointer = { x, y, downX: x, downY: y, hold: null, holdStart: null }
  pointers.set(e.pointerId, pointer)
  if (props.tool === 'drop') dropAt(x, y)
  // กดค้างเกิน 400ms (เครื่องมือไหนก็ได้) = หยดต่อเนื่องที่ตำแหน่งปัจจุบัน
  pointer.holdStart = setTimeout(() => {
    dropAt(pointer.x, pointer.y, HOLD_STRENGTH)
    pointer.hold = setInterval(() => dropAt(pointer.x, pointer.y, HOLD_STRENGTH), HOLD_INTERVAL)
  }, HOLD_MS)
}

const onMove = (e) => {
  const pointer = pointers.get(e.pointerId)
  if (!pointer || !fluid || clearing) return
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

onMounted(createFluid)

watch(
  () => [props.emotion, props.intensity],
  applyParams,
)
watch(() => props.emotion, startGravity)

watch(
  () => props.running,
  (running) => {
    if (!fluid) return
    if (running) {
      fluid.start()
      startGravity()
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
  releaseAll()
  stopGravity()
  clearTimers()
  fluid?.stop()
  fluid = null
})
</script>
