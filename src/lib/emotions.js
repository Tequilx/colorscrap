// ข้อมูลอารมณ์ 8 แบบ (SPEC §3.2, §11.1) สีดึงจาก tokens.js ที่เดียว
import { EMOTION_COLORS } from '@/lib/tokens'
import { mixRgb } from '@/lib/color'
import { DYE_LIMIT } from '@/lib/dyeLimit'

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
// splash = ตัวคูณจำนวนหยดตอนสาดของอารมณ์นี้ [นิดหน่อย, พอประมาณ, มากเลย] (คูณกับ SPLASH_LEVELS) ใช้ปรับให้พื้นที่หลังสาดของแต่ละอารมณ์ใกล้เป้าเดียวกัน (อารมณ์ที่น้ำพาสีไปไกลอย่างตื่นเต้นใช้ค่าน้อยกว่า)
// ค่าไหล (brightness/speed/curl/velDiss/radius/pattern) เท่ากับ main ทุกตัว ความต่างจาก main คือ splash กับการแห้งของน้ำ (FLUID_GLOBAL.flowTime/dryTime)
// pattern: burst กระจายรอบทิศ | drift ไหลช้า | fall ไหลลง (มีแรงถ่วง) | pulse พุ่งเป็นจังหวะ | scatter จุดเล็กทั่วกระดาษ | still แทบนิ่ง
export const FLUID_PARAMS = {
  happy: { brightness: 2.0, speed: 1.3, curl: 18, velDiss: 0.35, radius: 0.15, splash: [1.06, 0.65, 0.43], pattern: 'burst' },
  calm: { brightness: 1.8, speed: 0.5, curl: 6, velDiss: 0.5, radius: 0.2, splash: [1.01, 0.92, 0.76], pattern: 'drift' },
  excited: { brightness: 2.0, speed: 1.4, curl: 30, velDiss: 0.3, radius: 0.12, splash: [0.62, 0.42, 0.33], pattern: 'burst' },
  warm: { brightness: 2.0, speed: 1, curl: 12, velDiss: 0.4, radius: 0.22, splash: [0.93, 0.71, 0.67], pattern: 'burst' },
  sad: { brightness: 1.7, speed: 0.5, curl: 8, velDiss: 0.5, radius: 0.18, splash: [0.92, 0.8, 0.78], pattern: 'fall' },
  angry: { brightness: 2.0, speed: 1.3, curl: 26, velDiss: 0.3, radius: 0.13, splash: [1.04, 0.73, 0.64], pattern: 'pulse' },
  anxious: { brightness: 1.9, speed: 1, curl: 22, velDiss: 0.35, radius: 0.09, splash: [0.77, 0.75, 0.54], pattern: 'scatter' },
  tired: { brightness: 1.6, speed: 0.2, curl: 4, velDiss: 0.55, radius: 0.2, splash: [0.55, 0.52, 0.3], pattern: 'still' },
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
// เพดานของสีอุ่นแยกจากสีอารมณ์ และตรวจเฉพาะช่องที่หยดตก (ไม่ใช่ทุกช่องที่แตะ): ผู้ใช้เป็นคนหยดเอง ต้องเห็นสีอุ่นแม้ทับรอยสีเข้ม
// แผนที่ ink ประเมินสูงกว่าสีจริง (นับค่าสูงสุดที่เป็นไปได้ในช่อง ไม่ตามสีที่น้ำพาไป) เพดาน 1.1 จึงยังไม่ดำ (วัดแล้ว ดู SPEC §6.4)
export const WARM_INK_CAP = 1.1

// ค่ากลางที่แผง ?debug ปรับสดได้ (FluidCanvas อ่านจากที่นี่ ไม่อ่านค่าคงที่ข้างบนโดยตรง)
// การสาดตอนเข้าหน้า paint แยกตามระดับอารมณ์ (นิดหน่อย / พอประมาณ / มากเลย) แยกจาก INTENSITY_FACTOR ที่ยังคุมความเข้มสีต่อหยด
// count = ตัวคูณจำนวนหยด (คูณ INITIAL_SPLATS ของอารมณ์) size = ตัวคูณขนาดหยด spread = ตัวคูณระยะกระจายของตำแหน่ง (1 = ช่วง 15–85% ของกระดาษ)
export const SPLASH_LEVELS = [
  { count: 1.5, size: 1.2, spread: 1.15 },
  { count: 3.0, size: 1.5, spread: 1.25 },
  { count: 4.8, size: 2.2, spread: 1.35 },
]

// splashMs = ช่วงเวลาที่หยดตอนสาดทยอยลง (ms) ไม่ลงพร้อมกันทั้งหมด
// สีน้ำที่ค่อย ๆ แห้ง (ดู FluidCanvas): flowTime = วินาทีหลัง input ล่าสุดที่น้ำไหลปกติ (velDiss ของอารมณ์) หลังจากนั้นเพิ่ม velocityDissipation
// แบบ ease-in-out จนถึง dryDamp ที่ dryTime วินาที (นับจาก input ล่าสุด) น้ำจึงสงบเอง ไม่แตะ density จึงไม่ทำให้สีจาง
// ตัวกันดำ: 'gpu' = จำกัด dye ที่พิกเซลใน shader ลงสี (gpuCap/minLight/knee ดู lib/dyeLimit.js) 'cpu' = แบบเก่า (แผนที่ ink บล็อกหยด inkCap/warmCap)
// สวิตช์ใน ?debug ไว้เทียบ จะลบแบบเก่าทีหลัง
export const FLUID_GLOBAL = { blackGuard: 'gpu', gpuCap: DYE_LIMIT.cap, minLight: DYE_LIMIT.minLight, knee: DYE_LIMIT.knee, density: DENSITY_DISSIPATION, inkCap: INK_CAP, warmCap: WARM_INK_CAP, splashMs: 1000, flowTime: 2.5, dryTime: 10, dryDamp: 6 }

// ค่าเริ่มต้นทั้งหมด (สำเนาตอนโหลดโมดูล) ให้ปุ่ม "รีเซ็ตเป็นค่าเริ่มต้น" ในแผง ?debug คืนค่า
const clone = (o) => JSON.parse(JSON.stringify(o))
const FLUID_DEFAULTS = { params: clone(FLUID_PARAMS), splats: clone(INITIAL_SPLATS), global: clone(FLUID_GLOBAL), splash: clone(SPLASH_LEVELS) }
export const defaultsOf = (key) => ({ ...FLUID_DEFAULTS.params[key], splats: FLUID_DEFAULTS.splats[key] })
export const resetEmotionParams = (key) => {
  Object.assign(FLUID_PARAMS[key], clone(FLUID_DEFAULTS.params[key])) // clone: ค่า splash เป็น array ห้ามอ้างอิงตัวเดียวกับค่าเริ่มต้น
  INITIAL_SPLATS[key] = FLUID_DEFAULTS.splats[key]
}
export const resetFluidGlobal = () => {
  Object.assign(FLUID_GLOBAL, FLUID_DEFAULTS.global)
  FLUID_DEFAULTS.splash.forEach((level, i) => Object.assign(SPLASH_LEVELS[i], { ...level }))
}

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

// สีอุ่นของเครื่องมือ "สีอุ่น" (SPEC §3.2, §6.4): สีเดียวต่ออารมณ์ ไม่สลับสี ทุกหยดของอารมณ์นั้นต่างกันแค่ความอ่อนเข้มเล็กน้อย (warmShade)
// เดิมเป็นลำดับ "สีสะพาน → สีอุ่น" (SHIFT_TARGETS) ที่สลับสีทุกครั้งที่หยด ทำให้ครั้งเว้นครั้งเป็นฟ้า/ชมพูทับรอยสีเดิม ดูเป็นสีเย็นเข้มขึ้น
// โกรธ: ครีมทอง (ไม่มีแดง/ชมพูปน เพราะพีชทับสีแดงของโกรธกลายเป็นส้มแดงเข้มกว่าเดิม) กังวล: เหลืองอ่อนอมส้ม (เขียวอ่อนเดิมไม่ใช่โทนอุ่น)
export const WARM_TONES = {
  sad: '#F7DE99', // เหลืองทอง (เดิม)
  tired: '#F7DE99', // เหลืองทอง (เดิม)
  angry: '#F3DEA3', // ครีมทอง
  anxious: '#F8D68E', // เหลืองอ่อนอมส้ม
}

// เฉดของหยดที่ n ของแผ่น: วนสามเฉด ปกติ → อ่อนลงนิดหน่อย → เข้มขึ้นนิดหน่อย (สีเดียวกัน ไม่เปลี่ยน hue)
export const warmShade = (hex, n) => {
  const k = n % 3
  if (k === 1) return mixRgb(hex, '#FFFFFF', 0.18)
  if (k === 2) return mixRgb(hex, '#D9A33F', 0.22)
  return hex
}

// อารมณ์ที่เปิด "สีอุ่นแบบบาน" (SPEC §6.4) เปิดเฉพาะอารมณ์ที่ผ่านเกณฑ์การบานบนตัวกันดำแบบ GPU
export const WARM_BLOOM = { sad: true, tired: true, angry: true, anxious: true }
