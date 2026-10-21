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
      <!-- โพลารอยด์ที่บินตอนบันทึก (SPEC §5.4) -->
      <SavedFlight v-if="app.saveFlight" :flight="app.saveFlight" />

      <!-- ส่วนของแต่ละ view ที่เข้า/ออกด้วย fade -->
      <Transition name="fade">
        <LoginCard v-if="app.view === 'login'" />
      </Transition>
      <Transition name="fade">
        <div v-if="app.view === 'hello'" class="absolute inset-0">
          <HelloSheet />
          <CoverPreview />
          <AccountActions v-if="app.helloEditing && !USE_MOCK" />
        </div>
      </Transition>
      <Transition name="fade">
        <CoverIntro v-if="app.view === 'cover'" class="absolute inset-0" />
      </Transition>
      <!-- การ์ดโผล่เป็นขั้นสุดท้ายของลำดับบันทึก (savePhase card → idle) -->
      <Transition name="card">
        <SavedCard v-if="app.view === 'saved' && (app.savePhase === 'card' || app.savePhase === 'idle')" />
      </Transition>
      <PhotoView />
      <LegacyPrompt />
      <Toast />
      <SoundToggle />
      <!-- ปุ่มนำทางของหน้า book -->
      <Transition name="fade">
        <div v-if="app.view === 'book'" class="absolute left-[124px] top-7">
          <HandButton variant="secondary" @click="app.go('cover')"><Doodle name="back" :size="22" /> หน้าแรก</HandButton>
        </div>
      </Transition>
    </template>
  </Stage>
  <!-- แผงปรับค่าสีน้ำ: dev เท่านั้น เปิดด้วย ?debug (อยู่นอก Stage ไม่โดน scale) -->
  <component :is="DebugPanel" v-if="DebugPanel" />
</template>

<script setup>
import { watch, watchEffect, defineAsyncComponent, onBeforeUnmount } from 'vue'
import Stage from '@/components/desk/Stage.vue'
import SvgDefs from '@/components/desk/SvgDefs.vue'
import Scrapbook from '@/components/book/Scrapbook.vue'
import EmotionPalette from '@/components/pick/EmotionPalette.vue'
import LegacyPrompt from '@/components/auth/LegacyPrompt.vue'
import Toast from '@/components/ui/Toast.vue'
import SoundToggle from '@/components/ui/SoundToggle.vue'
import { attachSound, sound } from '@/lib/sound'
import { installCursors } from '@/lib/cursors'
import { attachMusic } from '@/lib/music'
import LoginCard from '@/components/auth/LoginCard.vue'
import HelloSheet from '@/components/hello/HelloSheet.vue'
import AccountActions from '@/components/hello/AccountActions.vue'
import { USE_MOCK } from '@/lib/supabase'
import CoverPreview from '@/components/hello/CoverPreview.vue'
import CoverIntro from '@/components/cover/CoverIntro.vue'
import DrawingBoard from '@/components/paint/DrawingBoard.vue'
import SavedCard from '@/components/saved/SavedCard.vue'
import SavedFlight from '@/components/saved/SavedFlight.vue'
import PhotoView from '@/components/photo/PhotoView.vue'
import HandButton from '@/components/ui/HandButton.vue'
import Doodle from '@/components/ui/Doodle.vue'
import { useAppStore } from '@/stores/app'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useHashView } from '@/lib/useHashView'
import { coverSpine, coverStrap } from '@/lib/color'

const app = useAppStore()
const profile = useProfileStore()
const auth = useAuthStore()
const entries = useEntriesStore()

useHashView(app, profile, auth)

// เสียง (src/lib/sound.js): สร้างระบบเสียงหลังแตะครั้งแรก + เสียงแตะกระดาษเบามากเมื่อกดปุ่ม/ลิงก์
attachSound()
attachMusic() // เพลงคลอ (เริ่มหลังแตะครั้งแรก)
installCursors() // เคอร์เซอร์นิ้วชี้ (เฉพาะเมาส์)
const tapSound = (e) => {
  if (e.target?.closest?.('button, a, [role="button"]')) sound.tap()
}
window.addEventListener('pointerdown', tapSound, true)
onBeforeUnmount(() => window.removeEventListener('pointerdown', tapSound, true))

// session หมดอายุหรือออกจากระบบ (โหมดจริง): ล้างข้อมูลของคนก่อนแล้วกลับหน้า login
watch(
  () => auth.user,
  (now, before) => {
    if (before && !now) {
      app.resetSession()
      profile.reset()
      entries.reset()
      app.setView('login')
    }
  },
)

// ผ้าใบมีภาพที่ยังไม่บันทึก: เตือนก่อนปิดแท็บ/รีเฟรช (เบราว์เซอร์แสดงข้อความมาตรฐานเอง)
const warnUnsaved = (e) => {
  if (!app.canvasDirty) return
  e.preventDefault()
  e.returnValue = ''
}
window.addEventListener('beforeunload', warnUnsaved)
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsaved))

// สีปกเป็นตัวแปรรันไทม์ที่ root (สันปก/สายรัดคำนวณจากสีปก)
watchEffect(() => {
  const root = document.documentElement.style
  root.setProperty('--cover', profile.coverColor)
  root.setProperty('--cover-spine', coverSpine(profile.coverColor))
  root.setProperty('--cover-strap', coverStrap(profile.coverColor))
})

const showKit = import.meta.env.DEV && new URLSearchParams(location.search).has('kit')
const DebugPanel = import.meta.env.DEV && new URLSearchParams(location.search).has('debug') ? defineAsyncComponent(() => import('@/dev/DebugPanel.vue')) : null
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
.card-enter-active,
.card-leave-active {
  transition:
    opacity calc(300ms * var(--motion-scale, 1)) cubic-bezier(0.2, 0.8, 0.2, 1),
    transform calc(300ms * var(--motion-scale, 1)) cubic-bezier(0.2, 0.8, 0.2, 1);
}
.card-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
.card-leave-to {
  opacity: 0;
}
</style>
