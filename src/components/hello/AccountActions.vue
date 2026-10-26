<template>
  <!-- บัญชีของฉัน: ออกจากระบบ และลบข้อมูลทั้งหมด (เฉพาะโหมดแก้ไขในหน้า hello ที่ต่อ Supabase จริง) ห่างขอบล่างของโต๊ะ ≥ 48px + safe-area (ข้อ 53b) -->
  <div class="absolute bottom-[calc(48px+env(safe-area-inset-bottom))] left-[790px] flex w-[420px] flex-col items-center gap-2">
    <span class="text-13 text-ink-soft">{{ auth.user?.email }}</span>
    <div class="flex items-center gap-3">
      <HandButton variant="secondary" :disabled="busy" @click="onSignOut">{{ confirming === 'out' ? 'กดอีกครั้งเพื่อออก' : 'ออกจากระบบ' }}</HandButton>
      <HandButton variant="chip" :disabled="busy" class="!text-e-angry" @click="onDelete">{{ confirming === 'delete' ? 'กดอีกครั้งเพื่อลบ' : 'ลบข้อมูลทั้งหมด' }}</HandButton>
    </div>
    <span v-if="confirming" role="status" class="text-13 text-ink-soft">{{ confirming === 'out' ? 'มีภาพบนผ้าใบที่ยังไม่ได้บันทึก' : 'ภาพและข้อมูลทั้งหมดจะหายไป กู้คืนไม่ได้' }}</span>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useAppStore } from '@/stores/app'
import { useToastStore } from '@/stores/toast'

const auth = useAuthStore()
const entries = useEntriesStore()
const app = useAppStore()
const toast = useToastStore()

// ปุ่มที่เสี่ยงต้องกดซ้ำภายใน 3 วินาที (แบบเดียวกับ "เริ่มใหม่" SPEC §5.3) ไม่มี undo
const CONFIRM_MS = 3000
const confirming = ref('') // '' | 'out' | 'delete'
const busy = ref(false)
let timer = null

const arm = (what) => {
  confirming.value = what
  clearTimeout(timer)
  timer = setTimeout(() => (confirming.value = ''), CONFIRM_MS)
}
onBeforeUnmount(() => clearTimeout(timer))

// ออกจากระบบ: ถ้ามีภาพบนผ้าใบที่ยังไม่บันทึกต้องกดยืนยัน ส่วนการล้างข้อมูลคนก่อนทำโดย watcher ใน App.vue
const onSignOut = async () => {
  if (app.canvasDirty && confirming.value !== 'out') return arm('out')
  confirming.value = ''
  busy.value = true
  try {
    await auth.signOut()
  } finally {
    busy.value = false
  }
}

const onDelete = async () => {
  if (confirming.value !== 'delete') return arm('delete')
  confirming.value = ''
  busy.value = true
  try {
    await entries.deleteEverything()
    await auth.signOut()
  } catch (error) {
    console.error('ลบข้อมูลไม่สำเร็จ:', error)
    toast.show('ลบไม่สำเร็จ ลองอีกครั้งนะ')
  } finally {
    busy.value = false
  }
}
</script>
