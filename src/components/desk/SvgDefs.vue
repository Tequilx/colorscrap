<template>
  <!-- SVG filter ทั้งหมด วางครั้งเดียวที่ root แล้วอ้างผ่าน filter: url(#id) -->
  <svg width="0" height="0" class="absolute" aria-hidden="true">
    <defs>
      <!-- ขอบทรงลายมือ: ห้ามใส่กับพื้นที่ใหญ่ ของที่ขยับตลอด หรือ element ที่มีตัวหนังสือยาว -->
      <filter id="wob">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="2" />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
      <!-- รอยสีน้ำตกแต่ง wc (ใหญ่/ภาพนิ่ง) wcm (ภาพย่อ หลุมผสมสี) wct (หยดบนเส้นเวลา รอยพู่กัน) wcs (ชิปเล็ก): ขอบคมแบบสีน้ำแห้ง ไม่มี blur
           ขอบหยักเล็กน้อย (turbulence + displacement scale เล็ก) · ขอบเข้มกว่าข้างในเล็กน้อย (rim = ส่วนที่ erode หายไป ทำให้เข้มขึ้นแล้วซ้อนทับ) · เนื้อสีข้างในไม่เรียบ (alpha จาก noise ความถี่ต่ำคูณ ±~20%)
           wct region สูงพิเศษ: รอยพู่กันเส้นหนาเป็น stroke ซึ่งไม่นับใน bbox ถ้า region เล็กจะถูกตัดเหลือเส้นบาง -->
      <filter v-for="f in BLOB_FILTERS" :id="f.id" :key="f.id" :x="f.x ?? '-30%'" :y="f.y ?? '-30%'" :width="f.w ?? '160%'" :height="f.h ?? '160%'" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" :baseFrequency="f.freq" numOctaves="2" :seed="f.seed" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" :scale="f.disp" result="d" />
        <feMorphology in="d" operator="erode" :radius="f.rim" result="inner" />
        <feComposite in="d" in2="inner" operator="out" result="rim" />
        <feColorMatrix in="rim" type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 0.55 0" result="rimDark" />
        <feMerge result="body"><feMergeNode in="d" /><feMergeNode in="rimDark" /></feMerge>
        <feTurbulence type="fractalNoise" :baseFrequency="f.mottle" numOctaves="3" :seed="f.seed + 7" result="m" />
        <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.1 0 0 0 0.4" result="mottle" />
        <feComposite in="body" in2="mottle" operator="in" />
      </filter>
      <!-- ภาพยังเปียก (lib/wetPhoto.js ตั้ง scale/baseFrequency ทุกเฟรมช่วง 3 วิแรก แล้วถอดฟิลเตอร์ออก) scale 0 = ไม่บิดเลย -->
      <filter id="wet" x="-4%" y="-4%" width="108%" height="108%">
        <feTurbulence id="wet-turb" type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="11" result="n" />
        <feDisplacementMap id="wet-disp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <!-- ผิวกระดาษ: render เป็นภาพครั้งเดียวใน Stage.vue (ดู grainUrl) ไม่ใช้ filter ทับทั้งโต๊ะ -->
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
      </filter>
    </defs>
  </svg>
</template>

<script setup>
// เล็กลงตามขนาดการใช้งาน: disp = ขอบหยัก (scale เล็ก) rim = ความหนาขอบเข้ม mottle = ความถี่ของลายเนื้อสี
const BLOB_FILTERS = [
  { id: 'wc', freq: 0.03, seed: 5, disp: 12, rim: 2.5, mottle: 0.012 },
  { id: 'wcm', freq: 0.05, seed: 3, disp: 7, rim: 1.4, mottle: 0.02 },
  { id: 'wct', freq: 0.12, seed: 4, disp: 4, rim: 0.9, mottle: 0.05, x: '-40%', y: '-150%', w: '180%', h: '400%' },
  { id: 'wcs', freq: 0.08, seed: 8, disp: 3, rim: 0.8, mottle: 0.04 },
]
</script>
