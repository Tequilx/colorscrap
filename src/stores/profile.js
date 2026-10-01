import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { COVER_COLORS } from '@/lib/tokens'

// ข้อมูลจำลอง: เก็บใน localStorage แทน Supabase `profiles` (ขั้นที่ 7 จะเปลี่ยนเป็นของจริง)
const KEY = 'colorscrap.profile'

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

export const useProfileStore = defineStore('profile', () => {
  const saved = load()
  const exists = ref(Boolean(saved))
  const displayName = ref(saved?.displayName ?? '')
  const avatar = ref(saved?.avatar ?? 'cat')
  const coverColor = ref(saved?.coverColor ?? COVER_COLORS[0].hex)
  const likes = ref(saved?.likes ?? ['เพลง', 'แมว'])

  const shownName = computed(() => displayName.value.trim())

  const toggleLike = (like) => {
    likes.value = likes.value.includes(like) ? likes.value.filter((l) => l !== like) : [...likes.value, like]
  }

  // เทียบกับ `upsert` ลงตาราง profiles (SPEC §5.0)
  const save = () => {
    displayName.value = displayName.value.trim().slice(0, 20)
    exists.value = true
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ displayName: displayName.value, avatar: avatar.value, coverColor: coverColor.value, likes: likes.value }),
      )
    } catch {
      // เบราว์เซอร์ปิด storage: ใช้ได้ในหน่วยความจำต่อไป
    }
  }

  return { exists, displayName, avatar, coverColor, likes, shownName, toggleLike, save }
})
