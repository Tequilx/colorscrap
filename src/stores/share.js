import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useToastStore } from '@/stores/toast'
import { makeDayCard, makePhotoCard, makePhotoOnly } from '@/lib/share/exporter'
import { canShareFile, makeFile, shareOrDownload } from '@/lib/share/shareOrDownload'

// เก็บรูปการ์ด/ภาพ (SPEC ส่วนที่ 2 §9): สร้างรูปในเครื่อง แล้วเปิดหน้าแชร์ (iPad) หรือดาวน์โหลด (เครื่องอื่น)
export const useShareStore = defineStore('share', () => {
  const toast = useToastStore()
  const profile = useProfileStore()
  // ปุ่มที่กำลังทำรูป (ปุ่มอื่นยังกดได้ ปุ่มเดียวกันกดซ้ำไม่ได้)
  const busy = reactive({ 'photo-card': false, 'photo-only': false, day: false })
  // รูปที่ทำเสร็จแต่การแชร์หลุดจังหวะกด (NotAllowedError) เก็บไว้ให้ปุ่ม "แตะเพื่อบันทึก" แชร์ใหม่
  let pending = null

  // แชร์ไฟล์ที่เก็บไว้ใน gesture ใหม่ (เรียกจากการกดปุ่มใน toast)
  const retryPending = async () => {
    const file = pending
    if (!file) return
    try {
      const result = await shareOrDownload(file, file.name)
      if (result === 'blocked') return showBlocked(file)
      pending = null
      if (result !== 'cancelled') toast.show('เก็บรูปแล้ว')
    } catch (error) {
      console.error('เก็บรูปไม่สำเร็จ:', error)
      toast.show('ทำรูปไม่สำเร็จ ลองอีกครั้งนะ')
    }
  }

  const showBlocked = (file) => {
    pending = file
    toast.show('รูปพร้อมแล้ว', 12000, { label: 'แตะเพื่อบันทึก', run: retryPending })
  }

  const run = async (key, make) => {
    if (busy[key]) return
    busy[key] = true
    try {
      const { blob, filename } = await make()
      const file = makeFile(blob, filename)
      const result = await shareOrDownload(file, filename)
      if (result === 'blocked') showBlocked(file)
      else if (result !== 'cancelled') toast.show('เก็บรูปแล้ว')
    } catch (error) {
      console.error('ทำรูปไม่สำเร็จ:', error)
      toast.show('ทำรูปไม่สำเร็จ ลองอีกครั้งนะ')
    } finally {
      busy[key] = false
    }
  }

  const photoCard = (entry) => run('photo-card', () => makePhotoCard(entry, profile.shownName))
  const photoOnly = (entry) => run('photo-only', () => makePhotoOnly(entry))
  const dayCard = (date, entries) => run('day', () => makeDayCard(date, entries, profile.shownName))

  // true = เครื่องนี้เปิดหน้าแชร์ไฟล์ได้ (ข้อความกำกับใต้ปุ่มต่างกัน) ตัดสินครั้งเดียวด้วยไฟล์เปล่า ๆ
  const canShare = () => canShareFile(new File([''], 'x.png', { type: 'image/png' }))

  return { busy, canShare, photoCard, photoOnly, dayCard }
})
