<template>
  <!-- แผงปรับค่าสีน้ำ เฉพาะ dev: เปิดด้วย ?debug (App.vue โหลดแบบ lazy ภายใต้ import.meta.env.DEV จึงไม่ติดไปใน production) -->
  <div class="fixed bottom-2 left-2 z-50 w-[262px] rounded bg-black/80 font-mono text-[12px] leading-snug text-white">
    <button type="button" class="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent px-2 py-1 text-left font-mono text-[12px] font-bold text-white" :aria-expanded="open" @click="open = !open">
      <span>แผงปรับค่า (dev)</span>
      <span>{{ open ? '▾ พับ' : '▸ เปิด' }}</span>
    </button>
    <div v-if="open" class="max-h-[70vh] overflow-y-auto px-2 pb-2">
      <div class="mb-1 border-b border-white/30 pb-1">
        <div>นับตั้งแต่แตะครั้งแรก: {{ noteDebug.elapsed }}</div>
        <div>พักมือ: {{ noteDebug.idle }}</div>
        <div>โน้ต: {{ NOTE_LABEL[app.warmNote] }}</div>
      </div>

      <div class="mb-1 flex flex-wrap gap-1" role="group" aria-label="อารมณ์">
        <button v-for="e in EMOTIONS" :key="e.key" type="button" class="cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[12px] text-white" :class="app.selection.emotion === e.key ? 'border-white bg-white/30' : 'border-white/30 bg-transparent'" @click="app.selectEmotion(e.key)">{{ e.th }}</button>
      </div>

      <div class="font-bold">{{ EMOTION_BY_KEY[emotion].th }} (FLUID_PARAMS)</div>
      <label v-for="f in FIELDS" :key="f.key + (f.index ?? '')" class="flex items-center gap-2">
        <span class="w-[78px] shrink-0">{{ f.label }}</span>
        <input type="range" class="w-[88px]" :min="f.min" :max="f.max" :step="f.step" :data-field="f.key + (f.index ?? '')" :value="get(f)" @input="set(f, $event.target.valueAsNumber)" />
        <span class="w-9 text-right">{{ get(f) }}</span>
      </label>
      <div class="my-1 flex flex-wrap gap-1">
        <button type="button" class="cursor-pointer rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white" @click="redrop">หยดสีเริ่มต้นใหม่</button>
        <button type="button" class="cursor-pointer rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white" @click="copy">{{ copied ? 'คัดลอกแล้ว' : 'คัดลอกค่า' }}</button>
        <button type="button" class="cursor-pointer rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white" @click="resetEmotion">รีเซ็ตเป็นค่าเริ่มต้น</button>
      </div>

      <div class="mt-1 border-t border-white/30 pt-1 font-bold">ค่ากลาง (ใช้ทุกอารมณ์)</div>
      <!-- ตัวกันดำ: สลับเทียบแบบเก่า (แผนที่ ink บล็อกหยดที่ CPU) กับแบบใหม่ (จำกัด dye ที่พิกเซลใน shader) เก็บไว้ชั่วคราว -->
      <label class="flex items-center gap-2">
        <span class="w-[78px] shrink-0">ตัวกันดำ</span>
        <select class="w-[150px] text-black" data-global="blackGuard" :value="gv({ key: 'blackGuard' })" @change="setGlobal({ key: 'blackGuard' }, $event.target.value)">
          <option value="gpu">แบบใหม่ (GPU)</option>
          <option value="cpu">แบบเก่า (CPU)</option>
        </select>
      </label>
      <label v-for="g in GLOBAL_FIELDS" :key="g.key" class="flex items-center gap-2">
        <span class="w-[78px] shrink-0">{{ g.label }}</span>
        <input type="range" class="w-[88px]" :min="g.min" :max="g.max" :step="g.step" :value="gv(g)" @input="setGlobal(g, $event.target.valueAsNumber)" />
        <span class="w-9 text-right">{{ gv(g) }}</span>
      </label>
      <div class="text-[11px] text-white/70">จางช้า (density) ต้องเป็น 0 พอดีถึงจะไม่จาง ค่าเล็ก ๆ ก็ทำให้สีหายใน ~1 นาที (ดูหมายเหตุใน emotions.js)</div>
      <button type="button" class="my-1 cursor-pointer rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white" @click="resetGlobal">รีเซ็ตค่ากลาง</button>

      <div class="mt-1 border-t border-white/30 pt-1 font-bold">สาดสีตอนเข้าหน้า (ตามระดับ)</div>
      <div v-for="(lv, li) in SPLASH_LEVELS" :key="li">
        <div class="text-white/80">{{ INTENSITY_LABELS[li] }}</div>
        <label v-for="f in SPLASH_FIELDS" :key="f.key" class="flex items-center gap-2">
          <span class="w-[78px] shrink-0">{{ f.label }}</span>
          <input type="range" class="w-[88px]" :min="f.min" :max="f.max" :step="f.step" :value="sv(li, f)" @input="setSplash(li, f, $event.target.valueAsNumber)" />
          <span class="w-9 text-right">{{ sv(li, f) }}</span>
        </label>
      </div>
      <div class="text-[11px] text-white/70">เปลี่ยนแล้วกด "หยดสีเริ่มต้นใหม่" เพื่อดูผล</div>

      <div class="mt-1 border-t border-white/30 pt-1 font-bold">ตรวจเครื่องนี้ (อ่านจากไลบรารี)</div>
      <div v-for="row in INFO_ROWS" :key="row.key" class="flex justify-between gap-2">
        <span class="shrink-0">{{ row.label }}</span>
        <span class="text-right">{{ fluidInfo[row.key] }}</span>
      </div>

      <div class="mt-1 border-t border-white/30 pt-1 font-bold">สีอุ่น (SPEC §6.4)</div>
      <label v-for="t in WARM_FIELDS" :key="t.key" class="flex items-center gap-2">
        <span class="w-[78px] shrink-0">{{ t.label }}</span>
        <input v-model.number="warmTune[t.key]" type="range" class="w-[88px]" :min="t.min" :max="t.max" :step="t.step" :data-tune="t.key" />
        <span class="w-9 text-right">{{ warmTune[t.key] }}</span>
      </label>
      <label class="flex items-center gap-2">
        <input v-model="warmTune.bloom" type="checkbox" data-tune="bloom" />
        <span>สีอุ่นแบบบาน (ยกสีเดิม + ดันน้ำ + เบ่งบาน)</span>
      </label>
      <button type="button" class="my-1 cursor-pointer rounded border border-white/50 bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white" @click="resetNote">รีเซ็ตโน้ต</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { EMOTIONS, EMOTION_BY_KEY, FLUID_PARAMS, FLUID_GLOBAL, SPLASH_LEVELS, INTENSITY_LABELS, INITIAL_SPLATS, resetEmotionParams, resetFluidGlobal } from '@/lib/emotions'
