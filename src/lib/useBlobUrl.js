import { ref, watch } from 'vue'

// แปลง Blob เป็น object URL ที่คืนหน่วยความจำให้เอง เมื่อ Blob เปลี่ยนหรือ component ถูกถอด (watch เรียก cleanup ตอน unmount)
// source: getter ที่คืน Blob | null
export const useBlobUrl = (source) => {
  const url = ref(null)
  watch(
    source,
    (blob, _old, onCleanup) => {
      if (!blob) {
        url.value = null
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      url.value = objectUrl
      onCleanup(() => URL.revokeObjectURL(objectUrl))
    },
    { immediate: true },
  )
  return url
}
