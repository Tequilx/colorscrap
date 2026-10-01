<template>
    <div class="flex flex-col items-center p-8 bg-[#121212] rounded-2xl shadow-2xl">
        <h2 class="text-3xl font-bold text-white mb-6">ตอนนี้คุณรู้สึกอย่างไร? (ผสมอารมณ์ได้นะ)</h2>

        <!-- แถบเลือกอารมณ์ -->
        <div class="flex flex-wrap justify-center gap-4 mb-8 max-w-2xl">
            <button v-for="emo in emotions" :key="emo.id" @click="toggleEmotion(emo.id)" :class="[
                'px-6 py-2 rounded-full font-bold transition-all duration-300 border-2',
                selectedEmotions.includes(emo.id)
                    ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.1)] text-white'
                    : 'text-gray-400 border-gray-700 hover:border-gray-500 opacity-60'
            ]" :style="{
                backgroundColor: selectedEmotions.includes(emo.id) ? emo.colorHex : 'transparent',
                borderColor: selectedEmotions.includes(emo.id) ? emo.colorHex : ''
            }">
                {{ emo.label }}
            </button>
        </div>

        <!-- กระดาน Canvas (คงที่ตลอดกาล ไม่มีการลบหรือซ่อน) -->
        <div
            ref="containerRef"
            class="relative w-full max-w-4xl h-[500px] rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <canvas class="w-full h-full cursor-crosshair" :style="{ backgroundColor: PAPER_COLOR }"></canvas>
            <div
                class="absolute top-4 left-0 w-full text-center pointer-events-none text-black/40 text-sm tracking-widest">
                ลองลากเมาส์เพื่อระบายความรู้สึกของคุณ
            </div>
        </div>

        <div class="mt-8 flex flex-wrap justify-center gap-4">
        <button @click="clearCanvas"
            class="px-8 py-3 border-2 border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white rounded-full font-bold text-lg transition-colors">
            ล้างกระดาน
        </button>
        <button @click="saveToScrapbook"
            class="px-8 py-3 bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-600 hover:to-sky-600 text-white rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105">
            ดึงสีและบันทึกลง Scrapbook
        </button>
        </div>

        <!-- รายการภาพที่บันทึกไว้ พร้อมชุดสีที่ดูดได้ -->
        <div v-if="scraps.length" class="mt-8 w-full max-w-4xl grid gap-6 sm:grid-cols-2">
            <div v-for="scrap in scraps" :key="scrap.id" class="bg-gray-800 p-4 rounded-lg">
                <img :src="scrap.image" class="w-full rounded border border-gray-700" />
                <div class="flex gap-2 mt-3">
                    <div v-for="(c, i) in scrap.palette" :key="i" class="flex-1 h-10 rounded"
                        :style="{ backgroundColor: c }" :title="c"></div>
                </div>
                <div class="flex justify-between items-center mt-3 text-sm text-gray-300">
                    <span>{{ scrap.palette.join(' ') }}</span>
                    <a :href="scrap.image" :download="`colorscrap-${scrap.id}.png`"
                        class="text-sky-400 hover:underline">ดาวน์โหลดภาพ</a>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import WebGLFluid from 'webgl-fluid-enhanced'

// webgl-fluid-enhanced v0.8 รับ "container" (ไม่ใช่ canvas) แล้วหา <canvas> ข้างในเอง
const containerRef = ref(null)

// สีกระดาษ (ขาวครีม) ใช้ทั้งเป็นพื้น canvas และเป็นพื้นตอนบันทึกภาพ/ตัดสีพื้นออกจากชุดสี
const PAPER_COLOR = '#f5efe0'
const PAPER_RGB = [0xf5, 0xef, 0xe0]

// ภาพที่บันทึกไว้ [{ id, image (dataURL), palette: ['#rrggbb', ...] }]
const scraps = ref([])

// สำคัญมาก: ใช้ตัวแปรธรรมดา (let) ไม่ใช้ ref() เพื่อป้องกัน Vue Proxy เข้าไปแทรกแซง WebGL
let fluidInstance = null

const emotions = [
    { id: 'happy', label: 'สนุก / มีพลัง', colorHex: '#f97316' },
    { id: 'calm', label: 'สงบ / เป็นอิสระ', colorHex: '#3b82f6' },
    { id: 'healed', label: 'ผ่อนคลาย / เยียวยา', colorHex: '#22c55e' },
    { id: 'stable', label: 'มั่นคง / ปลอดภัย', colorHex: '#a16207' }
]