import { warmTune, noteDebug, fluidInfo, DEV_PARAMS_EVENT, DEV_NOTE_RESET_EVENT } from '@/lib/devState'

const app = useAppStore()
const open = ref(true)
const copied = ref(false)
const emotion = computed(() => app.selection.emotion)
const NOTE_LABEL = { idle: 'รอ', open: 'แสดง', done: 'ปิดแล้ว' }

// ทุกค่าใน FLUID_PARAMS (ยกเว้น pattern ที่เป็นตัวเลือก ไม่ใช่ตัวเลข) + จำนวนหยดเริ่มต้นของ INITIAL_SPLATS
const FIELDS = [
  { key: 'splats', label: 'จำนวนหยด', min: 1, max: 12, step: 1 },
  { key: 'speed', label: 'ความเร็วหยด', min: 0, max: 3, step: 0.05 },
  { key: 'curl', label: 'curl', min: 0, max: 60, step: 1 },
  { key: 'velDiss', label: 'velDiss', min: 0, max: 2, step: 0.05 },
  { key: 'radius', label: 'ขนาดหยด', min: 0.02, max: 0.6, step: 0.01 },
  { key: 'brightness', label: 'ความเข้ม', min: 0.5, max: 4, step: 0.1 },
  { key: 'splash', index: 0, label: 'สาด×นิดหน่อย', min: 0.1, max: 3, step: 0.05 },
  { key: 'splash', index: 1, label: 'สาด×พอประมาณ', min: 0.1, max: 3, step: 0.05 },
  { key: 'splash', index: 2, label: 'สาด×มากเลย', min: 0.1, max: 3, step: 0.05 },
]
// ค่ากลางของผ้าใบ (FLUID_GLOBAL ใน emotions.js)
const GLOBAL_FIELDS = [
  { key: 'inkCap', label: 'เพดานสี/ช่อง (CPU)', min: 0.2, max: 1.5, step: 0.05 },
  { key: 'gpuCap', label: 'CAP (GPU)', min: 0.4, max: 1, step: 0.01 },
  { key: 'minLight', label: 'MIN_LIGHT (GPU)', min: 0, max: 0.5, step: 0.01 },
  { key: 'knee', label: 'knee (GPU)', min: 0.2, max: 0.95, step: 0.01 },
  { key: 'density', label: 'จางช้า (density)', min: 0, max: 0.01, step: 0.0005 },
  { key: 'dryTime', label: 'เวลาจนแห้ง (วินาที)', min: 4, max: 30, step: 1 },
  { key: 'flowTime', label: 'ไหลปกติก่อนเริ่มแห้ง (วินาที)', min: 0.5, max: 8, step: 0.5 },
  { key: 'dryDamp', label: 'ความหน่วงตอนแห้ง', min: 1, max: 20, step: 0.5 },
  { key: 'splashMs', label: 'เวลาสาด (ms)', min: 200, max: 3000, step: 100 },
]
const SPLASH_FIELDS = [
  { key: 'count', label: 'จำนวนหยด ×', min: 0.3, max: 6, step: 0.1 },
  { key: 'size', label: 'ขนาดหยด ×', min: 0.5, max: 3, step: 0.05 },
  { key: 'spread', label: 'ระยะกระจาย ×', min: 0.5, max: 2, step: 0.05 },
]
const INFO_ROWS = [
  { key: 'webgl', label: 'WebGL' },
  { key: 'format', label: 'รูปแบบ texture' },
  { key: 'texType', label: 'ชนิดข้อมูล' },
  { key: 'linear', label: 'linear filtering' },
  { key: 'density', label: 'density ที่ใช้จริง' },
  { key: 'velocity', label: 'velocity ที่ใช้จริง' },
  { key: 'dyeRes', label: 'dye resolution' },
  { key: 'simRes', label: 'sim resolution' },
  { key: 'canvas', label: 'ขนาดผ้าใบ' },
  { key: 'state', label: 'การจำลอง' },
  { key: 'speed', label: 'ความเร็วน้ำสูงสุด' },
]
const WARM_FIELDS = [
  { key: 'size', label: 'ขนาดหยด', min: 0.1, max: 3, step: 0.05 },
  { key: 'strength', label: 'ความเข้ม', min: 0.5, max: 5, step: 0.1 },
  { key: 'samples', label: 'จำนวนลองดู', min: 1, max: 10, step: 1 },
  { key: 'noteDelay', label: 'เวลาก่อนโน้ตขึ้น (วิ)', min: 3, max: 30, step: 1 },
  { key: 'noteIdle', label: 'เวลาพักมือ (วิ)', min: 0.5, max: 5, step: 0.5 },
  { key: 'lift', label: 'ความแรงยกสี', min: 0, max: 1, step: 0.05 },
  { key: 'liftRadius', label: 'รัศมียกสี ×', min: 0.5, max: 2, step: 0.05 },
  { key: 'rim', label: 'ขอบเข้ม', min: 0, max: 2, step: 0.1 },
  { key: 'push', label: 'แรงดันวงขอบ', min: 0, max: 400, step: 10 },
  { key: 'bloomMs', label: 'เวลาบาน (ms)', min: 0, max: 2000, step: 100 },
]

