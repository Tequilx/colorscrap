<template>
  <!-- หน้าดู UI kit สำหรับตรวจตอนพัฒนา เปิดด้วย /?kit (เฉพาะโหมด dev) -->
  <div class="h-full overflow-y-auto bg-desk px-12 py-10 text-ink">
    <h1 class="m-0 font-hand text-44 font-semibold">UI kit</h1>
    <p class="m-0 mb-8 text-17 text-ink-soft">ตัวอย่างคอมโพเนนต์ทุกแบบ เทียบกับ docs/design/style-board.html</p>

    <section class="mb-10">
      <h2 class="mb-3 font-hand text-26 font-semibold">HandButton</h2>
      <div class="flex flex-wrap items-center gap-5">
        <HandButton>เริ่มใช้สมุด <Doodle name="forward" :size="22" /></HandButton>
        <HandButton variant="secondary"><Doodle name="back" :size="22" /> หน้าแรก</HandButton>
        <HandButton variant="secondary"><Doodle name="book" :size="22" /> เปิดสมุด</HandButton>
        <HandButton variant="primary" disabled>ปิดใช้งาน</HandButton>
        <HandButton variant="secondary" disabled>ปิดใช้งาน</HandButton>
        <HandButton v-for="l in likes" :key="l" variant="chip" :pressed="chosen.includes(l)" @click="toggle(l)">{{ l }}</HandButton>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-hand text-26 font-semibold">EmotionBlob (8 อารมณ์)</h2>
      <p class="m-0 mb-3 text-14 text-ink-soft">คลิกเพื่อเลือก (สถานะเลือกตาม SPEC §5.2: พื้นสีอารมณ์จาง ขอบ ink ยกขึ้น 5px หมุน -1° เงาด้านล่าง ขีดเส้นใต้หยัก)</p>
      <div role="group" aria-label="เลือกความรู้สึก" class="flex flex-wrap gap-4">
        <button
          v-for="e in EMOTIONS"
          :key="e.key"
          type="button"
          :aria-pressed="pickedEmotion === e.key"
          class="flex h-[150px] w-[190px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[18px_22px_16px_20px] border-2 p-0 font-hand text-19 font-semibold text-ink transition-transform duration-450 ease-desk"
          :class="pickedEmotion === e.key ? 'border-ink -translate-y-[5px] -rotate-1' : 'border-transparent bg-paper'"
          :style="pickedEmotion === e.key ? { background: e.hex + '2E', boxShadow: `0 8px 0 -2px ${e.hex}80` } : {}"
          @click="pickedEmotion = e.key"
        >
          <EmotionBlob :name="e.key" :size="88" />
          <span :class="pickedEmotion === e.key ? 'underline decoration-wavy underline-offset-[6px]' : ''">{{ e.th }}</span>
        </button>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-hand text-26 font-semibold">Doodle: ตัวแทนและไอคอน</h2>
      <div role="group" aria-label="เลือกรูปตัวแทน" class="mb-4 flex flex-wrap gap-2">
        <button
          v-for="a in AVATARS"
          :key="a.key"
          type="button"
          :aria-pressed="pickedAvatar === a.key"
          :aria-label="a.label"
          :title="a.label"
          class="flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-[16px_18px_14px_20px] border-2 p-0 text-ink transition-transform duration-450 ease-desk"
          :class="pickedAvatar === a.key ? 'border-ink bg-[rgba(241,190,72,.28)] -translate-y-[3px] -rotate-3' : 'border-transparent bg-[#F0EEE9]'"
          @click="pickedAvatar = a.key"
        >
          <Doodle :name="a.key" :size="38" />
        </button>
      </div>
      <div class="flex flex-wrap gap-4">
        <span v-for="i in iconNames" :key="i" class="flex flex-col items-center gap-1 text-13 text-ink-soft">
          <Doodle :name="i" :size="32" />
          {{ i }}
        </span>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-hand text-26 font-semibold">Tape / Polaroid / WatercolorBlob</h2>
      <div class="flex flex-wrap items-start gap-10">
        <Polaroid caption="09:12 · สงบ" :rotate="-3" :colors="['#5FA3C8', '#9CC3D8']" />
        <Polaroid caption="13:40 · เหนื่อย → อุ่นขึ้น" :rotate="2" :tape-rotate="4" :colors="['#5B6773', '#F7DE99']" badge="ใหม่" />
        <div class="relative h-[60px] w-[140px] bg-paper-deep">
          <Tape class="left-5 top-5" long />
        </div>
        <WatercolorBlob kind="large" color="#F1BE48" :width="190" :height="165" :opacity="0.7" />
        <WatercolorBlob kind="small" color="#E2688A" />
        <WatercolorBlob kind="timeline" color="#6E4FA0" :width="40" :height="100" :opacity="0.85" />
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 font-hand text-26 font-semibold">สีปก: สัน (mix 0.14) และสายรัด (mix 0.32)</h2>
      <div class="flex flex-wrap gap-6">
        <div v-for="c in COVER_COLORS" :key="c.hex" class="flex flex-col items-center gap-2 text-14">
          <div class="relative h-[140px] w-[110px] overflow-hidden rounded-[6px_14px_14px_6px] shadow-book" :style="{ background: c.hex }">
            <span class="absolute inset-y-0 left-0 w-[10px]" :style="{ background: coverSpine(c.hex) }"></span>
            <span class="absolute inset-y-0 right-[14px] w-[8px]" :style="{ background: coverStrap(c.hex) }"></span>
          </div>
          {{ c.label }}
          <code class="font-mono text-13 text-ink-soft">{{ c.hex }} / {{ coverSpine(c.hex) }} / {{ coverStrap(c.hex) }}</code>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import EmotionBlob from '@/components/ui/EmotionBlob.vue'
import Doodle from '@/components/ui/Doodle.vue'
import Tape from '@/components/ui/Tape.vue'
import Polaroid from '@/components/ui/Polaroid.vue'
import WatercolorBlob from '@/components/ui/WatercolorBlob.vue'
import { EMOTIONS } from '@/lib/emotions'
import { AVATARS, ICONS } from '@/lib/doodles'
import { COVER_COLORS } from '@/lib/tokens'
import { coverSpine, coverStrap } from '@/lib/color'

const likes = ['เพลง', 'แมว', 'กาแฟ', 'การนอน', 'เดินเล่น', 'วาดรูป', 'เกม', 'ทะเล']
const chosen = ref(['เพลง', 'แมว'])
const toggle = (l) => {
  chosen.value = chosen.value.includes(l) ? chosen.value.filter((x) => x !== l) : [...chosen.value, l]
}
const pickedEmotion = ref('calm')
const pickedAvatar = ref('cat')
const iconNames = Object.keys(ICONS)
</script>
