<template>
  <!-- โพลารอยด์ที่บินตอนบันทึก (SPEC §5.4): ภาพจากผ้าใบหดเป็นโพลารอยด์ รอกลางโต๊ะ แล้วลอยลงช่องเส้นประ เทปแปะ เงาลด
       transform/opacity อย่างเดียว คลุมทั้ง stage เพื่อกันการแตะระหว่างลำดับ -->
  <div class="pointer-events-auto absolute inset-0" aria-hidden="true">
    <div ref="wrapRef" class="absolute left-0 top-0" :style="{ width: POLAROID.w + 'px', height: POLAROID.h + 'px', transformOrigin: 'center', transform: poseTransform(poses.start) }">
      <div ref="shadowRef" class="absolute inset-0 opacity-0 shadow-[0_26px_34px_rgba(45,43,51,0.32)]"></div>
      <div ref="frameRef">
        <Polaroid :caption="caption" :src="null" :colors="entry.colors.slice(0, 2).map((c) => c.hex)" :palette="entry.colors" :badge="'ใหม่'" :tape="false" />
      </div>
      <!-- ภาพจากผ้าใบ ขยายเต็มกระดาษตอนเริ่ม แล้วหดลงมาเท่าช่องภาพ -->
      <div ref="windowRef" class="absolute overflow-hidden" :style="{ left: POLAROID.win.x + 'px', top: POLAROID.win.y + 'px', width: POLAROID.win.w + 'px', height: POLAROID.win.h + 'px' }"></div>
      <div ref="tapeRef" class="absolute inset-0 opacity-0">
        <Tape class="left-[56px] top-[-11px]" :rotate="rot.tape" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Polaroid from '@/components/ui/Polaroid.vue'
import Tape from '@/components/ui/Tape.vue'
import { POLAROID, flightPoses, poseTransform } from '@/lib/saveTimeline'
import { emotionLabel } from '@/lib/emotions'
import { photoRotation } from '@/lib/photos'
import { MOTION } from '@/lib/tokens'

// flight: { entry, canvas | null, target, schedule } จาก store.saveFlight (ตารางเวลาเดียวกับ timer ของ store)
const props = defineProps({ flight: { type: Object, required: true } })

const entry = computed(() => props.flight.entry)
const rot = computed(() => photoRotation(entry.value.id))
const caption = computed(() => `${entry.value.local_time} · ${emotionLabel(entry.value)}${entry.value.shifted ? ' → มีแสงขึ้น' : ''}`)
const fromPaper = Boolean(props.flight.canvas)
const poses = flightPoses({ target: props.flight.target, rotate: rot.value.rotate, fromPaper })

const wrapRef = ref(null)
const shadowRef = ref(null)
const frameRef = ref(null)
const windowRef = ref(null)
const tapeRef = ref(null)
let animations = []

const ease = MOTION.ease
const run = (node, keyframes, duration) => {
  animations.push(node.animate(keyframes, { duration, easing: ease, fill: 'both' }))
}

onMounted(() => {
  const sch = props.flight.schedule
  const total = sch.tape[1] // wrapper เล่นต่อเนื่องถึงตอนเทปแปะเสร็จ แล้ว store ถอดภาพบินพร้อมเลิกซ่อนช่องจริง
  const at = (t) => t / total
  const frame = (pose, t, extra = {}) => ({ transform: poseTransform(pose), offset: at(t), easing: ease, ...extra })

  run(wrapRef.value, [frame(poses.start, 0), frame(poses.park, sch.shrink[1]), frame(poses.park, sch.drop[0]), frame(poses.lift, sch.drop[1]), frame(poses.land, total)], total)

  if (fromPaper) {
    props.flight.canvas.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover'
    windowRef.value.appendChild(props.flight.canvas)
    run(windowRef.value, [{ transform: `scale(${poses.paperScale})` }, { transform: 'scale(1)' }], sch.shrink[1])
    run(frameRef.value, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1, offset: 1 }], sch.shrink[1])
  }
  // ยกลอยเหนือช่อง (เงาลึก) ระหว่างบินลง แล้วเงาลดลงตอนเทปแปะ
  run(shadowRef.value, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: at(sch.drop[0]) }, { opacity: 1, offset: at(sch.drop[0] + (sch.drop[1] - sch.drop[0]) * 0.6) }, { opacity: 1, offset: at(sch.tape[0]) }, { opacity: 0, offset: 1 }], total)
  run(tapeRef.value, [{ opacity: 0, transform: 'translateY(-14px) scale(1.2)', offset: 0 }, { opacity: 0, transform: 'translateY(-14px) scale(1.2)', offset: at(sch.tape[0]) }, { opacity: 1, transform: 'none', offset: 1 }], total)
})

onBeforeUnmount(() => {
  animations.forEach((a) => a.cancel())
  animations = []
  props.flight.canvas?.remove()
})
</script>
