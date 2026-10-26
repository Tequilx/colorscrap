// แปลง SVG (ข้อความ) เป็นภาพที่ drawImage ลง canvas ได้: serialize → Blob → Image
// ใช้กับส่วนที่ต้องมีฟิลเตอร์สีน้ำ (แถบสีของวัน กรอบสีของวัน โลโก้) ซึ่ง Canvas 2D ทำเองไม่ได้ SVG ต้องไม่อ้างอะไรนอกตัวเอง (ฟิลเตอร์อยู่ใน defs ของมันเอง)
export const svgToImage = async (svg) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
