<template>
  <!-- ปกสมุดที่พลิกรอบสันซ้ายของหน้าขวา (ข้อ 22): วางทับหน้าขวาของสมุดเปิด 506×640 (พิกัดในชั้นสมุดเปิด จึงตามการซูมของหน้า saved เอง)
       หน้าหน้า = ปกสมุดปิด (BookCover) หน้าหลัง = กระดาษในปก (backface-visibility hidden) เวลาพลิก ~1.3 วิ มีเงาของปกทอดลงหน้าขวา
       ใช้ transform/opacity เท่านั้น (WAAPI) พักอยู่ในสถานะซ่อน ไม่ทำงานเมื่อ reduced-motion (Scrapbook ไม่เรียก) -->
  <div class="pointer-events-none absolute left-[506px] top-0 h-[640px] w-[506px]" aria-hidden="true">
    <div ref="shadowRef" class="absolute inset-0 opacity-0" style="background: linear-gradient(to right, rgba(45, 43, 51, 0.5), rgba(45, 43, 51, 0) 75%)"></div>
    <!-- opacity อยู่ชั้นนอก: ชั้นที่ preserve-3d ห้ามมี opacity < 1 ไม่งั้นแบนและเห็นหน้าหน้าทะลุตอนพลิกไปด้านหลัง -->
    <div ref="fadeRef" class="absolute inset-0 opacity-0">
      <div ref="boardRef" class="absolute inset-0" style="transform-origin: 0 50%; transform-style: preserve-3d">
        <div class="absolute inset-0 [backface-visibility:hidden]">
          <div class="h-[540px] w-[420px] origin-top-left" :style="{ transform: `scale(${506 / 420}, ${640 / 540})` }">
            <BookCover :name="name" :avatar="avatar" :likes="likes" :tabs="[]" />
          </div>
        </div>
        <!-- ด้านในปก: ขอบสีปกรอบกระดาษ ตรงกับหน้าซ้ายของสมุดเปิดที่มันไปลงจอด -->
        <div class="absolute inset-0 rounded-xl bg-cover [backface-visibility:hidden]" style="transform: rotateY(180deg)">
          <span class="absolute inset-y-[14px] left-[14px] right-0 bg-paper"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import BookCover from '@/components/book/BookCover.vue'
import { MOTION } from '@/lib/tokens'
import { TIME_SCALE } from '@/lib/motion'

defineProps({
  name: { type: String, default: '' },
  avatar: { type: String, default: 'cat' },
  likes: { type: Array, default: () => [] },
})

const boardRef = ref(null)
const fadeRef = ref(null)
const shadowRef = ref(null)
let anims = []

const rot = (deg) => `perspective(${MOTION.flip.perspective}px) rotateY(${deg}deg)`
const SWING = 'cubic-bezier(0.45, 0, 0.25, 1)'
const CLIP_HALF = 'inset(-90px -90px -90px 506px)' // เหลือแค่หน้าขวา (ซ่อนหน้าซ้ายไว้จนปกไปลงจอด)
const CLIP_FULL = 'inset(-90px -90px -90px -90px)'

const stop = () => {
  anims.forEach((a) => a.cancel())
  anims = []
}

// kind: 'open' (หน้าแรก → สมุด ปกมาจากการเลื่อนของชั้นปกปิด) | 'openShort' (ระบาย/บันทึก → สมุด) | 'close' (สมุด → หน้าแรก เล่นย้อน)
// bodyEl = ชั้น OpenBook ที่ต้องซ่อนครึ่งซ้ายระหว่างพลิก คืน Promise ที่จบเมื่อแอนิเมชันจบ (หรือถูกยกเลิก)
const play = (kind, bodyEl) => {
  stop()
  const short = kind === 'openShort'
  const T = (short ? MOTION.flip.short : MOTION.flip.full) * TIME_SCALE
  const opts = { duration: T, fill: 'both', direction: kind === 'close' ? 'reverse' : 'normal' }
  // 'open': ปกนอนบนหน้าขวา 35% แรก (ชั้นปกปิดเลื่อนมาทับ) แล้วพลิก 65% ที่เหลือ / short: พลิกทั้งช่วง
  const a = short ? 0 : 0.35
  const frames = (list) => list.map(([offset, props]) => ({ offset, ...props }))
  anims = [
    boardRef.value.animate(short ? [{ transform: rot(0), easing: SWING }, { transform: rot(-180) }] : frames([[0, { transform: rot(0) }], [a, { transform: rot(0), easing: SWING }], [1, { transform: rot(-180) }]]), opts),
    fadeRef.value.animate(frames([[0, { opacity: 0 }], [short ? 0.1 : 0.12, { opacity: 1 }], [0.93, { opacity: 1 }], [1, { opacity: 0 }]]), opts),
    shadowRef.value.animate(frames([[0, { opacity: 0 }], [a, { opacity: 0 }], [a + (1 - a) * 0.55, { opacity: 0.42 }], [1, { opacity: 0 }]]), opts),
  ]
  if (bodyEl) anims.push(bodyEl.animate(frames([[0, { clipPath: CLIP_HALF }], [0.9, { clipPath: CLIP_HALF, easing: 'ease-out' }], [1, { clipPath: CLIP_FULL }]]), opts))
  return Promise.all(anims.map((x) => x.finished.catch(() => {}))).then(() => {
    // ถูกยกเลิก/เปลี่ยนเล่นใหม่แล้ว: ไม่ต้องเก็บกวาด
    if (anims.length && anims.every((x) => x.playState === 'finished')) stop()
  })
}

defineExpose({ play, stop })
onBeforeUnmount(stop)
</script>
