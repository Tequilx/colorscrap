// ติดต่อ Supabase (ตาราง profiles / entries / Storage) ใช้เฉพาะเมื่อไม่ใช่โหมดจำลอง (SPEC §7)
import { supabase, BUCKET } from '@/lib/supabase'

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

// ---- entries + ภาพ (SPEC §6.6, §7.2) ----
const ENTRY_COLUMNS = 'id, local_date, local_time, emotion, emotions, intensity, colors, shifted, image_path, thumb_path'

// แถวจาก DB → entry ในแอป (local_time เป็น HH:MM:SS ตัดเหลือ HH:MM; ยังไม่มี Blob = ใช้ signed URL จาก path)
const fromRow = (r) => ({
  id: r.id,
  local_date: r.local_date,
  local_time: r.local_time.slice(0, 5),
  emotion: r.emotion,
  emotions: r.emotions,
  intensity: r.intensity,
  shifted: r.shifted,
  colors: r.colors,
  image: null,
  thumb: null,
  image_path: r.image_path,
  thumb_path: r.thumb_path,
})

// สรุปรายวันแบบเบา (ข้อ 63): เฉพาะคอลัมน์ที่ใช้คำนวณสีเด่นของวัน (ไม่มี path/อารมณ์/รูป) แบ่งหน้าละ 1000 แถว (PostgREST ตัดที่ 1000) เรียง local_date, local_time
// ใช้ index entries_user_date (user_id, local_date, local_time) + RLS user_id = auth.uid() ไม่ต้องมี index เพิ่ม
const SUMMARY_COLUMNS = 'local_date, local_time, intensity, colors'
const PAGE = 1000
export const fetchDaySummaries = async () => {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('entries').select(SUMMARY_COLUMNS).order('local_date').order('local_time').range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data.map((r) => ({ local_date: r.local_date, local_time: r.local_time.slice(0, 5), intensity: r.intensity, colors: r.colors })))
    if (data.length < PAGE) break
  }
  return rows
}

// รายละเอียดเต็มของบางวัน (ภาพ path, อารมณ์ ฯลฯ) โหลดตอนเปิดวันนั้นหรือวันข้างเคียง
export const fetchEntriesOfDays = async (dates) => {
  if (!dates.length) return []
  const { data, error } = await supabase.from('entries').select(ENTRY_COLUMNS).in('local_date', dates).order('local_date').order('local_time')
  if (error) throw error
  return data.map(fromRow)
}

// (เดิม) ดึงทุกแถวในครั้งเดียว — ไม่ใช้แล้วใน store เก็บไว้เผื่อสคริปต์
export const fetchEntries = async () => {
  const { data, error } = await supabase.from('entries').select(ENTRY_COLUMNS).order('local_date').order('local_time')
  if (error) throw error
  return data.map(fromRow)
}

// นามสกุลตามชนิดไฟล์จริง (Safari รุ่นเก่าถอยไป JPEG, ดู exportImage.js) ชนิดอื่นที่ bucket ไม่รับ = ไม่อัปโหลด
const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }
const extOf = (blob) => {
  const ext = EXT[blob?.type]
  if (!ext) throw new Error(`ชนิดไฟล์ภาพไม่รองรับ: ${blob?.type}`)
  return ext
}

const upload = async (path, blob) => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) throw error
}

// อัปโหลดภาพเต็ม → ภาพย่อ → insert แถว (ลำดับตาม SPEC §6.6) ทำซ้ำได้ปลอดภัย: path คงที่ + upsert, แถวซ้ำ (23505) ถือว่าสำเร็จ
// entry ต้องมี image/thumb เป็น Blob คืน { image_path, thumb_path } ตามนามสกุลจริง
export const uploadEntry = async (userId, entry) => {
  const image_path = `${userId}/${entry.id}.${extOf(entry.image)}`
  const thumb_path = `${userId}/${entry.id}_thumb.${extOf(entry.thumb)}`
  await upload(image_path, entry.image)
  await upload(thumb_path, entry.thumb)
  const { error } = await supabase.from('entries').insert({
    id: entry.id,
    local_date: entry.local_date,
    local_time: entry.local_time,
    emotion: entry.emotion,
    emotions: [...entry.emotions],
    intensity: entry.intensity,
    colors: entry.colors.map((c) => ({ hex: c.hex, ratio: c.ratio })),
    shifted: entry.shifted,
    image_path,
    thumb_path,
  })
  if (error && error.code !== '23505') throw error
  return { image_path, thumb_path }
}

// signed URL อายุ ttl วินาที คืน [{ path, signedUrl }] เฉพาะที่ได้
export const signPaths = async (paths, ttl) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, ttl)
  if (error) throw error
  return data.filter((d) => d.signedUrl && !d.error)
}

// ---- ลบข้อมูลทั้งหมดของผู้ใช้ ----
// ลบไฟล์ทั้งโฟลเดอร์ {userId}/ ใน bucket (รวมไฟล์กำพร้าที่ไม่มีแถวอ้างถึง) → แถว entries → แถว profiles
// บัญชีผู้ใช้ใน auth ยังอยู่ (ลบเองต้องใช้ service role ซึ่งห้ามอยู่ในแอป)
export const deleteAllData = async (userId) => {
  const bucket = supabase.storage.from(BUCKET)
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 100 })
    if (error) throw error
    if (!data.length) break
    const { error: removeError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`))
    if (removeError) throw removeError
  }
  const entries = await supabase.from('entries').delete().eq('user_id', userId)
  if (entries.error) throw entries.error
  const profile = await supabase.from('profiles').delete().eq('id', userId)
  if (profile.error) throw profile.error
}
