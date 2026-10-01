// ตำแหน่งภาพบนหน้าซ้าย: ชุด slot คงที่ 4 ตำแหน่งต่อแผ่น (SPEC §5.5) พิกัดอิงหน้าซ้าย 492×612
// แผ่นแรกคือตัวหน้ากระดาษเอง (หัวหน้าสูงกว่า ภาพเริ่มที่ y=112)
export const FIRST_LEAF_SLOTS = [
  { x: 30, y: 112 },
  { x: 262, y: 124 },
  { x: 40, y: 330 },
  { x: 262, y: 344 },
]

// แผ่นแทรก (กระดาษ 470×548 ที่ offset (8, 18)) พิกัดอิงตัวกระดาษแทรก
export const INSERT_LEAF_SLOTS = [
  { x: 26, y: 112 },
  { x: 250, y: 140 },
  { x: 26, y: 330 },
  { x: 250, y: 344 },
]

// แฮชจาก id ให้ได้มุมเอียงเดิมทุกครั้ง (SPEC §5.5)
const hash = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// มุมเอียงของภาพ -3° ถึง 3° และของเทป -5° ถึง 5°
export const photoRotation = (id) => ({
  rotate: Math.round(((hash(id) % 61) / 10 - 3) * 10) / 10,
  tape: Math.round((((hash(id) >> 5) % 101) / 10 - 5) * 10) / 10,
})
