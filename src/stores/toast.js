import { defineStore } from 'pinia'
import { ref } from 'vue'

// ข้อความสั้น ๆ ที่โผล่แล้วหายเอง (SPEC §6.6)
export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  // ปุ่มในข้อความ (ไม่บังคับ): { label, run } เช่น "แตะเพื่อบันทึก" ที่ต้องกดจริงถึงจะแชร์ได้
  const action = ref(null)
  let timer = null

  const hide = () => {
    message.value = ''
    action.value = null
  }

  const show = (text, ms = 4000, act = null) => {
    message.value = text
    action.value = act
    clearTimeout(timer)
    timer = setTimeout(hide, ms)
  }

  const runAction = () => {
    const act = action.value
    hide()
    act?.run()
  }

  return { message, action, show, runAction }
})
