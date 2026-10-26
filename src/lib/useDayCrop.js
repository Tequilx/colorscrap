import { computed, ref, watch } from 'vue'
import { dayCropDone, dayCropSource, getDayCrop } from '@/lib/dayCrop'
import { useBlobUrl } from '@/lib/useBlobUrl'

// ชิ้นสีของวัน (ข้อ 49) สำหรับหน้าจานสี: url = object URL ของชิ้นที่ครอปแล้ว (null = ยังโหลดอยู่) failed = ครอปไม่ได้ (ใช้ก้อนสีเดิมแทน)
export const useDayCrop = (getEntries) => {
  const blob = ref(null)
  const failed = ref(false)
  const source = computed(() => dayCropSource(getEntries()))
  watch(
    source,
    (entry, _old, onCleanup) => {
      let live = true
      onCleanup(() => (live = false))
      failed.value = false
      blob.value = dayCropDone(entry)?.blob ?? null
      if (!entry || blob.value) return
      getDayCrop(getEntries()).then((r) => {
        if (!live) return
        if (r) blob.value = r.blob
        else failed.value = true
      })
    },
    { immediate: true },
  )
  return { url: useBlobUrl(() => blob.value), failed }
}
