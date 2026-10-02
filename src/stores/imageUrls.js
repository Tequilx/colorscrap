import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'
import { signPaths } from '@/lib/remote'

// cache signed URL ของภาพใน Storage (SPEC §7.2: อายุ 1 ชั่วโมง) ต่ออายุเองก่อนหมด
const TTL = 3600 // วินาที
const MARGIN = 5 * 60 * 1000 // เหลือน้อยกว่านี้ถือว่าใกล้หมด
const TICK = 60 * 1000

export const useImageUrlsStore = defineStore('imageUrls', () => {
  const urls = shallowReactive(new Map()) // path → { url, expiresAt } (อ่านใน template/computed แล้วอัปเดตเองเมื่อต่ออายุ)
  const wanted = new Set() // path ที่มี component ต้องการ → ต่ออายุให้
  const inflight = new Set()
  let timer = null

  const fresh = (path) => {
    const v = urls.get(path)
    return Boolean(v) && v.expiresAt - Date.now() > MARGIN
  }

  const sign = async (paths) => {
    const todo = paths.filter((p) => !inflight.has(p))
    if (!todo.length) return
    todo.forEach((p) => inflight.add(p))
    try {
      const expiresAt = Date.now() + TTL * 1000
      for (const d of await signPaths(todo, TTL)) urls.set(d.path, { url: d.signedUrl, expiresAt })
    } finally {
      todo.forEach((p) => inflight.delete(p))
    }
  }

  const refreshStale = () => {
    const stale = [...wanted].filter((p) => !fresh(p))
    if (stale.length) sign(stale).catch((e) => console.error('ขอ signed URL ไม่สำเร็จ:', e))
  }

  const startTimer = () => {
    if (timer) return
    timer = setInterval(refreshStale, TICK)
    window.addEventListener('online', refreshStale)
  }

  // URL ที่ใช้ได้ตอนนี้ (null = ยังไม่มี) ใช้ใน computed
  const get = (path) => (path ? (urls.get(path)?.url ?? null) : null)

  // บอกว่าต้องการภาพนี้ ถ้ายังไม่มีหรือใกล้หมดอายุจะขอให้
  const want = (path) => {
    if (!path) return
    wanted.add(path)
    startTimer()
    if (!fresh(path)) sign([path]).catch((e) => console.error('ขอ signed URL ไม่สำเร็จ:', e))
  }

  // ขอทีละหลายไฟล์ในครั้งเดียว (ภาพย่อของทั้งสมุดตอนโหลด) ไม่โยน error
  const prefetch = async (paths) => {
    paths.forEach((p) => wanted.add(p))
    startTimer()
    try {
      await sign(paths.filter((p) => !fresh(p)))
    } catch (e) {
      console.error('ขอ signed URL ไม่สำเร็จ:', e)
    }
  }

  // ออกจากระบบ: ลืมทุก URL
  const clear = () => {
    urls.clear()
    wanted.clear()
    clearInterval(timer)
    timer = null
    window.removeEventListener('online', refreshStale)
  }

  return { get, want, prefetch, clear }
})
