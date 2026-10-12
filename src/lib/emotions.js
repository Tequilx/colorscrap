// ข้อมูลอารมณ์ 8 แบบ (SPEC §3.2, §11.1) สีดึงจาก tokens.js ที่เดียว
import { EMOTION_COLORS } from '@/lib/tokens'
import { mixRgb } from '@/lib/color'

const DOT_EYES = 'M38 46 L38 46.1 M62 46 L62 46.1'

// path ใบหน้าอยู่ใน viewBox 0 0 100 100
const FACES = {
  happy: { eyes: DOT_EYES, eyeW: 6.5, brows: '', mouth: 'M38 60 Q50 71 62 60', mouthFill: 'none' },
  calm: { eyes: 'M33 46 Q38 50 43 46 M57 46 Q62 50 67 46', eyeW: 2.4, brows: '', mouth: 'M40 62 Q50 66 60 62', mouthFill: 'none' },
  excited: { eyes: DOT_EYES, eyeW: 6.5, brows: '', mouth: 'M38 58 Q50 76 62 58 Z', mouthFill: 'ink' },
  warm: { eyes: DOT_EYES, eyeW: 6.5, brows: '', mouth: 'M40 60 Q50 68 60 60', mouthFill: 'none' },
  sad: { eyes: DOT_EYES, eyeW: 6.5, brows: '', mouth: 'M40 67 Q50 58 60 67', mouthFill: 'none' },
  angry: { eyes: DOT_EYES, eyeW: 6.5, brows: 'M32 36 L43 40 M68 36 L57 40', mouth: 'M40 65 L60 65', mouthFill: 'none' },
  anxious: { eyes: DOT_EYES, eyeW: 6.5, brows: '', mouth: 'M37 64 Q41.3 59 45.6 64 T54.2 64 T62.8 64', mouthFill: 'none' },
  tired: { eyes: 'M33 47 L43 47 M57 47 L67 47', eyeW: 2.4, brows: '', mouth: 'M43 64 L57 64', mouthFill: 'none' },
}

const META = {
  happy: { th: 'สุขใจ', pigment: 'Hansa Yellow' },
  calm: { th: 'สงบ', pigment: 'Cerulean Blue' },
  excited: { th: 'ตื่นเต้น', pigment: 'Quinacridone Rose' },
  warm: { th: 'อบอุ่นใจ', pigment: 'Raw Sienna' },
  sad: { th: 'เศร้า', pigment: 'Ultramarine' },
  angry: { th: 'โกรธ', pigment: 'Pyrrol Red' },
  anxious: { th: 'กังวล', pigment: 'Dioxazine Violet' },
  tired: { th: 'เหนื่อย', pigment: "Payne's Grey" },
}

export const EMOTION_KEYS = Object.keys(META)

export const EMOTIONS = EMOTION_KEYS.map((key) => ({
  key,
  ...META[key],
  hex: EMOTION_COLORS[key],
  face: FACES[key],
}))

export const EMOTION_BY_KEY = Object.fromEntries(EMOTIONS.map((e) => [e.key, e]))

// ชื่ออารมณ์ของภาพสำหรับคำบรรยาย: "อารมณ์แรก → อารมณ์ล่าสุด" ถ้าแผ่นนั้นเปลี่ยนอารมณ์ ไม่งั้นชื่ออารมณ์เดียว (SPEC §5.5)
export const emotionLabel = (entry) => {
  const first = entry.emotions?.[0] ?? entry.emotion
  const last = entry.emotion
  return first === last ? EMOTION_BY_KEY[last].th : `${EMOTION_BY_KEY[first].th} → ${EMOTION_BY_KEY[last].th}`
}

// จำนวนหยดเริ่มต้นตอนเข้าหน้า paint (SPEC §6.3) ค่าตั้งต้นปรับจูนได้ และตัวคูณตามความเข้ม
export const INITIAL_SPLATS = { happy: 5, calm: 3, excited: 3, warm: 3, sad: 3, angry: 3, anxious: 6, tired: 2 }
export const INTENSITY_FACTOR = [0.6, 1, 1.5]

// พารามิเตอร์ fluid ตามอารมณ์ (SPEC §6.3) ค่าตั้งต้น ปรับจูนได้
// brightness = ตัวคูณความเข้มของ dye (1 = จุดศูนย์กลางหยดแรกได้สีเท่า hex ของอารมณ์ เกิน 1 = เข้มกว่า) จูนต่ออารมณ์ให้สีบนผ้าใบใกล้ hex
// (ค่าสูงสุดที่มีผลคือ INK_CAP ÷ ค่าสีสูงสุดของ hex นั้น ~1.1 แดง ถึง ~1.4 ชมพู เกินกว่านั้นถูกตัดที่เพดาน)
// speed = ตัวคูณความเร็วหยด, velDiss = velocityDissipation (ยิ่งมาก การไหลหยุดเร็ว ~1/velDiss วินาทีต่อรอบ), radius = ขนาดหยด (splatRadius ของไลบรารี)
// pattern: burst กระจายรอบทิศ | drift ไหลช้า | fall ไหลลง (มีแรงถ่วง) | pulse พุ่งเป็นจังหวะ | scatter จุดเล็กทั่วกระดาษ | still แทบนิ่ง
export const FLUID_PARAMS = {
  happy: { brightness: 1.2, speed: 0.5, curl: 9, velDiss: 2.0, radius: 0.15, pattern: 'burst' },
  calm: { brightness: 1.15, speed: 0.3, curl: 3, velDiss: 1.2, radius: 0.2, pattern: 'drift' },
  excited: { brightness: 1.4, speed: 0.6, curl: 8, velDiss: 2.5, radius: 0.15, pattern: 'burst' },
  warm: { brightness: 1.2, speed: 0.45, curl: 6, velDiss: 1.2, radius: 0.22, pattern: 'burst' },
  sad: { brightness: 1.15, speed: 0.3, curl: 4, velDiss: 1.4, radius: 0.18, pattern: 'fall' },
  angry: { brightness: 1.1, speed: 0.6, curl: 7, velDiss: 2.5, radius: 0.13, pattern: 'pulse' },
  anxious: { brightness: 1.2, speed: 0.4, curl: 5, velDiss: 2.2, radius: 0.09, pattern: 'scatter' },
  tired: { brightness: 1.1, speed: 0.1, curl: 2, velDiss: 1.6, radius: 0.2, pattern: 'still' },
}

