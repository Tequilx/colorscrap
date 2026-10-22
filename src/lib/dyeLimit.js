// ตัวกันดำที่ GPU (แทนแผนที่ ink ฝั่ง CPU): จำกัดค่า dye ที่ "พิกเซล" ตอนลงสี ไม่ใช่ตอนตัดสินใจหยด
// แผนที่ ink ประเมินสูงกว่าสีจริง (นับค่าสูงสุดที่เป็นไปได้ต่อช่อง 80px และไม่ตามสีที่น้ำพาไป) จึงบล็อกหยดทั้งที่สีบนผ้าใบยังไม่เต็ม
// (วัดแล้ว: ระบายเต็ม 30 วินาที แตะ 20 จุด 16 จุดไม่มีสีออก ทั้งที่สีจริงตรงจุด ≤ 0.57 จากเพดาน 0.85 ดู SPEC §6.3)
// shader อ่าน dye เดิมของพิกเซลนั้นแล้วลงสีเพิ่มเท่าที่ไม่ทะลุ 2 เงื่อนไขพร้อมกัน:
//   ก. ช่องสีที่สูงสุดไม่เกิน cap
//   ข. ความสว่างที่แสดงผลจริง (≈ ความสว่างของกระดาษ − dye) ไม่ต่ำกว่า minLight ไม่ว่าจะผสมสีอะไร (กันสีตรงข้ามผสมกันเป็นเทาดำ)
// ทั้งสองข้อเป็นแบบนุ่มนวล: ต่ำกว่า knee ลงสีเต็มตามที่ขอ เกินแล้วเข้าใกล้เพดานแบบเอ็กซ์โพเนนเชียล ไม่ตัดกึก (ฟังก์ชันเดียวกับ GLSL ด้านล่าง)
// metric m = ค่าที่วัด ÷ เพดาน (1 = ถึงเพดาน) m0 = ก่อนลงสี, m1 = ถ้าลงเต็มที่ขอ → m ใหม่ = u0 + H(1 − e^(−(ส่วนเกิน knee)/H)) โดย H = 1 − u0
// แล้ว s = (m ใหม่ − m0) ÷ (m1 − m0) คือสัดส่วนของสีที่ขอที่ลงจริง (ไม่ลดสีเดิม ไม่เกิน 1)

export const DYE_LIMIT = { cap: 0.85, minLight: 0.3, knee: 0.8 }
// ความสว่างของกระดาษ (ค่าถ่วงน้ำหนัก rec.709 ของ PALETTE.paper #FBFAF6) ใช้หา "ความมืดสูงสุดที่ยอมได้" dmax = paperLight − minLight
export const PAPER_LIGHT = 0.9796
const LUMA = [0.2126, 0.7152, 0.0722]

const softAdd = (m0, m1, knee) => {
  if (m1 <= m0 + 1e-6) return 1
  if (m1 <= knee) return 1
  const u0 = Math.max(m0, knee)
  const h = 1 - u0
  if (h <= 1e-5) return 0 // ถึงเพดานแล้ว ไม่ลงเพิ่ม (ไม่ใส่พื้นขั้นต่ำ ไม่งั้นแตะซ้ำค่อย ๆ ทะลุ)
  const over = m1 - u0
  const m = u0 + h * (1 - Math.exp(-over / h))
  return Math.min(1, Math.max(0, (m - m0) / (m1 - m0)))
}

const maxOf = (c) => Math.max(c[0], c[1], c[2])
const dark = (c) => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]

// ต้นแบบ JS ของ shader (ใช้ทดสอบหน่วย) base/add = dye RGB (0..) ของพิกเซลก่อนลงสี/สีที่ขอลง คืนสัดส่วน 0..1
export const limitScale = (base, add, { cap = DYE_LIMIT.cap, minLight = DYE_LIMIT.minLight, knee = DYE_LIMIT.knee } = {}) => {
  const cand = [base[0] + add[0], base[1] + add[1], base[2] + add[2]]
  const dmax = Math.max(1e-3, PAPER_LIGHT - minLight)
  const sA = softAdd(maxOf(base) / cap, maxOf(cand) / cap, knee)
  const sB = softAdd(dark(base) / dmax, dark(cand) / dmax, knee)
  return Math.min(sA, sB)
}

// ความสว่างที่เห็นของ dye หนึ่งค่า (ประมาณ: กระดาษ − dye รายช่องแล้วถ่วงน้ำหนัก)
export const visibleLight = (dye) => PAPER_LIGHT - dark(dye)

// fragment shader: ลง dye แบบ Gaussian (เหมือน splat ของไลบรารี) แต่คูณด้วย s ที่คำนวณจาก dye เดิมของพิกเซล
// เขียนแบบ GLSL ES 1.00 (ไม่มี loop/ไม่ใช้ฟังก์ชัน ES 3.00) ใช้ได้ทั้ง WebGL1 และ WebGL2 ผลลัพธ์ half float
export const DYE_SPLAT_FRAG = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
uniform float cap;
uniform float dmax;
uniform float knee;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float softAdd (float m0, float m1) {
  if (m1 <= m0 + 0.000001) return 1.0;
  if (m1 <= knee) return 1.0;
  float u0 = max(m0, knee);
  float h = 1.0 - u0;
  if (h <= 0.00001) return 0.0;
  float m = u0 + h * (1.0 - exp(-(m1 - u0) / h));
  return clamp((m - m0) / (m1 - m0), 0.0, 1.0);
}
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 add = exp(-dot(p, p) / radius) * color;
  vec3 base = texture2D(uTarget, vUv).xyz;
  vec3 cand = base + add;
  float sA = softAdd(max(base.r, max(base.g, base.b)) / cap, max(cand.r, max(cand.g, cand.b)) / cap);
  float sB = softAdd(dot(base, LUMA) / dmax, dot(cand, LUMA) / dmax);
  gl_FragColor = vec4(base + add * min(sA, sB), 1.0);
}`
