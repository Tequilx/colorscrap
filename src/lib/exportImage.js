// ส่งออกภาพของผ้าใบเป็น Blob (SPEC §6.6): ภาพเต็ม 1600px และภาพย่อ 480px (ด้านยาว)
const FULL_SIZE = 1600
const THUMB_SIZE = 480
const QUALITY = 0.85

const resized = (source, longSide) => {
  const scale = longSide / Math.max(source.width, source.height)
  const out = document.createElement('canvas')
  out.width = Math.round(source.width * scale)
  out.height = Math.round(source.height * scale)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out
}

const toBlob = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))

// Safari รุ่นเก่าไม่เข้ารหัส WebP แล้วถอยเป็น PNG เงียบ ๆ ถ้าเจอแบบนั้นใช้ JPEG แทน
const encode = async (canvas) => {
  const webp = await toBlob(canvas, 'image/webp')
  if (webp?.type === 'image/webp') return webp
  return toBlob(canvas, 'image/jpeg')
}

export const exportImages = async (source) => ({
  image: await encode(resized(source, FULL_SIZE)),
  thumb: await encode(resized(source, THUMB_SIZE)),
})
