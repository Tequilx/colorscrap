// สคริปต์ dev (ข้อ 61a): วัดเวลาจากแตะครั้งแรก → เพลงเริ่มดัง บน throttle Fast 4G (CDP: 9 Mbps ลง, หน่วง 150 ms)
// "เริ่มดัง" = window.__music().playing (ต้อง ?debug บน dev server): มีแทร็กและเล่นไปแล้ว (เวลา > 0 และบัสไม่เป็น 0 หลังเปิดเสียง)
//   1) VITE_USE_MOCK=true npm run dev -- --port 5199
//   2) PLAYWRIGHT=… node scripts/measure-music.mjs [--url http://localhost:5199] [--time day|night] [--tapAfter 1500] [--net fast4g|none]
// พิมพ์: ขนาดไฟล์เพลงที่ดาวน์โหลดจริง, ms จากแตะถึงเริ่มเล่น (3 รอบ, cache ปิด)
const args = process.argv.slice(2)
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d)
const base = opt('url', 'http://localhost:5199')
const time = opt('time', 'day')
const tapAfter = +opt('tapAfter', 1500) // รอหลังโหลดหน้าก่อนแตะ (ผู้ใช้จริงแตะหลังเห็นหน้าแรกไม่กี่วินาที)
const net = opt('net', 'fast4g')
const pw = await import(process.env.PLAYWRIGHT || 'playwright')
const { chromium } = pw.default || pw
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=document-user-activation-required'] })
const results = []
for (let run = 0; run < 3; run++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  if (net === 'fast4g') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.6 * 1024 * 1024) / 8 })
  let bytes = 0
  cdp.on('Network.loadingFinished', (e) => { bytes += 0; void e })
  const audioReq = new Map()
  cdp.on('Network.responseReceived', (e) => { if (/\/audio\/music-/.test(e.response.url)) audioReq.set(e.requestId, e.response.url) })
  const sizes = {}
  cdp.on('Network.loadingFinished', (e) => { if (audioReq.has(e.requestId)) sizes[audioReq.get(e.requestId)] = e.encodedDataLength })
  await page.addInitScript(() => localStorage.setItem('colorscrap.profile', JSON.stringify({ displayName: 'มะลิ', avatar: 'cat', coverColor: '#9E2F2A', likes: ['ทะเล'] })))
  await page.goto(`${base}/?debug&time=${time}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(tapAfter)
  const t0 = Date.now()
  await page.mouse.click(640, 400)
  let ms = null
  for (let i = 0; i < 600; i++) {
    const ok = await page.evaluate(() => window.__music?.().playing ?? false)
    if (ok) { ms = Date.now() - t0; break }
    await page.waitForTimeout(50)
  }
  results.push({ run, startMs: ms, files: sizes })
  await ctx.close()
}
console.log(JSON.stringify({ net, time, tapAfter, results }, null, 1))
await browser.close()
