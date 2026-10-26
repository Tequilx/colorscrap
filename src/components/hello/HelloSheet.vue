<template>
  <!-- กระดาษหน้าแรกของสมุด ฝั่งซ้ายของหน้า hello (SPEC §5.0) -->
  <div class="absolute left-[72px] top-[72px] box-border flex w-[640px] -rotate-[0.6deg] flex-col gap-[22px] bg-paper px-11 py-9 shadow-card">
    <Tape class="left-[270px] top-[-12px]" long :rotate="-3" />

    <div class="flex flex-col gap-3">
      <BrandMark variant="lockup" :size="68" tagline />
      <span class="text-14 text-ink-soft">หน้าแรกของสมุด · แก้ทีหลังได้เสมอ</span>
      <h1 class="m-0 font-hand text-38 font-semibold leading-head">สมุดเล่มนี้เป็นของ...</h1>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="hello-name" class="font-hand text-17 font-semibold">ชื่อที่อยากให้เรียก</label>
      <input
        id="hello-name"
        v-model="profile.displayName"
        type="text"
        maxlength="20"
        placeholder="เช่น ฝน, มิ้นท์, เจ้าหญิงนอนดึก"
        class="border-0 border-b-2 border-dashed border-mute bg-transparent px-0.5 py-1.5 font-hand text-26 text-ink outline-offset-4"
      />
    </div>

    <div class="flex flex-col gap-2">
      <span class="font-hand text-17 font-semibold">ตัวแทนของฉัน</span>
      <div role="group" aria-label="เลือกรูปตัวแทน" class="grid grid-cols-8 gap-2">
        <button
          v-for="a in AVATARS"
          :key="a.key"
          type="button"
          :aria-pressed="profile.avatar === a.key"
          :aria-label="a.label"
          :title="a.label"
          class="flex h-[60px] cursor-pointer items-center justify-center rounded-[16px_18px_14px_20px] border-2 p-0 text-ink transition-transform duration-450 ease-desk"
          :class="profile.avatar === a.key ? 'border-ink bg-happy-wash -translate-y-[3px] -rotate-3' : 'border-transparent bg-wash'"
          @click="profile.avatar = a.key"
        >
          <Doodle :name="a.key" :size="38" />
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="font-hand text-17 font-semibold">สีปกสมุด</span>
      <div role="group" aria-label="เลือกสีปก" class="flex gap-3">
        <button
          v-for="c in COVER_COLORS"
          :key="c.hex"
          type="button"
          :aria-pressed="profile.coverColor === c.hex"
          :aria-label="c.label"
          :title="c.label"
          class="h-[52px] w-[52px] cursor-pointer rounded-full border-[3px] border-paper p-0"
          :style="{ background: c.hex, boxShadow: profile.coverColor === c.hex ? `0 0 0 3px ${PALETTE.ink}` : 'none' }"
          @click="profile.coverColor = c.hex"
        ></button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="flex items-baseline gap-2 font-hand text-17 font-semibold">
        สิ่งที่ทำให้ใจฟู
        <span class="font-body text-14 font-normal text-ink-soft">เลือกได้สูงสุด {{ MAX_LIKES }} อย่าง หรือข้ามก็ได้</span>
        <span class="ml-auto font-body text-14 font-medium" :class="profile.likesTooMany ? 'text-ink' : 'text-ink-soft'" aria-live="polite">เลือกแล้ว {{ profile.likes.length }}/{{ MAX_LIKES }}</span>
      </span>
      <div role="group" aria-label="สิ่งที่ทำให้ใจฟู" class="flex gap-1.5">
        <HandButton
          v-for="l in LIKES"
          :key="l"
          variant="chip"
          class="!px-3"
          :pressed="profile.likes.includes(l)"
          :aria-disabled="isLikeLocked(profile.likes, l) ? 'true' : undefined"
          @click="profile.toggleLike(l)"
        >{{ l }}</HandButton>
      </div>
      <!-- โปรไฟล์เดิมที่บันทึกไว้เกิน 3: แสดงที่เลือกไว้ทั้งหมดและบอกให้เอาออก (ปุ่มบันทึกกดไม่ได้จนเหลือ ≤ 3) -->
      <span v-if="profile.likesTooMany" role="alert" class="text-14 text-ink">เลือกไว้เกิน {{ MAX_LIKES }} อย่าง กดอันที่เลือกไว้เพื่อเอาออกให้เหลือ {{ MAX_LIKES }} อย่าง</span>
      <span v-else-if="profile.likes.length >= MAX_LIKES" class="text-14 text-ink-soft">ครบแล้ว กดอันที่เลือกไว้เพื่อเอาออก</span>
    </div>
  </div>
</template>

<script setup>
import BrandMark from '@/components/ui/BrandMark.vue'
import Tape from '@/components/ui/Tape.vue'
import Doodle from '@/components/ui/Doodle.vue'
import HandButton from '@/components/ui/HandButton.vue'
import { AVATARS } from '@/lib/doodles'
import { COVER_COLORS, PALETTE } from '@/lib/tokens'
import { MAX_LIKES, isLikeLocked } from '@/lib/likes'
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()

const LIKES = ['เพลง', 'แมว', 'กาแฟ', 'การนอน', 'เดินเล่น', 'วาดรูป', 'เกม', 'ทะเล']
</script>
