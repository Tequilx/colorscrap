# ROADMAP — งานคิวบน `feature/polish`

กติกาอยู่ที่ CLAUDE.md หัวข้อ "กติกาทำงาน" ทำตามลำดับ ติ๊กเมื่อผ่านเกณฑ์ ถ้าไม่ผ่านภายใน 2 รอบแก้ ข้ามแล้วจดเหตุผลไว้ใต้ข้อ

- [x] **1. เสียง** (`src/lib/sound.js`, Web Audio สังเคราะห์ ไม่ใช้ไฟล์)
  - หยดสี / ปาดสี / สาด / แต้มแสงบาน / บันทึก (ลม + เทป) / พลิกแผ่น-เปิดสมุด / แตะปุ่ม, ปุ่มเปิด-ปิดเสียงมุมขวาบน (localStorage), ไม่เกิน 6 เสียงพร้อมกัน + master volume
  - เกณฑ์: ปิดแล้วเงียบสนิท · แตะรัว 2 นาที peak < 0 dBFS และ FPS ไม่ลด · ใช้ได้ Chrome + Safari
- [x] **2. แสงตามเวลาจริง** (overlay บนพื้นโต๊ะ ใต้กระดาษ)
  - กลางวัน 06–17 / เย็น 17–19 / กลางคืน 19–06, crossfade 2 วิ, `?time=day|dusk|night`, reduced-motion: ฝุ่นนิ่ง
  - เกณฑ์: สีที่ดึงจากภาพเหมือนเดิมทุกช่วงเวลา · FPS ระหว่างระบายไม่ลด · screens ครบ 3 ช่วงเวลา
- [x] **3. พู่กันจุ่มสีในหน้าเลือกความรู้สึก**
  - พู่กัน SVG เลื่อนไปการ์ดที่เลือก ยก-จุ่ม วงน้ำกระเพื่อม ปลายขนเป็นสีอารมณ์ ~0.7 วิ, ไม่บล็อก "เริ่มระบาย", เสียงจุ่ม, reduced-motion: เปลี่ยนสีปลายขนอย่างเดียว
- [x] **4. เคอร์เซอร์** (เฉพาะ `pointer: fine`)
  - นิ้วชี้ SVG 32px ทั่วแอป · บนผ้าใบ: ปาด = นิ้วติดสีอารมณ์ / หยด = พู่กันสีอารมณ์ / แต้มแสง = พู่กันแต้มแสง · จอสัมผัสไม่เปลี่ยน
- [x] **5. บ่อสีใน SavedCard กระเพื่อม** (คอมโพเนนต์ well แยก)
  - หยดตกบ่อ วง 2–3 วง สีผสมจากสีเดิมของวัน → สีใหม่ ~1.2 วิ เล่นครั้งเดียว, เสียงหยด, reduced-motion: จางเปลี่ยนสี, ห้ามเปลี่ยนเลย์เอาต์การ์ด

## บันทึกผล
(เติมใต้แต่ละข้อเมื่อทำเสร็จ: ตัวเลขเกณฑ์ / path contact sheet / เหตุผลที่ข้าม)

