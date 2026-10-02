// sync view กับ location.hash ให้ปุ่ม back ของเบราว์เซอร์ใช้ได้ (SPEC §4.1) โดยไม่ใช้ router
import { watch } from 'vue'

// view ที่เปิดจาก hash ได้ (เพิ่มเมื่อทำหน้าอื่นเสร็จ)
const HASH_VIEWS = ['login', 'hello', 'cover', 'pick', 'paint', 'book', 'photo']

export const useHashView = (app, profile, auth) => {
  const fromHash = () => location.hash.replace('#', '')

  // ยังไม่ล็อกอิน (โหมดจริง) เข้าได้แค่ login, ล็อกอินแล้วเข้า login ไม่ได้
  // photo ต้องมีภาพที่เปิดอยู่ (เช่น กด forward กลับมา) ไม่งั้นเข้าตรง ๆ จาก URL ไม่ได้
  const accepts = (v) => {
    if (!HASH_VIEWS.includes(v)) return false
    if (auth.needsLogin) return v === 'login'
    if (v === 'login') return false
    return (v === 'hello' || profile.exists) && (v !== 'photo' || Boolean(app.photoEntryId))
  }

  // ตอนโหลดแอป: ไม่ได้ล็อกอิน → login, มีโปรไฟล์ → cover ไม่มี → hello (ถ้า hash ถูกต้องและใช้ได้ ให้ใช้ตาม hash)
  app.boot(profile.exists, !auth.needsLogin)
  const initial = fromHash()
  if (accepts(initial)) app.setView(initial)
  if (fromHash() !== app.view) history.replaceState(null, '', `#${app.view}`)

  watch(
    () => app.view,
    (v) => {
      if (fromHash() !== v) location.hash = v
    },
  )

  window.addEventListener('hashchange', () => {
    const v = fromHash()
    if (accepts(v) && v !== app.view) {
      app.setView(v)
      // กลับเข้า hello จากปุ่ม back ถือเป็นโหมดแก้ไขถ้ามีโปรไฟล์แล้ว
      app.helloEditing = v === 'hello' && profile.exists
    } else if (v !== app.view) {
      // hash ที่ไม่อนุญาต (เช่น back ออกจากหน้า login ที่ล็อกอินแล้ว) ดึงกลับให้ตรงกับหน้าปัจจุบัน
      history.replaceState(null, '', `#${app.view}`)
    }
  })
}
