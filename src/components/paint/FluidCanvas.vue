<template>
  <!-- ผ้าใบน้ำไหล (webgl-fluid-enhanced) ครอบเต็มกระดาษ ขนาดคงที่ 1112×612 บน stage -->
  <!-- ไลบรารีเขียนทับ style ของ container (position: relative; display: flex) จึงต้องมีกล่องนอกที่ absolute inset-0 คอยกำหนดขนาด
       ไม่งั้น canvas สูง 100% ของ container ที่ความสูงไม่แน่นอน แล้วถูกคำนวณจากอัตราส่วน 2:1 แทน -->
  <div class="absolute inset-0">
    <div ref="containerRef" class="h-full w-full" aria-label="ผ้าใบระบายสี ลากเพื่อปาดและกวนสี" role="img"></div>
    <!-- ชั้นรับ pointer: ดัก event ไว้ไม่ให้ถึง canvas (ไลบรารีใช้ pageX/pageY ซึ่งผิดตำแหน่งเมื่อ Stage ถูก scale) -->
    <div
      ref="inputRef"
      class="absolute inset-0 touch-none"
      data-cursor
      :style="overlayStyle"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @lostpointercapture="onUp"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import WebGLFluid from 'webgl-fluid-enhanced'
import { emotionShades, FLUID_PARAMS, FLUID_GLOBAL, SPLASH_LEVELS, INK_CELL, INITIAL_SPLATS, INTENSITY_FACTOR, EMOTION_BY_KEY, WARM_TONES, WARM_BLOOM, WARM_PUSH_GAIN, warmShade } from '@/lib/emotions'
import { PALETTE } from '@/lib/tokens'
import { invertedHex } from '@/lib/dye'
import { sound } from '@/lib/sound'
import { canvasCursor, finePointer } from '@/lib/cursors'
import { DYE_SPLAT_FRAG, PAPER_LIGHT } from '@/lib/dyeLimit'
import { warmTune as tune, noteDebug as debug, fluidInfo, DEV_PARAMS_EVENT, DEV_NOTE_RESET_EVENT } from '@/lib/devState'

const props = defineProps({
  emotion: { type: String, required: true },
  intensity: { type: Number, default: 1 },
  // เครื่องมือที่เลือก: smear (ปาดสี) | drop (เติมหยด) | warm (แต้มแสง เฉพาะอารมณ์ลบ)
  tool: { type: String, default: 'smear' },
  // false = หยุด loop ของ simulation (ไม่อยู่ในหน้า paint) แต่ยังคง WebGL context ไว้ (SPEC §4.3)
  running: { type: Boolean, default: true },
  // เพิ่มค่าเพื่อสั่งล้างผ้าใบ
  clearTick: { type: Number, default: 0 },
  // เพิ่มค่าเพื่อสั่งหยดสีเริ่มต้นของอารมณ์ที่เลือก (หยดทับของเดิมได้) store เป็นผู้ตัดสินว่าเมื่อไหร่ควรหยด (SPEC §5.3)
  dropTick: { type: Number, default: 0 },
  // เพิ่มค่าเมื่อกด "ลองดู" ในโน้ตชวน: หยดแต้มแสง 1 หยดที่ขอบกระดาษ
  warmTick: { type: Number, default: 0 },
  // อารมณ์ล่าสุดของแผ่นเป็นอารมณ์ลบ (ใช้ตัดสินว่าจะชวนหรือไม่)
  warmAvailable: { type: Boolean, default: false },
})

// shifted: ผู้ใช้หยดแต้มแสงเองหยดแรกของแผ่น | invite: ระบายรวมครบและพักมือ ควรโผล่โน้ตชวน (SPEC §6.4)
const emit = defineEmits(['shifted', 'invite', 'splash'])

const SIZE = { w: 1112, h: 612 }
const HOLD_MS = 400 // กดค้างเกินนี้ = หยดต่อเนื่อง (SPEC §6.5)
const HOLD_INTERVAL = 120
const HOLD_STRENGTH = 0.1
const HOLD_MOVE_LIMIT = 8 // ขยับเกินนี้ (px) ถือว่าเป็นการลาก ไม่ใช่กดค้าง
const SMEAR_RADIUS = 0.25
// แต้มแสงแบบบาน (ดู bloomAt): ความปลอดภัยเรื่องดำ/รูขาวอยู่ที่ตัวกันดำของ GPU แล้ว (หลังยกสี พื้นที่สว่างพอให้แต้มแสงลงได้เสมอ ก่อนยกก็ไม่เกินเพดาน)
// จึงไม่ต้องมีงบการยกสีต่อช่อง (เดิมมีงบ แล้วกดค้างหมดงบหลัง ~2 ครั้ง สีเดิมไหลกลับเต็มกลางวงและแต้มแสงหายไป วัดแล้ว)
// ขอบเข้มคูณสีเดิมของจุดนั้นแต่ไม่เกิน INK_CAP (ไม่ให้ขอบสะสมจนดำ) กันกดค้างบานถี่ไป: ไม่ถี่กว่า HOLD_BLOOM_MS
const HOLD_BLOOM_MS = 700
const LIFT_GAP_MS = 500 // แตะรัวถี่กว่านี้ ไม่ยกสีซ้ำ (ลงแต้มแสงอย่างเดียว) ไม่งั้นแต้มแสงที่เพิ่งลงถูกยกทิ้งทุกครั้งจนเหลือรูขาว
const INK_SPREAD = 1.08 // วัดแล้ว: พื้นที่หยดเดี่ยวที่ 2 วินาทีเท่า main ±8% (ไม่ใส่ = 87–96%)
const DROP_RADIUS_SCALE = 3 // splatRadius ของ SPEC เล็กเกินไปบนกระดาษ 1112×612 ปรับให้หยดมีเนื้อสีพอ
const SMEAR_FORCE = 1500
const CLEAR_FRAMES = 8

