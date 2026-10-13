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
import { emotionShades, FLUID_PARAMS, FLUID_GLOBAL, SPLASH_LEVELS, INK_CELL, INITIAL_SPLATS, INTENSITY_FACTOR, SHIFT_TARGETS } from '@/lib/emotions'
import { PALETTE } from '@/lib/tokens'
import { dyeSetting, invertedHex } from '@/lib/dye'
import { warmTune as tune, noteDebug as debug, fluidInfo, DEV_PARAMS_EVENT, DEV_NOTE_RESET_EVENT } from '@/lib/devState'

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
const emit = defineEmits(['shifted', 'invite', 'splash'])

const SIZE = { w: 1112, h: 612 }
const HOLD_MS = 400 // กดค้างเกินนี้ = หยดต่อเนื่อง (SPEC §6.5)
const HOLD_INTERVAL = 120
const HOLD_STRENGTH = 0.1
const HOLD_MOVE_LIMIT = 8 // ขยับเกินนี้ (px) ถือว่าเป็นการลาก ไม่ใช่กดค้าง
const SMEAR_RADIUS = 0.25
const WARM_MIN_GIVEN = 0.02 // ต่ำกว่านี้ถือว่าลงสีอุ่นไม่ได้ (ข้าม)
const INK_SPREAD = 1.08 // วัดแล้ว: พื้นที่หยดเดี่ยวที่ 2 วินาทีเท่า main ±8% (ไม่ใส่ = 87–96%)
const DROP_RADIUS_SCALE = 3 // splatRadius ของ SPEC เล็กเกินไปบนกระดาษ 1112×612 ปรับให้หยดมีเนื้อสีพอ
const SMEAR_FORCE = 1500
const CLEAR_FRAMES = 8

// สีอุ่นของอารมณ์ลบ (SPEC §6.4) ผู้ใช้เลือกหยดเอง ไม่มีการหยดอัตโนมัติ
// ขนาด/ความเข้ม/จำนวนหยดตัวอย่างของสีอุ่นอยู่ใน lib/devState.js (warmTune) ปรับสดได้จากแผง ?debug
const WARM_SAMPLE_GAP = 280 // ms ห่างกันระหว่างหยดตัวอย่าง
const SHIFT_SPEED = 200 // ความเร็วต่ำ (initial = 220 × speed ของอารมณ์)
const WARM_TAP_SPEED = 60 // หยดที่ตำแหน่งแตะ ความเร็วเท่าหยดอารมณ์
// โน้ตชวน: ครบ tune.noteDelay วินาทีนับจาก pointerdown ครั้งแรกของแผ่น + พักมือ (ไม่มี pointerdown และไม่มีปุ่มกดค้าง) tune.noteIdle วินาที
// (เวลาที่ผ้าใบวิ่งอยู่ ค่าตั้งต้น 10 / 1.5 อยู่ใน lib/devState.js ปรับสดได้จากแผง ?debug) ถามครั้งเดียวต่อแผ่น
const NOTE_TICK = 250
// เร่งเวลาโน้ตตอน dev เพื่อทดสอบ (เร่งทั้งเวลาก่อนโน้ตขึ้นและเวลาพักมือ): เปิดหน้าด้วย ?shiftSpeed=10 (ไม่ยุ่งกับ simulation) และ ?debug เปิดแผงปรับค่า (src/dev/DebugPanel.vue)
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

