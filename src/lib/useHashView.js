// sync view กับ location.hash ให้ปุ่ม back ของเบราว์เซอร์ใช้ได้ (SPEC §4.1) โดยไม่ใช้ router
import { watch } from 'vue'

// view ที่เปิดจาก hash ได้ (เพิ่มเมื่อทำหน้าอื่นเสร็จ)
const HASH_VIEWS = ['hello', 'cover', 'pick', 'paint', 'book', 'photo']

export const useHashView = (app, profile) => {
  const fromHash = () => location.hash.replace('#', '')

  // photo ต้องมีภาพที่เปิดอยู่ (เช่น กด forward กลับมา) ไม่งั้นเข้าตรง ๆ จาก URL ไม่ได้
  const accepts = (v) => HASH_VIEWS.includes(v) && (v === 'hello' || profile.exists) && (v !== 'photo' || Boolean(app.photoEntryId))

  // ตอนโหลดแอป: มีโปรไฟล์ → cover ไม่มี → hello (ถ้า hash ถูกต้องและใช้ได้ ให้ใช้ตาม hash)
  app.boot(profile.exists)
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
    }
  })
}
