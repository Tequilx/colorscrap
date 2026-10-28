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
- [x] **9. SavedCard ตามภาพ 10** การ์ดอยู่ในหน้าขวาของสมุดซูมทั้งหมด (1280×800 และ 1180×820) 4 ส่วน, DayRibbon paintLast + ก้อนสีวันเปลี่ยนที่ ~1.5 วิ (ชื่อเดิมเทาขีดฆ่า ชื่อใหม่ตัวหนา), ลบ SavedWell · เกณฑ์: ไม่มีเฟรมเกิน 50 ms ตลอดลำดับบันทึก
- [x] **10. ภาพยังเปียก** ฟิลเตอร์บิดเบา ๆ ไล่ลง ease-out ~3 วิ แล้วถอดฟิลเตอร์ (ภาพที่เพิ่งแปะตอนการ์ดขึ้น + PhotoView ตอนเปิด) ทีละภาพ, reduced = ไม่เล่น · เกณฑ์: FPS ≥ 50 ระหว่างเล่น, ภาพหลังนิ่งเหมือนต้นฉบับทุกพิกเซล

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

### 9. SavedCard ตามภาพ 10 — ผ่าน (tag `pre-savedcard`)
- `SavedCard.vue` เขียนใหม่ 4 ส่วนคั่นเส้นประ: (1) เครื่องหมายถูกในวงหมึกวาดมือสี `--cover` + "แปะลงสมุดแล้ว" + เวลา · อารมณ์ · ระดับ (2) "สีในภาพนี้" หยดสีน้ำ + % (3) "สีของวันนี้ เติมเข้าไปอีกหนึ่งช่วง" + `DayRibbon paintLast` + ก้อนสีของวันเปลี่ยนที่ ~1.5 วิ (ชื่อเดิมเทาขีดฆ่า ชื่อใหม่ตัวหนา; ภาพแรกของวัน/ชื่อเดิม ไม่ขีดฆ่า) (4) `HandButton` หลัก/รอง · พื้นการ์ด `PALETTE.card` (#FFFDF8) เส้นขอบ 2px หมึก `rounded-hand` `shadow-card` · ลบ `SavedWell.vue`
- **ตำแหน่ง (วัด bounding box):** 1280×800 การ์ด x 652–1158, y 70–712 อยู่ในหน้าขวา x 622–1188, y 48–752 · 1180×820 การ์ด x 601–1068, y 106–697 อยู่ในหน้าขวา x 573–1095, y 86–734 (เดิม การ์ดล้นถึง y 781 และ x 1190 เกินหน้าขวา/ทับขอบเล่ม) · ไม่ทับสายรัด (สายรัดเริ่ม x ~1204)
- **เฟรม:** ตลอดลำดับบันทึก (วัดตั้งแต่เรียก `saveToBook` ถึง 6.5 วิ) **ไม่มีเฟรมเกิน 50 ms** ทั้ง 1280×800 และ 1180×820, FPS 60 (ก่อนแก้มีเฟรม 53 ms หนึ่งเฟรมตอนจับภาพ+ดูดสี+เข้ารหัสภาพในเฟรมเดียว → แบ่งข้ามเฟรมใน `grabPainting`)
- เทียบกับแบบ: `scripts/out/screens/compare/09-saved-vs-ref.png` · contact sheet: `scripts/out/screens/savedcard/contact-sheet.png`, `saved-1280x800.png`, `saved-1180x820.png`

### 10. ภาพยังเปียก — ผ่าน (tag `pre-wet`)
- `lib/wetPhoto.js` (`startWet`/`stopWet`, singleton = เล่นทีละภาพ) + `lib/wetCurve.js` (`wetStrength` = peak·(1−u)² ease-out ถึง 0 ที่ 3 วิ; ฟังก์ชันล้วน เทสต์ `wetPhoto.test.js` 3 ตัว) + filter `#wet` ใน `SvgDefs.vue` (feTurbulence + feDisplacementMap ตั้ง `scale`/`baseFrequency` ทุกเฟรม แล้ว **ถอด `style.filter` ออก**) · ที่ใช้: `PhotoSlot.vue` (ภาพใหม่ ตอน `savePhase === 'card'`) และ `PhotoView.vue` (หลังภาพลอยลงที่ตอนเปิด หยุดทันทีตอนปิด/ถูกตัด) · เป้าคือ `[data-wet-target]` ที่ `Polaroid.vue`
- วัด (Chrome): ภาพที่เพิ่งแปะ FPS **60.3** (เฟรมช้าสุด 17 ms) · เปิดภาพเดี่ยว FPS **60.3** (17 ms) · **พิกเซลช่องภาพหลังนิ่ง = ก่อนเล่นทุกไบต์** (sha256 เท่ากัน; ระหว่างเล่นต่างจริง) · PhotoView หลังนิ่ง = หลังถอดฟิลเตอร์ด้วยมือ · filter ไม่ค้างบน DOM · เริ่มภาพที่สองแล้วภาพแรกหยุดทันที · reduced-motion: ไม่เล่น (`wetActive` false, filter ว่างทุกภาพ)
- ภาพ: `scripts/out/screens/wet/montage.png` (ก่อน / ระหว่าง / หลัง / PhotoView) + `contact-sheet.png` · **ความแรง (peak 7px) เป็นค่าที่เลือกเอง ควรดูด้วยตาว่าเบาพอดีไหม**


---

# สาย 3 (ข้อ 11–13)

- [x] **11. ตัวเล่นเพลงคลอ (mock-up รอไฟล์จริง)** — ดูผลด้านล่าง
- [x] **12. พู่กันในหน้าเลือกความรู้สึก วาดใหม่ให้ใหญ่และไม่แหลม** (SVG 60×300 แสดง ~66×330, ขนบานตอนแตะน้ำ ~55% ของท่าจุ่ม, เงาตกขวาล่าง, ไม่บังชื่ออารมณ์ของช่องที่เลือก, reduced = เปลี่ยนสีปลายอย่างเดียว)
- [x] **13. เก็บงาน** ย้าย filter `wcr` และสี `#FFFDF8` เข้า tailwind config/tokens ให้ถูกที่ (รีสตาร์ท dev server) + ฮาโลจางกว้าง/เบลอด้านหลัง DayRibbon (ป้ายต้องไม่ทับกัน)

### 11. เพลงคลอ — ผ่าน (tag `pre-music`)
- `lib/music.js` (โหลด `public/audio/music-{day,night}.mp3` ก่อน ไม่มีใช้ `.wav` ไม่มีทั้งคู่เงียบ; `AudioBufferSourceNode.loop` วนไม่มีช่องว่าง; day=กลางวัน+เย็น night=กลางคืน ตาม `lib/daylight.js`; crossfade 4 วิ; fade in 3 วิหลังแตะครั้งแรก) + `lib/sound.js` (บัสเพลง `musicBus` เข้าคอมเพรสเซอร์/ตัวจำกัดตัวเดียวกับเอฟเฟกต์, `MUSIC_BASE`, `duckMusic`, `setMusic`, `onAudioReady`, suspend/resume ตาม `visibilitychange`) + `SoundToggle.vue` 2 ปุ่ม (เพลง/เอฟเฟกต์ เปิดปิดและจำแยก `colorscrap.music` / `colorscrap.sound`, ไอคอน `music`/`musicOff` ใหม่) · ย้ายปุ่มตั้งค่าหน้า cover ลง 12 px (`top-10`) กันทับปุ่มเสียง
- ลดเสียงเพลง 50% ระหว่างลำดับบันทึก (`runSaveSequence`) และระหว่างแต้มแสงบาน (`sound.bloom`) แล้วคืนช้า ๆ · ห้ามเปลี่ยนเพลงตามอารมณ์ (ไม่มีโค้ดผูก)
- `scripts/make-placeholder-music.mjs` เขียน WAV เอง (คอร์ดแพด 24 วิ 22.05 kHz mono ต่อกันเนียน: ความถี่ครบรอบพอดี + หน้าต่าง cos² วงกลม; ตรวจรอยวนท้าย→ต้นเท่ากับความต่างตัวอย่างข้างเคียง) ได้ `public/audio/music-day.wav`, `music-night.wav` (ไฟล์ละ ~1 MB commit ไว้เป็น placeholder) · วิธีเปลี่ยนเพลงอยู่ที่ `docs/FILE-GUIDE.md` หัวข้อ "เพลงคลอ"
- วัด (Chrome headless, `?debug`): เพลงอย่างเดียวยอด **−22.6 dBFS** (เอฟเฟกต์ −3.4 dBFS → ต่าง ~19 dB; ตั้ง `MUSIC_BASE` 0.04 หลังวัดรอบแรกที่ 0.1 ได้ −14.7 ซึ่งดังเกิน) · ปิดเพลง: ยอด **0.0000**, busGain 0 · แตะรัวพร้อมเพลง 60 วิ (545 ครั้ง สลับหยด/แต้มแสง/ปาด): ยอด **−3.43 dBFS (< 0)** FPS 60 เฟรมช้าสุด 23 ms · crossfade day→night: แทร็กเปลี่ยน · duck: บัสเพลงระหว่างบันทึก/ปกติ = **0.50** แล้วคืน 0.0399 · pageerror 0 · **ไม่มีไฟล์เพลงเลย** (บังคับ 404): pageerror 0 และไม่มี `console.error` จากโค้ดเรา (เหลือเฉพาะบรรทัด "Failed to load resource 404" ของเบราว์เซอร์เอง 2 บรรทัด ซึ่งเลี่ยงไม่ได้เมื่อโฮสต์ตอบ 404; dev server/`vite preview` ตอบ index.html 200 จึงไม่ขึ้น)
- เทสต์ `music.test.js` 5 ตัว · ภาพ: `scripts/out/screens/music/contact-sheet.png` · **ยังไม่ได้ฟังเพลงด้วยหู/บน Safari**

### 12. พู่กันวาดใหม่ — ผ่าน (tag `pre-brush2`)
- `PickBrush.vue` ใช้ SVG ตามที่กำหนด (viewBox 60×300 แสดง 66×330 px, ปลายขนมนอยู่ล่างสุด = จุดจุ่ม) สีวัสดุมาจาก `BRUSH` ใน `lib/tokens.js` (เพิ่ม `wood-hi`/`wood-shade`/`metal-line`/`metal-hi`/`bristle-hi`, สี `wood`/`metal`/`bristle` เปลี่ยนตามแบบใหม่ → เคอร์เซอร์พู่กันใน `lib/cursors.js` เปลี่ยนสีตามด้วย) · เงา `drop-shadow(12px 12px 7px)` อยู่ที่กล่องนอกที่ไม่หมุน (ไม่งั้นเงาหมุนตามพู่กัน)
- แตะน้ำที่ **55% ของท่าจุ่ม** (`TOUCH_AT`): ปลายขนเปลี่ยนสี + วงน้ำ + เสียง + กลุ่ม `.bristles` บาน `scale(1.12, 0.9)` จากปลายขน (`transform-origin: 30px 299px`) 340 ms แล้วคืนรูป (WAAPI)
- ด้ามชี้ออกด้านนอก: คอลัมน์ซ้าย (0–1) เอียงซ้าย ขวา (2–3) เอียงขวา; **คอลัมน์ซ้ายสุดเอียงน้อยลง (14°)** เพราะ 30° ทำให้ด้ามพาดทับปุ่ม "หน้าแรก" (เห็นจากภาพจริง) · เช็กภาพ 8 ช่อง: ไม่บังชื่ออารมณ์ของช่องที่เลือก (ด้ามอยู่เหนือปลายขน ชื่ออยู่ใต้) ด้ามพาดทับการ์ดข้างเคียงบางส่วนซึ่งเลี่ยงไม่ได้เมื่อยาว 330 px · reduced-motion: อยู่นิ่งขวากล่อง เปลี่ยนสีปลายอย่างเดียว (ตรวจจากภาพ)
- ภาพ 3 จังหวะ (ยก / แตะน้ำ / หลังจุ่ม): `scripts/out/screens/brush2/brush-3-phases.png` · ช่องอื่น/reduced-motion: `scripts/out/screens/brush2/*.png`, `reduced/` · contact sheet: `scripts/out/screens/brush2/contact-sheet.png`

### 13. เก็บงาน — ผ่าน (tag `pre-cleanup`)
- `tailwind.config.js`: เพิ่ม utility `.filter-wcr` และ `.filter-wcrh` (ฟิลเตอร์ `#wcr`, `#wcrh` อยู่ใน `SvgDefs.vue`) · `DayRibbon.vue` ใช้คลาสแทน `style="filter:url(...)"` · `SavedCard.vue` ใช้ `bg-card` (`PALETTE.card` #FFFDF8 มีใน `tokens.js` อยู่แล้ว ไม่ใช้ inline แล้ว) · **รีสตาร์ท dev server แล้ว** (พอร์ต 5199: kill แล้ว `VITE_USE_MOCK=true npx vite --port 5199 --strictPort` — **ต้องใส่ `VITE_USE_MOCK=true`** ไม่งั้นอ่าน `.env.local` เป็นโหมดจริงแล้วบูตเข้าหน้า login สคริปต์ screens/วัดทั้งหมดต้องใช้โหมด mock) ตรวจ computed style: `filter-wcr`/`filter-wcrh` ติด, พื้นการ์ด = `rgb(255, 253, 248)`
- ฮาโลจางหลังริบบิ้น: ชั้นใหม่ `#wcrh` (กว้าง 80px, บิด 18, เบลอ σ=5, opacity .2) หลังสุด · ตรวจ bounding box ป้ายใน `?kit` 1–8 ภาพ: ทับกัน **0** ทุกกรณี · ภาพ: `scripts/out/screens/cleanup/ribbons-halo.png`
- หมายเหตุ: ถ้ามีใครรัน dev server ค้างไว้ก่อนดึง commit นี้ ต้องรีสตาร์ทเอง (config เปลี่ยน)


---

# ข้อ 14 — DayRibbon ให้ตรงแบบ 10–11

- [x] **14. DayRibbon หน้าตา** (tag `pre-ribbon2`)
  - ตามโครงที่กำหนด: ฮาโล `#wcrh` (+4px ทุกด้าน opacity .35, turbulence .05 oct 2 → displace 14 → blur σ2.2) → ตัวแถบ `#wcr` (−4px บนล่าง rx 40% opacity .85, turbulence .035 oct 3 → displace 9 → blur σ.8) → เกรน `#grain` บาง ๆ ลบชั้นอื่นทั้งหมด หัวท้ายสั่นจากฟิลเตอร์เอง · gradient เส้นเดียวตลอดแถบ ช่วงละ ≤ 2 สี (สีหลัก → แต้มแสงถ้า shifted) รอยต่อซึม 7% ของความกว้าง ไม่มีแถบเหลืองแทรก (เทสต์ `gradientStops`: 2 จุดหยุดต่อช่วงพอดี)
  - **รวมช่วง:** ภาพติดกันอารมณ์เดียวกัน + shifted เหมือนกัน → ช่วงเดียว น้ำหนักรวม ป้าย "04:05–04:08" + "ตื่นเต้น ×3" (ภาพเดียว: เวลาเดียว ไม่มี ×) การรวมเป็นการแสดงผลเท่านั้น (เทสต์ยืนยันไม่แก้ข้อมูลเดิม) ไม่แตะ `palette.js`
  - **ป้าย:** ช่วงแคบกว่า 90px ใช้เวลาอย่างเดียว ป้ายที่ชนกัน **เยื้องลงเป็นแถวถัดไป** (สูงสุด 4 แถว, ขีดบอกยืดลงถึงป้าย) แทนการซ่อน ซ่อนเฉพาะช่วงที่แคบกว่า 40px · ตรวจชนแบบ 2 มิติรวมขีด · ความกว้างข้อความประมาณจากตัวอักษรฐาน (ไม่นับสระ/วรรณยุกต์) × 10px ที่ 15px ปรับจากการวัดจริงในเบราว์เซอร์ (วัดที่ 16px ได้ 9.8–11.3 ต่อตัว)
  - **ชิป "สีในภาพนี้":** สี HSL L > 90% (`isPale` ใน `lib/color.js`) ได้ขอบ `PALETTE.line` บาง ๆ บิดตามหยด (ใน `WatercolorBlob.vue`) สีและ % ไม่เปลี่ยน
  - **เกณฑ์:** ป้ายทับกัน **0** ทุกกรณี 1–8 ภาพ ทั้งเทสต์ (4 ความกว้าง × 4 ชุดความเข้ม × 1–8 ภาพ) และ bounding box จริงใน `?kit` (แถว 1–8, `ref3`, `dup8`) · การ์ดหลังบันทึกยังอยู่ในหน้าขวา (1280×800: y 70–702 ใน 48–752; 1180×820: y 106–688 ใน 86–734) ไม่มีเฟรมเกิน 50ms · test 147 ผ่าน + build ผ่าน
  - ภาพเทียบ (แบบ / ของเดิม / ของใหม่ — 3 ภาพข้อมูลเดียวกับแบบ และ 8 ภาพมีอารมณ์ซ้ำติดกัน): `scripts/out/screens/ribbon2/compare-ribbon.png` · ภาพแยก `ribbon2/{old,new}-{ref3,dup8}.png` · contact sheet `ribbon2/contact-sheet.png`


---

# รอบยาว — ข้อ 15–33 (ทำต่อเนื่องบน feature/polish)

กติกา: tag `pre-<ชื่อ>` ก่อนเริ่ม · test+build ผ่านก่อน commit · ทีละข้อ commit+push · ห้ามแตะ main/merge/force · ฟิลเตอร์ SVG ใหม่ประกาศใน `<defs>` ของ SVG ตัวเองและใช้ attribute `filter="url(#…)"` · แก้ 2 รอบไม่ผ่านให้ revert แล้วจดเหตุผลที่นี่

## ช่วง 1 ดีไซน์ที่ค้าง
- [x] 15. หน้าจานสีประจำวัน: ก้อนสีในกรอบ `bg-card` 138×138 ขอบ 11px เท่ากัน เอียง −3° เงา card ไม่มีเทป/รหัสสี · ภาพ `scripts/out/screens/daypanel/14-book-วันนี้.png` (tag `pre-daypanel`)
- [x] 16. DayRibbon: filter + gradient ใน `<defs>` ของ SVG ตัวเอง id ไม่ซ้ำ (`${uid}-fm/-fh`) `filterUnits=userSpaceOnUse` เผื่อ 20px · ลบ `wcr/wcrh` ออกจาก SvgDefs และ tailwind · ภาพก่อน/หลัง `scripts/out/screens/ribbondefs/before.png` / `14-book-วันนี้.png` ดูเหมือนเดิม (tag `pre-ribbon-defs`)
- [x] 17. การ์ดจานสีของวันทำใหม่ตามภาพ 12: หัว BrandMark / กรอบสี (SVG `lib/dayFrame.js`) / DayRibbon (markup จาก `lib/dayRibbon.js` `ribbonSvg` → `lib/share/svgImage.js` → drawImage ไม่วาดแถบใหม่) + ป้ายเยื้องแถวจาก `layoutRibbon` / โพลารอยด์ 3 ใบ + "+N ภาพ" · ทดสอบ 1/3/13 ภาพ + Web Share จำลอง (`shared`) + ดาวน์โหลด (`downloaded`) ได้ PNG 1080×1350 (`scripts/render-cards.mjs`) · ภาพ `scripts/out/cards2/card-day-{1,3,13}.png` เทียบแบบ `docs/design/screens/12-card-day-v2.png` (tag `pre-daycard2`)
- [x] 18. การ์ดภาพเดี่ยว: หัวใช้ BrandMark ตัวเดียวกับการ์ดวัน (โลโก้ 64px + ชื่อ 44px) ส่วนอื่นไม่เปลี่ยน · `scripts/out/cards2/card-photo-*.png` (tag `pre-photocard2`)
## ช่วง 2
- [x] 19. BrandMark: `lib/brand.js` ที่เดียว → `BrandMark.vue` (ปกสมุด/login/hello) + favicon (SVG เดียวกัน `installFavicon`) + การ์ดเก็บรูป · FILE-GUIDE หัวข้อ "โลโก้" (tag `pre-brandmark`)
## ช่วง 3
- [x] 20. ใจฟูสูงสุด 3: `lib/likes.js` (+เทสต์ 4) · ครบ 3 ชิปที่เหลือจาง (aria-disabled opacity .4) · ตัวนับ "เลือกแล้ว N/3" + คำบอก · โปรไฟล์เดิมเกิน 3 แสดงทั้งหมด บอกให้เอาออก ปุ่มบันทึกกดไม่ได้จน ≤ 3 (`profile.likesTooMany`) · หน้าสมุดแสดง 3 อันแรกเหมือนเดิม ไม่แตะ schema · ภาพ `scripts/out/screens/likes3/` (ก่อน = `screens/brand/01-hello-ผู้ใช้ใหม่.png`) (tag `pre-likes3`)
- [x] 21. โน้ตอารมณ์พับเก็บ: แตะผ้าใบครั้งแรกของแผ่น (`FluidCanvas` emit `first-touch`) → `app.foldMood(true)` โน้ตเลื่อนออกขวา 450ms เหลือแถบ 60×176 ที่ขอบกระดาน (x 1204–1264 นอกผ้าใบ) กดแถบ = กางกลับ / ปุ่มเก็บบนโน้ต 44px · จำสถานะข้ามหน้าเปลี่ยนสีจนจบแผ่น (`resetWarmNote` = แผ่นใหม่/เริ่มใหม่/บันทึก/ออกจากระบบ → เปิดเต็ม) · reduced-motion จางอย่างเดียว · เสียง `sound.paperSlide` · ตรวจด้วย Playwright (ปกติ+reduced: พับ/ไม่กางซ้ำเมื่อแตะอีก/กางด้วยแถบ/เก็บด้วยปุ่ม/จำข้ามหน้า/แผ่นใหม่เปิด) ผ่านทั้งหมด · ภาพ `scripts/out/screens/moodfold/` (tag `pre-moodfold`)
- [x] 22. พลิกสมุด 3D (tag `pre-flip3d`)
  - `components/book/CoverFlip.vue`: ปก (หน้าหน้า = `BookCover`, หน้าหลัง = กระดาษในปก `backface-visibility:hidden`) พลิกรอบสันซ้ายของหน้าขวา `rotateY` 0 → −180° (`perspective(1800px)`) ด้วย WAAPI ease-in-out + เงาของปกทอดลงหน้าขวา (opacity 0→.42→0) + ครึ่งซ้ายของสมุดเปิดถูกซ่อน (`clip-path`) จนปกไปลงจอด · opacity อยู่ชั้นนอกของชั้น `preserve-3d` (ไม่งั้นหน้าหน้าทะลุ)
  - `Scrapbook.vue`: หน้าแรก→สมุด `open` 1.3 วิ (ชั้นปกปิดเลื่อนไปทับหน้าขวาแล้วจางให้ปกพลิกรับช่วง) · สมุด→หน้าแรก `close` เล่นย้อน แล้วชั้นสมุดเปิดจาง/ปกปิดเลื่อนกลับ (`closeDelay`) · ระบาย→สมุด/ลำดับบันทึก→saved `openShort` 0.9 วิ (ปกอยู่บนหน้าขวาแล้ว) · พิกัดอยู่ในชั้นสมุดเปิด จึงตามการซูมของหน้า saved เอง · เสียง `sound.flip({long})`
  - ลำดับบันทึก: `MOTION.save.flipExtra` 300ms (เพิ่มจากเดิมไม่เกิน 0.3 วิ ตามสเปก) เทสต์ `saveTimeline` ปรับเพดานเป็น 1700+300
  - พลิกแผ่น/เปลี่ยนวัน: `PhotoPage` layer key = วัน+แผ่น พลิกรอบสันกลาง (ขอบขวาของหน้าซ้าย `rotateY` 90° + เงา) ไปหน้า = แผ่นเก่าพลิกออก / ย้อน = แผ่นใหม่พลิกลงมาทับ · เปลี่ยนวันด้วยแท็บ/ปุ่มวัน (`app.turnToDay`) พลิกด้วย ส่วนเปิดสมุดไม่พลิก
  - reduced-motion: ปกไม่พลิก (fade 150ms เดิม), แผ่นใช้ `leaf-fade` · ใช้ transform/opacity/clip-path เท่านั้น
  - ภาพ: `scripts/out/screens/flip3d/open.png` (หน้าแรก→สมุด), `close.png` (สมุด→หน้าแรก, ระบาย→สมุด), `turn.png` (พลิกแผ่น) · FPS ระหว่างพลิก วัดในข้อ 29 (`docs/PERF.md`)
## ช่วง 4
- [x] 23. พื้นที่กด ≥ 44px: สแกนปุ่มจริงทุกหน้า (hello/cover/pick/paint/book/แผ่นแทรก/photo) พบ 4 ตัวต่ำกว่า 44 (ปุ่มเพลง/เอฟเฟกต์ 36, ลูกศรแผ่น 44×32) → ขยายพื้นที่กด หน้าตา/ตำแหน่งไอคอนเท่าเดิม · สแกนซ้ำ 0 ตัว (tag `pre-tap44`) · ยังไม่ได้สแกนหน้า login (ต้องโหมดจริง) และการ์ด saved
- [x] 24. `.fade`/WarmNote คูณ `--motion-scale` · FluidCanvas ใช้ `reducedMotion` จาก `lib/motion.js` · DateTabs ทุกแท็บสูง 58px แท็บที่ไม่ได้เปิด `translateY(12px)` ซ่อนหลังปก (เลิก animate height) (tag `pre-motion-tidy`)
- [x] 25. สีเทา hardcode → `PALETTE` (`mute faint edge well wash tray leaf tape-ink happy-wash`) + `EmotionBlob`/`HelloSheet`/`dayFrame`/focus ring/`cardDraw.C`/`exporter` อ่านจาก tokens · ภาพก่อน/หลัง (kit, hello, cover, pick, book, แผ่นแทรก, photo) ต่าง **0 พิกเซล** (`scripts/out/screens/greytokens/{before,after}`; ต้องรีสตาร์ท dev server หลังแก้ tokens) (tag `pre-greytokens`)
- [x] 26. ลบโค้ดค้าง: คอมเมนต์ทางถอย CPU (`FluidCanvas`) · `centreIndex` · `defaultsOf` · de-export `EMOTION_KEYS`/`WARM_DEFAULTS`/`LUMA` · prop `tilt` ของ `HandButton` · `lib/mixingWell.js` (ไม่มีผู้ใช้หลังการ์ดวันทำใหม่) · เศษ SavedWell/MixingWell/DayTimeline: ไม่มีไฟล์คอมโพเนนต์เหลือแล้ว เหลือแต่ข้อความใน docs (แก้ในข้อ 28) · **คงไว้** `timelineX`/`spreadXs`/`TIMELINE_*` ใน `palette.js` เพราะเป็นตัวอย่าง SPEC §8.3 ที่มีเทสต์ (กติกา: ห้ามแก้ตัวอย่างเอง), `visibleLight`/`limitScale` ใช้ในเทสต์, `INK_CAP` ใช้ใน `scripts/measure-fluid.mjs` (tag `pre-deadcode`)
- [x] 27. **ข้าม**: ยังไม่มี `public/audio/music-*.mp3` (มีแต่ `music-day.wav`/`music-night.wav`) จึงไม่ลบ placeholder ตามเงื่อนไข
- [x] 28. เอกสาร: SPEC §4.1 (`paint→cover`, saved), §7.2 RLS แยก 4 policy ตาม `schema.sql`, §5.0 ใจฟู ≤ 3, §5.3 โน้ตพับเก็บ, §5.6 พลิกแผ่น, §5.7 กรอบสี + DayRibbon (แทน MixingWell/DayTimeline), §5.9 การ์ดวัน (ภาพ 12), §5.10 พลิกปก 3D/เสียง/เพลง/แสงตามเวลา · FILE-GUIDE (ตาราง splash ตามโค้ด, pulse, ตัวกันดำ CPU, ตารางไฟล์ใหม่, โลโก้) · CLAUDE.md · PROJECT-OVERVIEW (แถบอัปเดต + §6 เสียง) (tag `pre-docs-sync`)
## ช่วง 5–6
- [x] 29. QA ทั้งแอป: `scripts/qa-flow.mjs` เดินทั้ง flow ผ่าน UI จริง 13 รอบ (1280×800 / 1180×820 × ปกติ/reduced × day/dusk/night) → console error 0, focus ring ขาด 0, ข้อความล้น 0, ใจฟูค้าง 3, โน้ตพับ, ดาวน์โหลด 3 ไฟล์ได้, รีเฟรชแล้วข้อมูลยังอยู่ · **29a** พบ/แก้: แท็บวันที่ (DateTabs) ส่วนที่โผล่พ้นปกสูงแค่ 26/38px → เพิ่มพื้นที่กดโปร่งใสด้านบน 18px (ดูเท่าเดิม) · FPS ใน `docs/PERF.md`
- [x] 30. `scripts/record-demo.mjs` → `scripts/out/demo/demo-night.webm` (83.6 วิ) และ `demo-day.webm` (82.8 วิ) ไม่ commit · **ไม่มีเสียง** (Playwright อัดเสียงไม่ได้) เคอร์เซอร์เป็นจุดจำลอง · ติดตั้ง ffmpeg ของ Playwright (1.4 MB นอกรีโป)
- [x] 31. `docs/DEPLOY.md` (Vercel/Netlify, env 3 ตัว ไม่มีค่าจริง, Redirect URL ใน Supabase Auth, เช็กหลัง deploy)
- [x] 32. `docs/CHANGELOG.md` (5 หมวด ภาษาคนทั่วไป)
- [x] 33. `scripts/out/screens/final/` (16 ภาพ + `contact-sheet.png`)


---

# รอบแก้ดีไซน์ — ข้อ 34–43

กติกาเหมือนรอบก่อน: tag `pre-<ชื่อ>` ก่อนแต่ละข้อ · screens/ภาพก่อน-หลัง · test+build ผ่านก่อน commit · commit+push ทีละข้อ · ห้ามแตะ main/merge · แก้ 2 รอบไม่ผ่าน revert แล้วข้าม

- [x] 34. ระยะบรรทัดไทยเป็น token `LEADING` ใน `tokens.js` (`leading-thai` 1.5 / `leading-head` 1.3 / `leading-stack` 1.7 สำหรับ Mali หลายบรรทัด) แทน `leading-[…]` รายจุด + ช่องว่างใต้/เหนือหัวข้อ (gap) · `scripts/check-leading.mjs` ตรวจกรอบบรรทัดทุกหน้า (เผื่อสระบน/ล่างของ Mali): **ก่อน 16 จุดชน → หลัง 0** ทั้ง 1280×800 และ 1180×820 · ภาพก่อน/หลัง `scripts/out/leading/compare.png` (tag `pre-leading`)
- [x] 35. ปกสมุด: สติกเกอร์อวตาร 110→58px แปะทับมุมซ้ายบนของป้ายชื่อ · "ของ <ชื่อ>" Mali ตัวหนา 26px (เดิม 16px, ย่อเป็น 22/18px เมื่อชื่อยาวกว่า 8/12 ตัว) · ปกส้ม #E0704A → #CC5A30 · รอยสีบนปกทึบขึ้น (opacity .45→.7) + ขอบกระดาษบาง ๆ ให้เห็นชัดทุกสีปก (ไม่เปลี่ยนสีปกอื่น) · ภาพก่อน/หลังทั้ง 4 สีปก `scripts/out/screens/cover2/before-all.png` / `after-all.png`, เทียบ `cmp.png` (tag `pre-cover2`)
- [x] 36. ปุ่มเสียงเป็น `HandButton icon` 48px กรอบวาดมือ (เพลง/เอฟเฟกต์ `aria-pressed` ถูกต้อง ไอคอนปิดมีเส้นขีด) อยู่ top 24px แถวเดียวกับปุ่ม "หน้าแรก" ทุกหน้า (ปรับ top ของหน้าแรกใน book/pick/paint, ตั้งค่า, ปุ่ม "สมุด" ในหน้าระบายขยับซ้าย) · หน้าแรก: [เพลง][เอฟเฟกต์][ตั้งค่า] ห่างเท่ากัน 12px · ตรวจ bounding box ทุกหน้า 1280×800 และ 1180×820 ไม่ทับปุ่มอื่น · **ข้อยกเว้น:** หน้า saved ซ่อนปุ่มเสียง (การ์ดกับสมุดซูมกินมุมขวาบน ไม่มีที่วางโดยไม่ทับ) · ภาพ `scripts/out/screens/soundbtn/after.png` (ก่อน = `screens/final/contact-sheet.png`) (tag `pre-soundbtn`)
- [x] 37. แผ่นแทรก (เปลี่ยนแผ่นในวันเดียวกัน) กลับเป็นพลิกขึ้น-ลง `rotateX` รอบแนวเทปบนเหมือนก่อนข้อ 22 (key = `leafIndex`, ตัด `rotateY`/เงา) · เปลี่ยนวันไม่พลิกในหน้านี้อีก · ตัวเปลี่ยนแผ่น "< แผ่น N / N >" อยู่ในหน้ากระดาษ (`bottom-0`) เส้นขอบกระดาษซ้อนยกขึ้นเป็น 62px ห่างข้อความ ≥ 12px · ภาพก่อน/หลัง `scripts/out/screens/flipdir/pager.png` (tag `pre-leaf-x`)
- [x] 38. ทิศการพลิกหน้าหนังสือ: เปลี่ยนวันใช้แผ่นกระดาษที่ `OpenBook.vue` (สำเนา DOM ของหน้าเดิมเป็นหน้าหน้า, หน้าเก่าฝั่งที่ลงคงอยู่ใต้แผ่นจนลงถึง, เงาทอดลงหน้าที่ถูกเปิดเผย) · วันใหม่กว่า = หน้าขวายกพลิกไปซ้าย (`rotateY` 0→−180 หมุนรอบขอบซ้ายของหน้าขวา) / วันเก่ากว่า = หน้าซ้ายยกพลิกไปขวา (0→+180) ใช้กับปุ่ม ‹ ›, แท็บ ทั้งเก่า/ใหม่ · ปกเปิด/ปิดตรวจแล้วถูกทิศ (ข้อ 22) · ตารางทิศ + เฟรมกลางใน RUN-REPORT · ภาพ `scripts/out/screens/flipdir/` · QA qa-flow ผ่าน 0 error (พบและแก้: สำเนาหน้าที่ค้างใน DOM มี `data-entry-id` ซ้ำ ต้องล้างหลังพลิก) (tag `pre-flipdir`)
- [x] 39. สรุปอารมณ์ของวัน (`DailyPalette.vue`): ประโยคทักบรรทัดบน + รายการ หยดสีเล็ก(`WatercolorBlob`) · ชื่ออารมณ์ · N ภาพ เรียงมาก→น้อย ในกล่องสูงคงที่ 84px (เลื่อนได้ `overflow-y:auto`, scrollbar บางสี `faint`, ขอบจางด้านล่างเมื่อยังมีต่อ `mood-fade`, `touch-action: pan-y`) ไม่ดันส่วนอื่น · การ์ดเก็บรูปของวันไม่มีข้อความนี้อยู่แล้ว จึงไม่ต้องแก้ · ภาพก่อน/หลัง `scripts/out/screens/moodlist/compare.png` (tag `pre-moodlist`)
- [x] 40. เสียงเอฟเฟกต์จากไฟล์: `sound.js` โหลด `public/audio/sfx/{drop,smear,splash,glow,dip,stroke,lift,tape,cover,page,note,tap}.mp3` ถ้ามี (ไม่มี/ถอดรหัสไม่ได้ = เสียงสังเคราะห์เดิม ไม่มี error) ผ่าน pool ≤ 6 เสียง + master + คอมเพรสเซอร์ + soft clip เดิม · smear วนได้ · เทสต์ 2 ตัว · ทดลองกับไฟล์ตัวอย่าง drop/cover/tap (โหลดสำเร็จ 3 ไฟล์ ไม่มี error แล้วลบทิ้ง) · ตาราง "เปลี่ยนเสียงเอฟเฟกต์" ใน FILE-GUIDE · **ยังไม่ได้ฟังด้วยหู** (tag `pre-sfxfiles`)
- [x] 41. แท็บคั่นหน้าบนปกปิดติดไปกับปกที่พลิก: ชั้นปกปิด (`Scrapbook`) แสดงแท็บทุก view ยกเว้น hello (เดิมแสดงเฉพาะ cover จึงหายตั้งแต่เริ่มพลิก) และ `CoverFlip` ส่ง `tabs` ให้ `BookCover` ในหน้าหน้าของแผ่นที่หมุน (ทั้งเปิด/ปิด) · ภาพเฟรมกลางก่อน/หลัง `scripts/out/screens/covertabs/compare-rot.png`, `compare.png` (tag `pre-covertabs`)
- [x] 42. ระบาย→สมุด และลำดับบันทึก ไม่พลิกปกแล้ว (เหลือ `open`/`close` ของหน้าแรก↔สมุด) สมุดเลื่อนเข้าตามก่อนข้อ 22 · ลบ `openShort`, `MOTION.flip.short`, `MOTION.save.flipExtra` · วัดลำดับบันทึก (ช่วง active) **ก่อน 1851 ms → หลัง 1551 ms** (= ก่อนข้อ 22) เฟรมสูงสุด 17 ms เกิน 50ms = 0 · ไม่มีปกจางขึ้นบนหน้าขวา · ภาพ `scripts/out/screens/nopaintflip/compare.png` (tag `pre-nopaintflip`)
- [x] 43. ฟอนต์ในแอปเอง: เพิ่ม `@fontsource/mali` + `@fontsource/ibm-plex-sans-thai-looped` (v5.3.0) นำเข้าใน `src/fonts.js` (Mali 400–700 / Plex 400–600 เฉพาะ thai+latin รวม 14 ไฟล์ woff2 ~230 KB ใน dist) ลบ Google Fonts ออกจาก `index.html` · `scripts/check-fonts.mjs` บล็อก fonts.googleapis/gstatic แล้วทุก weight โหลดจากไฟล์ของแอป (คำขอภายนอก 0) และการ์ดเก็บรูปยังใช้ฟอนต์ถูก (`scripts/out/cards-fonts/`) · ผู้ใช้ไม่ได้ใช้ไลบรารี่ใหญ่ >100 KB ในโค้ดแอป ไฟล์ฟอนต์อนุญาตตามข้อกำหนด (tag `pre-fonts`)


---

# รอบเก็บงาน — ข้อ 44–47

- [x] 44. DayRibbon เตี้ยลงครึ่งหนึ่ง (พื้นที่ 84→42, แถบ 56→28, ฮาโล/ตัวแถบ ±4→±2, ฟิลเตอร์ความถี่ ×2 scale/เบลอ ×½ ขอบยังสั่นนุ่ม) ป้ายเวลา 14→11px ชื่ออารมณ์ 15→12px (token `text-11/12`) แถวป้ายถี่ขึ้น (H1 17 / H2 37 / ROW_STEP 19) · การ์ดเก็บรูป RIB_K 1.3→1.8 ให้อ่านง่ายและแถบเตี้ยเหมือนในแอป · ส่วนล่างหน้าจานสีไหลเป็นคอลัมน์เดียว (หัวข้อ→แถบ+ป้าย→ย่อหน้า→รายการ) ประโยคทักต่อท้ายประโยคสรุปในย่อหน้าเดียว · ระยะที่วัดจริง: ป้าย→ย่อหน้า ≥ 20px (20/25), ย่อหน้า→รายการ 12px, รายการ→ปุ่มท้าย ≥ 26px · รายการเห็น 3 แถว (72px) เริ่มบนสุดทุกครั้งที่เปิดวัน ขอบจางล่างเสมอเมื่อยังมีต่อ บนเฉพาะตอนเลื่อนลงแล้ว · ภาพก่อน/หลัง 2 อารมณ์ + 13 ภาพ 4 อารมณ์ `scripts/out/screens/ribbon44-compare.png` การ์ด `scripts/out/cards44/` (tag `pre-ribbon-half`)
- [x] 45. เพลงจริง: `music-day.mp3` 4.4 MB (137.6 วิ, 256 kbps stereo) / `music-night.mp3` **8.8 MB** (275.9 วิ) — **night เกิน 5 MB** (รายงานตามสั่ง ยังไม่บีบอัด) · ลบ .wav placeholder แล้ว commit mp3 ทั้งสอง · loudness integrated day −16.3 LUFS (เดิม −16.9), night −19.2 (เดิม −17.5) ต่าง ≤ 1.7 dB < 4 dB จึงไม่ปรับ `MUSIC_BASE` (ยอดเพลงอย่างเดียววัดในเบราว์เซอร์: day −23.7 dBFS เทียบ −22.6 เดิม) · เงียบหัว/ท้าย: day หัว 0.03 วิ ท้าย 1.56 วิ, night หัว 3.21 วิ ท้าย 7.0 วิ → `trimSilence` ตัดตอนโหลดแล้ววนเฉพาะช่วงที่มีเสียง (`loopStart/loopEnd`) เทสต์ 2 ตัว · `candidates` เหลือ mp3 อย่างเดียว · **รอยต่อวนเป็นการตัดตรง ๆ ไม่ crossfade ภายในแทร็ก ต้องฟังว่ากระโดดไหม** (tag `pre-realmusic`)
- [x] 46. sfx: ย้ายไปวางที่ `src/assets/sfx/<ชื่อ>.mp3` รายการรู้ตอน build ด้วย `import.meta.glob(..., { eager, query: '?url' })` โหลดเฉพาะไฟล์ที่มีจริง (ชื่อนอกตารางถูกข้าม) · ตรวจด้วย Playwright: **ไม่มีไฟล์เลย → ไม่มีคำขอ sfx และ console error 0 (ไม่มี 404)** · มีไฟล์ drop+tap → `__sfxLoaded` = [drop, tap] (ไฟล์ทดลองลบแล้ว) · ในโหมด dev Vite จะขอไฟล์ทุกตัวที่อยู่ในโฟลเดอร์ผ่าน `?import&url` (เฉพาะไฟล์ที่มีจริง) · เทสต์ปรับแล้ว · FILE-GUIDE อัปเดตที่วางไฟล์ (tag `pre-sfx-glob`)
- [x] 47. qa-flow 1280×800 (`qa/final3`): console error 0, focus ring ขาด 0, ข้อความล้น 0, 60 fps ช้าสุด 17 ms ทุกช่วง, ใจฟู 3, โน้ตพับ, ดาวน์โหลด 3 ไฟล์, รีเฟรชข้อมูลยังอยู่ · check-leading 0 จุดชน (แถวรายการอารมณ์ปรับเป็น 26px) · contact sheet `scripts/out/screens/final3/contact-sheet.png`


---

# ข้อ 48 — โลโก้ใหม่

- [x] 48. โลโก้ใหม่ใน `lib/brand.js` ที่เดียว: wordmark / icon / lockup (`BrandMark variant`) ตัวอักษรเวกเตอร์จาก Mali 700 (`brandGlyphs.js`) · แทนทุกจุด: ป้ายบนปก = wordmark 44px, หน้าตั้งชื่อสมุด/เข้าสู่ระบบ = lockup 68px + คำรอง, การ์ดเก็บรูป 2 แบบ = lockup 64px · favicon.svg + PNG 16/32/180/512 + manifest + `index.html` (`scripts/make-favicons.mjs`) เลิก `installFavicon` · **ไม่พบไฟล์แบบอ้างอิง `docs/design/screens/13-logo.png` / `13-icon.png` ในรีโป** ทำตามคำอธิบายเป็นตัวอักษร จึงไม่มีภาพวางข้างแบบจริง ต้องเทียบด้วยตา · ภาพ: `scripts/out/screens/logo2/` (`sheet.png` 3 รูปแบบ + ขนาดเล็ก 24/16px, `favicons.png`, `compare.png` ก่อน/หลัง hello+ปก, `cards.png` ก่อน/หลังการ์ด) (tag `pre-logo2`)

# ข้อ 49 — ชิ้นสีของวันจากภาพจริง

- [x] 49. กรอบ "สีของวัน" ในจานสีประจำวัน (`DailyPalette.vue`) และการ์ดเก็บรูปของวัน ใช้ชิ้นที่ครอปจากภาพที่ผู้ใช้ระบายจริงแทนก้อนสีเบลอ · เลือกภาพต้นทาง `pickSourceEntry` (`lib/cropWindow.js`): `entry.liked` อันแรกก่อน **แต่ตอนนี้ยังไม่มีฟังก์ชันกดถูกใจภาพในแอป (`likes` เป็นของโปรไฟล์) จึงใช้ภาพล่าสุดของวันเสมอ** · หาพื้นที่: ย่อภาพ 128px, ระยะห่างจากสีกระดาษ, หน้าต่างจัตุรัส 50% ของด้านสั้น เลื่อนทีละพิกเซลด้วย integral image (`bestWindow`) · ครอปจากภาพเต็ม ≤480px (`lib/dayCrop.js` ใช้ `loadEntryBitmap` ตัวเดิม: Blob ในเครื่อง ไม่งั้น signed URL ของภาพเต็ม 1 ครั้งต่อวัน แล้วเก็บผลในหน่วยความจำ `clearDayCrops()` ตอน `entries.reset`) · ไม่มี blur/filter · โหลดไม่เสร็จ = พื้นกระดาษเปล่าแล้ว fade เข้า (`useDayCrop`), ครอปไม่ได้ = ก้อนสีเดิม, วันไม่มีภาพ = สถานะว่างเดิม · mock: วาดภาพจำลองจากสีของ entry (ตัววาดเดียวกับการ์ด) แล้วครอป · การ์ดวัน: `renderDayCard({ crop })` วางภาพเดียวกันในกรอบ (`dayFrameSvg({ crop: true })`, `CROP_BOX`) · ชื่อสี/สีหลักของวันยังมาจาก `palette.js` · ภาพ: `scripts/out/screens/palcrop/{before,after}/sheet-*.png` (`scripts/palcrop.mjs` 7 วัน) (tag `pre-palette-crop`)

# ข้อ 50 — ปรับรายละเอียดชุดย่อย (a–i)

- [x] 50. **a** กรอบ "สีของวัน" = `components/ui/PolaroidFrame.vue` (ขาว + `shadow-photo` ขอบล่างหนากว่า ไม่มีเทป เอียง −3°) ใช้ร่วมกับ `Polaroid.vue`; การ์ดวัน `dayFrameSvg` เป็นกรอบขาวแบบเดียวกัน (`CROP_BOX`) · **b** แถบ "กลับไประบาย" แสดงภาพล่าสุดที่เซฟ (`object-cover`, ขอ URL เฉพาะตอนอยู่ book/photo) ไม่มีภาพ = กราฟิกเดิม · **c** คำบรรยายโพลารอยด์ 7.5px (token `text-cap` = 50% ของ 15) + `leading-thai` ความสูงโพลารอยด์เท่าเดิม · **d/e** ป้าย "หยดสี" / "เติมสีสดใส" (วัดที่ 375px: บรรทัดเดียว ไม่ล้น ไม่ต้องลดฟอนต์) · **f** ข้อความที่เปลี่ยน: ถาดเครื่องมือ (2 ป้าย), `WarmNote` "ลองเติมสีสดใส", "→ สดใสขึ้น" ใน `PhotoSlot`/`PhotoView` (2)/`SavedFlight`/`DailyPalette` ("ที่ค่อย ๆ สดใสขึ้น")/`dayRibbon.js`/`cards.js` (2 การ์ด)/`KitGallery` + เทสต์ + SPEC.md; ไม่มี tooltip/aria-label/onboarding อื่นที่พูดถึงแสง; ชื่อ identifier (`warm`) และคอมเมนต์ในโค้ดไม่เปลี่ยน · **g** เสียงระฆังแก้ว (sine ~740 Hz + triangle ×2.4 ที่ 0.12, attack 30 ms, decay ~600 ms, lowpass 2 kHz, gain ≈ 1/3, กันซ้อน 150 ms) ไฟล์ override จริงคือ `src/assets/sfx/glow.mp3` (ไม่ใช่ `public/audio/sfx/warm.mp3`) ยังใช้ได้ · **h** ฟิลเตอร์ `wc/wcm/wct/wcs` ใน `SvgDefs.vue` ไม่มี blur: ขอบหยัก (displacement เล็ก), ขอบเข้มกว่า (erode → rim), เนื้อสีไม่เรียบ (alpha จาก noise ±~20%)
- **i** (ชื่อสี ↔ ภาพ): `palette.js` คำนวณชื่อจาก `mixColors` = ค่าเฉลี่ย HSL ถ่วงน้ำหนักของ `entry.colors` ทุกภาพ (สีที่ดูดจากพิกเซลตอนเซฟ; mock = เฉดสีอารมณ์) ไม่ใช่พิกเซลในภาพโดยตรง จึงอาจเป็นสีที่ไม่มีในภาพ · เป้าหมาย = สีผสมนั้น; ค้นทุกภาพ (ภาพย่อ 128px, `targetScores` = exp(−ΔE²/σ²) ใน OKLab **σ = 0.09**, ไม่นับพิกเซลใกล้กระดาษ ระยะ RGB < 28), หน้าต่าง 50% ด้านสั้น; **เกณฑ์ `MIN_MATCH` = 0.065** (คะแนนเฉลี่ยของหน้าต่าง) ต่ำกว่า → fallback ข้อ 49 + ตั้งชื่อใหม่จากชิ้นครอป (เฉลี่ย OKLab ถ่วง chroma → กลุ่มสี + เข้ม L<0.45 / อ่อน L>0.80 / จาง C<0.06) · ค่าจากการทดสอบ 12 วัน: สีมีจริงแต่เล็ก 0.082–0.103, ไม่มีสีนั้น 0.007–0.049 (ช่องว่างแคบ ตัวอย่างน้อย) · `displayGroup`: แดงสว่าง (L≥0.72) → ชมพู, ชมพู hue<310° L<0.6 → ม่วง, ม่วงอ่อนที่ซีดไม่เรียก "ครึ้ม" (`hueGroup` และเทสต์ SPEC ไม่เปลี่ยน) · cache ต่อวัน (key = id ภาพของวัน) · การ์ดวันใช้ชิ้น+ชื่อเดียวกัน · ภาพ: `scripts/out/screens/palcrop/i3/sheet-i3.png` (`scripts/palcrop.mjs`) ก่อน/หลัง a,b,c,e,h: `scripts/out/screens/details50/{before,after}/` (`scripts/details50.mjs`) (tag `pre-details50`)

# ข้อ 52 — ปรับรายละเอียดชุดถัดไป (a–g)

- [x] 52. **a** กรอบโพลารอยด์ของจานสีลงมา 24px (top 80→104, ส่วนล่างเลื่อน 230→254 สูง 276 รายการอารมณ์ยังเห็นเต็ม 78px) ห่างจากบรรทัด "x ภาพ · y อารมณ์" ~26px ที่จุดสูงสุดหลังเอียง · **b** ข้อความปก "วันนี้คุณรู้สึกอย่างไร / ไม่ต้องหาคำพูดอะไรมาอธิบาย / แค่ลองเลือกสี แล้วปลดปล่อยมันออกมา" (ตัด 3 บรรทัดที่ช่องว่างระหว่างวลี) แก้ `CoverIntro.vue` + SPEC (ไม่มีเทสต์อ้างข้อความนี้; ไฟล์ mock ใน `docs/design/` คงเดิม) · **c** เสียง `dip`: noise bandpass 1400→700 Hz decay ~150 ms + sine 320→180 Hz ใน 70 ms, สุ่ม ±5%, lowpass 3 kHz ไม่ผูกกับอารมณ์ ไม่ไต่ขึ้น ไม่เด้งซ้ำ · **d** เสียง `bloom`: 2–4 โน้ตสุ่มไม่ซ้ำจาก `BELL_SCALE` (587–1175 Hz pentatonic) ห่าง 60–100 ms โน้ตละ attack 30/decay ~600 ms/lowpass 2 kHz ความดังรวม 2/3 เดิม (peak ต่อโน้ต = 0.07×⅔÷จำนวนโน้ต) กันซ้อน 150 ms · อัดเสียง: `scripts/record-sfx.mjs` → `scripts/out/audio/{dip,glow}-{1,2,3}.wav` (OfflineAudioContext ผ่านคอมเพรสเซอร์จริง) · **e** คำบรรยายใน `Polaroid.vue` 16px (ลบ token `text-cap` ของข้อ 50c; การ์ดดาวน์โหลดไม่เปลี่ยน) ตัดสองบรรทัดที่ " → " ขอบล่างขยายตามจำนวนบรรทัด (inline style) · **f** หน้าแรกของสมุด (มีช่องชื่อ) เอา "· แก้ทีหลังได้เสมอ" ออก ใส่ "เปลี่ยนชื่อได้ภายหลังที่ปุ่มปรับแต่ง" ใต้ช่อง 13px เทา · **g** ปุ่มบนปก `aria-label="ปรับแต่งหน้าตาสมุด"` 56px พื้น ink ไอคอน paper + ป้าย "ปรับแต่ง" (HandButton `filled`/`large`) ปุ่มเสียงเลื่อนซ้ายเป็น right 132px (ห่างจากปุ่มปรับแต่ง 40px) · ที่ 375px กล่องปุ่มทั้ง 3 ไม่ทับกัน · ภาพ `scripts/out/screens/details52/{before,after}/` (`scripts/details52.mjs`) (tag `pre-details52`)

# ข้อ 53 — เก็บรายละเอียด + ตรวจเสียงจุ่มพู่กัน

- [x] 53. **a** เอาเทปบนกระดาษหน้าตั้งชื่อ/ปรับแต่งสมุด (`HelloSheet.vue`) ออก · **b** `AccountActions.vue` ใช้ `bottom: calc(48px + env(safe-area-inset-bottom))` วัดช่องห่างขอบล่างโต๊ะ **9 → 48 หน่วยสเตจ** (Mac 1280×800 = 48px, iPad 1180×820 = 44px จริงที่สเกล 0.922, 375px สเกล 0.293) ไม่ชนกระดาษซ้าย/ปุ่มบันทึก/ตัวอย่างปก · **c** `vite.config.js` เปิด vue-devtools เฉพาะ `VITE_DEVTOOLS=true` (ค่าเริ่มต้นปิด) บันทึกใน README "Dev", CLAUDE.md, FILE-GUIDE; `dist/` ไม่มี devtools · **d** สาเหตุเสียงจุ่มยังเหมือนเดิม: ไม่มีไฟล์ override (`src/assets/sfx/` ไม่มีอยู่), `PickBrush` เรียก `sound.dip(key)` ฟังก์ชันเดียวกับที่แก้ในข้อ 52c แต่ (1) แตะการ์ดอารมณ์ยังมี `sound.tap()` ของทุกปุ่มดังซ้อนก่อนจุ่ม 350 ms → ใส่ `data-no-tap` ที่การ์ดอารมณ์ให้เหลือเสียงจุ่มเดียว (2) dev HMR: แก้ `sound.js` โดยไม่โหลดหน้าใหม่ทำให้คอมโพเนนต์ที่ยังไม่ถูกอัปเดตถือ `sound.js` ตัวเก่าคนละ instance (พบ `sound.js` สองแบบ URL ในหน้าเดียวตอนตรวจ) → เพิ่ม `import.meta.hot.decline()` ใน `sound.js` ให้แก้แล้วรีโหลดทั้งหน้า (production ไม่เกี่ยว) · ตรวจจริงด้วย Playwright: คลิกการ์ดแล้วมี `sound.dip` ครั้งเดียว oscillator 1 + noise 1 ไม่มีเสียงอื่น · อัดจากแอป `scripts/record-app-dip.mjs` → `scripts/out/audio/dip-app-{1,2,3}.wav` (คลิกการ์ดจริง) เทียบ `dip-{1,2,3}.wav` (เรียก `sound.dip` ตรงในแอป `DIRECT=1`) ซองเสียงตั้งแต่จุดเริ่มตรงกัน (−12 → −73 dBFS ใน ~150 ms) · ไฟล์ `dip-*`/`glow-*` จาก `record-sfx.mjs` (OfflineAudioContext) เบากว่าในแอปจริง ~12 dB (ใช้ฟังรูปร่างเสียงได้ ไม่ใช้เทียบระดับ) (tag `pre-details53`)

# ข้อ 56 — เสียงจุ่มพู่กันเป็นน้ำกระฉอก

- [x] 56. ใช้ไฟล์จริง `src/assets/sfx/dip-1.mp3` (จาก `docs/design/audio-src/dip-b.mp3`: สแปลชสั้นสะอาด เริ่มทันที ไม่มีหาง ศูนย์กลาง ~1.6 kHz) และ `dip-2.mp3` (จาก `dip-a.mp3`: น้ำปั่นป่วน สว่างกว่า ~2.5 kHz มีหางฟอง) · **ไม่ใช้ `dip-c.mp3`**: เงียบ 125 ms ก่อนเริ่ม และพลังงาน 38% อยู่ที่ 120–500 Hz (เสียง "ปั๊ก/ตุบ" แบบเดิม) · เตรียมด้วย `scripts/make-dip-sfx.sh` (ffmpeg): ตัดเงียบหัว ≤ 600 ms fade out 100 ms highpass 120 Hz ×2 mono ยอด −6 dBFS mp3 96 kbps · ระบบ sfx รองรับหลายไฟล์ต่อเสียง (`name-N.mp3` สุ่มเล่น `sfxBase`) · เล่น: สุ่มไฟล์ + playbackRate 0.94–1.06 gain 0.4 (ยอดในแอป ≈ −10 dBFS ใกล้เสียงอื่น) กันซ้อน 150 ms · synth สำรอง: ไม่มี sine ทุ้ม, noise ผ่าน bandpass 900→1500→800 Hz (attack 15 ms decay ~300 ms) + ฟอง 3–5 เม็ด (sine 20–40 ms ไต่ 500–800→1000–1400 Hz สุ่มเวลา 0–200 ms) ยอด ≈ −12 dBFS · อัดจากคลิกการ์ดจริง: `scripts/out/audio/dip-water-{1,2,3}.wav` (ไฟล์) และ `dip-water-synth-{1,2,3}.wav` (synth สำรอง บล็อก mp3 ด้วย `FALLBACK=1 PREFIX=dip-water`) ยังไม่ได้ฟังด้วยหู (tag `pre-dipwater`)

# ข้อ 57 — เอา dip-a ออก + merge เข้า main

- [x] 57. ลบ `src/assets/sfx/dip-2.mp3` (เหลือ `dip-1.mp3` จาก `dip-b`; ต้นฉบับ `docs/design/audio-src/` ครบ 3 ไฟล์) `make-dip-sfx.sh` สร้างเฉพาะ dip-1 · ตรวจ: เล่นได้เมื่อมีไฟล์เดียว playbackRate สุ่ม (วัด 0.976 / 1.03 / 1.05) · ตรวจความพร้อม deploy: ไม่มี router (ใช้ hash) จึงไม่ต้อง rewrite · ไม่มี service_role ในโค้ด · **แก้ `VITE_USE_MOCK` ให้ไม่ตั้ง = โหมดจริง** (`=== 'true'` เท่านั้นที่เป็นโหมดจำลอง) · devtools ไม่อยู่ใน build · `build + preview` ไม่มี 404 (ฟอนต์ เสียง เพลง favicon) ทั้งโหมดจริงและ mock · CHANGELOG/DEPLOY อัปเดต (tag `pre-merge-polish` ที่ main เดิม)

# ข้อ 59–60 — การ์ดล้นขอบ Safari iPad + เสียงหลังสลับแอป + maskName สระหน้า

- [x] 59. **a** การ์ดดาวน์โหลด (Canvas 2D 1080×1350 เดิม): `fitLines`/`drawFitted` ย่อข้อความ ≤ 70% แล้วตัดบรรทัด แล้วตัดท้ายด้วย "…" (วันที่ตามความกว้างหลังโลโก้, ท้ายการ์ด, คำบรรยาย, ชื่อสี) · `drawText` วัดแล้ววางเอง ไม่ใช้ `textAlign` · warm-up ฟอนต์ก่อนวาด · จุดเซ็นเซอร์ `•` วาดเป็นวงกลม (`drawMasked`) เพราะ glyph ของ Mali แปลก · `scripts/render-card-export.mjs` · **b** `sound.js`/`music.js`: visibilitychange, pagehide/pageshow, statechange → ติด listener ปลุกครั้งเดียวเมื่อ context ไม่ running, resume ไม่ขึ้นใน 800 ms/ถูก close = สร้าง context ใหม่ + เพลงเล่นต่อ, `audioState` · เทสต์ `audioResume.test.js`
- [x] 60. `maskName`: สระหน้ารวมกับ grapheme ถัดไปเป็นก้อนแรก (ไข่หวาน → ไข่•••น, เมย์ → เม•ย์) จำนวนจุด/ก้อนท้ายเดิม · SPEC เพิ่มตัวอย่าง

# ข้อ 61 — เพลงเริ่มช้า + ชั้นแผ่นพลิกตอนย้อนวัน

- [x] 61. **a** เพลงเป็นสตรีม `HTMLAudioElement` (ต่อ `MediaElementAudioSourceNode` เข้า `musicBus` เดิม) preload ตอนเปิดหน้า `play()` ในแตะแรกแล้ว fade in 1.5 วินาที · ไฟล์ `src/assets/audio/` มี hash, cache ยาวใน `vercel.json`/`public/_headers` · `scripts/make-music.sh` ตัดเงียบ + crossfade ท้าย→หัว + mp3 112 kbps (day 4.4→1.8 MB, night 8.8→3.7 MB; ต้นฉบับเก็บ `docs/design/audio-src/`) · วัดบน Fast 4G (`scripts/measure-music.mjs`, แตะหลังโหลด 1.5 วินาที): **day 4.1–4.4 วิ → 0.03–0.06 วิ, night 8.1–8.2 วิ → 0.03–0.08 วิ** (แตะที่ 0.1 วินาทีหลังโหลด ~0.25–0.3 วิ) · โค้ดสลับแอป (59b) ใช้กับ element: ซ่อน→pause กลับมา→play ถ้าถูกปฏิเสธรอแตะ · เทสต์ mock ใน `audioResume.test.js` · **b** แผ่นพลิกกับสำเนาหน้าเก่าใต้แผ่นได้ `z-[31]`/`z-[30]` (สาเหตุ: `.leaf-layer {z-index:1}` ของหน้าซ้ายอยู่เหนือแผ่นที่ไม่มี z-index ตอนย้อนวัน) · หลักฐาน `scripts/record-flip-layer.mjs` ก่อน/หลัง

# ข้อ 62 — ของในหน้าโผล่หลังพลิกหน้าเสร็จ

- [x] 62. สาเหตุ: (1) หลังแผ่นที่พลิกเป็นกระดาษเปล่า หน้าใหม่ที่แผ่นไปลงถูกซ่อนแล้วเฟดเข้าใน 12% สุดท้ายซ้อนกับสำเนาหน้าเก่า → เห็น "ว่าง → ภาพซ้อน → หน้าใหม่" (2) กรอบชิ้นสีของวัน (`DailyPalette`) คำนวณ async แล้ว fade 600 ms หลังเปลี่ยนวัน วันที่ยังไม่เคยเปิดจึงโผล่ตอน/หลังพลิก (3) ภาพย่อของวันปลายทางเพิ่งเริ่มโหลดตอน mount · ไม่มี unmount/remount หลังพลิกเสร็จ (`stopTurn` ล้างแค่สำเนา) · แก้: หลังแผ่น = สำเนาหน้าใหม่ (พลิกไปพร้อมแผ่น สลับเป็นหน้าจริงเหมือนกันทุกพิกเซล) · รอภาพย่อ/ชิ้นสี/decode ≤150 ms ก่อนเริ่มพลิก (แผ่นคลุมหน้าเก่าไว้ระหว่างรอ) · อุ่นภาพ+ชิ้นสีของวันก่อนหน้า/ถัดไป · `RevealImg` เฟดสำรอง 200 ms เฉพาะรูปที่ไม่ทัน · วัด (Fast 4G ไม่แคช พลิกทันที): ย้อนวัน ระยะห่างจากหน้านิ่ง +0…+400 ms ก่อน 23–26 (ค้างถึง +398 ms) → หลัง 0 ตั้งแต่พลิกเสร็จ · หลักฐาน `scripts/record-flip-reveal.mjs` → `scripts/out/screens/flip-reveal/`
