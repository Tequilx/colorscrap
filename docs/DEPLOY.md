# วิธี deploy ColorScrap (Vercel หรือ Netlify)

เอกสารนี้อธิบายขั้นตอนอย่างเดียว **ยังไม่ได้ deploy จริง** และ **ห้ามใส่ค่าจริงของ key/URL ลงในไฟล์ใด ๆ ในรีโป** (ตั้งค่าในหน้าเว็บของผู้ให้บริการเท่านั้น)

แอปเป็น Vue 3 + Vite ล้วน (ไม่มีเซิร์ฟเวอร์ของเราเอง ไม่มี Vue Router ใช้ `location.hash`) จึงโฮสต์เป็นเว็บ static ได้เลย ไม่ต้องตั้ง rewrite/redirect ของ SPA

## 0. สิ่งที่ต้องมีก่อน
- โปรเจกต์ Supabase ที่รัน `supabase/schema.sql` ใน SQL Editor แล้ว (ตาราง `profiles`, `entries`, bucket `paintings` แบบ private)
- ค่าสองตัวจากหน้า Supabase → Project Settings → API: **Project URL** และ **publishable key** (`sb_publishable_…`) ห้ามใช้ service role key ในเว็บ
- รีโปบน GitHub (branch ที่จะ deploy) · Node `^22.18.0 || >=24.12.0`
- ไฟล์เพลง `public/audio/music-day.mp3` / `music-night.mp3` (เพลงจริงอยู่ในรีโปแล้ว ไฟล์ night ~8.8 MB / day ~4.4 MB ไม่มี = เงียบ)

## 1. ตัวแปรสภาพแวดล้อม (ตั้งในหน้าเว็บของผู้ให้บริการ)
| ชื่อ | ค่า |
|---|---|
| `VITE_USE_MOCK` | `false` (ถ้าไม่ตั้ง แอปจะเข้า "โหมดจำลอง" ไม่ต่อ Supabase) |
| `VITE_SUPABASE_URL` | Project URL ของ Supabase |
| `VITE_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) |

ค่า `VITE_*` ถูกฝังในไฟล์ JS ตอน build จึงเป็นของสาธารณะเสมอ ความปลอดภัยของข้อมูลมาจาก Row Level Security ใน `schema.sql` ไม่ใช่การซ่อน key ถ้าแก้ค่าต้อง **build ใหม่ (Redeploy)** ไม่ใช่แค่รีสตาร์ท
(ไฟล์ `.env.production` ในรีโปตั้ง `VITE_USE_MOCK=false` ไว้แล้ว ส่วนค่าอีกสองตัวไม่อยู่ในรีโป)

## 2A. Vercel
1. เข้า vercel.com → **Add New… → Project** → เลือกรีโป GitHub ของโปรเจกต์
2. Framework Preset: **Vite** (ตรวจเจออัตโนมัติ)
3. Build Command: `npm run build` · Output Directory: `dist` · Install Command: `npm install`
4. เปิด **Environment Variables** ใส่ 3 ตัวด้านบน (ติ๊กทั้ง Production และ Preview)
5. กด **Deploy** รอจนได้ URL เช่น `https://<ชื่อโปรเจกต์>.vercel.app`
6. ตั้ง **Production Branch** เป็น branch ที่ต้องการ (ถ้าไม่ใช่ `main`) ที่ Settings → Git

## 2B. Netlify
1. เข้า app.netlify.com → **Add new site → Import an existing project** → เลือกรีโป
2. Build command: `npm run build` · Publish directory: `dist`
3. ที่ **Site configuration → Environment variables** เพิ่ม 3 ตัวด้านบน
4. **Deploy site** รอจนได้ URL เช่น `https://<ชื่อ>.netlify.app`
5. ตั้ง Node version ผ่าน Environment variable `NODE_VERSION` = `22` ถ้า build ฟ้องเวอร์ชัน

