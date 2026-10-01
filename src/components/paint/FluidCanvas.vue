<template>
  <!-- ผ้าใบน้ำไหล (webgl-fluid-enhanced) ครอบเต็มกระดาษ ขนาดคงที่ 1112×612 บน stage -->
  <div ref="containerRef" class="absolute inset-0 cursor-crosshair" aria-label="ผ้าใบระบายสี ลากเพื่อปาดและกวนสี" role="img"></div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import WebGLFluid from 'webgl-fluid-enhanced'
import { emotionShades, INITIAL_SPLATS, INTENSITY_FACTOR } from '@/lib/emotions'

const props = defineProps({
  emotion: { type: String, required: true },
  intensity: { type: Number, default: 1 },
  // false = หยุด loop ของ simulation (ไม่อยู่ในหน้า paint) แต่ยังคง WebGL context ไว้ (SPEC §4.3)
  running: { type: Boolean, default: true },
  // เพิ่มค่าเพื่อสั่งล้างผ้าใบ
  clearTick: { type: Number, default: 0 },
})

// webgl-fluid-enhanced v0.8 รับ "container" (ไม่ใช่ canvas) แล้วหา <canvas> ข้างในเอง
const containerRef = ref(null)

// สำคัญมาก: ใช้ตัวแปรธรรมดา (let) ไม่ใช้ ref() เพื่อป้องกัน Vue Proxy เข้าไปแทรกแซง WebGL
let fluidInstance = null
// ผ้าใบใหม่ที่ยังไม่เคยหยดสีเริ่มต้น (หยดตอนเข้าหน้า paint ครั้งแรก ไม่หยดซ้ำเมื่อกลับมาจากหน้าเลือกสี)
let fresh = true

// สีของอารมณ์ที่เลือก 3 ระดับ (เนื้อสีมากสุด) ให้ library สุ่มหยิบ
const paletteFor = (emotion) => {
  const s = emotionShades(emotion)
  return [s.base, s.base, s.base, s.deep, s.light]
}

// หยดสีเริ่มต้นตามอารมณ์และความเข้ม (SPEC §6.3) เวอร์ชันนี้ใช้ multipleSplats ของไลบรารี
const dropInitial = () => {
  if (!fluidInstance || !fresh) return
  fresh = false
  const count = Math.max(1, Math.round(INITIAL_SPLATS[props.emotion] * INTENSITY_FACTOR[props.intensity]))
  fluidInstance.multipleSplats(count)
}

const createFluid = () => {
  if (!containerRef.value) return
  try {
    fluidInstance = new WebGLFluid(containerRef.value)
    fluidInstance.setConfig({
      simResolution: 128,
      dyeResolution: navigator.maxTouchPoints > 1 ? 512 : 1024,
      // สไตล์สีน้ำ: สีจางช้า / การไหลหยุดเร็วพอให้ค่อย ๆ ซึม / แรงลากเบา
      densityDissipation: 0.15,
      velocityDissipation: 1.2,
      pressure: 0.8,
      curl: 5,
      splatRadius: 0.15,
      splatForce: 1500,
      splatAmount: 1, // ตัวแทนชั่วคราว: พารามิเตอร์ตามอารมณ์ (§6.3) ทำในขั้นที่ 5
      hover: true, // วาดได้แค่เอาเมาส์ไปลาก/ผ่าน ไม่ต้องกดค้าง
      colorful: true, // ต้องเป็น true เสมอ ไม่งั้น library ไม่ใช้ colorPalette
      colorPalette: paletteFor(props.emotion),
      transparent: true, // canvas โปร่งใส สีซ้อนบนกระดาษของ CSS
      shading: false,
      bloom: false,
      sunrays: false,
    })
    fluidInstance.start()
    fresh = true
    if (props.running) dropInitial()
    else fluidInstance.stop()
  } catch (error) {
    // เครื่องที่ไม่มี WebGL: แอปส่วนอื่นยังใช้ได้
    console.error('เริ่มผ้าใบไม่สำเร็จ:', error)
    fluidInstance = null
  }
}

// library ไม่มีคำสั่งล้างกระดาน จึงหยุดตัวเดิมแล้วสร้างใหม่บน canvas เดิม
const clear = () => {
  if (fluidInstance) fluidInstance.stop()
  createFluid()
}

onMounted(createFluid)

watch(
  () => props.emotion,
  (emotion) => fluidInstance?.setConfig({ colorPalette: paletteFor(emotion) }),
)

watch(
  () => props.running,
  (running) => {
    if (!fluidInstance) return
    if (running) {
      fluidInstance.start()
      dropInitial()
    } else fluidInstance.stop()
  },
)

watch(() => props.clearTick, clear)

// อ่านภาพจากผ้าใบ (ใช้ในขั้นที่ 5): ต้องอ่านใน requestAnimationFrame เพราะ WebGL ไม่เก็บ drawing buffer
const capture = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      const source = containerRef.value?.querySelector('canvas')
      if (!source) return resolve(null)
      const out = document.createElement('canvas')
      out.width = source.width
      out.height = source.height
      const ctx = out.getContext('2d')
      ctx.fillStyle = '#FBFAF6'
      ctx.fillRect(0, 0, out.width, out.height)
      ctx.drawImage(source, 0, 0)
      resolve(out)
    })
  })

defineExpose({ clear, capture })

onBeforeUnmount(() => {
  fluidInstance?.stop()
  fluidInstance = null
})
</script>
