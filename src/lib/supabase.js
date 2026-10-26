import { createClient } from '@supabase/supabase-js'

// VITE_USE_MOCK=true เท่านั้น → โหมดจำลองไม่ต่อเครือข่าย (ใช้ทำงานตอน dev; .env ตั้ง true) ค่าอื่น รวมถึงไม่ตั้ง → ใช้ Supabase จริง (ข้อ 57: ลืมตั้งตอน deploy ต้องไม่หลุดเป็นโหมดจำลอง)
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ค่า "VITE_SUPABASE_ANON_KEY" ใส่ publishable key (sb_publishable_...) ได้ ส่งเป็น header apikey ตรง ๆ
// ห้ามใส่ secret / service_role key ในแอปเด็ดขาด
export const supabase = USE_MOCK
  ? null
  : createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const BUCKET = 'paintings'