// ปริมาณสีที่ลงแล้วต่อช่อง (รีเซ็ตเมื่อล้างผ้าใบ) หน่วยเดียวกับ INK_CAP = ค่าสีสูงสุดของช่องสีหนึ่งในบัฟเฟอร์ ให้สีบนผ้าใบไม่เกินเพดาน
// หยดหนึ่งไม่ได้ลงแค่ช่องที่ตก: เป็น Gaussian exp(−d²/ρ) กว้าง ~±1–2 ช่อง จึงคิดส่วนที่ตกในทุกช่องที่โดน (ค่าที่กึ่งกลางช่อง)
// แล้วลดแรงหยดให้ไม่มีช่องไหนเกินเพดาน (หยดหลายหยดที่อยู่ติดกันซ้อนกันไม่ทะลุเพดาน ไม่ดำ) คิดค่าสูงสุดในช่อง ไม่ใช่ที่กึ่งกลาง
// strength = ความแรงที่ตั้งใจจะลง (1 = หยดเต็ม) คืน { given: ความแรงที่ลงได้จริง (เต็มแล้ว = 0), room: ที่ว่างเหลือก่อนหยดนี้ในช่องที่เต็มที่สุดที่หยดแตะ (1 = ว่าง 0 = เต็ม) }
// ปริมาณสีจริงของหยด = strength × brightness × ตัวคูณความเข้ม × ค่าสีสูงสุดของ dye ของเฉดนั้น (useShade/dyeSetting ใช้สูตรเดียวกัน)
const inkCols = Math.ceil(SIZE.w / INK_CELL)
const inkRows = Math.ceil(SIZE.h / INK_CELL)
let ink = new Float32Array(inkCols * inkRows)
const dyePeak = (hex) => Math.max(...[1, 3, 5].map((i) => 1 - parseInt(hex.slice(i, i + 2), 16) / 255))
// opts.cap = เพดานที่ใช้ (ค่าเริ่มต้น INK_CAP) opts.centreOnly = ตรวจเฉพาะช่องที่หยดตก (สีอุ่น: ไม่ให้ช่องข้างเคียงที่เต็มบล็อกหยดทั้งหมด)
const takeInk = (x, y, strength, hex, radius, { cap = FLUID_GLOBAL.inkCap, centreOnly = false } = {}) => {
  const unit = params().brightness * INTENSITY_FACTOR[props.intensity] * dyePeak(hex)
  if (unit <= 0) return { given: 0, room: 0 }
  // ρ ของ exp(−d²/ρ) ในหน่วยพิกเซลกระดาษ: ไลบรารีใช้ (splatRadius/100) × aspect บน UV ที่ x ถูกคูณ aspect อยู่แล้ว
  const rho = (SIZE.w * SIZE.h * radius) / 100
  const reach = Math.ceil(Math.sqrt(rho * 3) / INK_CELL) + 1 // 3ρ ≈ ค่าตกเหลือ e^-3 (5%) +1 ช่องเผื่อขอบ
  const cx = Math.floor(x / INK_CELL)
  const cy = Math.floor(y / INK_CELL)
  const hit = [] // { index, weight }
  for (let j = Math.max(0, cy - reach); j <= Math.min(inkRows - 1, cy + reach); j++) {
    for (let i = Math.max(0, cx - reach); i <= Math.min(inkCols - 1, cx + reach); i++) {
      // ระยะจากจุดตกถึงจุดในช่องที่ใกล้ที่สุด (ช่องที่หยดตกอยู่ = 0): ค่าสูงสุดของหยดในช่องนั้น ไม่ใช่ที่กึ่งกลางช่อง
      // (ไม่งั้นหยดที่ตกตรงมุมช่องผ่านเพดานได้เกือบ 1.6 เท่า)
      const dx = Math.max(0, Math.abs((i + 0.5) * INK_CELL - x) - INK_CELL / 2)
      const dy = Math.max(0, Math.abs((j + 0.5) * INK_CELL - y) - INK_CELL / 2)
      const weight = Math.exp(-(dx * dx + dy * dy) / rho)
      if (weight > 0.05) hit.push({ index: j * inkCols + i, weight })
    }
  }
  if (!hit.length) {
    // หยดตกนอกกริด/แคบมาก: ใช้ช่องที่ตกอย่างเดียว
    const i = Math.min(ink.length - 1, cy * inkCols + cx)
    hit.push({ index: Math.max(0, i), weight: 1 })
  }
  let allowed = strength * unit
  let room = 1
  const centreIndex = Math.min(ink.length - 1, cy * inkCols + cx)
  for (const h of hit) {
    if (centreOnly && h.index !== centreIndex) continue
    allowed = Math.min(allowed, Math.max(0, cap - ink[h.index]) / h.weight)
    room = Math.min(room, Math.max(0, cap - ink[h.index]) / cap)
  }
  for (const h of hit) ink[h.index] += allowed * h.weight
  return { given: allowed / unit, room }
}

// ตั้งสีของหยดถัดไป: ไลบรารีสุ่มจาก colorPalette (hue/saturation) และใช้ brightness เป็นความเข้ม
const useShade = (hex, strength = 1) => {
  const dye = dyeSetting(hex, params().brightness * INTENSITY_FACTOR[props.intensity] * strength)
  if (dye) fluid.setConfig({ colorPalette: [dye.hex], brightness: dye.brightness })
  return !!dye
}

