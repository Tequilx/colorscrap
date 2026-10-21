# ROADMAP — งานคิวบน `feature/polish`

กติกาอยู่ที่ CLAUDE.md หัวข้อ "กติกาทำงาน" ทำตามลำดับ ติ๊กเมื่อผ่านเกณฑ์ ถ้าไม่ผ่านภายใน 2 รอบแก้ ข้ามแล้วจดเหตุผลไว้ใต้ข้อ

- [x] **1. เสียง** (`src/lib/sound.js`, Web Audio สังเคราะห์ ไม่ใช้ไฟล์)
  - หยดสี / ปาดสี / สาด / สีอุ่นบาน / บันทึก (ลม + เทป) / พลิกแผ่น-เปิดสมุด / แตะปุ่ม, ปุ่มเปิด-ปิดเสียงมุมขวาบน (localStorage), ไม่เกิน 6 เสียงพร้อมกัน + master volume
  - เกณฑ์: ปิดแล้วเงียบสนิท · แตะรัว 2 นาที peak < 0 dBFS และ FPS ไม่ลด · ใช้ได้ Chrome + Safari
- [x] **2. แสงตามเวลาจริง** (overlay บนพื้นโต๊ะ ใต้กระดาษ)
  - กลางวัน 06–17 / เย็น 17–19 / กลางคืน 19–06, crossfade 2 วิ, `?time=day|dusk|night`, reduced-motion: ฝุ่นนิ่ง
  - เกณฑ์: สีที่ดึงจากภาพเหมือนเดิมทุกช่วงเวลา · FPS ระหว่างระบายไม่ลด · screens ครบ 3 ช่วงเวลา
- [x] **3. พู่กันจุ่มสีในหน้าเลือกความรู้สึก**
  - พู่กัน SVG เลื่อนไปการ์ดที่เลือก ยก-จุ่ม วงน้ำกระเพื่อม ปลายขนเป็นสีอารมณ์ ~0.7 วิ, ไม่บล็อก "เริ่มระบาย", เสียงจุ่ม, reduced-motion: เปลี่ยนสีปลายขนอย่างเดียว
- [ ] **4. เคอร์เซอร์** (เฉพาะ `pointer: fine`)
  - นิ้วชี้ SVG 32px ทั่วแอป · บนผ้าใบ: ปาด = นิ้วติดสีอารมณ์ / หยด = พู่กันสีอารมณ์ / สีอุ่น = พู่กันสีอุ่น · จอสัมผัสไม่เปลี่ยน
- [ ] **5. บ่อสีใน SavedCard กระเพื่อม** (คอมโพเนนต์ well แยก)
  - หยดตกบ่อ วง 2–3 วง สีผสมจากสีเดิมของวัน → สีใหม่ ~1.2 วิ เล่นครั้งเดียว, เสียงหยด, reduced-motion: จางเปลี่ยนสี, ห้ามเปลี่ยนเลย์เอาต์การ์ด

## บันทึกผล
(เติมใต้แต่ละข้อเมื่อทำเสร็จ: ตัวเลขเกณฑ์ / path contact sheet / เหตุผลที่ข้าม)

### 1. เสียง — ผ่าน (tag `pre-sound`)
- `src/lib/sound.js` (Web Audio สังเคราะห์ทั้งหมด) + `components/ui/SoundToggle.vue` (มุมขวาบน ไอคอน `sound`/`mute` ใน `lib/doodles.js`, จำใน `localStorage['colorscrap.sound']`, ค่าเริ่มต้นเปิด) เทสต์ `sound.test.js` 8 ตัว (pitch, voice pool ≤ 6, ยอด soft clip, ซองสีอุ่น, อ่านค่าที่จำ)
- จุดเรียก: หยด/ปาด/สาด/สีอุ่นบาน ใน `FluidCanvas.vue`; เปิดสมุด/พลิกแผ่น/ลมกระดาษ/เทป ใน `stores/app.js` (ตาม `saveSchedule`); แตะปุ่มทั่วไปใน `App.vue`
- วัด (headless Chrome, `--autoplay-policy=no-user-gesture-required`, `?debug`): แตะรัวสลับหยด/สีอุ่น/ปาด 120 วิ (1090 ครั้ง) **ยอดสัญญาณหลังตัวจำกัด −3.4 dBFS** (< 0), เสียงพร้อมกันสูงสุด 6, **FPS 60 เท่ากับตอนปิดเสียง** (เฟรมช้าสุด 20 ms ทั้งสองแบบ); ปิดเสียง → ยอด 0 (เงียบสนิท)
- Safari: ใช้เฉพาะ API มาตรฐาน (`webkitAudioContext` สำรอง, สร้าง/resume หลัง pointerdown/touchend/keydown, ไม่ซ้อน `setValueAtTime` กับ `setValueCurveAtTime`) **ยังไม่ได้ลองบน Safari จริง** (ต้องเช็กด้วยหู/เครื่องจริง)
- ภาพ: `scripts/out/screens/sound/contact-sheet.png`

