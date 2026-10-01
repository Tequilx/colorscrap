<template>
  <SvgDefs />
  <Stage>
    <!-- หน้าตรวจ UI kit เฉพาะโหมด dev: เปิดด้วย /?kit -->
    <component :is="Kit" v-if="Kit" />
    <!-- วัตถุบนโต๊ะจะมาวางที่นี่ในขั้นถัดไป -->
    <div v-else class="flex h-full items-center justify-center font-hand text-38 text-ink-soft">ColorScrap</div>
  </Stage>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import Stage from '@/components/desk/Stage.vue'
import SvgDefs from '@/components/desk/SvgDefs.vue'

const showKit = import.meta.env.DEV && new URLSearchParams(location.search).has('kit')
const Kit = showKit ? defineAsyncComponent(() => import('@/KitGallery.vue')) : null
</script>
