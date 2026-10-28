// จังหวะการพลิกหน้า: easing ของแผ่นและเวลา (สัดส่วน 0–1 ของการพลิก) ที่แผ่นหมุนถึงมุมที่ต้องการ ใช้สลับด้านหน้า/ด้านหลังของแผ่นให้ตรงจังหวะ
export const TURN_EASING = [0.45, 0, 0.25, 1] // cubic-bezier ของแผ่นที่พลิก (x1, y1, x2, y2)

const bez = (a, b, s) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3

// ความคืบหน้าของมุม (0–1) ที่เวลา x (0–1)
export const progressAt = (x, [x1, y1, x2, y2] = TURN_EASING) => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (bez(x1, x2, mid) < x) lo = mid
    else hi = mid
  }
  return bez(y1, y2, (lo + hi) / 2)
}

// เวลา (0–1) ที่มุมหมุนถึง p ของการพลิกทั้งหมด (p = 0.5 คือ 90° ของ 180°)
export const timeAtProgress = (p, [x1, y1, x2, y2] = TURN_EASING) => {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (bez(y1, y2, mid) < p) lo = mid
    else hi = mid
  }
  return bez(x1, x2, (lo + hi) / 2)
}

export const easingCss = (e = TURN_EASING) => `cubic-bezier(${e.join(', ')})`
