// ตั้งค่า Vite: plugin Vue, alias @ → src/, และ Vue DevTools (เปิดด้วย VITE_DEVTOOLS=true)
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // ปุ่มลอยของ Vue DevTools ปิดไว้เป็นค่าเริ่มต้น (บังหน้าจอ) เปิดด้วย VITE_DEVTOOLS=true ตอน npm run dev
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), ...(env.VITE_DEVTOOLS === 'true' ? [vueDevTools()] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
