// ติดต่อ Supabase (ตาราง profiles / entries / Storage) ใช้เฉพาะเมื่อไม่ใช่โหมดจำลอง (SPEC §7)
import { supabase } from '@/lib/supabase'

// คืน { displayName, avatar, coverColor, likes } หรือ null ถ้ายังไม่มีแถว (ผู้ใช้ใหม่ → ไปหน้า hello)
export const fetchProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('display_name, avatar, cover_color, likes').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: data.display_name, avatar: data.avatar, coverColor: data.cover_color, likes: data.likes }
}

export const upsertProfile = async (userId, p) => {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: p.displayName,
    avatar: p.avatar,
    cover_color: p.coverColor,
    likes: p.likes,
  })
  if (error) throw error
}