// ---- ประหยัดงาน GPU/CPU (SPEC §6.5) ----
// พักการจำลอง: น้ำนิ่งแล้ว (ไม่มีแรง/สีใหม่ SLEEP_MS) ข้ามขั้น step (pressure 20 รอบ + advect) ต่อ แต่ยัง render ทุกเฟรม
// ภาพจึงไม่เปลี่ยนและ capture() ยังอ่านได้ ปลุกทันทีเมื่อมีแรง/สีใหม่ ล้างผ้าใบ หรือกลับเข้าหน้า paint
// พักเมื่อ "ความเร็วน้ำต่ำมากจริง" เท่านั้น: อ่านความเร็วสูงสุดของสนามน้ำแบบ async (PBO + fence ไม่หยุด GPU) ทุก ~0.5 วินาที
// ไม่ใช่นับเวลาอย่างเดียว (น้ำไหลช้าแต่ยังไหลอยู่ ถ้าพักเฉยสีจะหยุดกะทันหัน) WebGL1 ที่ไม่มี fence ใช้เวลานิ่ง SLEEP_FALLBACK_MS แทน
const STILL_SPEED = 0.15 // หน่วยของสนามความเร็ว (texel/วินาที ของกริดจำลอง 233×128) ต่ำกว่านี้ตาแยกการขยับไม่ออก (วัดแล้ว ดู SPEC §6.5)
const SETTLE_MIN_MS = 1500 // อย่างน้อยหลังแรงสุดท้ายเท่านี้ก่อนเริ่มตรวจ
const PROBE_EVERY_MS = 500
const SLEEP_FALLBACK_MS = 20000
let lastImpulse = 0
let sleeping = false
let probe = null // { buf, sync, w, h } การอ่านที่ค้างอยู่
let probeBuf = null
let lastProbeAt = 0
let flowSpeed = Infinity // ความเร็วสูงสุดที่อ่านล่าสุด

const startProbe = () => {
  const sim = fluid?.simulation
  const gl = sim?.gl
  const v = sim?._velocity?.read
  if (!gl || !v || typeof gl.fenceSync !== 'function' || probe) return false
  const bytes = v.width * v.height * 16
  if (!probeBuf) probeBuf = gl.createBuffer()
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, probeBuf)
  gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ)
  gl.bindFramebuffer(gl.FRAMEBUFFER, v.fbo)
  gl.readPixels(0, 0, v.width, v.height, gl.RGBA, gl.FLOAT, 0)
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
  probe = { sync: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), w: v.width, h: v.height, at: performance.now() }
  gl.flush()
  return true
}
const pollProbe = () => {
  if (!probe || !fluid) return
  const gl = fluid.simulation.gl
  const status = gl.clientWaitSync(probe.sync, 0, 0)
  if (status === gl.TIMEOUT_EXPIRED) return
  // อ่านก่อนมีแรงใหม่ = ข้อมูลเก่า ทิ้ง (ไม่งั้นพักผิดจังหวะ)
  if (status !== gl.WAIT_FAILED && probe.at >= lastImpulse) {
    const out = new Float32Array(probe.w * probe.h * 4)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, probeBuf)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    let max = 0
    for (let i = 0; i < out.length; i += 4) {
      const m = Math.abs(out[i]) + Math.abs(out[i + 1])
      if (m > max) max = m
    }
    flowSpeed = max
    if (DEBUG) {
      fluidInfo.speed = max.toFixed(3)
      window.__flowSpeed = max
    }
  }
  gl.deleteSync(probe.sync)
  probe = null
}
// สีน้ำที่ค่อย ๆ แห้ง: น้ำไหลปกติ (ค่าของอารมณ์) ช่วงแรกหลัง input ล่าสุด แล้วเพิ่ม velocityDissipation แบบ ease-in-out จนน้ำสงบ
// ไม่แตะ density (สีอยู่ถาวร) input = แตะ ลาก กดค้าง หยดสีอุ่น และหยดสาดตอนเข้าหน้า (นับจากหยดสุดท้าย) มี input ใหม่ = กลับเป็นค่าปกติทันที
// แรงถ่วงของ sad เป็นส่วนหนึ่งของการสาด ไม่นับเป็น input (ยังปลุกการจำลองได้ แต่ไม่ต่อเวลาแห้ง)
// เวลาที่ใช้ = "เวลาของการจำลอง" (สะสม dt ที่ไลบรารีจำกัดไว้ ≤ 1/60 วินาทีต่อเฟรม ไม่นับช่วงพัก) ไม่ใช่เวลานาฬิกา:
// เครื่องที่เฟรมตกจะได้น้ำไหลครบเท่ากัน ไม่ใช่แห้งก่อนน้ำไหลถึง (วัดแล้ว เฟรมช้าลงทำให้พื้นที่สีเล็กลงถ้าใช้เวลานาฬิกา)
let simNow = 0
let lastInputAt = 0
let dryVel = null // ความคืบหน้าการแห้ง (0 = ไหลปกติ 1 = แห้ง) ที่ตั้งให้ไลบรารีล่าสุด (ไม่ตั้งซ้ำถ้าค่าเดิม)
let dryRaf = 0
let dryLast = 0
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2)
// curl (vorticity confinement) ใส่พลังงานกลับเข้าน้ำเองจากกระแสวนที่เหลือ ค่าสูง (ตื่นเต้น/โกรธ/กังวล) ทำให้น้ำวนไม่หยุดแม้หน่วงแรง
// จึงลด curl ลงเหลือ 0 ไปพร้อมกัน (ไม่ใช่ density) ไม่งั้นน้ำของอารมณ์ curl สูงยังขยับที่ความเร็ว 2–12 หลัง 1 นาที (วัดแล้ว)
const dryProgress = () => {
  const flow = FLUID_GLOBAL.flowTime
  const dry = Math.max(flow + 0.001, FLUID_GLOBAL.dryTime)
  return ease(Math.min(1, Math.max(0, (simNow - lastInputAt - flow) / (dry - flow))))
}
const applyDry = () => {
  if (!fluid) return
  const e = dryProgress()
  if (e === dryVel) return
  dryVel = e
  const p = params()
  fluid.setConfig({ velocityDissipation: p.velDiss + (FLUID_GLOBAL.dryDamp - p.velDiss) * e, curl: p.curl * (1 - e) })
}
const dryFrame = (t) => {
  dryRaf = requestAnimationFrame(dryFrame)
  const dt = Math.min((t - dryLast) / 1000, 1 / 60)
  dryLast = t
  if (!fluid || !props.running || clearing || sleeping) return
  simNow += dt
  if (pointers.size) lastInputAt = simNow // นิ้วหรือเมาส์กดอยู่ = ยังระบายอยู่
  applyDry()
}