### 1. เสียง — ผ่าน (tag `pre-sound`)
- `src/lib/sound.js` (Web Audio สังเคราะห์ทั้งหมด) + `components/ui/SoundToggle.vue` (มุมขวาบน ไอคอน `sound`/`mute` ใน `lib/doodles.js`, จำใน `localStorage['colorscrap.sound']`, ค่าเริ่มต้นเปิด) เทสต์ `sound.test.js` 8 ตัว (pitch, voice pool ≤ 6, ยอด soft clip, ซองแต้มแสง, อ่านค่าที่จำ)
- จุดเรียก: หยด/ปาด/สาด/แต้มแสงบาน ใน `FluidCanvas.vue`; เปิดสมุด/พลิกแผ่น/ลมกระดาษ/เทป ใน `stores/app.js` (ตาม `saveSchedule`); แตะปุ่มทั่วไปใน `App.vue`
- วัด (headless Chrome, `--autoplay-policy=no-user-gesture-required`, `?debug`): แตะรัวสลับหยด/แต้มแสง/ปาด 120 วิ (1090 ครั้ง) **ยอดสัญญาณหลังตัวจำกัด −3.4 dBFS** (< 0), เสียงพร้อมกันสูงสุด 6, **FPS 60 เท่ากับตอนปิดเสียง** (เฟรมช้าสุด 20 ms ทั้งสองแบบ); ปิดเสียง → ยอด 0 (เงียบสนิท)
- Safari: ใช้เฉพาะ API มาตรฐาน (`webkitAudioContext` สำรอง, สร้าง/resume หลัง pointerdown/touchend/keydown, ไม่ซ้อน `setValueAtTime` กับ `setValueCurveAtTime`) **ยังไม่ได้ลองบน Safari จริง** (ต้องเช็กด้วยหู/เครื่องจริง)
- ภาพ: `scripts/out/screens/sound/contact-sheet.png`

### 2. แสงตามเวลาจริง — ผ่าน (tag `pre-light`)
- `components/desk/DeskLight.vue` (ชั้นแรกสุดใน `Stage.vue` ใต้เวทีทั้งหมด จึงอยู่ใต้กระดาษ/ผ้าใบ/สมุด/การ์ดเสมอ) + `lib/daylight.js` (`periodOf`, `?time=day|dusk|night` ใช้ได้ทั้ง production) + สีแสงใน `lib/tokens.js` `LIGHT` · สามชั้นสลับด้วย opacity อย่างเดียว crossfade 2 วิ (reduced-motion: 150ms ตาม `app.css` และฝุ่นนิ่ง/ไม่มี animation) · เทสต์ `daylight.test.js` 2 ตัว
- วัด: ภาพผ้าใบ (พิกเซลจริงบนจอ) ต่างกัน **0** ระหว่าง day/dusk/night และสีที่ดึงจากภาพ (`extractColors`) **เหมือนกันทุกช่วงเวลา** (5 สีเท่ากันทุกค่า) · แตะแต้มแสงรัว 60 วิ: FPS **59.9 ทั้ง day/dusk/night** (เฟรมสะดุดครั้งเดียว ~150 ms ที่แตะครั้งแรกคือคอมไพล์ shader ยกสี มีอยู่ก่อนแล้ว เกิดเหมือนกันทุกช่วงเวลา)
- ภาพ: `scripts/out/screens/light-time=day|dusk|night/contact-sheet.png`

### 3. พู่กันจุ่มสีในหน้าเลือกความรู้สึก — ผ่าน (tag `pre-brush`)
- `components/pick/PickBrush.vue` (วางใน `EmotionPalette.vue`, `pointer-events: none`): พู่กัน SVG (ด้ามไม้ ปลอกโลหะ ขนสีเข้มชี้ลง สีวัสดุอยู่ใน `lib/tokens.js` `BRUSH`) เลื่อนด้วย tween ใน rAF จากตำแหน่งปัจจุบันเสมอ: ยกขึ้น → จุ่มลง → ถอยพัก; สัมผัสน้ำสี = ปลายขนเปลี่ยนสีอารมณ์ (`transition: fill 700ms`) + วงน้ำ 3 วง + `sound.dip()` (ใหม่ใน `sound.js`) · เลือกเร็ว ๆ ต่อกันพู่กันตามไปช่องใหม่ทันที · ปุ่ม "เริ่มระบาย" กดได้ตลอด (ทดสอบกดระหว่างพู่กันเคลื่อนที่ → เข้า paint)
- reduced-motion: พู่กันอยู่นิ่งที่ขวาของกล่อง (ไม่เคลื่อน ไม่มีวงน้ำ) แค่เปลี่ยนสีปลายขนทันที
- **หมายเหตุ:** artboard อ้างอิง "DeskPick" ไม่อยู่ในรีโป/ที่เข้าถึงได้ในรอบนี้ (มีแต่ `docs/design/screens/*.dc.html`) ท่าทางและรูปทรงพู่กันจึงทำตามคำอธิบายในโจทย์ — **ต้องเช็กด้วยตาเทียบแบบ DeskPick**
- บั๊กที่เจอระหว่างทำ: ตำแหน่งพู่กันที่ผูก `:style` ใน template ถูกเขียนทับเมื่อ re-render (วงน้ำเพิ่ม/ลบ) → ตั้ง `style.transform` ใน JS อย่างเดียว
- ภาพ: `scripts/out/screens/brush/pick-dip-sequence.png` (ลำดับคลิก/คลิกรัว), `pick-reduced-motion.png`, `scripts/out/screens/brush/contact-sheet.png` (ทุกหน้า)