const selectedEmotions = ref(['happy', 'calm'])

// ฟังก์ชันแปลงอารมณ์เป็นชุดสี
const getActiveColors = () => {
    return selectedEmotions.value.map(id => {
        return emotions.find(e => e.id === id).colorHex
    })
}

const toggleEmotion = (id) => {
    const index = selectedEmotions.value.indexOf(id)
    if (index > -1) {
        if (selectedEmotions.value.length > 1) {
            selectedEmotions.value.splice(index, 1)
        }
    } else {
        selectedEmotions.value.push(id)
    }

    // หยอดสีใหม่เข้าไปในออบเจกต์ config ตรงๆ ในขณะที่กระดานยังทำงานอยู่
    if (fluidInstance) {
        fluidInstance.setConfig({ colorPalette: getActiveColors() })
    }
}

const createFluid = () => {
    // ผูก WebGL เข้ากับ container แล้วตั้งค่า (camelCase) ก่อนสั่ง start()
    fluidInstance = new WebGLFluid(containerRef.value)
    fluidInstance.setConfig({
        simResolution: 128,
        dyeResolution: 512,
        // สไตล์สีน้ำ: สีจางช้า (density ต่ำ) / การไหลหยุดเร็วพอให้ค่อยๆ ซึม (velocity) / แรงลากเบา
        densityDissipation: 0.15,
        velocityDissipation: 1.2,
        pressure: 0.8,
        curl: 5,
        splatRadius: 0.15,
        splatForce: 1500,
        hover: true, // วาดได้แค่เอาเมาส์ไปลาก/ผ่าน ไม่ต้องกดค้าง
        colorful: true, // บังคับให้เป็น true เสมอ เพื่อให้ระบบยอมหยิบสีจาก Palette
        colorPalette: getActiveColors(),
        // ปิด effect ที่ทำให้สีเพี้ยน เพื่อให้ดูดสีจากภาพได้ตรง
        transparent: true, // ให้ canvas โปร่งใส แล้วสีจะซ้อนบนพื้นครีมของ CSS เหมือนสีน้ำบนกระดาษ
        shading: false,
        bloom: false,
        sunrays: false,
    })
    fluidInstance.start()
}

// library ไม่มีคำสั่งล้างกระดาน จึงหยุดตัวเดิมแล้วสร้างใหม่บน canvas เดิม
// (stop()+start() เฉยๆ ไม่ล้าง เพราะ framebuffer เดิมถูกเก็บไว้)
const clearCanvas = () => {
    if (!fluidInstance) return
    fluidInstance.stop()
    createFluid()
}

onMounted(() => {
    if (containerRef.value) createFluid()
})

// canvas เป็น WebGL (preserveDrawingBuffer: false) จึงต้องอ่านภาพใน requestAnimationFrame
// หลังรอบวาดของ library ไม่เช่นนั้น toDataURL จะได้ภาพว่าง
const captureCanvas = () => new Promise(resolve => {
    requestAnimationFrame(() => {
        const source = containerRef.value.querySelector('canvas')
        // canvas โปร่งใส จึงวางลงบนพื้นครีมก่อน ไม่งั้นภาพที่บันทึกจะพื้นดำ/โปร่งใส
        const out = document.createElement('canvas')
        out.width = source.width
        out.height = source.height
        const ctx = out.getContext('2d')
        ctx.fillStyle = PAPER_COLOR
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.drawImage(source, 0, 0)
        resolve(out.toDataURL('image/png'))
    })
})

const toHex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')

// ตัดสีที่ใกล้สีกระดาษทิ้งก่อนเก็บเป็นชุดสี
const isBackground = (rgb) => Math.hypot(...rgb.map((v, i) => v - PAPER_RGB[i])) < 30

const extractPalette = (dataUrl) => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
        try {
            const colors = new window.ColorThief().getPalette(img, 6) || []
            resolve(colors.filter(c => !isBackground(c)).slice(0, 5).map(toHex))
        } catch (error) {
            reject(error)
        }
    }
    img.onerror = reject
    img.src = dataUrl
})

const saveToScrapbook = async () => {
    try {
        const image = await captureCanvas()
        const palette = await extractPalette(image)
        scraps.value.unshift({ id: Date.now(), image, palette })
    } catch (error) {
        console.error('บันทึก/ดูดสีไม่สำเร็จ:', error)
    }
}

onBeforeUnmount(() => {
    if (fluidInstance) fluidInstance.stop()
    fluidInstance = null
})
</script>
