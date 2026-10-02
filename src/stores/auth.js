import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, USE_MOCK } from '@/lib/supabase'

// แปลง error ของ Supabase Auth เป็นข้อความไทย
const thaiError = (error) => {
  const code = error?.code ?? ''
  const msg = (error?.message ?? '').toLowerCase()
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'อีเมลนี้มีสมุดอยู่แล้ว ลองเข้าสู่ระบบแทนนะ'
  if (code === 'weak_password' || msg.includes('password should be')) return 'รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัว)'
  if (code === 'validation_failed' || code === 'email_address_invalid' || msg.includes('invalid format') || msg.includes('is invalid')) return 'อีเมลไม่ถูกต้อง'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error?.status === 429) return 'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่นะ'
  if (error?.name === 'AuthRetryableFetchError' || msg.includes('fetch')) return 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่นะ'
  return 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้งนะ'
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  // โหมดจำลองไม่มีการเข้าสู่ระบบ
  const needsLogin = computed(() => !USE_MOCK && !user.value)

  // โหลด session ที่ค้างอยู่ (เรียกครั้งเดียวก่อน mount) และคอยฟังการหมดอายุ/ออกจากระบบ
  const init = async () => {
    if (USE_MOCK) return
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  // คืน null เมื่อสำเร็จ หรือข้อความ error ภาษาไทย
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return thaiError(error)
    user.value = data.user
    return null
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return thaiError(error)
    // ปิด confirm email แล้วจึงได้ session ทันที ถ้าไม่ได้ (ยังเปิด confirm อยู่) บอกให้ไปตรวจค่าตั้งใน dashboard
    if (!data.session) return 'สมัครแล้ว แต่ยังเข้าไม่ได้ (โปรเจกต์ยังเปิดยืนยันอีเมลอยู่)'
    user.value = data.user
    return null
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    user.value = null
  }

  return { user, needsLogin, init, signIn, signUp, signOut }
})
