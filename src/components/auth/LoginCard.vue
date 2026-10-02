<template>
  <!-- การ์ดเข้าสู่ระบบ: กระดาษบนโต๊ะสไตล์เดียวกับหน้า hello มีทั้งเข้าสู่ระบบและสมัครในใบเดียว (SPEC §7.1) -->
  <form
    class="absolute left-[400px] top-[150px] box-border flex w-[480px] rotate-[0.6deg] flex-col gap-[22px] bg-paper px-11 py-9 shadow-card"
    novalidate
    @submit.prevent="submit"
  >
    <Tape class="left-[190px] top-[-12px]" long :rotate="2" />

    <div class="flex flex-col gap-1">
      <span class="text-14 text-ink-soft">ColorScrap · สมุดสีน้ำ</span>
      <h1 class="m-0 font-hand text-38 font-semibold leading-[1.2]">{{ signingUp ? 'เริ่มสมุดเล่มใหม่' : 'เปิดสมุดของฉัน' }}</h1>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="login-email" class="font-hand text-17 font-semibold">อีเมล</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        autocomplete="email"
        inputmode="email"
        placeholder="you@example.com"
        class="border-0 border-b-2 border-dashed border-[#8E8A93] bg-transparent px-0.5 py-1.5 font-hand text-26 text-ink outline-offset-4"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="login-password" class="font-hand text-17 font-semibold">รหัสผ่าน</label>
      <input
        id="login-password"
        v-model="password"
        type="password"
        :autocomplete="signingUp ? 'new-password' : 'current-password'"
        :placeholder="signingUp ? 'อย่างน้อย 6 ตัว' : ''"
        class="border-0 border-b-2 border-dashed border-[#8E8A93] bg-transparent px-0.5 py-1.5 font-hand text-26 text-ink outline-offset-4"
      />
    </div>

    <p v-if="error" role="alert" class="m-0 text-14 text-ink-soft">{{ error }}</p>

    <div class="flex flex-col items-center gap-3">
      <HandButton type="submit" :disabled="!canSubmit || busy" @click.prevent="submit">
        {{ busy ? 'รอสักครู่...' : signingUp ? 'สร้างสมุดใหม่' : 'เข้าสมุด' }}
        <Doodle name="forward" :size="22" />
      </HandButton>
      <button type="button" class="cursor-pointer border-0 bg-transparent p-1 font-hand text-17 text-ink-soft underline decoration-dashed underline-offset-4" @click="toggle">
        {{ signingUp ? 'มีสมุดอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีสมุด? สมัครใหม่' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed } from 'vue'
import Tape from '@/components/ui/Tape.vue'
import Doodle from '@/components/ui/Doodle.vue'
import HandButton from '@/components/ui/HandButton.vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useEntriesStore } from '@/stores/entries'

const app = useAppStore()
const auth = useAuthStore()
const profile = useProfileStore()
const entries = useEntriesStore()

const signingUp = ref(false)
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

const canSubmit = computed(() => email.value.trim().length > 0 && password.value.length > 0)

const toggle = () => {
  signingUp.value = !signingUp.value
  error.value = ''
}

const submit = async () => {
  if (!canSubmit.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const message = signingUp.value ? await auth.signUp(email.value.trim(), password.value) : await auth.signIn(email.value.trim(), password.value)
    if (message) {
      error.value = message
      return
    }
    await Promise.all([profile.loadRemote(), entries.load()])
    password.value = ''
    // ยังไม่มีโปรไฟล์ (สมัครใหม่) → hello, มีแล้ว → cover
    app.go(profile.exists ? 'cover' : 'hello')
  } catch (e) {
    console.error('เข้าสู่ระบบไม่สำเร็จ:', e)
    error.value = 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่นะ'
  } finally {
    busy.value = false
  }
}
</script>