// แผงแก้ object ในโมดูล emotions.js ตรง ๆ (FluidCanvas อ่านค่าสดจากที่เดียวกัน) แล้วแจ้งให้ตั้ง curl/velDiss ใหม่
// ค่าที่แก้อยู่แค่ในหน่วยความจำ ต้องกด "คัดลอกค่า" แล้วนำไปแก้ emotions.js เอง
const tick = ref(0) // อ่านใน get() ให้แถบเลื่อนอัปเดตตามเมื่อค่าใน object ธรรมดาเปลี่ยน
const get = (f) => (tick.value, f.key === 'splats' ? INITIAL_SPLATS[emotion.value] : f.index !== undefined ? FLUID_PARAMS[emotion.value][f.key][f.index] : FLUID_PARAMS[emotion.value][f.key])
const set = (f, v) => {
  if (Number.isNaN(v)) return
  if (f.key === 'splats') INITIAL_SPLATS[emotion.value] = v
  else if (f.index !== undefined) FLUID_PARAMS[emotion.value][f.key][f.index] = v
  else FLUID_PARAMS[emotion.value][f.key] = v
  window.dispatchEvent(new Event(DEV_PARAMS_EVENT))
  tick.value++
}

const gv = (g) => (tick.value, FLUID_GLOBAL[g.key])
const sv = (i, f) => (tick.value, SPLASH_LEVELS[i][f.key])
const setSplash = (i, f, v) => {
  if (Number.isNaN(v)) return
  SPLASH_LEVELS[i][f.key] = v
  tick.value++
}
const setGlobal = (g, v) => {
  if (typeof v === 'number' && Number.isNaN(v)) return
  FLUID_GLOBAL[g.key] = v
  window.dispatchEvent(new Event(DEV_PARAMS_EVENT))
  tick.value++
}

