// เส้นโค้งความแรงของ "ภาพยังเปียก" (ฟังก์ชันล้วน ทดสอบได้ ไม่แตะ DOM) ใช้โดย lib/wetPhoto.js
export const WET_MS = 3000
export const WET_PEAK = 7 // px ของการบิดสูงสุด (หน่วยของภาพก่อนขยาย)

// ความแรงที่เวลา t (ms): เริ่มที่ peak แล้วลดแบบ ease-out (เร็วก่อนแล้วค่อย ๆ ช้า) ถึง 0 ที่ WET_MS พอดี
export const wetStrength = (t, total = WET_MS, peak = WET_PEAK) => {
  const u = Math.min(1, Math.max(0, t / total))
  return peak * (1 - u) ** 2
}
