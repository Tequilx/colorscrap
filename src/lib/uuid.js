// UUID v4: crypto.randomUUID มีเฉพาะ secure context (https หรือ localhost) เปิดผ่าน http://<IP> (เช่นทดสอบบน iPad) จะไม่มี
// จึงสร้างเองจาก crypto.getRandomValues (ใช้ได้ทุก context) ให้ใช้กับคอลัมน์ uuid ของ Supabase ได้
export const uuid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}
