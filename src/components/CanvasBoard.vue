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
            class="relative w-full max-w-4xl h-[500px] rounded-lg overflow-hidden border border-gray-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <canvas ref="canvasRef" class="w-full h-full bg-black cursor-crosshair"></canvas>
            <div
                class="absolute top-4 left-0 w-full text-center pointer-events-none text-white/40 text-sm tracking-widest">
                ลองลากเมาส์เพื่อระบายความรู้สึกของคุณ
            </div>
        </div>

        <button
            class="mt-8 px-8 py-3 bg-gradient-to-r from-orange-500 to-sky-500 hover:from-orange-600 hover:to-sky-600 text-white rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105">
            ดึงสีและบันทึกลง Scrapbook
        </button>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import WebGLFluid from 'webgl-fluid-enhanced'

const canvasRef = ref(null)

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
    if (fluidInstance && fluidInstance.config) {
        fluidInstance.config.COLOR_PALETTE = getActiveColors()
    }
}

onMounted(() => {
    if (!canvasRef.value) return

    // ผูก WebGL เข้ากับ Canvas แค่ "ครั้งเดียว"
    fluidInstance = new WebGLFluid(canvasRef.value, {
        IMMEDIATE: false,
        TRIGGER: 'hover',
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 512,
        DENSITY_DISSIPATION: 2.0,
        VELOCITY_DISSIPATION: 1.0,
        PRESSURE: 0.5,
        COLORFUL: true, // บังคับให้เป็น true เสมอ เพื่อให้ระบบยอมหยิบสีจาก Palette
        COLOR_PALETTE: getActiveColors(),
        BLOOM: true,
        SUNRAYS: false,
    })
})
</script>