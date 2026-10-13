import { reactive } from 'vue'

// ค่าของหยดสีอุ่น (SPEC §6.4) เป็น reactive เพื่อให้แผง dev (?debug) ปรับสดได้ ไม่เปิดแผง = ใช้ค่าตั้งต้นนี้
export const WARM_DEFAULTS = {
  size: 0.4, // รัศมีหยดสีอุ่น (splatRadius) เทียบ "เติมหยด" ของ sad ที่ 0.18 × 3 = 0.54 (ลดจาก 0.5: แตะน้อยช่องลง)
  strength: 1, // ตัวคูณความเข้มสีอุ่น ยังผ่านตัวกันสีสะสม INK_CAP
  samples: 4, // จำนวนหยดตัวอย่างของ "ลองดู"
  noteDelay: 10, // วินาที: โน้ตชวนขึ้นเมื่อครบเท่านี้นับจาก pointerdown ครั้งแรกของแผ่น
  noteIdle: 1.5, // วินาที: และพักมือ (ไม่มี pointerdown/ปุ่มกดค้าง) นานเท่านี้
}
export const warmTune = reactive({ ...WARM_DEFAULTS })

// ตัวนับของโน้ตชวน FluidCanvas เขียนเฉพาะตอน ?debug (dev) แผง dev อ่านไปแสดง
export const noteDebug = reactive({ elapsed: '-', idle: '-' })

// ชื่อ event ที่แผง dev ส่งให้ FluidCanvas (dev เท่านั้น)
export const DEV_PARAMS_EVENT = 'colorscrap:params'
// แผง dev สั่งให้ FluidCanvas เริ่มนับโน้ตของแผ่นปัจจุบันใหม่ (ไม่ล้างภาพ)
export const DEV_NOTE_RESET_EVENT = 'colorscrap:note-reset'

// ข้อมูลที่ไลบรารีน้ำไหลใช้งานจริง (อ่านกลับจากตัวไลบรารีตอน ?debug) แผง dev เอาไปโชว์ให้ตรวจบน iPad
export const fluidInfo = reactive({ webgl: '-', format: '-', texType: '-', linear: '-', density: '-', velocity: '-', dyeRes: '-', simRes: '-', canvas: '-', state: '-', speed: '-' })
