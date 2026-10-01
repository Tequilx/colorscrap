<template>
  <!-- SVG filter ทั้งหมด วางครั้งเดียวที่ root แล้วอ้างผ่าน filter: url(#id) -->
  <svg width="0" height="0" class="absolute" aria-hidden="true">
    <defs>
      <!-- ขอบทรงลายมือ: ห้ามใส่กับพื้นที่ใหญ่ ของที่ขยับตลอด หรือ element ที่มีตัวหนังสือยาว -->
      <filter id="wob">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="2" />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
      <!-- หยดสีน้ำขนาดใหญ่ (ภาพนิ่ง) -->
      <filter id="wc" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="5" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="30" result="d" />
        <feGaussianBlur in="d" stdDeviation="1.4" />
      </filter>
      <!-- ภาพย่อในสมุด หลุมผสมสี -->
      <filter id="wcm" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="18" result="d" />
        <feGaussianBlur in="d" stdDeviation="1" />
      </filter>
      <!-- หยดสีบนเส้นเวลา รอยพู่กัน -->
      <!-- region สูงพิเศษ: รอยพู่กันเส้นหนาเป็น stroke ซึ่งไม่นับใน bbox ถ้า region เล็กจะถูกตัดเหลือเส้นบาง -->
      <filter id="wct" x="-40%" y="-150%" width="180%" height="400%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="7" result="d" />
        <feGaussianBlur in="d" stdDeviation="0.5" />
      </filter>
      <!-- หยดสีขนาดเล็กที่ชิปความเข้ม -->
      <filter id="wcs" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="8" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="8" result="d" />
        <feGaussianBlur in="d" stdDeviation="0.6" />
      </filter>
      <!-- ผิวกระดาษ: render เป็นภาพครั้งเดียวใน Stage.vue (ดู grainUrl) ไม่ใช้ filter ทับทั้งโต๊ะ -->
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0" />
      </filter>
    </defs>
  </svg>
</template>
