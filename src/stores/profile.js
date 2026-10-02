import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { COVER_COLORS } from '@/lib/tokens'
import { USE_MOCK } from '@/lib/supabase'
import { fetchProfile, upsertProfile } from '@/lib/remote'
import { useAuthStore } from '@/stores/auth'

// โหมดจำลอง: เก็บใน localStorage แทนตาราง profiles โหมดจริง: อ่าน/เขียนตาราง profiles ของผู้ใช้ที่ล็อกอิน
const KEY = 'colorscrap.profile'

const load = () => {
  if (!USE_MOCK) return null
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

const DEFAULTS = () => ({ displayName: '', avatar: 'cat', coverColor: COVER_COLORS[0].hex, likes: ['เพลง', 'แมว'] })

export const useProfileStore = defineStore('profile', () => {
  const saved = load()
  const exists = ref(Boolean(saved))
  const displayName = ref(saved?.displayName ?? '')
  const avatar = ref(saved?.avatar ?? 'cat')
  const coverColor = ref(saved?.coverColor ?? COVER_COLORS[0].hex)
  const likes = ref(saved?.likes ?? ['เพลง', 'แมว'])
  const saveError = ref('')

  const shownName = computed(() => displayName.value.trim())

  const apply = (p) => {
    displayName.value = p.displayName
    avatar.value = p.avatar
    coverColor.value = p.coverColor
    likes.value = p.likes
  }

  const toggleLike = (like) => {
    likes.value = likes.value.includes(like) ? likes.value.filter((l) => l !== like) : [...likes.value, like]
  }

  // โหมดจริง: ดึงโปรไฟล์ของผู้ใช้ที่ล็อกอิน (ไม่มีแถว = ผู้ใช้ใหม่ ใช้ค่าเริ่มต้นแล้วไปหน้า hello)
  const loadRemote = async () => {
    const p = await fetchProfile(useAuthStore().user.id)
    exists.value = Boolean(p)
    apply(p ?? DEFAULTS())
  }

  // ล้างตอนออกจากระบบ ไม่ให้คนถัดไปเห็นข้อมูลของคนก่อน
  const reset = () => {
    exists.value = false
    saveError.value = ''
    apply(DEFAULTS())
  }

  // เทียบกับ `upsert` ลงตาราง profiles (SPEC §5.0) คืน true เมื่อสำเร็จ
  const save = async () => {
    displayName.value = displayName.value.trim().slice(0, 20)
    const data = { displayName: displayName.value, avatar: avatar.value, coverColor: coverColor.value, likes: likes.value }
    saveError.value = ''
    if (!USE_MOCK) {
      try {
        await upsertProfile(useAuthStore().user.id, { ...data, likes: [...data.likes] })
      } catch (error) {
        console.error('บันทึกโปรไฟล์ไม่สำเร็จ:', error)
        saveError.value = 'บันทึกไม่ได้ ลองอีกครั้งนะ'
        return false
      }
    } else {
      try {
        localStorage.setItem(KEY, JSON.stringify(data))
      } catch {
        // เบราว์เซอร์ปิด storage: ใช้ได้ในหน่วยความจำต่อไป
      }
    }
    exists.value = true
    return true
  }

  return { exists, displayName, avatar, coverColor, likes, saveError, shownName, toggleLike, loadRemote, reset, save }
})
