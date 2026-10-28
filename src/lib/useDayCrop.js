import { computed, ref, watch } from 'vue'
import { dayCropDone, dayCropKey, getDayCrop } from '@/lib/dayCrop'
import { useBlobUrl } from '@/lib/useBlobUrl'

// ชิ้นสีของวัน สำหรับหน้าจานสี: url = object URL ของชิ้นที่ครอปแล้ว (null = ยังโหลดอยู่) failed = ครอปไม่ได้ (ใช้ก้อนสีแทน) crop = ผลเต็ม (ใช้ชื่อสีจาก nameForCrop)
export const useDayCrop = (getEntries) => {
  const crop = ref(null)
  const failed = ref(false)
  const key = computed(() => dayCropKey(getEntries()))
  watch(
    key,
    (k, _old, onCleanup) => {
      let live = true
      onCleanup(() => (live = false))
      failed.value = false
      crop.value = (k && dayCropDone(getEntries())) || null
      if (!k || crop.value) return
      getDayCrop(getEntries()).then((r) => {
        if (!live) return
        if (r) crop.value = r
        else failed.value = true
      })
    },
    { immediate: true },
  )
  return { url: useBlobUrl(() => crop.value?.blob ?? null), failed, crop }
}