// auto = แรงที่แอปใส่เอง (แรงถ่วง) ปลุกการจำลองแต่ไม่นับเป็น input ของผู้ใช้
const wake = (auto = false) => {
  lastImpulse = performance.now()
  if (!auto) {
    lastInputAt = simNow
    applyDry()
  }
  flowSpeed = Infinity // มีแรงใหม่ ค่าที่อ่านไว้ใช้ไม่ได้แล้ว
  if (sleeping && fluid) {
    sleeping = false
    fluid.togglePause()
    if (DEBUG) {
      fluidInfo.state = 'ทำงาน'
      window.__fluidSleeping = false
    }
  }
}
const goToSleep = () => {
  if (sleeping || !fluid) return
  sleeping = true
  fluid.togglePause()
  if (DEBUG) {
    fluidInfo.state = 'พัก (น้ำนิ่ง)'
    window.__fluidSleeping = true
  }
}

// ดันน้ำอย่างเดียว (ไม่เติมสี): ไลบรารีทุก splat ทำ 2 ผ่าน (ความเร็ว + สี) และอ่าน clientHeight (บังคับ layout) ทุกครั้ง
// ที่นี่ทำเฉพาะผ่านความเร็วเองด้วยโปรแกรม splat ของไลบรารี ใช้ตอนปาดสี/แรงถ่วง ที่ส่งสีศูนย์อยู่แล้ว ถ้าเข้าถึงภายในไม่ได้ถอยไปใช้ของไลบรารี
const pushWater = (x, y, dx, dy, radius, auto = false) => {
  wake(auto)
  const sim = fluid.simulation
  const program = sim?.programs?.splatProgram
  if (program && sim._velocity && typeof sim.blit === 'function' && typeof sim.correctRadius === 'function') {
    const gl = sim.gl
    program.bind()
    gl.uniform1i(program.uniforms.uTarget, sim._velocity.read.attach(0))
    gl.uniform1f(program.uniforms.aspectRatio, sim.canvas.width / sim.canvas.height)
    gl.uniform2f(program.uniforms.point, x / SIZE.w, 1 - y / SIZE.h)
    gl.uniform3f(program.uniforms.color, dx, dy, 0)
    gl.uniform1f(program.uniforms.radius, sim.correctRadius(radius / 100))
    sim.blit(sim._velocity.write)
    sim._velocity.swap()
    return
  }
  fluid.setConfig({ splatRadius: radius })
  fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx, dy, '#000000')
}

