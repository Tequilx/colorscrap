<template>
  <SvgDefs />
  <Stage>
    <!-- หน้าตรวจ UI kit เฉพาะโหมด dev: เปิดด้วย /?kit -->
    <component :is="Kit" v-if="Kit" />
    <template v-else>
      <!-- วัตถุบนโต๊ะที่อยู่ตลอด ไม่ถูก unmount เวลาเปลี่ยน view -->
      <DrawingBoard />
      <Scrapbook />
      <EmotionPalette />

      <!-- ส่วนของแต่ละ view ที่เข้า/ออกด้วย fade -->
      <Transition name="fade">
        <div v-if="app.view === 'hello'" class="absolute inset-0">
          <HelloSheet />
          <CoverPreview />
        </div>
      </Transition>
      <Transition name="fade">
        <CoverIntro v-if="app.view === 'cover'" class="absolute inset-0" />
      </Transition>
      <Transition name="fade">
        <SavedCard v-if="app.view === 'saved'" />
      </Transition>
      <PhotoView />
      <!-- ปุ่มนำทางของหน้า book -->
      <Transition name="fade">
        <div v-if="app.view === 'book'" class="absolute left-[124px] top-7">
          <HandButton variant="secondary" @click="app.go('cover')"><Doodle name="back" :size="22" /> หน้าแรก</HandButton>
        </div>
      </Transition>
    </template>
  </Stage>
</template>

<script setup>
import { watchEffect, defineAsyncComponent } from 'vue'
import Stage from '@/components/desk/Stage.vue'
import SvgDefs from '@/components/desk/SvgDefs.vue'
import Scrapbook from '@/components/book/Scrapbook.vue'
import EmotionPalette from '@/components/pick/EmotionPalette.vue'
import HelloSheet from '@/components/hello/HelloSheet.vue'
import CoverPreview from '@/components/hello/CoverPreview.vue'
import CoverIntro from '@/components/cover/CoverIntro.vue'
import DrawingBoard from '@/components/paint/DrawingBoard.vue'
import SavedCard from '@/components/saved/SavedCard.vue'
import PhotoView from '@/components/photo/PhotoView.vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'
import { useHashView } from '@/lib/useHashView'
import { coverSpine, coverStrap } from '@/lib/color'

const app = useAppStore()
const profile = useProfileStore()

useHashView(app, profile)

// สีปกเป็นตัวแปรรันไทม์ที่ root (สันปก/สายรัดคำนวณจากสีปก)
watchEffect(() => {
  const root = document.documentElement.style
  root.setProperty('--cover', profile.coverColor)
  root.setProperty('--cover-spine', coverSpine(profile.coverColor))
  root.setProperty('--cover-strap', coverStrap(profile.coverColor))
})

const showKit = import.meta.env.DEV && new URLSearchParams(location.search).has('kit')
const Kit = showKit ? defineAsyncComponent(() => import('@/KitGallery.vue')) : null
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
