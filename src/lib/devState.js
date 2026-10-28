import { reactive } from 'vue'

// ค่าของหยดเติมสีสดใส (SPEC §6.4) เป็น reactive ให้แผง dev (?debug) ปรับสดได้ ไม่เปิดแผง = ใช้ค่าตั้งต้นนี้
const WARM_DEFAULTS = {
  size: 0.4, // รัศมีหยดเติมสีสดใส (splatRadius) เทียบกับหยดของ sad ที่ 0.54
  strength: 2, // ตัวคูณความเข้มของสีที่เติม (ค่าต่ำเกินไปสีจางเป็นเทาบนรอยสีเข้ม)
  samples: 4, // จำนวนหยดตัวอย่างของ "ลองดู"
  noteDelay: 10, // วินาที: โน้ตชวนขึ้นเมื่อครบเท่านี้นับจาก pointerdown ครั้งแรกของแผ่น
  noteIdle: 1.5, // วินาที: และพักมือ (ไม่มี pointerdown/ปุ่มกดค้าง) นานเท่านี้
  // เติมสีแบบบาน (bloom): หยดดันสีเดิมออกเป็นขอบเข้ม ยกสีกลางวงให้จาง แล้วสีใหม่บานตรงกลาง
  bloom: true, // เปิด/ปิดการบาน (ปิด = หยดเดี่ยวเรียบ) ใช้เฉพาะอารมณ์ใน WARM_BLOOM (lib/emotions.js)
  lift: 0.7, // ความแรงยกสีเดิมกลางวง: เหลือ (1 − ค่านี้) ของสีเดิม (0–1)
  liftRadius: 0.75, // รัศมีวงยกสีเทียบ size
  rim: 1.5, // ความเข้มของขอบ: สีที่ยกออกกองเป็นวงรอบนอก (สัดส่วนของ lift)
  push: 120, // แรงดันน้ำออกจากกลางวง (ทำให้สีเดิมกองเป็นขอบเข้ม)
  bloomMs: 3000, // ความยาวเส้นโค้งการบาน (ms): ขึ้นสูงสุดที่ ~250ms แล้วลดเป็นเส้นตรงถึงศูนย์ที่ท้ายเส้น
  bloomPeak: 1, // ความแรงสูงสุดของเส้นโค้ง (ตัวคูณปริมาณรวม 1 = ตามค่าที่ตั้งไว้)
}
export const warmTune = reactive({ ...WARM_DEFAULTS })

// ตัวนับของโน้ตชวน FluidCanvas เขียนเฉพาะตอน ?debug (dev) แผง dev อ่านไปแสดง
export const noteDebug = reactive({ elapsed: '-', idle: '-' })

// ชื่อ event ที่แผง dev ส่งให้ FluidCanvas (dev เท่านั้น)
export const DEV_PARAMS_EVENT = 'colorscrap:params'
// แผง dev สั่งให้ FluidCanvas เริ่มนับโน้ตของแผ่นปัจจุบันใหม่ (ไม่ล้างภาพ)
export const DEV_NOTE_RESET_EVENT = 'colorscrap:note-reset'

// ข้อมูลที่ไลบรารีน้ำไหลใช้จริง (อ่านกลับตอน ?debug) แผง dev โชว์ให้ตรวจบน iPad
export const fluidInfo = reactive({ webgl: '-', format: '-', texType: '-', linear: '-', density: '-', velocity: '-', dyeRes: '-', simRes: '-', canvas: '-', state: '-', speed: '-' })