// พิกัด css px บนกระดาษ (0..SIZE) → ไลบรารี (x เป็น px จริง ×dpr, y เป็น css px และกลับแกนเอง)
// warm = หยดสีอุ่นของผู้ใช้: เพดานแยก (FLUID_GLOBAL.warmCap) ตรวจช่องที่ตกอย่างเดียว และถ้าลงสีไม่ได้เลย (given = 0) ข้ามทั้งหมด
// ไม่ส่ง splat สีศูนย์ที่ยังดันน้ำ (เดิมดูเหมือนหยดแล้วสีไม่ออก แต่น้ำขยับ) คืน true ถ้าลงสีจริง
const splat = (x, y, dx, dy, { hex, radius, noColor, strength = 1, warm = false } = {}) => {
  if (!fluid) return false
  if (noColor) {
    pushWater(x, y, dx, dy, radius, true)
    return false
  }
  const shade = hex ?? pickShade()
  const { given, room } = takeInk(x, y, strength, shade, radius, warm ? { cap: FLUID_GLOBAL.warmCap, centreOnly: true } : undefined)
  if (warm && given < WARM_MIN_GIVEN) return false
  wake()
  // เพดานสีตัดยอดหยดให้เตี้ยลง สีที่ถูกตัดไปจึงกระจายออกข้างแทน (ปริมาณสีไม่หายไปเฉย ๆ) ขอบวงกว้างขึ้นเล็กน้อยให้พื้นที่ช่วงแรกใกล้ main
  fluid.setConfig({ splatRadius: radius * INK_SPREAD })
  // ช่องที่สีเต็มเพดานแล้วไม่ควรดันน้ำเต็มแรงอีก (ไม่งั้นแตะจุดเดิมรัว ๆ ปั่นสีเดิมให้กระจายทั่วผ้าใบ) ดันตามที่ว่างเหลือ ขั้นต่ำ 10%
  // ดันตามที่ว่าง ไม่ใช่ตามสัดส่วนที่ถูกตัดทอน: หยดแรกบนผ้าใบว่างโดนเพดานตัดสีได้ แต่ต้องดันน้ำเต็มแรงเท่า main (พื้นที่ช่วงแรกเท่ากัน)
  const push = strength > 0 ? Math.max(0.1, Math.min(1, room)) : 1
  if (!useShade(shade, given)) return false
  fluid.splatAtLocation(x * (window.devicePixelRatio || 1), y, dx * push, dy * push)
  return true
}

const params = () => FLUID_PARAMS[props.emotion]

const applyParams = () => {
  if (!fluid) return
  fluid.setConfig({ densityDissipation: FLUID_GLOBAL.density })
  dryVel = null
  applyDry()
  reportInfo()
}

// ?debug: อ่านค่าที่ไลบรารีใช้งานจริงกลับมา + ชนิด texture ของเครื่องนี้ ให้แผงโชว์ (ตรวจบน iPad)
// ไลบรารีใช้ half float 16 บิตเสมอ (WebGL2: RGBA16F / WebGL1: OES_texture_half_float) ไม่มีทางถอยเป็น 8 บิต
const reportInfo = () => {
  if (!DEBUG || !fluid) return
  window.__fluid = fluid // dev เท่านั้น: ให้สคริปต์วัด (scripts/measure-fps.mjs) จับเวลาแต่ละขั้นของไลบรารี
  const sim = fluid.simulation
  if (!sim) return
  const gl = sim.gl
  const ext = sim.ext
  const FORMATS = { 0x881a: 'RGBA16F', 0x8814: 'RGBA32F', 0x1908: 'RGBA' }
  Object.assign(fluidInfo, {
    webgl: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1',
    format: FORMATS[ext?.formatRGBA?.internalFormat] ?? String(ext?.formatRGBA?.internalFormat),
    texType: ext?.halfFloatTexType === gl.HALF_FLOAT ? 'HALF_FLOAT (16 บิต)' : ext?.halfFloatTexType ? 'HALF_FLOAT_OES (16 บิต)' : 'ไม่ใช่ half float',
    linear: Boolean(ext?.supportLinearFiltering),
    density: sim.densityDissipation,
    velocity: sim.velocityDissipation,
    dyeRes: sim.dyeResolution,
    simRes: sim.simResolution,
    canvas: `${sim.canvas?.width}×${sim.canvas?.height}`,
  })
}

