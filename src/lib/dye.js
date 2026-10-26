// สีของผ้าใบ: webgl-fluid-enhanced เก็บสีเป็น "แสงบวก" (dye) และสุ่มสีจาก hue/saturation ของ colorPalette
// ส่วนความสว่าง (V) ใช้ค่า brightness ค่าเดียว แล้วคูณ 1.5 (0.15 × 10) เราจึงเปิด inverted (CSS invert) ให้เป็นสีลบแบบสีน้ำ
// สีที่เห็นบนกระดาษ = 1 − dye ดังนั้นต้องแปลงสีเป้าหมายเป็น dye ก่อน
import { hexToRgb, rgbToHex } from '@/lib/color'

// พื้นกระดาษใน canvas ที่กลับสีแล้ว (ใช้เป็น backgroundColor ของไลบรารี) ให้ผลลัพธ์หลัง invert เป็นสีกระดาษ
export const invertedHex = (hex) => rgbToHex(hexToRgb(hex).map((v) => 255 - v))
