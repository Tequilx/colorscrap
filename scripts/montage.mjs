// รวมภาพเป็นแผ่นเดียวไว้เทียบ ก่อน/หลัง:  PLAYWRIGHT=… node scripts/montage.mjs <out.png> <คอลัมน์> <กว้างต่อภาพ> <ภาพ1> <ภาพ2> …  (ป้ายชื่อ = ชื่อไฟล์ ใส่ "ชื่อ=path" เพื่อตั้งป้ายเอง)
import { readFileSync, writeFileSync } from 'node:fs'
const [out, colsS, cwS, ...files] = process.argv.slice(2)
const cols = +colsS, cw = +cwS, ch = Math.round(cw * 0.625), lab = 22, pad = 6
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright')
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
const imgs = files.map((f) => { const [name, path] = f.includes('=') ? f.split('=') : [f.split('/').pop().replace('.png', ''), f]; return { name, src: 'data:image/png;base64,' + readFileSync(path).toString('base64') } })
const data = await p.evaluate(async ({ imgs, cols, cw, ch, lab, pad }) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s })
  const L = await Promise.all(imgs.map((m) => load(m.src)))
  const rows = Math.ceil(L.length / cols)
  const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = rows * (ch + lab + pad) + pad
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.font = '14px sans-serif'; x.fillStyle = '#222'
  L.forEach((im, i) => { const cx = pad + (i % cols) * (cw + pad), cy = pad + Math.floor(i / cols) * (ch + lab + pad); x.fillText(imgs[i].name, cx, cy + 15); x.drawImage(im, cx, cy + lab, cw, ch) })
  return c.toDataURL('image/png').split(',')[1]
}, { imgs, cols, cw, ch, lab, pad })
writeFileSync(out, Buffer.from(data, 'base64')); await b.close()
