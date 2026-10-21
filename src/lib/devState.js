import { reactive } from 'vue'

// ค่าของหยดสีอุ่น (SPEC §6.4) เป็น reactive เพื่อให้แผง dev (?debug) ปรับสดได้ ไม่เปิดแผง = ใช้ค่าตั้งต้นนี้
export const WARM_DEFAULTS = {
  size: 0.4, // รัศมีหยดสีอุ่น (splatRadius) เทียบ "เติมหยด" ของ sad ที่ 0.18 × 3 = 0.54 (ลดจาก 0.5: แตะน้อยช่องลง)
  strength: 2, // ตัวคูณความเข้มสีอุ่น (เดิม 1: บนรอยสีเข้มที่ยกสีแล้ว สีอุ่นจางเกินไปจนเป็นเทา วัดแล้ว 2 เห็นเหลืองชัดทั้งเศร้า/เหนื่อย)
  samples: 4, // จำนวนหยดตัวอย่างของ "ลองดู"
  noteDelay: 10, // วินาที: โน้ตชวนขึ้นเมื่อครบเท่านี้นับจาก pointerdown ครั้งแรกของแผ่น
  noteIdle: 1.5, // วินาที: และพักมือ (ไม่มี pointerdown/ปุ่มกดค้าง) นานเท่านี้
  // สีอุ่นแบบบาน (bloom / backrun ของสีน้ำจริง SPEC §6.4): หยดสีอุ่นดันสีเดิมออกเป็นวงขอบเข้ม ยกสีเดิมกลางวงให้จาง แล้วสีอุ่นเบ่งบานตรงกลาง
  bloom: true, // สวิตช์รวม (ปิด = หยดสีอุ่นเดี่ยวแบบเรียบ) การบานเปิดเฉพาะอารมณ์ใน WARM_BLOOM (lib/emotions.js)
  lift: 0.7, // ความแรงยกสี: กลางวงเหลือ (1 − ค่านี้) ของ dye เดิม
  liftRadius: 0.75, // รัศมีวงยกสีเทียบ size
  rim: 1.5, // ความเข้มของขอบ: สีที่ยกออกกองเป็นวงรอบนอก (สัดส่วนของ lift)
  push: 120, // แรงดันน้ำออกจากกลางวง (ทำให้สีเดิมกองเป็นขอบเข้ม)
  bloomMs: 3000, // ความยาวเส้นโค้งการบาน (ms): ขึ้นสูงสุดที่ ~250ms แล้วลดเป็นเส้นตรงถึงศูนย์ที่ท้ายเส้น (รวมช่วงประคองกลางวง) ลดการเคลื่อนไหว = ทำทีเดียว
  bloomPeak: 1, // ความแรงสูงสุดของเส้นโค้ง (ตัวคูณปริมาณสีอุ่นรวม 1 = เท่าที่ปรับไว้)
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
