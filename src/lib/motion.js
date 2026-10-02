// ตัวช่วยการเคลื่อนไหว (SPEC §3.6, §5.4): prefers-reduced-motion แบบ reactive และเวลาของลำดับแอนิเมชันฝั่ง JS
import { ref } from 'vue'
import { MOTION } from '@/lib/tokens'

const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')

// ผู้ใช้สลับค่านี้กลางเซสชันได้ จึงฟัง change ไม่อ่านครั้งเดียว
export const reducedMotion = ref(Boolean(query?.matches))
query?.addEventListener?.('change', (e) => {
  reducedMotion.value = e.matches
})

// dev เท่านั้น: เปิดหน้าด้วย ?motion=slow ให้ทุกแอนิเมชันช้าลง 3 เท่า (CSS ใช้ --motion-scale, JS ใช้ ms())
export const TIME_SCALE = import.meta.env.DEV && new URLSearchParams(location.search).get('motion') === 'slow' ? 3 : 1
if (TIME_SCALE !== 1) document.documentElement.style.setProperty('--motion-scale', String(TIME_SCALE))

// เวลาของขั้นหนึ่ง: reduced → ไม่เกิน 150ms, ปกติ → คูณตาม TIME_SCALE
export const ms = (n) => (reducedMotion.value ? Math.min(n, MOTION.fade) : n * TIME_SCALE)

export const sleep = (n) => new Promise((resolve) => setTimeout(resolve, ms(n)))

// ค่าเวลา CSS ที่คูณ --motion-scale (?motion=slow) ใช้กับ var ใน style ของคอมโพเนนต์
export const scaled = (n) => `calc(${n}ms * var(--motion-scale, 1))`