## 3. ตั้งค่า Supabase Auth ให้รู้จัก URL ที่ deploy
ไปที่ Supabase → **Authentication → URL Configuration**
1. **Site URL**: ใส่ URL ของเว็บที่ deploy (เช่น `https://<ชื่อโปรเจกต์>.vercel.app`) — ลิงก์ในอีเมลยืนยันจะชี้ไปที่นี่
2. **Redirect URLs**: เพิ่ม URL เดียวกัน (และ `http://localhost:5173` ถ้ายังพัฒนาในเครื่อง) ถ้าใช้ Preview Deployment ให้เพิ่มรูปแบบ `https://*-<ชื่อทีม>.vercel.app` หรือ `https://deploy-preview-*--<ชื่อ>.netlify.app`
3. ถ้าไม่ต้องการให้ยืนยันอีเมล: Authentication → Providers → Email → ปิด "Confirm email" (งานแสดงที่คนเข้าใช้ผลัดกัน ปิดจะสะดวกกว่า)

## 4. เช็กหลัง deploy (ทำตามลำดับ)
- [ ] เปิด URL แล้วเห็นหน้า **login** (ถ้าเห็นหน้า hello/ข้อมูลตัวอย่างแปลว่ายังเป็นโหมดจำลอง → ตรวจ `VITE_USE_MOCK=false` แล้ว Redeploy)
- [ ] สมัครด้วยอีเมลใหม่ → ตั้งชื่อสมุด → เข้า cover ได้
- [ ] ระบายสีหนึ่งภาพแล้วกด "บันทึกลงสมุด" → ภาพขึ้นในสมุด
- [ ] เปิด Supabase → Table Editor `entries` มีแถวใหม่ และ Storage `paintings/{user_id}/…` มีไฟล์ภาพ + thumb
- [ ] รีเฟรชหน้า แล้วภาพยังอยู่ (โหลดผ่าน signed URL)
- [ ] ออกจากระบบ แล้วสมัครบัญชีที่สอง → **ไม่เห็นภาพของบัญชีแรก** (RLS ทำงาน)
- [ ] "เก็บรูป" ทั้งการ์ดภาพและการ์ดจานสีของวัน ได้ไฟล์ PNG
- [ ] เปิดบน iPad (Safari): แตะระบายได้ เสียงเริ่มหลังแตะครั้งแรก ปุ่ม "เก็บรูป" เปิดหน้าแชร์
- [ ] Console ของเบราว์เซอร์ไม่มี error สีแดง (ยกเว้น 404 ของไฟล์เพลงถ้ายังไม่มี mp3)
- [ ] ฟอนต์ Mali / IBM Plex Sans Thai Looped มาจากไฟล์ในแอปเอง (`src/fonts.js`) ใช้ได้แม้ไม่มีอินเทอร์เน็ต ตรวจ Network ว่าไม่มีคำขอไป fonts.googleapis.com

## 5. ปัญหาที่พบบ่อย
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ขึ้นหน้าจอว่าง | เปิด DevTools ดู error · ส่วนมากเพราะ `VITE_SUPABASE_URL` ว่างตอน build → ตั้งแล้ว Redeploy |
| สมัครแล้วไม่ได้อีเมล | Supabase ฟรีส่งอีเมลได้จำกัดต่อชั่วโมง ปิด "Confirm email" หรือตั้ง SMTP ของตัวเอง |
| ลิงก์ในอีเมลชี้ไป localhost | Site URL ใน Supabase ยังเป็นค่าเดิม (ข้อ 3) |
| บันทึกภาพไม่ขึ้น / 403 | ยังไม่ได้รัน `schema.sql` (policy ของตารางและ bucket) |
| รูปไม่ขึ้นหลัง deploy | bucket `paintings` ต้องเป็น private และมี policy ตามโฟลเดอร์ `uid` (อยู่ใน `schema.sql`) |
| เสียง/เพลงไม่ดัง | เบราว์เซอร์เริ่มเสียงหลังผู้ใช้แตะครั้งแรกเท่านั้น (ปกติ) · ตรวจปุ่มเสียงมุมขวาบน |

## 6. อัปเดตเว็บทีหลัง
push ขึ้น branch ที่ผูกไว้ → Vercel/Netlify build และ deploy ให้เองอัตโนมัติ ถ้าแก้ `supabase/schema.sql` ต้องไปรันใน SQL Editor ของ Supabase เองด้วย (ไม่อยู่ในขั้นตอน deploy)
