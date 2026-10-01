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