// แต้มแสงของอารมณ์ลบ (SPEC §6.4) ผู้ใช้เลือกหยดเอง ไม่มีการหยดอัตโนมัติ
// ขนาด/ความเข้ม/จำนวนหยดตัวอย่างของแต้มแสงอยู่ใน lib/devState.js (warmTune) ปรับสดได้จากแผง ?debug
const WARM_SAMPLE_GAP = 280 // ms ห่างกันระหว่างหยดตัวอย่าง
const SHIFT_SPEED = 200 // ความเร็วต่ำ (initial = 220 × speed ของอารมณ์)
const WARM_TAP_SPEED = 60 // หยดที่ตำแหน่งแตะ ความเร็วเท่าหยดอารมณ์
// โน้ตชวน: ครบ tune.noteDelay วินาทีนับจาก pointerdown ครั้งแรกของแผ่น + พักมือ (ไม่มี pointerdown และไม่มีปุ่มกดค้าง) tune.noteIdle วินาที
// (เวลาที่ผ้าใบวิ่งอยู่ ค่าตั้งต้น 10 / 1.5 อยู่ใน lib/devState.js ปรับสดได้จากแผง ?debug) ถามครั้งเดียวต่อแผ่น
const NOTE_TICK = 250
// เร่งเวลาโน้ตตอน dev เพื่อทดสอบ (เร่งทั้งเวลาก่อนโน้ตขึ้นและเวลาพักมือ): เปิดหน้าด้วย ?shiftSpeed=10 (ไม่ยุ่งกับ simulation) และ ?debug เปิดแผงปรับค่า (src/dev/DebugPanel.vue)
const DEBUG = import.meta.env.DEV && new URLSearchParams(location.search).has('debug')
const NOTE_TIME_SCALE = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('shiftSpeed')) || 1 : 1
// prefers-reduced-motion: หยดแต้มแสงตอนกดค้างช้าลงครึ่งหนึ่ง (ห่างขึ้น 2 เท่า)
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
// สถานะของแผ่นปัจจุบัน (รีเซ็ตเมื่อล้างผ้าใบ): เวลาที่ระบายรวม เวลาที่พักมือ ชวนไปแล้วหรือยัง จำนวนครั้งที่หยดแต้มแสง (ไล่สีตามนี้)
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