const rand = (min, max) => min + Math.random() * (max - min)

// สาดสีตอนเข้าหน้า paint (SPEC §6.3): หยดทยอยลงภายใน FLUID_GLOBAL.splashMs ตาม pattern ของอารมณ์ ไม่ลงพร้อมกันทั้งหมด
// จำนวน/ขนาด/ระยะกระจายตามระดับที่ผู้ใช้เลือก (SPLASH_LEVELS แยกจาก INTENSITY_FACTOR ที่ยังคุมความเข้มสีต่อหยด)
// ลดการเคลื่อนไหว: ทุกหยดลงทันทีโดยไม่ซึมเป็นจังหวะ ผ้าใบปรากฏด้วย fade 150ms แทน
let splashPending = 0
const setSplashing = (on) => {
  emit('splash', on)
}
const finishSplashOne = () => {
  if (splashPending > 0 && --splashPending === 0) setSplashing(false)
}
const dropInitial = () => {
  if (!fluid) return
  const p = params()
  const level = SPLASH_LEVELS[props.intensity] ?? SPLASH_LEVELS[1]
  // จำนวนหยดต้องเป็นจำนวนเต็ม: ส่วนที่ปัดทิ้ง/เพิ่ม (want ÷ count) ไปปรับขนาดหยดแทน ให้ตัวคูณ splash ปรับพื้นที่ได้ต่อเนื่อง
  // ปัดขึ้นเมื่อเศษ ≥ 0.8 (ไม่ใช่ 0.5): หยด 1 → 2 หยดเปลี่ยนพื้นที่เป็นก้าวใหญ่เมื่อจำนวนน้อย (เหนื่อยระดับนิดหน่อย 6% → 9%) ให้ขนาดรับส่วนที่เหลือก่อน
  const want = INITIAL_SPLATS[props.emotion] * level.count * (p.splash?.[props.intensity] ?? 1)
  const count = Math.max(1, Math.floor(want + 0.2))
  const fit = Math.sqrt(want / count)
  const mag = 220 * p.speed
  const calm = Boolean(reducedMotion?.matches)
  const half = Math.min(0.46, 0.35 * level.spread) // ครึ่งช่วงของตำแหน่ง (เดิม 0.35 = 15–85%)
  const radius = p.radius * DROP_RADIUS_SCALE * level.size * fit
  const span = calm ? 0 : FLUID_GLOBAL.splashMs
  lastInputAt = simNow

  // สร้างรายการหยดก่อน (ตำแหน่ง ทิศ แรง) แล้วกำหนดเวลาตาม pattern
  const drops = []
  for (let i = 0; i < count; i++) {
    let x = SIZE.w * rand(0.5 - half, 0.5 + half)
    let y = SIZE.h * rand(0.5 - half, 0.5 + half)
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
    drops.push({ x, y, dx: Math.cos(angle) * m, dy: Math.sin(angle) * m })
  }
  if (p.pattern === 'fall') drops.sort((a, b) => a.y - b.y) // ไหลลง: ทยอยจากบนลงล่าง
  const last = Math.max(1, count - 1)
  drops.forEach((d, i) => {
    const k = i / last
    let t
    if (p.pattern === 'burst') t = span * 0.7 * k ** 0.8 // พุ่งออกเร็ว ๆ ช่วงต้น
    else if (p.pattern === 'scatter') t = rand(0, span) // จุดเล็กผุดสุ่ม
    else if (p.pattern === 'drift' || p.pattern === 'still') t = span * k // ไล่เรียงสม่ำเสมอ
    else t = span * k // pulse / fall: จังหวะเท่ากัน
    d.t = t + (calm ? 0 : rand(0, 60))
  })

  splashPending += count
  if (splashPending === count) setSplashing(true)
  if (calm && containerRef.value?.animate) containerRef.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
  for (const d of drops) {
    const run = () => {
      if (fluid) dropInk(d.x, d.y, d.dx, d.dy, { radius })
      finishSplashOne()
    }
    if (d.t <= 0) run()
    else {
      const t = setTimeout(() => {
        timers.delete(t)
        run()
      }, d.t)
      timers.add(t)
    }
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
  if (splat(x, y, Math.cos(a) * WARM_TAP_SPEED, Math.sin(a) * WARM_TAP_SPEED, { hex, radius: tune.size, strength: warmStrength(strength), warm: true })) markWarmDropped()
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
      if (splat(x, y, Math.cos(angle) * SHIFT_SPEED, Math.sin(angle) * SHIFT_SPEED, { hex: targets[(base + i) % targets.length], radius: tune.size, strength: warmStrength(), warm: true })) markWarmDropped()
    }, i * WARM_SAMPLE_GAP)
    timers.add(t)
  }
}

