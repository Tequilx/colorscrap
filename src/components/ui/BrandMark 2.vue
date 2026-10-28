<template>
  <!-- โลโก้ ColorScrap (รูปทั้งหมดมาจาก lib/brand.js ที่เดียว) variant: wordmark | icon | lockup · size = ความสูง (px) · tagline = คำรอง (เฉพาะ lockup ขนาดใหญ่) -->
  <span v-if="variant === 'wordmark'" class="inline-flex" role="img" :aria-label="BRAND_NAME">
    <svg class="shrink-0" :width="size * WORD_ASPECT" :height="size" :viewBox="wordVb" aria-hidden="true" v-html="wordInner"></svg>
  </span>
  <span v-else-if="variant === 'icon'" class="inline-flex" role="img" :aria-label="BRAND_NAME">
    <svg class="shrink-0" :width="size" :height="size" :viewBox="iconVb" aria-hidden="true" v-html="iconSvg"></svg>
  </span>
  <span v-else class="inline-flex items-center" :style="{ gap: layout.gap + 'px' }" role="img" :aria-label="BRAND_NAME">
    <svg class="shrink-0" :width="layout.icon" :height="layout.icon" :viewBox="iconVb" aria-hidden="true" v-html="iconSvg"></svg>
    <span class="shrink-0 rounded-full" :style="{ width: layout.divider.w + 'px', height: layout.divider.h + 'px', background: DIVIDER_COLOR }" aria-hidden="true"></span>
    <span class="flex flex-col" :style="{ gap: size * 0.06 + 'px' }">
      <svg class="shrink-0" :width="layout.wordW" :height="layout.word" :viewBox="wordVb" aria-hidden="true" v-html="wordInner"></svg>
      <span v-if="tagline" class="whitespace-nowrap font-body text-ink-soft" :style="{ fontSize: size * 0.2 + 'px', lineHeight: 1.5 }">{{ BRAND_TAGLINE }}</span>
    </span>
  </span>
</template>

<script setup>
import { useId } from 'vue'
import { BRAND_NAME, BRAND_TAGLINE, DIVIDER_COLOR, WORD_ASPECT, WORD_VB, iconInner, iconViewBox, lockupLayout, wordmarkInner } from '@/lib/brand'

const props = defineProps({
  variant: { type: String, default: 'wordmark', validator: (v) => ['wordmark', 'icon', 'lockup'].includes(v) },
  size: { type: Number, default: 32 },
  tagline: { type: Boolean, default: false },
})
const uid = `bm${useId().replace(/[^\w]/g, '')}`
const wordVb = WORD_VB.join(' ')
const iconVb = iconViewBox(0.04).join(' ')
const wordInner = wordmarkInner(`${uid}w`)
const iconSvg = iconInner(`${uid}i`)
const layout = lockupLayout(props.size)
</script>