### 4. เคอร์เซอร์ — ผ่าน (tag `pre-cursor`)
- `lib/cursors.js` (SVG 32px สร้างจาก token `PALETTE`/`BRUSH`, สีปลายนิ้ว/ปลายขนเป็นสีอารมณ์) + กฎ `@media (pointer: fine)` ใน `assets/app.css` (ทุกองค์ประกอบใช้ `--cursor-finger`, ยกเว้นชั้นรับ pointer ของผ้าใบที่มี `data-cursor`) + `FluidCanvas.vue` `overlayStyle` (ปาด = นิ้วสีอารมณ์ จุดคลิก (13,3) / หยด = พู่กันสีอารมณ์ / แต้มแสง = พู่กันแต้มแสง จุดคลิก (4,28)) · เทสต์ `cursors.test.js` 6 ตัว
- วัดด้วย computed style (Chrome): เมาส์ → ปุ่ม/body = นิ้วชี้ `13 3`, ผ้าใบ ปาด `13 3` / หยด `4 28` / แต้มแสง `4 28`; จอสัมผัส (`isMobile+hasTouch`, `pointer: coarse`) → ปุ่ม `pointer`, body `auto`, ผ้าใบ `crosshair` = **ไม่เปลี่ยนจากเดิม**
- บั๊กที่เจอ: แอตทริบิวต์ซ้ำใน SVG ทำให้โหลดภาพไม่ได้ (เบราว์เซอร์ถอยเป็น `auto` เงียบ ๆ แม้ computed style ยังเป็น url) → เพิ่มเทสต์ตรวจแอตทริบิวต์ซ้ำและเรนเดอร์ภาพจริงตรวจด้วยตา
- ภาพ: `scripts/out/screens/cursor/cursors.png` (เคอร์เซอร์ทั้งหมดขยาย 6×; **ภาพหน้าจอ Playwright ไม่เรนเดอร์เคอร์เซอร์ของระบบ** จึงต้องเช็กจุดคลิกจริงด้วยเมาส์) + `contact-sheet.png`

### 5. บ่อสีใน SavedCard กระเพื่อม — ผ่าน (tag `pre-well`)
- `components/saved/SavedWell.vue` (คอมโพเนนต์แยก props `entry`/`before`/`day`/`autoplay`, `defineExpose({ play })`) แทนบล็อก SVG เดิมใน `SavedCard.vue` ขนาดและตำแหน่งเท่าเดิม 272×125 (เลย์เอาต์การ์ดไม่เปลี่ยน) · เล่นครั้งเดียวหลัง mount (+350 ms ให้การ์ดขึ้นก่อน): หยดตก 380 ms (transform) → วงน้ำ 3 วง (transform/opacity, 1 วิ) + `sound.drop` + สีในบ่อ crossfade จากสีเดิมของวัน (`before`) เป็นสีใหม่ (`day`) 1.2 วิ
- reduced-motion: ไม่มีหยดตก/วงน้ำ (แสดงวงคลื่นนิ่งแบบเดิมของการ์ด) สีจางเปลี่ยนอย่างเดียว (ช่วงเวลา 150 ms ตาม `app.css`) ตรวจจากเฟรมจริง
- สีฮาร์ดโค้ดของบ่อ (`#F1EEE8`, `#DCD6CC`, `#E4DFD6`) ย้ายมาตามเดิมจาก `SavedCard.vue` ไม่ได้เพิ่มสีใหม่ (ยังอยู่ในรายการเก็บเข้า token รอบหน้า)
- ภาพ: `scripts/out/screens/well/well-sequence.png` (ทุก ~45 ms ตั้งแต่การ์ดขึ้น), `well-reduced-motion.png`, `contact-sheet.png`


