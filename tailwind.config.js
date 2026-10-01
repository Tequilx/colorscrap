import { PALETTE, EMOTION_COLORS, FONT_SIZES } from './src/lib/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        ...PALETTE,
        cover: 'var(--cover)', // ผู้ใช้เปลี่ยนได้ จึงเป็น CSS variable
        'cover-spine': 'var(--cover-spine)',
        'cover-strap': 'var(--cover-strap)',
        e: EMOTION_COLORS, // bg-e-calm, text-e-sad ...
      },
      fontFamily: {
        hand: ['Mali', 'Itim', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans Thai Looped"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: FONT_SIZES, // text-13 ... text-52 (px ตาม stage 1280×800)
      borderRadius: {
        hand: '18px 22px 16px 24px', // ปุ่มทรงลายมือ
        'hand-sm': '16px 20px 14px 18px',
        'hand-lg': '26px 30px 24px 28px',
        chip: '999px',
      },
      boxShadow: {
        // ใช้กับของที่วางซ้อนบนโต๊ะเท่านั้น (สมุด ภาพ การ์ด)
        photo: '0 3px 10px rgba(45, 43, 51, 0.18)',
        card: '0 10px 28px rgba(45, 43, 51, 0.16)',
        book: '0 22px 44px rgba(45, 43, 51, 0.30)',
      },
      transitionTimingFunction: {
        desk: 'cubic-bezier(.2,.8,.2,1)',
      },
      transitionDuration: {
        450: '450ms',
        600: '600ms',
      },
    },
  },
  plugins: [
    // ผูก filter ของ SvgDefs.vue (ต้องมี <SvgDefs/> วางที่ root)
    ({ addUtilities }) => {
      addUtilities({
        '.filter-wob': { filter: 'url(#wob)' },
        '.filter-wc': { filter: 'url(#wc)' },
        '.filter-wcm': { filter: 'url(#wcm)' },
        '.filter-wct': { filter: 'url(#wct)' },
      })
    },
  ],
};
