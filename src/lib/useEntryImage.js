import { computed, watchEffect } from 'vue'
import { useBlobUrl } from '@/lib/useBlobUrl'
import { useImageUrlsStore } from '@/stores/imageUrls'

// URL ภาพของ entry: ถ้ายังมี Blob ในเครื่อง (เพิ่งบันทึก/ยังไม่อัปโหลด) ใช้ object URL
// ไม่งั้นใช้ signed URL ของ path ใน Storage (cache ใน imageUrls) entry จำลองไม่มีทั้งคู่ = null (แสดงหยดสีจำลอง)
// getEntry: getter คืน entry | null (คืน null = ยังไม่ต้องใช้ ไม่ขอ URL) kind: 'thumb' | 'image'
export const useEntryImage = (getEntry, kind) => {
  const imageUrls = useImageUrlsStore()
  const blobUrl = useBlobUrl(() => getEntry()?.[kind] ?? null)
  const path = computed(() => getEntry()?.[`${kind}_path`] ?? null)
  watchEffect(() => {
    if (!getEntry()?.[kind] && path.value) imageUrls.want(path.value)
  })
  return computed(() => blobUrl.value ?? imageUrls.get(path.value))
}