---

# สาย 2 (ข้อ 6–10) — แบบอ้างอิง `docs/design/screens/10-saved-v2.png`, `11-book-v2.png`

- [x] **6. เปลี่ยนชื่อ "สีอุ่น" → "แต้มแสง"** (เฉพาะข้อความที่ผู้ใช้เห็น; ไม่เปลี่ยน "อบอุ่นใจ" และชื่อตัวแปร/ฟังก์ชัน `warm`) ปุ่มถาด, "→ มีแสงขึ้น", "ค่อย ๆ มีแสงขึ้น", โน้ตชวน, การ์ดเก็บรูป, aria-label, toast · เกณฑ์: grep "อุ่น" ใน src เหลือเฉพาะ "อบอุ่นใจ" + คอมเมนต์ · SPEC/FILE-GUIDE ใช้คำใหม่
- [x] **7. `DayRibbon.vue`** แถบรอยพู่กันของวัน (1 ภาพ = 1 ช่วง กว้าง ∝ น้ำหนัก, สีหลักตาม entry.colors, shifted ไล่ไปสีแต้มแสง, รอยต่อซึม 3–4%, ป้ายเวลา+อารมณ์ 2 บรรทัด ซ่อนตามความกว้าง, `animate` none/reveal/paintLast ขอบนำสั่นแบบรอยพู่กัน 1.1 วิ หน่วง 0.5 วิ + เสียง, reduced = จางเข้า 150ms) · เทสต์: ป้ายไม่ทับกัน 1–8 ภาพ, 1 ภาพเต็มความกว้าง
- [x] **8. DailyPalette ตามภาพ 11** ก้อนสีน้ำก้อนเดียว + ชื่อสี + hex, DayRibbon ใต้ "สีของวันตามลำดับเวลา" (reveal ตาม bookTick), เอาวงซ้อนสี/DayTimeline ออก
- [ ] **9. SavedCard ตามภาพ 10** การ์ดอยู่ในหน้าขวาของสมุดซูมทั้งหมด (1280×800 และ 1180×820) 4 ส่วน, DayRibbon paintLast + ก้อนสีวันเปลี่ยนที่ ~1.5 วิ (ชื่อเดิมเทาขีดฆ่า ชื่อใหม่ตัวหนา), ลบ SavedWell · เกณฑ์: ไม่มีเฟรมเกิน 50 ms ตลอดลำดับบันทึก
- [ ] **10. ภาพยังเปียก** ฟิลเตอร์บิดเบา ๆ ไล่ลง ease-out ~3 วิ แล้วถอดฟิลเตอร์ (ภาพที่เพิ่งแปะตอนการ์ดขึ้น + PhotoView ตอนเปิด) ทีละภาพ, reduced = ไม่เล่น · เกณฑ์: FPS ≥ 50 ระหว่างเล่น, ภาพหลังนิ่งเหมือนต้นฉบับทุกพิกเซล

### 6. แต้มแสง — ผ่าน (tag `pre-rename-glow`)
- แทนที่ "สีอุ่น" → "แต้มแสง" และ "→ อุ่นขึ้น" → "→ มีแสงขึ้น" ใน src (ข้อความ+คอมเมนต์), SPEC, FILE-GUIDE, specs, CLAUDE.md (ไม่แตะ `docs/design/*.html` ซึ่งเป็นแบบอ้างอิงที่ส่งออกมา) โน้ตชวนเขียนใหม่ "ลองแต้มแสง / ลงไปสักนิดไหม" (ข้อความแรกยาวไปตัดคำกลางประโยค จึงใช้แบบสั้น)
- grep "อุ่น" ใน src (นอก "อบอุ่น") เหลือเฉพาะคอมเมนต์ที่เป็นคำอื่น ("แสงส้มอุ่น", "เสียงอุ่น", "โทนอุ่น") ไม่มีข้อความที่ผู้ใช้เห็นเหลือ · ภาพ: `scripts/out/screens/rename/contact-sheet.png`

