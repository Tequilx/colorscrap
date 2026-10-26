// "สิ่งที่ทำให้ใจฟู": เลือกได้สูงสุด 3 อย่าง (บังคับฝั่งไคลเอนต์ ไม่ยุ่งกับ schema) ที่หน้าสมุดแสดง 3 อันแรก
export const MAX_LIKES = 3

// กดชิป: เอาออกได้เสมอ เพิ่มได้เฉพาะเมื่อยังไม่ครบ MAX_LIKES (ครบแล้วคืนรายการเดิม)
export const toggleLikeList = (list, like) => {
  if (list.includes(like)) return list.filter((l) => l !== like)
  return list.length >= MAX_LIKES ? list : [...list, like]
}

// ชิปที่กดเพิ่มไม่ได้ (ยังไม่ได้เลือก และครบแล้ว)
export const isLikeLocked = (list, like) => !list.includes(like) && list.length >= MAX_LIKES

// โปรไฟล์เดิมอาจบันทึกไว้เกิน 3: ต้องเอาออกจนเหลือ ≤ 3 ก่อนบันทึก
export const likesOverLimit = (list) => list.length > MAX_LIKES
