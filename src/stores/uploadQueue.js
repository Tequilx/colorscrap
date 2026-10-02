import { defineStore } from 'pinia'
import { USE_MOCK } from '@/lib/supabase'
import { loadRecords } from '@/lib/imageStore'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useToastStore } from '@/stores/toast'

// คิวอัปโหลดภาพ (SPEC §6.6): entry ที่ยังขึ้น Supabase ไม่สำเร็จค้างอยู่ใน IndexedDB (มี user_id ของเจ้าของ)
// flush() อัปโหลดทุกรายการของผู้ใช้ที่ล็อกอินอยู่ ล้มเหลว → toast ครั้งแรก แล้วลองใหม่เองห่างขึ้นเรื่อย ๆ
const RETRY_MS = [5000, 15000, 60000, 300000]

export const useUploadQueueStore = defineStore('uploadQueue', () => {
  let running = false
  let again = false // มีรายการใหม่เข้ามาระหว่างที่กำลังทำงาน ให้วนอีกรอบ
  let attempt = 0 // จำนวนรอบที่พลาดติดต่อกัน
  let timer = null
  let listening = false

  const stop = () => {
    clearTimeout(timer)
    timer = null
    attempt = 0
  }

  const flush = async () => {
    const auth = useAuthStore()
    if (USE_MOCK || !auth.user) return
    if (!listening) {
      listening = true
      window.addEventListener('online', flush)
    }
    if (running) {
      again = true
      return
    }
    running = true
    clearTimeout(timer)
    let failed = false
    try {
      const entries = useEntriesStore()
      do {
        again = false
        const uid = auth.user?.id
        if (!uid) return
        const records = (await loadRecords()).filter((r) => r.user_id === uid && r.image && r.thumb)
        for (const record of records) {
          try {
            await entries.upload(record)
          } catch (error) {
            failed = true
            console.error('อัปโหลดภาพไม่สำเร็จ (เก็บไว้ในเครื่องแล้ว):', error)
          }
        }
      } while (again)
    } finally {
      running = false
    }
    if (failed) {
      if (attempt === 0) useToastStore().show('ยังบันทึกไม่ได้ จะลองใหม่ให้อีกครั้ง')
      timer = setTimeout(flush, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)])
      attempt += 1
    } else {
      attempt = 0
    }
  }

  return { flush, stop }
})
