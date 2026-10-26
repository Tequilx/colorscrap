// ตรวจฟอนต์ออฟไลน์ (ข้อ 43): บล็อก fonts.googleapis.com / fonts.gstatic.com แล้วเดินหลายหน้า ฟอนต์ Mali 400–700 / IBM Plex Sans Thai Looped 400–600 ต้องโหลดจากไฟล์ของแอปเอง
//   VITE_USE_MOCK=true npm run dev -- --port 5199
//   PW=/path/to/playwright/index.mjs node scripts/check-fonts.mjs <ไฟล์ภาพ-prefix>   (ใส่ 'open' เป็นอาร์กิวเมนต์ที่ 2 เพื่อไม่บล็อก)
const { chromium } = await import(process.env.PW || process.env.PLAYWRIGHT)
const out = process.argv[2]
const block = process.argv[3] !== 'open'
const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
await ctx.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
const ext = []
if (block) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => { ext.push(r.request().url()); r.abort() })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('pageerror', e.message))
await page.goto('http://localhost:5199/?time=day', { waitUntil: 'load' }); await page.waitForTimeout(1500)
const st = (fn, arg) => page.evaluate(({ fn, arg }) => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('app'); return new Function('a', 'arg', 'return (' + fn + ')(a, arg)')(s, arg) }, { fn: fn.toString(), arg })
for (const v of ['cover', 'pick', 'book']) { await st((a, v) => a.go(v), v); await page.waitForTimeout(1200) }
await st((a) => a.openSettings()); await page.waitForTimeout(1200)
await page.screenshot({ path: out + '-hello.png' })
const res = await page.evaluate(async () => {
  await document.fonts.ready
  const T = 'สมุดระบายความรู้สึก ก่ะ ColorScrap'
  const faces = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight} ${f.unicodeRange ? (/0E01/i.test(f.unicodeRange) ? 'thai' : 'latin') : ''}`)
  const chk = {}
  for (const fam of ['Mali', '"IBM Plex Sans Thai Looped"']) for (const w of [400, 500, 600, 700]) { const faces = await document.fonts.load(`${w} 16px ${fam}`, T); chk[`${fam} ${w}`] = faces.length + ' ' + faces.map((f) => f.status).join('/') }
  return { faces: faces.length, chk, used: getComputedStyle(document.querySelector('h1')).fontFamily }
})
console.log('external font requests blocked:', ext.length, JSON.stringify(res))
await b.close()
