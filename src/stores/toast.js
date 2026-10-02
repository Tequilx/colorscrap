import { defineStore } from 'pinia'
import { ref } from 'vue'

// ข้อความสั้น ๆ ที่โผล่แล้วหายเอง (SPEC §6.6)
export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  let timer = null

  const show = (text, ms = 4000) => {
    message.value = text
    clearTimeout(timer)
    timer = setTimeout(() => (message.value = ''), ms)
  }

  return { message, show }
})
