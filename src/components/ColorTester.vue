<template>
    <div class="min-h-screen flex flex-col items-center p-10">
        <h2 class="text-3xl font-bold text-orange-500 mb-6">ทดสอบระบบสกัดสี (Color Extraction)</h2>

        <!-- 1. ปุ่มอัปโหลดรูปภาพ -->
        <input type="file" accept="image/*" @change="handleImageUpload" class="mb-8 block w-full max-w-sm text-sm text-gray-300
             file:mr-4 file:py-2 file:px-4
             file:rounded-md file:border-0
             file:text-sm file:font-bold
             file:bg-sky-500 file:text-white
             hover:file:bg-sky-600 cursor-pointer" />

        <!-- 2. พื้นที่แสดงผลรูปภาพและจานสี -->
        <div v-if="imageUrl" class="flex flex-col items-center gap-6 w-full max-w-2xl">

            <!-- รูปภาพที่อัปโหลด (ซ่อนขอบถ้าไม่มีรูป) -->
            <img ref="imageRef" :src="imageUrl" @load="extractColors"
                class="max-w-full h-auto rounded-lg shadow-lg border border-gray-700" />

            <!-- แถบแสดงชุดสี (Palette) ที่สกัดได้ -->
            <div v-if="palette.length > 0" class="w-full bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 class="text-xl text-white mb-4 text-center">ชุดสีเด่นที่สกัดได้ (5 สี)</h3>
                <div class="flex flex-wrap justify-center gap-4">

                    <!-- วนลูปแสดงผลก้อนสีจาก Array ของ RGB -->
                    <div v-for="(color, index) in palette" :key="index"
                        class="w-20 h-20 rounded-full shadow-md flex items-center justify-center border-2 border-gray-600"
                        :style="{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }">
                        <!-- แสดงค่า RGB ไว้ตรงกลางวงกลมเผื่อเช็กความแม่น -->
                        <span class="text-xs text-white bg-black bg-opacity-50 px-1 rounded">
                            {{ color[0] }},{{ color[1] }},{{ color[2] }}
                        </span>
                    </div>

                </div>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

// ตัวแปรเก็บข้อมูล
const imageUrl = ref(null)    // เก็บ URL ของภาพจำลอง
const imageRef = ref(null)    // อ้างอิงถึง Tag <img> ใน HTML
const palette = ref([])       // เก็บ Array ชุดสีที่ได้จาก Color Thief

// ฟังก์ชันทำงานเมื่อผู้ใช้กดเลือกไฟล์
const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
        // สร้าง URL จำลองชั่วคราวเพื่อแสดงภาพบนหน้าเว็บ
        imageUrl.value = URL.createObjectURL(file)
        // เคลียร์ชุดสีเก่าออกระหว่างรอภาพใหม่โหลด
        palette.value = []
    }
}

// ฟังก์ชันดูดสี (จะทำงานก็ต่อเมื่อภาพเรนเดอร์เสร็จสมบูรณ์เท่านั้น)
const extractColors = () => {
    // ดึงคลาสจาก window ที่เราฝัง script ไว้ใน index.html มาใช้งาน
    const colorThief = new window.ColorThief()

    if (imageRef.value) {
        try {
            palette.value = colorThief.getPalette(imageRef.value, 5)
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการสกัดสี:", error)
        }
    }
}
</script>