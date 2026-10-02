<template>
  <!-- ภาพเก่าในเครื่องจากช่วงก่อนมีบัญชี: ถามทุกครั้งก่อนย้าย ไม่ย้ายเงียบ ๆ (เครื่องนี้อาจมีผู้ใช้หลายคน) -->
  <Transition name="fade">
    <div
      v-if="entries.legacyCount > 0 && app.view === 'cover'"
      role="dialog"
      aria-label="ย้ายภาพเก่าเข้าสมุด"
      class="absolute bottom-8 left-8 z-40 box-border flex w-[340px] -rotate-[0.8deg] flex-col gap-3 bg-paper px-6 py-5 shadow-card"
    >
      <span class="font-hand text-19 font-semibold leading-[1.3]">พบภาพ {{ entries.legacyCount }} ภาพที่บันทึกไว้ในเครื่องนี้</span>
      <span class="text-14 text-ink-soft">จะย้ายเข้าสมุดของบัญชีนี้ไหม</span>
      <div class="flex gap-2">
        <HandButton variant="secondary" :disabled="busy" @click="move">ย้ายขึ้น</HandButton>
        <HandButton variant="chip" :disabled="busy" @click="entries.skipLegacy()">ไม่ย้าย</HandButton>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import HandButton from '@/components/ui/HandButton.vue'
import { useAppStore } from '@/stores/app'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const entries = useEntriesStore()
const busy = ref(false)

const move = async () => {
  busy.value = true
  try {
    await entries.adoptLegacy()
  } finally {
    busy.value = false
  }
}
</script>