// ตัวจับเวลาของโน้ตชวน: นับเฉพาะตอนผ้าใบวิ่งอยู่ (ออกจากหน้า paint = หยุด กลับมานับต่อ)
// elapsed = เวลาตั้งแต่ pointerdown ครั้งแรกของแผ่น (ไม่ต้องกดค้างตลอด) idle = เวลาที่ไม่มี pointerdown และไม่มี pointer กดค้าง
// pointermove ที่ไม่ได้กด (hover) ไม่ถูกนับ เพราะ onMove ข้าม pointer ที่ไม่อยู่ใน pointers
const noteTick = () => {
  // น้ำนิ่งแล้ว (ไม่มีแรง/สีใหม่, ไม่มีนิ้วกด, ไม่มีการซึมค้าง) → พักการจำลอง
  if (fluid && props.running && !clearing && !sleeping && pointers.size === 0 && timers.size === 0) {
    const now = performance.now()
    pollProbe()
    if (now - lastImpulse > SETTLE_MIN_MS) {
      const canProbe = typeof fluid.simulation?.gl?.fenceSync === 'function'
      if (canProbe) {
        if (flowSpeed < STILL_SPEED && lastProbeAt > lastImpulse) goToSleep()
        else if (!probe && now - lastProbeAt > PROBE_EVERY_MS) {
          lastProbeAt = now
          startProbe()
        }
      } else if (now - lastImpulse > SLEEP_FALLBACK_MS) goToSleep()
    }
  }
  if (!fluid || !props.running || clearing || !sheet.started) return
  const dt = NOTE_TICK * NOTE_TIME_SCALE
  sheet.elapsed += dt
  sheet.idle = pointers.size ? 0 : sheet.idle + dt
  if (DEBUG) {
    debug.elapsed = (sheet.elapsed / 1000).toFixed(1) + ' วิ'
    debug.idle = (sheet.idle / 1000).toFixed(1) + ' วิ'
  }
  if (!sheet.invited && sheet.elapsed >= tune.noteDelay * 1000 && sheet.idle >= tune.noteIdle * 1000 && props.warmAvailable) {
    sheet.invited = true
    emit('invite')
  }
}

// dev: เริ่มนับโน้ตของแผ่นนี้ใหม่โดยไม่ล้างภาพ (นับใหม่ตั้งแต่ pointerdown ถัดไป) แล้วแผงตั้ง app.warmNote กลับเป็น idle
const resetNote = () => {
  Object.assign(sheet, { started: false, elapsed: 0, idle: 0, invited: false })
  if (DEBUG) {
    debug.elapsed = '-'
    debug.idle = '-'
  }
}

const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers.clear()
  if (splashPending > 0) {
    splashPending = 0
    setSplashing(false)
  }
}