// แผนที่ประเมินปริมาณสีที่ลงแล้วต่อช่อง (รีเซ็ตเมื่อล้างผ้าใบ) ไม่ได้บล็อกการหยด (ตัวกันดำอยู่ที่ shader GPU, lib/dyeLimit.js)
// หยดหนึ่งไม่ได้ลงแค่ช่องที่ตก: เป็น Gaussian exp(−d²/ρ) กว้าง ~±1–2 ช่อง จึงคิดส่วนที่ตกในทุกช่องที่โดน
const inkCols = Math.ceil(SIZE.w / INK_CELL)
const inkRows = Math.ceil(SIZE.h / INK_CELL)
let ink = new Float32Array(inkCols * inkRows)
// ช่องของแผนที่ ink ที่หยดรัศมี radius ที่ (x, y) แตะ: [{ index, weight }] weight = ค่าสูงสุดของ Gaussian ในช่องนั้น (0..1) และช่องที่หยดตก
const inkCells = (x, y, radius) => {
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
  return { hit, centreIndex: Math.min(ink.length - 1, cy * inkCols + cx) }
}
// แผนที่นี้ใช้ประเมินว่าตรงไหนมีสีมากน้อย (หาที่วาง "ลองดู") ค่าสะสมประมาณ (ไม่ตามสีที่น้ำพาไป) จึงจำกัดไว้ที่ 1 ต่อช่อง
const depositInk = (x, y, amount, radius) => {
  const { hit } = inkCells(x, y, radius)
  for (const h of hit) ink[h.index] = Math.min(1, ink[h.index] + amount * h.weight)
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
// ไม่แตะ density (สีอยู่ถาวร) input = แตะ ลาก กดค้าง หยดแต้มแสง และหยดสาดตอนเข้าหน้า (นับจากหยดสุดท้าย) มี input ใหม่ = กลับเป็นค่าปกติทันที
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

// ลง dye หนึ่งหยดด้วย shader ตัวกันดำ: dye = เวกเตอร์สีที่ขอลง (หน่วยเดียวกับ dye ของไลบรารี)
const dyeSplat = (x, y, radius, dye) => {
  const dp = getDyeProgram()
  if (!dp) return false
  const sim = fluid.simulation
  const gl = sim.gl
  gl.useProgram(dp.program)
  gl.uniform1i(dp.u.uTarget, sim._dye.read.attach(0))
  gl.uniform1f(dp.u.aspectRatio, sim.canvas.width / sim.canvas.height)
  gl.uniform3f(dp.u.color, dye[0], dye[1], dye[2])
  gl.uniform2f(dp.u.point, x / SIZE.w, 1 - y / SIZE.h)
  gl.uniform1f(dp.u.radius, sim.correctRadius(radius / 100))
  gl.uniform1f(dp.u.cap, FLUID_GLOBAL.gpuCap)
  gl.uniform1f(dp.u.dmax, Math.max(0.05, PAPER_LIGHT - FLUID_GLOBAL.minLight))
  gl.uniform1f(dp.u.knee, FLUID_GLOBAL.knee)
  sim.blit(sim._dye.write)
  sim._dye.swap()
  return true
}

// dye (เวกเตอร์ 1 − rgb/255) ของเฉดสี × ความเข้มของอารมณ์/ระดับ × strength ตรงกับที่ไลบรารีคำนวณจาก colorPalette + brightness (lib/dye.js)
const dyeOf = (hex, strength) => {
  const gain = params().brightness * INTENSITY_FACTOR[props.intensity] * strength
  return [1, 3, 5].map((i) => (1 - parseInt(hex.slice(i, i + 2), 16) / 255) * gain)
}

// หยดสีหนึ่งหยดแบบ GPU: ดันน้ำ (ผ่านความเร็วของไลบรารี) + ลง dye ผ่าน shader ตัวกันดำ ลงสีเสมอ ไม่มีการข้ามหรือบล็อกจากแผนที่ ink
// ใกล้เพดานสีที่ลงจริงลดลงเอง (นุ่มนวล) แรงดันน้ำไปพร้อมสีเสมอ ไม่มีดันน้ำโดยไม่มีสี
const splatGpu = (x, y, dx, dy, { hex, radius, strength = 1 }) => {
  const shade = hex ?? pickShade()
  let dye = dyeOf(shade, strength)
  const peak = Math.max(...dye)
  if (peak < 0.003) return false
  // หยดเดียวไม่ให้ยอดสูงเกิน cap: ลดทั้งหยดตามสัดส่วน (รูปทรง Gaussian เดิม ไม่ตัดยอดแบน) เหมือนที่แบบเก่าทำกับหยดแรก หน้าตาหยดเดี่ยวจึงเท่าเดิม
  // ส่วนการซ้อนของหยดหลายหยดที่จุดเดียวกันให้ shader ตัวกันดำจัดการ (ตรงที่สีจริงเต็มแล้วเท่านั้น)
  if (peak > FLUID_GLOBAL.gpuCap) dye = dye.map((v) => (v * FLUID_GLOBAL.gpuCap) / peak)
  if (!getDyeProgram()) return false
  wake()
  const r = radius * INK_SPREAD
  pushWater(x, y, dx, dy, r)
  dyeSplat(x, y, r, dye)
  depositInk(x, y, Math.max(...dye), radius)
  return true
}

// พิกัด css px บนกระดาษ (0..SIZE) → ไลบรารี (x เป็น px จริง ×dpr, y เป็น css px และกลับแกนเอง)
// คืน true ถ้าลงสีจริง ไม่ส่ง splat สีศูนย์ที่ยังดันน้ำ (ดูเหมือนหยดแล้วสีไม่ออก แต่น้ำขยับ)
const splat = (x, y, dx, dy, { hex, radius, noColor, strength = 1 } = {}) => {
  if (!fluid) return false
  if (noColor) {
    pushWater(x, y, dx, dy, radius, true)
    return false
  }
  return splatGpu(x, y, dx, dy, { hex, radius, strength })
}

const params = () => FLUID_PARAMS[props.emotion]

// เคอร์เซอร์บนผ้าใบ (เฉพาะเมาส์ pointer: fine) ตามเครื่องมือ: ปาด = นิ้วติดสีอารมณ์ / หยด = พู่กันสีอารมณ์ / แต้มแสง = พู่กันแต้มแสง (lib/cursors.js) จอสัมผัสคงเดิม
const overlayStyle = computed(() => {
  if (!finePointer.value) return { cursor: 'crosshair' }
  const tool = props.tool === 'warm' && props.warmAvailable ? 'warm' : props.tool
  return { cursor: canvasCursor(tool, EMOTION_BY_KEY[props.emotion].hex, WARM_TONES[props.emotion] ?? WARM_TONES.sad) }
})

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
      if (fluid) {
        dropInk(d.x, d.y, d.dx, d.dy, { radius })
        sound.drop(props.emotion, { size: 1.5 })
      }
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

// ---- แต้มแสงของอารมณ์ลบ (SPEC §6.4) ----

// แต้มแสงของการหยดครั้งนี้: สีเดียวของอารมณ์ล่าสุด (WARM_TONES) เฉดต่างกันเล็กน้อยตามลำดับครั้ง (หนึ่งการแตะ/กดค้างหนึ่งรอบ/"ลองดูหนึ่งหยด" = หนึ่งครั้ง) นับต่อแผ่น รีเซ็ตเมื่อเริ่มแผ่นใหม่
const warmHex = () => {
  const tone = WARM_TONES[props.emotion]
  return tone ? warmShade(tone, sheet.warmGestures) : null
}

// ความเข้มแต้มแสงตามความเข้มของอารมณ์เดิมเหมือนเครื่องมือ "เติมหยด" (dyeOf คูณ INTENSITY_FACTOR ให้เอง)
const warmStrength = (strength = 1) => strength * tune.strength

const markWarmDropped = () => {
  if (sheet.warmDropped) return
  sheet.warmDropped = true
  emit('shifted')
}

// ---- แต้มแสงแบบบาน (bloom / backrun ของสีน้ำจริง) ----
// หยดน้ำสะอาดลงบนสีที่ยังเปียก ดันสีเดิมออกเป็นวงขอบเข้ม กลางวงจางลง แล้วเม็ดสีใหม่เบ่งบานตรงกลาง จึงเห็นแต้มแสงชัดแม้บนรอยสีเข้ม
// ลำดับต่อหยด (ภายใน tune.bloomMs): ก. ดันน้ำออกแนวรัศมี  ข. ยกสีเดิม: dye ในวง × (1 − lift × gaussian) เป็น shader pass แบบคูณ (ไม่มีค่าลบ ใช้ได้กับ half float)
// ค. ลงแต้มแสงตรงกลางด้วยเพดานของตัวเอง 3 ครั้งรัศมีโตขึ้นให้เบ่งออกช้า ๆ  ง. ลด ink ของช่องที่ถูกยกสีให้ตรงกับของจริง
const LIFT_FRAG = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec2 point;
uniform float radius;
uniform float amount;
uniform float rim;
uniform float cap;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  float d2 = dot(p, p);
  float g = exp(-d2 / radius);
  // ขอบเข้ม: สีที่ถูกยกออกจากกลางวงไปกองเป็นวงรอบนอก (คูณสีเดิมของจุดนั้นเพิ่ม ไม่บวกค่าคงที่ จึงไม่มีสีโผล่ในที่ที่ไม่มีสี)
  float ring = exp(-pow(sqrt(d2) - 1.6 * sqrt(radius), 2.0) / (0.35 * radius));
  vec3 base = texture2D(uTarget, vUv).xyz;
  // ยกสี = คูณน้อยกว่า 1 ขอบ = คูณมากกว่า 1 แต่ไม่ให้เกิน cap (ค่าเพดานเดียวกับ INK_CAP) และไม่ลดสีที่เกินอยู่แล้ว
  vec3 boosted = base * max(0.0, 1.0 - amount * g + rim * ring);
  gl_FragColor = vec4(min(boosted, max(base, vec3(cap))), 1.0);
}`
// โปรแกรม shader ของเราเอง: ใช้ vertex shader ตัวเดียวกับ splat ของไลบรารี (aPosition → vUv) เขียนเฉพาะ fragment shader
// คืน { program, u } หรือ false ถ้าเครื่องนี้คอมไพล์/ลิงก์ไม่ได้ (ผู้เรียกถอยกลับไปทางเดิม) ลองเฉพาะ GLSL ES 1.00 จึงใช้ได้ทั้ง WebGL1/2
const buildProgram = (frag, names) => {
  try {
    const sim = fluid?.simulation
    const gl = sim?.gl
    const base = sim?.programs?.splatProgram?.program
    if (!gl || !base || !sim._dye) return false
    const vs = gl.getAttachedShaders(base).find((sh) => gl.getShaderParameter(sh, gl.SHADER_TYPE) === gl.VERTEX_SHADER)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(fs, frag)
    gl.compileShader(fs)
    if (!vs || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('คอมไพล์ shader ไม่สำเร็จ:', gl.getShaderInfoLog(fs))
      return false
    }
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'aPosition')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('ลิงก์ shader ไม่สำเร็จ:', gl.getProgramInfoLog(program))
      return false
    }
    const u = {}
    for (const name of names) u[name] = gl.getUniformLocation(program, name)
    return { program, u }
  } catch (error) {
    console.error('สร้าง shader ไม่สำเร็จ:', error)
    return false
  }
}
let lift = null // null = ยังไม่สร้าง, false = เครื่องนี้สร้างไม่ได้ (บานแต่ไม่ยกสี)
const getLift = () => (lift === null ? (lift = buildProgram(LIFT_FRAG, ['uTarget', 'aspectRatio', 'point', 'radius', 'amount', 'rim', 'cap'])) : lift)
// ลงสีด้วย shader ตัวกันดำ GPU (lib/dyeLimit.js) null/false = ใช้ไม่ได้ → ถอยไปแบบ CPU เก่า
let dyeProgram = null
const getDyeProgram = () => (dyeProgram === null ? (dyeProgram = buildProgram(DYE_SPLAT_FRAG, ['uTarget', 'aspectRatio', 'color', 'point', 'radius', 'cap', 'dmax', 'knee'])) : dyeProgram)
if (typeof window !== 'undefined' && DEBUG) window.__dyeProgramOk = () => Boolean(getDyeProgram())
const liftDye = (x, y, radius, amount, rim) => {
  const lp = getLift()
  if (!lp) return false
  const sim = fluid.simulation
  const gl = sim.gl
  gl.useProgram(lp.program)
  gl.uniform1i(lp.u.uTarget, sim._dye.read.attach(0))
  gl.uniform1f(lp.u.aspectRatio, sim.canvas.width / sim.canvas.height)
  gl.uniform2f(lp.u.point, x / SIZE.w, 1 - y / SIZE.h)
  gl.uniform1f(lp.u.radius, sim.correctRadius(radius / 100))
  gl.uniform1f(lp.u.amount, amount)
  gl.uniform1f(lp.u.rim, rim)
  gl.uniform1f(lp.u.cap, FLUID_GLOBAL.inkCap)
  sim.blit(sim._dye.write)
  sim._dye.swap()
  return true
}

// ลด ink ของช่องที่ถูกยกสี (× 1 − amount × ค่าเฉลี่ย gaussian ทั้งช่อง จุดย่อย 3×3) ให้แผนที่ตรงกับสีบนผ้าใบ ไม่เพิ่มที่ขอบ (ประเมินต่ำไว้ ปลอดภัยกว่า)
// ถ้าลดน้อยไป แผนที่จะบล็อกแต้มแสงที่ลงทีหลังจนกลางวงเป็นรูขาว (วัดแล้ว) ถ้าไม่ลดเลยก็เช่นกัน
const lowerInk = (x, y, radius, amount) => {
  const rho = (SIZE.w * SIZE.h * radius) / 100 // ρ ของ exp(−d²/ρ) ในหน่วยพิกเซลกระดาษ
  const reach = Math.ceil(Math.sqrt(rho * 3) / INK_CELL) + 1
  const cx = Math.floor(x / INK_CELL)
  const cy = Math.floor(y / INK_CELL)
  for (let j = Math.max(0, cy - reach); j <= Math.min(inkRows - 1, cy + reach); j++) {
    for (let i = Math.max(0, cx - reach); i <= Math.min(inkCols - 1, cx + reach); i++) {
      let g = 0
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const dx = (i + (sx + 0.5) / 3) * INK_CELL - x
          const dy = (j + (sy + 0.5) / 3) * INK_CELL - y
          g += Math.exp(-(dx * dx + dy * dy) / rho)
        }
      }
      g /= 9
      if (g > 0.02) ink[j * inkCols + i] *= 1 - amount * g
    }
  }
}

let lastBloomAt = 0
// เปิดการบานเมื่อสวิตช์รวมเปิดและอารมณ์นี้อยู่ในรายการที่ผ่านเกณฑ์ (WARM_BLOOM)
const bloomOn = () => tune.bloom && WARM_BLOOM[props.emotion] !== false

// ---- เส้นโค้งการบาน (หนึ่งการแตะ = หนึ่งเส้นโค้ง) ----
// เดิมแบ่งเป็น 4 หยดก้อน + หยดประคอง 5 ครั้ง แต่ละก้อนทำให้น้ำกระแทกเป็นจังหวะ (หยดที่ 4 หนักสุดเห็นเป็นจังหวะที่สอง) จึงเปลี่ยนเป็นเส้นโค้งเดียวที่คำนวณจากเวลาจริง
// อัตราลงสี f(t): ขึ้นแบบ sin ถึงยอดที่ BLOOM_TIP_MS แล้วลดแบบ (1 − u)^BLOOM_TAIL ถึง 0 ที่ท้ายเส้น ไม่มีช่วงไหนแรงกว่าช่วงก่อนหน้าหลังยอด
// ปริมาณสีที่ลงในช่วงเวลาหนึ่ง = ผลต่างของปริพันธ์ F (สูตรปิด) จึงไม่ขึ้นกับ fps หยดจริงส่งทุก BLOOM_EMIT_MS เท่านั้น (ไม่ส่งทุกเฟรมจะได้ไม่หนักเมื่อแตะรัว)
// ยกสีเดิมแบบต่อเนื่อง: ส่วนที่ยกต่อวินาทีคงที่ตามเวลา (ยกสัดส่วน L ต่อ BLOOM_LIFT_REF ms) L ลดจาก 1.2× ลงเหลือ 0.6× ของ lift ภายใน BLOOM_LIFT_FALL ms เหมือนที่ยกซ้ำ/ประคองเดิม
const BLOOM_TIP_MS = 250
const BLOOM_TAIL = 1 // f ช่วงหลังยอด = (1 − u)^BLOOM_TAIL
const BLOOM_EMIT_MS = 30
const BLOOM_MIN_SHARE = 0.0015 // น้อยกว่านี้รอสะสมก่อน (หยดจิ๋วจะถูกทิ้งที่ shader) ไม่ทิ้งปริมาณ ค่าสูงกว่านี้ (0.006) ช่วงท้ายเส้นหยดห่างเป็นขั้น เห็นเป็นกระแทกเล็กที่ ~2.3/2.5/2.8 วินาที (วัดแล้ว)
const BLOOM_LIFT_REF = 350
const BLOOM_LIFT_FALL = 1000
const BLOOM_UNITS_TAP = 1.85 // ปริมาณรวมของแตะ/ลองดู (เดิม 4 ก้อน 1.0 + ประคอง 5 × 0.12 = 1.6 หน่วยเดียวกับ share เดิม) ปรับให้พื้นที่/ความชัดที่ 3 วิ ตรงของเดิมที่วัดไว้
const BLOOM_UNITS_HOLD = 1.6 // เดิม 1.0 ปรับตามแตะ (1.6 → 2.5) ให้ความชัดของกดค้างใกล้เดิม
const BLOOM_PUSH = 16 // ความเร็วดันน้ำต่อหน่วยปริมาณที่ลง (เดิมก้อน 0.25 ดัน 30) ดันเฉพาะช่วงแรก จางเป็น 0 ที่ BLOOM_PUSH_MS ไม่งั้นพลังงานน้ำสะสมเป็นโหนกที่สอง (วัดแล้ว anxious/angry)
const BLOOM_PUSH_MS = 500
const BLOOM_TURNS = 4 // ทิศดันหมุนกี่รอบตลอดเส้นโค้ง (ช่วงดัน 500 ms จึงหมุน ~0.7 รอบ: น้อยกว่านี้สีถูกลากเป็นหางดาวหาง มากกว่านี้ดันหักล้างกันจนพื้นที่หด)
const BLOOM_HOLD_MS = 900 // เส้นโค้งสั้นของการกดค้าง (บานซ้ำทุก HOLD_BLOOM_MS)
const blooms = []
let bloomRaf = 0

const bloomTip = (T) => Math.min(BLOOM_TIP_MS, T * 0.3)
// ปริพันธ์สะสมของ f ถึงเวลา t
const bloomCum = (t, T) => {
  const tp = bloomTip(T)
  if (t <= tp) return ((2 * tp) / Math.PI) * (1 - Math.cos((Math.PI * t) / (2 * tp)))
  const u = Math.min(1, (t - tp) / (T - tp))
  return (2 * tp) / Math.PI + ((T - tp) / (BLOOM_TAIL + 1)) * (1 - (1 - u) ** (BLOOM_TAIL + 1))
}
// รัศมีโตต่อเนื่องไม่ลดจนจบเส้นโค้ง (ตัวคูณของ tune.size)
const bloomScale = (t, T) => {
  const u = Math.min(1, t / T)
  return 0.55 + 0.5 * (1 - (1 - u) ** 2)
}

const bloomFrame = () => {
  bloomRaf = 0
  if (!fluid) {
    blooms.length = 0
    return
  }
  const now = performance.now()
  const pushGain = WARM_PUSH_GAIN[props.emotion] ?? 1
  const gap = BLOOM_EMIT_MS * Math.max(1, blooms.length / 3) // ซ้อนกันหลายเส้น (แตะรัว) = ส่งห่างขึ้น ปริมาณรวมเท่าเดิม
  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i]
    const t = Math.min(b.T, now - b.t0)
    const end = t >= b.T
    if (!end && now - b.lastEmit < gap) continue
    const scale = bloomScale(t, b.T)
    if (b.amount > 0.01) {
      // ยกสีเดิมก่อนลงสี (ไม่เพิ่มขอบ) ส่วนที่ยกตามเวลาจริงของช่วงนี้ ไม่ใช่ต่อเฟรม
      const k = Math.min(1, t / BLOOM_LIFT_FALL)
      // หลัง BLOOM_LIFT_FALL ลดต่อเนื่องเหลือ 0 ที่ท้ายเส้น (ลงสีน้อยลงแล้ว ยกต่อเท่าเดิมจะกินแต้มแสงที่เพิ่งลง กลางวงจางลงหลัง ~1.6 วิ วัดแล้ว)
      const tail = 1 - Math.max(0, (t - BLOOM_LIFT_FALL) / Math.max(1, b.T - BLOOM_LIFT_FALL))
      const level = Math.min(0.85, b.amount * 1.2) * (1 - k) + b.amount * 0.6 * k * tail
      const part = 1 - (1 - level) ** ((t - b.tPrev) / BLOOM_LIFT_REF)
      const r = tune.size * tune.liftRadius * scale * INK_SPREAD
      if (part > 0.001 && liftDye(b.x, b.y, r, part, 0)) lowerInk(b.x, b.y, r, part)
    }
    // ลงสี: ช่วงท้ายอัตราต่ำมาก สะสมจนถึง BLOOM_MIN_SHARE ค่อยลง (หยดจิ๋วจะถูก shader ทิ้ง) ส่วนการยกสีด้านบนทำทุกครั้งที่ส่งเพื่อให้ต่อเนื่อง
    const share = (b.units * (bloomCum(t, b.T) - bloomCum(b.tDep, b.T))) / bloomCum(b.T, b.T)
    if (share >= BLOOM_MIN_SHARE || (end && share > 0)) {
      b.tDep = t
      const a = b.a0 + (t / b.T) * Math.PI * BLOOM_TURNS * 2 // หมุนช้า ๆ ทิศไม่สุ่มทุกครั้ง (สุ่มถี่ ๆ หักล้างกัน น้ำไม่ขยายเหมือนเดิม)
      const speed = WARM_TAP_SPEED * BLOOM_PUSH * pushGain * share * Math.max(0, 1 - t / BLOOM_PUSH_MS) // เดิมก้อน 0.25 ดัน 30 ก้อน 0.12 ดัน 15: ดันตามปริมาณที่ลง
      const landed = splat(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed, { hex: b.hex, radius: tune.size * scale, strength: warmStrength(b.strength) * share })
      if (landed) markWarmDropped()
    }
    b.tPrev = t
    b.lastEmit = now
    if (end) blooms.splice(i, 1)
  }
  if (blooms.length) bloomRaf = requestAnimationFrame(bloomFrame)
}
const stopBlooms = () => {
  blooms.length = 0
  cancelAnimationFrame(bloomRaf)
  bloomRaf = 0
}

// strength = ความแรงแต้มแสงทั้งหยด gentle = กดค้าง (ยกสีเบาลง เส้นโค้งสั้น ไม่ประคองต่อ)
const bloomAt = (x, y, hex, { strength = 1, gentle = false } = {}) => {
  if (!fluid) return
  const calm = Boolean(reducedMotion?.matches)
  const recent = lastBloomAt && performance.now() - lastBloomAt < LIFT_GAP_MS
  const amount = recent ? 0 : tune.lift * (gentle ? 0.6 : 1)
  lastBloomAt = performance.now()
  // ก. ดันสีเดิมออกเป็นวง: หลายจุดรอบกลางวง ดันออกนอก (ไม่ดันตอนลดการเคลื่อนไหว) กดค้างไม่ดัน/ไม่ยกก้อนแรก (ทุก ~0.7 วินาทีจะกระแทกเป็นจังหวะ วัดแล้ว) ใช้เส้นโค้งอย่างเดียว
  if (!calm && !recent && !gentle) {
    wake()
    const reach = Math.sqrt((SIZE.w * SIZE.h * tune.size) / 100) * 0.6
    const arms = 6
    const phase = rand(0, Math.PI * 2)
    for (let k = 0; k < arms; k++) {
      const a = phase + (k * Math.PI * 2) / arms
      pushWater(x + Math.cos(a) * reach, y + Math.sin(a) * reach, Math.cos(a) * tune.push, -Math.sin(a) * tune.push, SMEAR_RADIUS * 0.8)
    }
  }
  // ข. ยกสีเดิมกลางวง
  if (amount > 0.01 && !gentle) {
    wake()
    const r = tune.size * tune.liftRadius * INK_SPREAD
    if (liftDye(x, y, r, amount, amount * tune.rim)) lowerInk(x, y, r, amount)
  }
  // ลดการเคลื่อนไหว: ลงสีทีเดียว ไม่ดันน้ำ ไม่มีเส้นโค้ง
  if (calm) {
    if (amount > 0.01) {
      const r = tune.size * tune.liftRadius * INK_SPREAD
      const again = Math.min(0.85, amount * 1.2)
      if (liftDye(x, y, r, again, 0)) lowerInk(x, y, r, again)
    }
    const a = rand(0, Math.PI * 2)
    if (splat(x, y, Math.cos(a) * WARM_TAP_SPEED * 0.5, Math.sin(a) * WARM_TAP_SPEED * 0.5, { hex, radius: tune.size, strength: warmStrength(strength) })) markWarmDropped()
    sound.bloom({ ms: 1000, gentle })
    return
  }
  // ค. เส้นโค้งการบาน (ดูหัวข้อด้านบน) ความแรงสูงสุด tune.bloomPeak คูณปริมาณรวมของเส้นโค้ง
  const T = gentle ? Math.min(tune.bloomMs, BLOOM_HOLD_MS) : tune.bloomMs
  if (T <= 0) return
  blooms.push({ x, y, hex, strength, amount, T, t0: lastBloomAt, a0: rand(0, Math.PI * 2), tPrev: 0, tDep: 0, lastEmit: lastBloomAt, units: (gentle ? BLOOM_UNITS_HOLD : BLOOM_UNITS_TAP) * tune.bloomPeak })
  if (!bloomRaf) bloomRaf = requestAnimationFrame(bloomFrame)
  sound.bloom({ ms: T, gentle })
}

// จุดวางหยดตัวอย่างของ "ลองดู": บริเวณที่ผู้ใช้ระบายไว้แล้ว (ink 0.3–0.7) ใกล้กลางภาพ ไม่โดนการ์ดอารมณ์/โน้ต/ถาดเครื่องมือ
// ถ้าไม่มีบริเวณแบบนั้นพอ ใช้ที่ว่างที่สุด (ink ต่ำสุด) แทน ห่างกันอย่างน้อย SAMPLE_SPACING
const SAMPLE_BOX = { x0: 110, x1: 860, y0: 60, y1: 560 } // พิกัดกระดาษ: การ์ดอารมณ์/โน้ตอยู่ x > 900 ถาดอยู่ y > 598
const SAMPLE_SPACING = 150
const pickSamplePoints = (n) => {
  const cells = []
  for (let j = 0; j < inkRows; j++) {
    for (let i = 0; i < inkCols; i++) {
      const x = (i + 0.5) * INK_CELL
      const y = (j + 0.5) * INK_CELL
      if (x < SAMPLE_BOX.x0 || x > SAMPLE_BOX.x1 || y < SAMPLE_BOX.y0 || y > SAMPLE_BOX.y1) continue
      const v = ink[j * inkCols + i]
      const painted = v >= 0.3 && v <= 0.7
      const centre = Math.hypot(x - SIZE.w / 2, y - SIZE.h / 2)
      // บริเวณที่ระบายแล้วมาก่อน (ใกล้กลางภาพมาก่อน) แล้วค่อยที่ว่างที่สุด
      cells.push({ x, y, score: painted ? centre : 10000 + v * 1000 + centre })
    }
  }
  cells.sort((a, b) => a.score - b.score)
  const out = []
  for (const c of cells) {
    if (out.length >= n) break
    if (out.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= SAMPLE_SPACING)) out.push({ x: c.x + rand(-12, 12), y: c.y + rand(-12, 12) })
  }
  return out
}

// หยดแต้มแสงที่ตำแหน่งใดก็ได้ (ผู้ใช้แตะ หรือกดค้างเบา ๆ)
const dropWarmAt = (x, y, hex, strength = 1) => {
  if (bloomOn() && strength >= 0.5) {
    bloomAt(x, y, hex, { strength })
    return
  }
  const a = rand(0, Math.PI * 2)
  if (splat(x, y, Math.cos(a) * WARM_TAP_SPEED, Math.sin(a) * WARM_TAP_SPEED, { hex, radius: tune.size, strength: warmStrength(strength) })) markWarmDropped()
  sound.drop(props.emotion, { strength: 0.7 })
}

// "ลองดู": หยดตัวอย่าง tune.samples หยด วางบนบริเวณที่ระบายไว้แล้วใกล้กลางภาพ (pickSamplePoints) แต้มแสงของอารมณ์ (WARM_TONES) ห่างกัน WARM_SAMPLE_GAP
// โหมดบาน: แต่ละหยดบานเต็มลำดับ (ดูหัวข้อ bloomAt) ปิดสวิตช์: หยดเดี่ยวพุ่งเข้าด้านในช้า ๆ
const dropWarmSamples = () => {
  const tone = WARM_TONES[props.emotion]
  if (!tone || !fluid) return
  const n = Math.round(tune.samples)
  const points = pickSamplePoints(n)
  const base = sheet.warmGestures
  sheet.warmGestures += n
  points.forEach((pt, i) => {
    const t = setTimeout(() => {
      timers.delete(t)
      if (!fluid) return
      const hex = warmShade(tone, base + i)
      if (bloomOn()) return bloomAt(pt.x, pt.y, hex, { strength: 1 })
      const angle = rand(0, Math.PI * 2)
      if (splat(pt.x, pt.y, Math.cos(angle) * SHIFT_SPEED, Math.sin(angle) * SHIFT_SPEED, { hex, radius: tune.size, strength: warmStrength() })) markWarmDropped()
    }, i * WARM_SAMPLE_GAP)
    timers.add(t)
  })
}

// ตัวจับเวลาของโน้ตชวน: นับเฉพาะตอนผ้าใบวิ่งอยู่ (ออกจากหน้า paint = หยุด กลับมานับต่อ)
// elapsed = เวลาตั้งแต่ pointerdown ครั้งแรกของแผ่น (ไม่ต้องกดค้างตลอด) idle = เวลาที่ไม่มี pointerdown และไม่มี pointer กดค้าง
// pointermove ที่ไม่ได้กด (hover) ไม่ถูกนับ เพราะ onMove ข้าม pointer ที่ไม่อยู่ใน pointers
const noteTick = () => {
  // น้ำนิ่งแล้ว (ไม่มีแรง/สีใหม่, ไม่มีนิ้วกด, ไม่มีการซึมค้าง) → พักการจำลอง
  if (fluid && props.running && !clearing && !sleeping && pointers.size === 0 && timers.size === 0 && blooms.length === 0) {
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
  stopBlooms()
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
  sound.drop(props.emotion, { strength })
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
  const pointer = { x, y, downX: x, downY: y, hold: null, holdStart: null, t: e.timeStamp }
  pointers.set(e.pointerId, pointer)
  // แต้มแสง: แตะ = หยดสีปลายทางตรงจุดนั้น กดค้าง = หยดเบา ๆ ต่อเนื่องด้วยสีเดียวกัน (ไม่ใช่สีอารมณ์)
  const warm = props.tool === 'warm' && props.warmAvailable ? warmHex() : null
  if (warm) {
    sheet.warmGestures++
    dropWarmAt(x, y, warm)
  } else if (props.tool === 'drop') dropAt(x, y)
  // กดค้างเกิน 400ms (เครื่องมือไหนก็ได้) = หยดต่อเนื่องที่ตำแหน่งปัจจุบัน
  const holdWarm = () => {
    // โหมดบาน: กดค้างบานต่อเนื่องแต่ไม่ถี่ (HOLD_BLOOM_MS) เส้นโค้งของแต่ละครั้งต่อเนื่องกันอยู่แล้ว จึงไม่ต้องหยดแทรก
    if (bloomOn()) return performance.now() - lastBloomAt >= HOLD_BLOOM_MS ? bloomAt(pointer.x, pointer.y, warm, { strength: 0.6, gentle: true }) : undefined
    const a = rand(0, Math.PI * 2)
    if (splat(pointer.x, pointer.y, Math.cos(a) * WARM_TAP_SPEED * HOLD_STRENGTH, Math.sin(a) * WARM_TAP_SPEED * HOLD_STRENGTH, { hex: warm, radius: tune.size, strength: warmStrength(HOLD_STRENGTH) })) markWarmDropped()
  }
  const holdDrop = () => (warm ? holdWarm() : dropAt(pointer.x, pointer.y, HOLD_STRENGTH))
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
    const dt = Math.max(4, e.timeStamp - pointer.t)
    pointer.t = e.timeStamp
    sound.brush((Math.hypot(dx, dy) * 1000) / dt) // px/วินาทีของผ้าใบ
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
  if (!pointers.size) sound.brushStop()
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
