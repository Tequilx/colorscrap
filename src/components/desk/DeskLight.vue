<template>
  <!-- แสงตามเวลาจริงบนพื้นโต๊ะ: อยู่ใต้ทุกอย่างในเวที (กระดาษ ผ้าใบ สมุด การ์ดทึบอยู่เหนือชั้นนี้เสมอ จึงไม่เปลี่ยนสีที่เห็นหรือสีที่ดึงจากภาพ)
       สามชั้นสลับกันด้วย opacity เท่านั้น crossfade 2 วินาที (reduced-motion: app.css จำกัดเหลือ 150ms และฝุ่นนิ่ง) -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <!-- กลางวัน: แสงเฉียงจากซ้ายบน + เงากรอบหน้าต่างจาง ๆ -->
    <div class="light-layer" :style="[fade('day'), { background: dayWash }]">
      <svg class="absolute inset-0 h-full w-full" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice">
        <g class="window-shadow" :fill="shade" transform="translate(-40 -30) skewX(-20) rotate(-4)">
          <rect x="120" y="0" width="22" height="700" />
          <rect x="520" y="0" width="22" height="700" />
          <rect x="920" y="0" width="22" height="700" />
          <rect x="120" y="0" width="822" height="22" />
          <rect x="120" y="318" width="822" height="18" />
          <rect x="120" y="678" width="822" height="22" />
        </g>
      </svg>
    </div>
    <!-- เย็น: แสงส้มอุ่น แรงทางซ้าย -->
    <div class="light-layer" :style="[fade('dusk'), { background: duskWash }]"></div>
    <!-- กลางคืน: วงแสงโคมกลางจอ ขอบจอมืดไล่ ฝุ่นลอยช้า ๆ ในวงแสง -->
    <div class="light-layer" :style="[fade('night'), { background: nightWash }]">
      <span v-for="m in motes" :key="m.id" class="mote" :class="{ 'mote-still': reducedMotion, 'mote-paused': period !== 'night' }" :style="m.style"></span>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { LIGHT, PALETTE } from '@/lib/tokens'
import { hexToRgb } from '@/lib/color'
import { period, refreshPeriod } from '@/lib/daylight'
import { reducedMotion } from '@/lib/motion'

const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

// ค่าความเข้มตามที่กำหนด: กลางวัน ~10% · เย็น ~12% · คืน วงโคม ~18% ขอบมืด ~38%
const dayWash = `radial-gradient(ellipse 95% 85% at 0% 0%, ${rgba(LIGHT.day, 0.1)} 0%, ${rgba(LIGHT.day, 0.06)} 45%, ${rgba(LIGHT.day, 0)} 80%)`
const duskWash = `linear-gradient(100deg, ${rgba(LIGHT.dusk, 0.12)} 0%, ${rgba(LIGHT.dusk, 0.09)} 55%, ${rgba(LIGHT.dusk, 0.06)} 100%)`
const nightWash = [
  `radial-gradient(circle 430px at 50% 47%, ${rgba(LIGHT.lamp, 0.18)} 0%, ${rgba(LIGHT.lamp, 0.1)} 45%, ${rgba(LIGHT.lamp, 0)} 100%)`,
  `radial-gradient(ellipse 75% 80% at 50% 50%, ${rgba(PALETTE.ink, 0)} 42%, ${rgba(PALETTE.ink, 0.38)} 100%)`,
].join(',')
const shade = rgba(PALETTE.ink, 0.05)

const fade = (p) => ({ opacity: period.value === p ? 1 : 0 })

// ฝุ่นในวงแสง: ตำแหน่งกระจายในวงรัศมี ~330px รอบกลางจอ ลอยช้า ๆ (ใช้ transform อย่างเดียว) ค่าคงที่ต่อรอบการโหลด
const motes = Array.from({ length: 16 }, (_, i) => {
  const a = (i * 2.399963) % (Math.PI * 2) // มุมทอง กระจายสม่ำเสมอ
  const r = 60 + ((i * 37) % 280)
  const size = 2 + (i % 3)
  return {
    id: i,
    style: {
      left: `${640 + Math.cos(a) * r}px`,
      top: `${376 + Math.sin(a) * r * 0.8}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: rgba(LIGHT.lamp, 0.55),
      '--dx': `${(i % 2 ? 1 : -1) * (18 + (i % 5) * 7)}px`,
      '--dy': `${-(26 + (i % 4) * 11)}px`,
      animationDuration: `${34 + (i % 6) * 9}s`,
      animationDelay: `${-(i * 4.3)}s`,
    },
  }
})

let timer = 0
onMounted(() => {
  timer = setInterval(refreshPeriod, 30000)
  document.addEventListener('visibilitychange', refreshPeriod)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshPeriod)
})
</script>

<style scoped>
.light-layer {
  position: absolute;
  inset: 0;
  transition: opacity 2000ms linear;
}
.window-shadow {
  filter: blur(14px);
}
.mote {
  position: absolute;
  border-radius: 9999px;
  animation: mote-drift 40s ease-in-out infinite alternate;
  will-change: transform;
}
.mote-still {
  animation: none;
}
.mote-paused {
  animation-play-state: paused; /* ไม่ใช่กลางคืน: หยุดไว้ ไม่เสียแรงเรนเดอร์ */
}
@keyframes mote-drift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(var(--dx), var(--dy), 0);
  }
}
</style>