// สีน้ำที่แห้งติดกระดาษ: สีไม่จางเลย ต้องเป็น 0 พอดี (ไม่ใช่ค่าเล็ก ๆ)
// เพราะบัฟเฟอร์สีของไลบรารีเป็นเลข 16 บิต (half float) ทุกเฟรมที่หารด้วย 1 + ค่า × dt ผลลัพธ์ถูกปัดลงอย่างน้อย 1 หน่วยเล็กสุด
// ค่าตั้งแต่ ~0.0001 ถึง 0.002 จึงทำให้สีหายหมดใน ~1 นาที (วัดแล้ว ปริมาณสีเหลือ ~9%) ส่วน 0 ไม่ปัดเลย (วัดแล้วเหลือ ~97%)
// ความต่างของแต่ละอารมณ์อยู่ที่ curl กับ velDiss (SPEC §6.3)
export const DENSITY_DISSIPATION = 0

// กันสีสะสมจนดำ: ผ้าใบไม่จางแล้ว หยดซ้ำที่เดิมจึงบวกกันไม่หยุด FluidCanvas จึงจำปริมาณสีที่ลงในแต่ละช่อง (ขนาด INK_CELL px)
// หน่วยคือ "ค่าสีสูงสุดของช่องสีใดช่องหนึ่งในบัฟเฟอร์" (0 = ไม่มีสี, 1 = ดูดแสงสีนั้นหมด = ดำสนิท) และจำกัดตอน splat จริง:
// ปริมาณรวมต่อช่องไม่เกิน INK_CAP (หยดที่เหลือที่ว่างไม่พอจะถูกลดแรงลงให้พอดีเพดาน) 0.85 ≈ เข้มสุดที่ยังเห็นเป็นสี ไม่ดำ
export const INK_CELL = 80
export const INK_CAP = 0.85

// ค่ากลางที่แผง ?debug ปรับสดได้ (FluidCanvas อ่านจากที่นี่ ไม่อ่านค่าคงที่ข้างบนโดยตรง)
export const FLUID_GLOBAL = { density: DENSITY_DISSIPATION, inkCap: INK_CAP }

// ค่าเริ่มต้นทั้งหมด (สำเนาตอนโหลดโมดูล) ให้ปุ่ม "รีเซ็ตเป็นค่าเริ่มต้น" ในแผง ?debug คืนค่า
const clone = (o) => JSON.parse(JSON.stringify(o))
const FLUID_DEFAULTS = { params: clone(FLUID_PARAMS), splats: clone(INITIAL_SPLATS), global: clone(FLUID_GLOBAL) }
export const defaultsOf = (key) => ({ ...FLUID_DEFAULTS.params[key], splats: FLUID_DEFAULTS.splats[key] })
export const resetEmotionParams = (key) => {
  Object.assign(FLUID_PARAMS[key], FLUID_DEFAULTS.params[key])
  INITIAL_SPLATS[key] = FLUID_DEFAULTS.splats[key]
}
export const resetFluidGlobal = () => Object.assign(FLUID_GLOBAL, FLUID_DEFAULTS.global)

// อารมณ์ด้านลบ ใช้กับการปรับโทน (SPEC §6.4)
export const NEGATIVE_EMOTIONS = ['sad', 'angry', 'anxious', 'tired']

export const INTENSITY_LABELS = ['นิดหน่อย', 'พอประมาณ', 'มากเลย']

// สีของแต่ละอารมณ์ 3 ระดับสำหรับ fluid (SPEC §3.2)
export const emotionShades = (key) => {
  const hex = EMOTION_COLORS[key]
  return {
    deep: mixRgb(hex, '#1a1a22', 0.35), // ขอบเข้ม
    base: hex, // เนื้อสี
    light: mixRgb(hex, '#ffffff', 0.6), // สีจาง
  }
}

// สีปลายทางเมื่ออารมณ์ลบถูกปรับไปทางบวก (SPEC §3.2)
export const SHIFT_TARGETS = {
  sad: ['#5FA3C8', '#F7DE99'],
  angry: ['#E2688A', '#F4C9A2'],
  anxious: ['#5FA3C8', '#B9D7A4'],
  tired: ['#9CC3D8', '#F7DE99'],
}

// ไล่สีของไอคอนหยดสีอุ่น: เหลือง (สีสุดท้ายของ sad/tired) → พีช (สีสุดท้ายของ angry)
export const WARM_GRADIENT = [SHIFT_TARGETS.sad[1], SHIFT_TARGETS.angry[1]]
