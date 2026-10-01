// สีของผ้าใบ: webgl-fluid-enhanced เก็บสีเป็น "แสงบวก" (dye) และสุ่มสีจาก hue/saturation ของ colorPalette
// ส่วนความสว่าง (V) ใช้ค่า brightness ค่าเดียว แล้วคูณ 1.5 (0.15 × 10) เราจึงเปิด inverted (CSS invert) ให้เป็นสีลบแบบสีน้ำ
// สีที่เห็นบนกระดาษ = 1 − dye ดังนั้นต้องแปลงสีเป้าหมายเป็น dye ก่อน
import { hexToRgb, rgbToHex } from '@/lib/color'

const LIB_GAIN = 1.5

// คืน { hex, brightness } สำหรับตั้ง colorPalette = [hex] และ brightness ก่อนเรียก splatAtLocation (ไม่ส่ง hex เข้าไลบรารีโดยตรง
// เพราะมันคูณค่า 0–255 ด้วย 10 ทำให้สีล้น) strength คูณความเข้มของ dye (ใช้กับ intensity)
export const dyeSetting = (hex, strength = 1) => {
  const dye = hexToRgb(hex).map((v) => 1 - v / 255)
  const peak = Math.max(...dye)
  if (peak < 0.01) return null // ขาวล้วน = ไม่มีสี
  return { hex: rgbToHex(dye.map((v) => (v / peak) * 255)), brightness: (peak * strength) / LIB_GAIN }
}

// พื้นกระดาษใน canvas ที่กลับสีแล้ว (ใช้เป็น backgroundColor ของไลบรารี) ให้ผลลัพธ์หลัง invert เป็นสีกระดาษ
export const invertedHex = (hex) => rgbToHex(hexToRgb(hex).map((v) => 255 - v))
