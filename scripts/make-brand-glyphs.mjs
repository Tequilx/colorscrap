// สร้าง src/lib/brandGlyphs.js: เส้นขอบ (path) ของตัวอักษร Mali 700 ที่ใช้ในโลโก้ ให้โลโก้เป็นเวกเตอร์ล้วน ไม่พึ่งฟอนต์ตอนแสดง (favicon.svg, ภาพ SVG ที่วาดลงการ์ด)
//   ต้องมี opentype.js ติดตั้งไว้นอกรีโป (ไม่อยู่ใน package.json):  OPENTYPE=/path/to/node_modules/opentype.js/dist/opentype.mjs node scripts/make-brand-glyphs.mjs
// ฟอนต์: node_modules/@fontsource/mali/files/mali-latin-700-normal.woff (SIL OFL) พิกัด: 1000 หน่วยต่อ em, baseline y=0, ขึ้นเป็นลบ
import { readFileSync, writeFileSync } from 'node:fs'
const opentype = await import(process.env.OPENTYPE || 'opentype.js')
const ot = opentype.default ?? opentype
const buf = readFileSync('node_modules/@fontsource/mali/files/mali-latin-700-normal.woff')
const font = ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const S = 1000 / font.unitsPerEm
const CHARS = ['C', 'o', 'r', 'S', 'c', 'a', 'p', 'l']
const glyphs = {}
for (const ch of CHARS) {
  const g = font.charToGlyph(ch)
  const p = g.getPath(0, 0, font.unitsPerEm) // y ลง เหมือน SVG
  const d = p.commands
    .map((c) => {
      const f = (n) => Math.round(n * S * 10) / 10
      if (c.type === 'M' || c.type === 'L') return `${c.type}${f(c.x)} ${f(c.y)}`
      if (c.type === 'C') return `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`
      if (c.type === 'Q') return `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`
      return 'Z'
    })
    .join('')
  const bb = p.getBoundingBox()
  glyphs[ch] = { adv: Math.round(g.advanceWidth * S), d, bbox: [bb.x1, bb.y1, bb.x2, bb.y2].map((n) => Math.round(n * S)) }
}
const out = `// สร้างโดย scripts/make-brand-glyphs.mjs จากฟอนต์ Mali 700 (SIL OFL) อย่าแก้ด้วยมือ
// 1000 หน่วยต่อ em · baseline y = 0 · ขึ้นเป็นค่าลบ · adv = ความกว้างตัวอักษร · bbox = [x1, y1, x2, y2]
export const BRAND_GLYPHS = ${JSON.stringify(glyphs, null, 1)}
`
writeFileSync('src/lib/brandGlyphs.js', out)
console.log(CHARS.map((c) => `${c}: adv ${glyphs[c].adv} bbox ${glyphs[c].bbox}`).join('\n'))