const createFluid = () => {
  if (!containerRef.value) return
  try {
    fluid = new WebGLFluid(containerRef.value)
    fluid.setConfig({
      simResolution: 128,
      // ความละเอียดสีบนจอทั่วไป 768 (เดิม 1024) และ pressure 12 รอบ (ไลบรารีตั้งต้น 20): วัดแล้วผลภาพเหมือนเดิม (ความเข้มรอบจุด/พื้นที่ ต่างไม่เกิน 0.3%) แต่ GPU เบาลง
      dyeResolution: navigator.maxTouchPoints > 1 ? 512 : 768,
      pressure: 0.8,
      pressureIterations: 12,
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
    reportInfo()
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
  wake() // ต้องให้ step วิ่งอยู่ ไม่งั้น dissipation ที่ตั้งไว้ล้างไม่ได้
  releaseAll()
  clearTimers()
  sheet = newSheetState()
  ink.fill(0)
  fluid.start() // no-op ถ้ากำลังวิ่งอยู่ (ถ้าถูกสั่งล้างตอนหยุด loop จะต้องวิ่งก่อนถึงจะล้างได้)
  fluid.setConfig({ densityDissipation: 1000, velocityDissipation: 1000 })
  await nextFrames(CLEAR_FRAMES)
  clearing = false
  if (!fluid) return
  lastInputAt = simNow
  applyParams()
  if (!props.running) fluid.stop()
  tryDrop() // หยดที่รอจนล้างเสร็จ (เริ่มแผ่นใหม่ / เริ่มใหม่)
}

// ---- Pointer ----

// getBoundingClientRect บังคับ layout ทุกครั้ง: เก็บผลไว้ใช้ทั้งเฟรม (เมาส์/Pencil ส่ง pointermove ได้หลายครั้งต่อเฟรม)
let rectCache = null
const toCanvas = (e) => {
  if (!rectCache) {
    rectCache = inputRef.value.getBoundingClientRect()
    requestAnimationFrame(() => (rectCache = null))
  }
  const rect = rectCache
  // ชดเชย scale ของ Stage: rect เป็นขนาดบนจอ ส่วน SIZE เป็นขนาดจริงบนกระดาษ
  return { x: ((e.clientX - rect.left) / rect.width) * SIZE.w, y: ((e.clientY - rect.top) / rect.height) * SIZE.h }
}

// หยดสีหนึ่งหยด: เฉดเดียว ลงเต็มแรงทีเดียว (ไม่ซึมต่อ สีน้ำจริงไหลไปตามน้ำที่ถูกดัน ไม่ได้ขยายวงเอง)
const dropInk = (x, y, dx, dy, { radius, strength = 1 }) => {
  splat(x, y, dx, dy, { hex: pickShade(), radius, strength })
}

// strength < 1 ใช้กับการกดค้าง: หยดซ้ำทุก 120ms ถ้าเต็มแรงจะทับกันจนดำ
const dropAt = (x, y, strength = 1) => {
  const p = params()
  const a = rand(0, Math.PI * 2)
  const m = 60 * p.speed * strength // หยดเบา (กดค้าง) ก็ดันน้ำเบา ไม่งั้นกดค้างนาน ๆ ปั่นน้ำจนสีกระจายทั่วผ้าใบ
  dropInk(x, y, Math.cos(a) * m, Math.sin(a) * m, { radius: p.radius * DROP_RADIUS_SCALE, strength })
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
  wake()
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
  lastInputAt = simNow
  // ลากไกลจากจุดแตะ = ไม่ใช่กดค้าง
  if (pointer.holdStart && Math.hypot(x - pointer.downX, y - pointer.downY) > HOLD_MOVE_LIMIT) {
    clearTimeout(pointer.holdStart)
    pointer.holdStart = null
  }
  if (props.tool === 'smear' && !pointer.hold) {
    const k = SMEAR_FORCE / SIZE.w // เท่ากับแรงของไลบรารีในแนวนอน และเท่ากันทุกทิศ
    queueSmear(x, y, dx * k, -dy * k)
  }
}

// รวมการปาดทั้งหมดที่เกิดในเฟรมเดียว (เมาส์/แทร็กแพด/Pencil ส่ง pointermove ได้ 120–1000 ครั้ง/วินาที) เป็น 1 ครั้งต่อเฟรม
let smear = null
let smearFrame = 0
const flushSmear = () => {
  smearFrame = 0
  const s = smear
  smear = null
  if (s && fluid && !clearing && props.running) pushWater(s.x, s.y, s.dx, s.dy, SMEAR_RADIUS)
}
const queueSmear = (x, y, dx, dy) => {
  if (smear) {
    smear.x = x
    smear.y = y
    smear.dx += dx
    smear.dy += dy
  } else smear = { x, y, dx, dy }
  if (!smearFrame) smearFrame = requestAnimationFrame(flushSmear)
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
  if (DEBUG) {
    window.addEventListener(DEV_PARAMS_EVENT, applyParams)
    window.addEventListener(DEV_NOTE_RESET_EVENT, resetNote)
  }
  noteTimer = setInterval(noteTick, NOTE_TICK)
  dryLast = performance.now()
  dryRaf = requestAnimationFrame(dryFrame)
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
      sleeping = false
      if (fluid.simulation) fluid.simulation.paused = false
      lastImpulse = performance.now()
      lastInputAt = simNow
      applyDry()
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
  if (DEBUG) {
    window.removeEventListener(DEV_PARAMS_EVENT, applyParams)
    window.removeEventListener(DEV_NOTE_RESET_EVENT, resetNote)
  }
  releaseAll()
  stopGravity()
  clearTimers()
  clearInterval(noteTimer)
  cancelAnimationFrame(dryRaf)
  fluid?.stop()
  fluid = null
})
</script>