// คืนค่าเริ่มต้น (ค่าที่เขียนไว้ใน emotions.js ตอนโหลดหน้า) เฉพาะอารมณ์ที่เลือก / เฉพาะค่ากลาง
const resetEmotion = () => {
  resetEmotionParams(emotion.value)
  window.dispatchEvent(new Event(DEV_PARAMS_EVENT))
  tick.value++
}
const resetGlobal = () => {
  resetFluidGlobal()
  window.dispatchEvent(new Event(DEV_PARAMS_EVENT))
  tick.value++
}

// ล้างผ้าใบแล้วหยดสีเริ่มต้นของอารมณ์ที่เลือกใหม่ (ทางเดียวกับปุ่ม "เริ่มใหม่" ไม่ต้องกลับไปหน้า pick)
const redrop = () => app.clearCanvas()

// เริ่มนับโน้ตของแผ่นปัจจุบันใหม่ ภาพบนผ้าใบอยู่เหมือนเดิม (โน้ตที่ปิดไปแล้วกลับมาถามได้อีก)
const resetNote = () => {
  app.warmNote = 'idle'
  window.dispatchEvent(new Event(DEV_NOTE_RESET_EVENT))
}

const copy = async () => {
  const e = emotion.value
  const json = JSON.stringify({ emotion: e, initialSplats: INITIAL_SPLATS[e], ...FLUID_PARAMS[e], global: { ...FLUID_GLOBAL }, splash: SPLASH_LEVELS.map((l) => ({ ...l })) }, null, 2)
  try {
    await navigator.clipboard.writeText(json)
  } catch {
    window.prompt('คัดลอกค่า', json)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>