### 7. DayRibbon — ผ่าน (tag `pre-ribbon`)
- `lib/dayRibbon.js` (เรขาคณิตล้วน: `layoutRibbon`, ป้ายไม่ทับกัน, ขอบนำสั่น `sweepPolygon`) + `components/book/DayRibbon.vue` + filter ใหม่ `wcr` ใน `SvgDefs.vue` (ขอบบิดแนวนอน + ชั้นจางกว้างกว่า + เกรนเฉพาะบนรอยสี; ใช้ผ่าน `style="filter:url(#wcr)"` ไม่ใช้ utility ของ tailwind เพราะเพิ่ม utility ใน tailwind.config.js แล้ว dev server ไม่โหลดใหม่เอง) + ไอคอน `sun`/`moon` + `sound.stroke()` · วางตัวอย่าง 1–8 ภาพและ paintLast ใน `?kit`
- เทสต์ `dayRibbon.test.js` 16 ตัว (1 ภาพเต็มความกว้าง, กว้าง ∝ น้ำหนัก, ป้ายไม่ทับกัน 1–8 ภาพ × 4 ความกว้าง × 4 ชุดความเข้ม, กฎ <90/<50px, ช่วงล่าสุดได้ป้ายก่อน, ขอบสั่น interpolate ได้) + ตรวจ bounding box จริงในเบราว์เซอร์: ป้ายทับกัน **0** ทุกกรณี 1–8 ภาพ
- animate: `reveal` (ไล่ซ้าย→ขวา 1.0 วิ) / `paintLast` (หน่วง 0.5 วิ ปาด 1.1 วิ + เสียง) ด้วย WAAPI บน `clip-path: polygon()` ขอบสั่น · reduced = จางเข้า 150ms
- ภาพ: `scripts/out/screens/ribbon/ribbons.png`

### 8. DailyPalette ตามภาพ 11 — ผ่าน (tag `pre-dailypalette`)
- `DailyPalette.vue`: ก้อนสีน้ำก้อนเดียว (สีผสม `mixColors`/`dayColor` + ก้อนเล็กข้างในเป็นสีเด่น `dominantColorOfDay`) + "สีของวันนี้" + ชื่อสี + hex, หัวข้อ "สีของวันตามลำดับเวลา" + `DayRibbon animate="reveal"` (เล่นตอนเข้าสมุดตาม `bookTick` หน่วงตามลำดับที่ 3 ของ stagger เดิม; ป้ายจางเข้าหลังแถบไล่ผ่านครึ่งหนึ่ง; เปลี่ยนวัน/พลิกแผ่นไม่เล่นซ้ำ) · เก็บส่วนหัว ปุ่มเก็บรูป ประโยคสรุป ปุ่มวันก่อน/ถัดไป · ลบ `MixingWell.vue` และ `DayTimeline.vue` (ไม่มีที่ใช้แล้ว; `lib/mixingWell.js` ยังใช้โดยการ์ดเก็บรูปของวัน ซึ่งไม่เปลี่ยน)
- ภาพที่แต้มแสง: สีหลักของช่วงเลือกสีเด่นที่ห่างจากสีแต้มแสง ≥ 70 (RGB) ก่อน ไม่งั้นแถบไล่เหลือง→เหลือง (เทสต์ `segmentColors` 2 ตัว) · คำบรรยายโพลารอยด์ที่ยาวกว่า 24 ตัวอักษรลดเป็น `text-13` (ข้อความ "→ มีแสงขึ้น" ยาวกว่า "→ อุ่นขึ้น" 2 ตัวและเดิมถูกตัดเป็น "…")
- เทียบกับแบบ: `scripts/out/screens/compare/08-book-vs-ref.png` · contact sheet: `scripts/out/screens/dailypalette/contact-sheet.png`