### 2. แสงตามเวลาจริง — ผ่าน (tag `pre-light`)
- `components/desk/DeskLight.vue` (ชั้นแรกสุดใน `Stage.vue` ใต้เวทีทั้งหมด จึงอยู่ใต้กระดาษ/ผ้าใบ/สมุด/การ์ดเสมอ) + `lib/daylight.js` (`periodOf`, `?time=day|dusk|night` ใช้ได้ทั้ง production) + สีแสงใน `lib/tokens.js` `LIGHT` · สามชั้นสลับด้วย opacity อย่างเดียว crossfade 2 วิ (reduced-motion: 150ms ตาม `app.css` และฝุ่นนิ่ง/ไม่มี animation) · เทสต์ `daylight.test.js` 2 ตัว
- วัด: ภาพผ้าใบ (พิกเซลจริงบนจอ) ต่างกัน **0** ระหว่าง day/dusk/night และสีที่ดึงจากภาพ (`extractColors`) **เหมือนกันทุกช่วงเวลา** (5 สีเท่ากันทุกค่า) · แตะสีอุ่นรัว 60 วิ: FPS **59.9 ทั้ง day/dusk/night** (เฟรมสะดุดครั้งเดียว ~150 ms ที่แตะครั้งแรกคือคอมไพล์ shader ยกสี มีอยู่ก่อนแล้ว เกิดเหมือนกันทุกช่วงเวลา)
- ภาพ: `scripts/out/screens/light-time=day|dusk|night/contact-sheet.png`

### 3. พู่กันจุ่มสีในหน้าเลือกความรู้สึก — ผ่าน (tag `pre-brush`)
- `components/pick/PickBrush.vue` (วางใน `EmotionPalette.vue`, `pointer-events: none`): พู่กัน SVG (ด้ามไม้ ปลอกโลหะ ขนสีเข้มชี้ลง สีวัสดุอยู่ใน `lib/tokens.js` `BRUSH`) เลื่อนด้วย tween ใน rAF จากตำแหน่งปัจจุบันเสมอ: ยกขึ้น → จุ่มลง → ถอยพัก; สัมผัสน้ำสี = ปลายขนเปลี่ยนสีอารมณ์ (`transition: fill 700ms`) + วงน้ำ 3 วง + `sound.dip()` (ใหม่ใน `sound.js`) · เลือกเร็ว ๆ ต่อกันพู่กันตามไปช่องใหม่ทันที · ปุ่ม "เริ่มระบาย" กดได้ตลอด (ทดสอบกดระหว่างพู่กันเคลื่อนที่ → เข้า paint)
- reduced-motion: พู่กันอยู่นิ่งที่ขวาของกล่อง (ไม่เคลื่อน ไม่มีวงน้ำ) แค่เปลี่ยนสีปลายขนทันที
- **หมายเหตุ:** artboard อ้างอิง "DeskPick" ไม่อยู่ในรีโป/ที่เข้าถึงได้ในรอบนี้ (มีแต่ `docs/design/screens/*.dc.html`) ท่าทางและรูปทรงพู่กันจึงทำตามคำอธิบายในโจทย์ — **ต้องเช็กด้วยตาเทียบแบบ DeskPick**
- บั๊กที่เจอระหว่างทำ: ตำแหน่งพู่กันที่ผูก `:style` ใน template ถูกเขียนทับเมื่อ re-render (วงน้ำเพิ่ม/ลบ) → ตั้ง `style.transform` ใน JS อย่างเดียว
- ภาพ: `scripts/out/screens/brush/pick-dip-sequence.png` (ลำดับคลิก/คลิกรัว), `pick-reduced-motion.png`, `scripts/out/screens/brush/contact-sheet.png` (ทุกหน้า)
