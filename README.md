# IT Asset, Phone Directory & Dashboard System

ระบบจัดการอุปกรณ์ IT และสมุดโทรศัพท์ภายใน สำหรับทีม IT Support โรงพยาบาล (ใช้งานคนเดียว, หลายสาขา)
**Frontend:** HTML + CSS ล้วน (ไม่มี framework) + Vanilla JS → โฮสต์บน GitHub Pages
**Backend:** Google Apps Script (Web App) + Google Sheets เป็นฐานข้อมูล
**Repo:** github.com/webthai/IT

---

## สถานะปัจจุบัน (v3.1)

ระบบผ่านการปรับใหญ่มาหลายรอบ จาก v1 (สเปกเริ่มต้น) → v2 (แก้ปัญหาโหลดช้า) → v3 (เพิ่มระบบ Admin + schema แบบ dynamic) → v3.1 (Logout, PIN lockout, PWA)
รายละเอียดการเปลี่ยนแปลงทั้งหมดอยู่ใน "ประวัติการพัฒนาโดยละเอียด" ด้านล่าง

**ค่าที่ใช้งานอยู่ตอนนี้:**
- Login เข้าเว็บ (ครั้งเดียวต่อเครื่อง): user `meen` / password `5340`
- PIN ยืนยันการเพิ่ม/แก้ไข/ลบทุกจุด (รวม Admin): `05032540`
- สาขา: อโศก, ปิ่นเกล้า, อุดร
- ประเภทอุปกรณ์: IPPhone, EDC, Pinpad, PrinterServer (Printer/Print Server รวมกัน), PC

ค่าทั้งหมดข้างบนนี้ **แก้ไขได้จากหน้าเว็บ (แท็บ Admin) แล้ว ไม่ต้องแก้โค้ด** — ค่าที่เขียนไว้ตรงนี้คือค่า ณ เวลาที่เขียนเอกสารนี้เท่านั้น
AI/คนที่มาทำงานต่อควรดึงค่าจริงจากชีต `Config` เสมอ อย่ายึดตามตัวเลขในเอกสารนี้เพียงอย่างเดียว

**เพิ่มใน v3.1 (ไม่กระทบ backend/Code.gs เลย แก้แค่ `index.html` + `app.js` และเพิ่มไฟล์ `manifest.json`):**
- ปุ่ม "ออกจากระบบ" ที่หัว header
- Lockout พื้นฐานบน Admin PIN keypad — ผิดครบ 5 ครั้ง ล็อก 30 วินาที (client-side, ไม่ persist ข้าม reload)
- `manifest.json` สำหรับ Add to Home Screen (ยังไม่มี service worker/offline)

---

## ประวัติการพัฒนาโดยละเอียด

### v1 — สเปกเริ่มต้น
สร้างระบบตามสเปก: Dashboard, Phone Directory, จัดการอุปกรณ์ 5 ประเภท (IP Phone, EDC, Pinpad, Printer, Server/PC), PIN `5340` ยืนยันการบันทึก, หลายสาขา, GitHub Pages + Apps Script + Sheets, ใช้ Tailwind CDN

### v2 — แก้ปัญหาโหลดช้า + ปรับโครงสร้างอุปกรณ์
- ตัด Tailwind CDN และ Google Fonts ออก เขียน CSS เองในไฟล์เดียว ลดจำนวน request ตอนโหลดหน้าแรก
- เปลี่ยนจากยิง API หลายครั้ง (ทุกครั้งที่เปลี่ยนแท็บ/สาขา/ประเภท) มาเป็นดึงข้อมูลทั้งหมดครั้งเดียวตอนเปิดเว็บ (`action=bootstrap`) แล้วกรอง/ค้นหา/สลับแท็บทำในเบราว์เซอร์ล้วนๆ
- เพิ่ม cache ฝั่ง backend (`CacheService`, 5 นาที) และ `LockService` กันเขียนข้อมูลชนกัน
- เก็บสำเนาข้อมูลไว้ใน `localStorage` เปิดเว็บได้ทันทีแม้เน็ตหลุด (แสดงข้อมูลเก่าไปก่อน แล้วค่อยอัปเดตเบื้องหลัง)
- เพิ่มฟิลด์ "เลข AnyDesk" ให้ประเภทที่เกี่ยวกับ PC/Server
- แก้บั๊ก: EDC กับ Pinpad ควรมีทั้ง TID และ Serial Number แต่ `Code.gs` เดิมมีคอลัมน์ไม่ครบ ทำให้กรอกแล้วข้อมูลหายเงียบๆ — แก้ให้ทั้งคู่มีครบทั้งสองคอลัมน์
- แยก "Printer" กับ "Server/PC" เดิมที่เป็นคนละประเภท มารวม Printer กับ Server เป็นประเภทเดียว `PrinterServer` (เพราะเครื่อง Print Server ทำหน้าที่ซ้อนกัน) และแยก `PC` ออกมาเป็นประเภทของตัวเอง
- เพิ่มหน้า Login (user `meen` / password `5340` ตอนนั้น) จำไว้ใน `localStorage` ครั้งเดียวต่อเครื่อง — ตอนนั้น user/password ยังฝังอยู่ใน `app.js` ตรงๆ (มีข้อจำกัดด้านความปลอดภัย ดูหัวข้อ "ข้อจำกัดด้านความปลอดภัย")

### v3 — ระบบ Admin + Dynamic Schema (ปรับใหญ่ที่สุด)
เปลี่ยนจากทุกอย่าง hardcode ในโค้ด มาเป็นเก็บในชีตทั้งหมด แก้ผ่านหน้าเว็บได้:

1. **ชีตใหม่ 3 อัน:**
   - `Config` — Key/Value เก็บ `pin`, `loginUser`, `loginPass`, `branches` (JSON array string)
   - `SchemaTypes` — `TypeKey` (ชื่อชีตข้อมูลจริง) / `TypeLabel` (ชื่อที่แสดงในเว็บ)
   - `SchemaFields` — `TypeKey` / `FieldKey` (ชื่อคอลัมน์จริง) / `FieldLabel` / `FieldType` (text/dropdown/date) / `FieldOptions` / `ShowInTable`
2. **Login ตรวจฝั่ง server แล้ว** (`action=login` ใน `doPost`) — ไม่มี user/password ฝังใน `app.js` ที่เปิด source ดูได้อีกต่อไป (ปลอดภัยขึ้นกว่า v2 จริง ไม่ใช่แค่ obscurity)
3. **แท็บ Admin ใหม่** มี 4 ส่วน:
   - **สาขา** — เพิ่ม/แก้ชื่อ/ลบสาขา
   - **ตั้งค่า PIN/Login** — เปลี่ยน PIN, user, password login
   - **Log** — ดูประวัติย้อนหลัง (สูงสุด 200 รายการ) กรองตามช่วงวันที่และประเภทได้
   - **ประเภท & ฟิลด์** — เพิ่ม/แก้ชื่อ/**ลบจริง**ประเภทอุปกรณ์ทั้งชีต และเพิ่ม/**ลบจริง**ฟิลด์ในแต่ละประเภท เลือกชนิดฟิลด์ได้ 3 แบบ (ข้อความ/ตัวเลือก dropdown/วันที่) — ใช้คำสั่ง Apps Script จริง (`insertColumnBefore`, `deleteColumn`, `insertSheet`, `deleteSheet`) ไม่ใช่แค่ซ่อนใน UI ข้อมูลแถวอื่นไม่เลื่อนตำแหน่งผิดเพราะ Sheets จัดการ shift ให้อัตโนมัติ
4. **Admin PIN gate แยกต่างหาก** — กด Admin ครั้งแรกต้องใส่ PIN ก่อน ใส่ถูกครั้งเดียวใช้ได้ทั้ง session (เก็บใน JS memory เท่านั้น ไม่ persist ข้าม reload เพราะเป็นโซนที่ลบข้อมูลถาวรได้ ตั้งใจให้ต้องใส่ใหม่ทุกครั้งที่เปิดเว็บใหม่) — ทุกปุ่มย่อยใน Admin เลยไม่ต้องขอ PIN ซ้ำอีก มีแค่ `confirm()` เตือนก่อนลบเท่านั้น
5. **เปลี่ยน PIN gate จากช่องพิมพ์ เป็นปุ่มกดตัวเลข (numeric keypad)** — กันปัญหาคีย์บอร์ดมือถือ (เลขไทย ๐-๙ ปนเลขอารบิก, autofill ของเบราว์เซอร์) เพราะกดผ่านปุ่มในเว็บโดยตรง ไม่ผ่านคีย์บอร์ดเครื่อง
6. **แก้บั๊ก PIN ตัดเลข 0 หน้า** — ตอนเปลี่ยน PIN เป็น `05032540` (มีเลข 0 นำหน้า) Google Sheets auto-detect ว่าเป็นตัวเลขแล้วตัดเลข 0 หน้าทิ้งเอง (`05032540` → `5032540`) ทำให้ PIN ไม่ตรงกับที่ตั้งไว้ — แก้โดยบังคับ format คอลัมน์ `Value` ในชีต `Config` เป็น Plain text (`setNumberFormat('@')`) ทุกครั้งที่เขียนค่าใหม่ ทั้งตอน seed ครั้งแรกและตอนแก้ผ่าน Admin
7. **แก้บั๊ก login ไม่ผ่านทั้งที่ user/password ถูก** (2026-09-17) — สาเหตุคือ `getConfig()` อ่านค่าจากชีต `Config` มาตรงๆ โดยไม่บังคับชนิดข้อมูล ถ้าใครไปพิมพ์ค่า `loginPass` ทับในชีตโดยไม่ได้บังคับ format เป็นข้อความไว้ก่อน (เช่นพิมพ์ `5340` ทับ) Google Sheets จะเก็บเป็น **number** แทน **string** โดยอัตโนมัติ แล้ว `checkLogin()` เดิมเทียบด้วย `===` ตรงๆ (`"5340" === 5340` เป็น `false` เสมอ ทั้งที่ค่าตรงกัน) ทำให้ login ไม่ผ่านไม่ว่าจะพิมพ์ถูกกี่ครั้ง (บั๊กนี้ต่างจากข้อ 6 ที่เป็นปัญหาเลข 0 นำหน้าหาย — อันนี้คือ type mismatch ธรรมดา ถึงไม่มีเลข 0 นำหน้าก็เกิดได้) — แก้ 2 จุดใน `Code.gs`:
   - `getConfig()` — ครอบ `String(...)` ให้ `pin`, `loginUser`, `loginPass` ทุกค่าตั้งแต่อ่านจากชีต กันไม่ให้ type ของค่าที่ได้ขึ้นกับว่า Sheets ตีความเซลล์เป็น text หรือ number
   - `checkLogin()` — เทียบ `user`/`pass` ด้วย `String(...)` ทั้งสองฝั่ง เหมือนที่ `checkPin()` ทำอยู่แล้วอยู่ก่อนแล้ว (จุดนี้เดิมลืมทำให้เหมือนกัน)
   - **ข้อสังเกตสำหรับคนทำงานต่อ**: `checkPin()` ปลอดภัยจาก type mismatch แบบนี้มาตั้งแต่ต้นเพราะบังคับ `String()` ทั้งสองฝั่งอยู่แล้ว มีแค่ `checkLogin()` ที่พลาดจุดนี้ไป — ถ้าจะเพิ่มการเทียบค่าจากชีต Config ในอนาคต ให้ทำตามแบบ `checkPin()` เสมอ
8. **เปลี่ยนโลโก้จากตัวอักษรในกล่อง CSS มาเป็นรูป `1.jpg` จริง** (2026-09-17) — เดิม `.mark` เป็น `<div class="mark mono">IT</div>` (กล่องสี่เหลี่ยมมุมโค้งพื้นหลัง teal เขียนตัวอักษร "IT" ด้วย CSS ล้วน ไม่มีรูปภาพ) ปรากฏอยู่ 3 จุดใน `index.html`: header หลัก, หน้า login, และ Admin PIN gate — เปลี่ยนทั้ง 3 จุดเป็น `<img class="mark" src="1.jpg" alt="โลโก้ IT">` (จุด header ไม่มี inline style ส่วนจุด login/admin gate มี `style="width:44px;height:44px;margin:0 auto 14px"` คงไว้เหมือนเดิม) และแก้ CSS `.mark` จาก `background/display/font-weight/font-size` (ของตัวอักษร) เป็น `object-fit:cover;display:block` (ของรูปภาพ) — ถ้าจะเปลี่ยนโลโก้อีกในอนาคต แค่เปลี่ยนไฟล์ `1.jpg` ทับ ไม่ต้องแก้โค้ดอีก ตราบใดที่ยังใช้ชื่อไฟล์เดิม

### v3.1 — Logout, PIN lockout (Admin keypad), PWA manifest (2026-09-17)
งานเล็ก 3 จุด ตามที่ผู้ใช้ขอ ไม่แตะ `Code.gs`/backend เลยแม้แต่บรรทัดเดียว แก้เฉพาะ `index.html` + `app.js` และเพิ่มไฟล์ใหม่ `manifest.json`:

1. **ปุ่ม "ออกจากระบบ"** — เพิ่ม `<button id="btnLogout">` ใน `.hbar` ของ header ข้าง `branchSelect` (ครอบทั้งคู่ด้วย `<div class="hbar-right">` ใหม่ เพื่อให้ยังจัดชิดขวาด้วย `justify-content:space-between` เดิมได้โดยไม่ต้องแก้ layout อื่น) กดแล้วเรียก `handleLogout()` ใน `app.js`:
   - ลบ `localStorage.getItem('it.auth')` ออก (`localStorage.removeItem('it.auth')`)
   - เอา class `authed` ออกจาก `<html>` (`document.documentElement.classList.remove('authed')`) → CSS เดิม (`html:not(.authed) #appRoot{display:none}` / `html.authed #loginScreen{display:none}`) จะสลับกลับไปโชว์หน้า login ทันทีโดยไม่ต้อง reload หน้า เพราะเป็นแค่การสลับ class ไม่ใช่การนำทางไปหน้าใหม่
   - รีเซ็ตสถานะ Admin session ของหน้านั้นด้วย (`state.adminUnlocked = false`, `state.adminPin = ''`, `state.pinBuffer = ''` และสลับกลับไปโชว์ `#adminGate` แทน `#adminContent`) เพื่อไม่ให้ login กลับเข้ามาใหม่แล้วเข้า Admin ต่อได้เลยโดยไม่ต้องใส่ PIN อีกรอบ (Admin session เดิมเป็น per-page-load อยู่แล้วตาม v3 ข้อ 4 แต่ logout ไม่ใช่การ reload หน้า เลยต้องรีเซ็ตมือ)
   - **ไม่รีเซ็ต** `state.pinAttempts` / `state.pinLockUntil` (ตัวนับ/ตัวจับเวลาของ PIN lockout ข้อ 2 ด้านล่าง) — ตั้งใจเว้นไว้ ป้องกันไม่ให้กดออกจากระบบแล้ว login ใหม่กลายเป็นวิธีเลี่ยง lockout ได้
   - ไม่กระทบ `state.db`/`state.schema`/`state.branches` ที่โหลดไว้แล้ว เพราะ `appStarted` ยัง `true` อยู่ (`initApp()` เช็คแล้ว return ทันทีถ้าเคยรันไปแล้ว) ตอน login ใหม่จะเห็นข้อมูลเดิมทันทีไม่ต้องรอโหลดใหม่ (แต่ `loadAll()` ก็ยังจะยิงเบื้องหลังตามปกติของ flow เดิมถ้าเรียก initApp ครั้งแรกจริงๆ — กรณี logout/login ซ้ำจะข้ามส่วนนี้ไปเพราะ `appStarted` กันไว้)

2. **PIN lockout บน Admin PIN keypad** — จุดเดียว ไม่กระทบช่อง PIN ธรรมดาในฟอร์มเพิ่ม/แก้อุปกรณ์ (`#f_pin`) หรือ `prompt()` ตอนลบรายการ เพราะสองจุดนั้นไม่มี keypad ให้ล็อก:
   - เพิ่ม state 3 ตัว: `pinAttempts` (นับจำนวนครั้งที่กรอกผิดติดกัน), `pinLockUntil` (timestamp ms ที่จะปลดล็อกได้ — `0` แปลว่าไม่ได้ล็อก), `pinLockTimer` (interval id ของตัวนับถอยหลังบนจอ)
   - ใน `submitAdminPin()` — ถ้า `checkPin` ตอบว่าผิด ให้ `pinAttempts++` ก่อน ถ้ายังไม่ถึง 5 โชว์ error เดิม (`res.error` จาก server) พ่วงข้อความ "(เหลืออีก N ครั้งก่อนถูกล็อกชั่วคราว)" ถ้าถึง 5 พอดี เรียก `lockPinKeypad()`
   - `lockPinKeypad()` — ตั้ง `pinLockUntil = Date.now() + 30000`, ล้าง `pinBuffer`, เรียก `setKeypadDisabled(true)` (ตั้ง `disabled = true` ให้ปุ่มทุกปุ่มใน `#pinKeypad` และปุ่ม `#pinSubmit` พร้อมลด opacity เหลือ .4/.55 ด้วย inline style กันไม่ให้มองว่ากดได้ทั้งที่กดไม่ได้จริง — ไม่ได้แก้ CSS ในไฟล์ เป็น inline style ที่ตั้งจาก JS ล้วนๆ) แล้วเริ่ม `setInterval(showPinLockCountdown, 1000)`
   - `showPinLockCountdown()` — คำนวณวินาทีที่เหลือจาก `pinLockUntil - Date.now()` แล้วอัปเดตข้อความใน `#adminGateError` เดิมทุกวินาที (ไม่ได้เพิ่ม element ใหม่) พอเหลือ `<= 0` จะ clear interval, รีเซ็ต `pinAttempts` กลับเป็น 0, ปลดล็อก keypad (`setKeypadDisabled(false)`) และซ่อนข้อความ error อัตโนมัติ
   - `isPinLocked()` — helper เช็คว่า `pinLockUntil > Date.now()` ใช้กันซ้ำทั้งใน click handler ของ `#pinKeypad` (กันกดตัวเลขได้ระหว่างล็อกถ้า event มันหลุดมา) และต้น `submitAdminPin()` (กันเผื่อ submit หลุดมาได้)
   - แก้ `switchTab()` ให้เช็ค `isPinLocked()` ตอนสลับเข้าแท็บ Admin (กรณียังไม่ปลดล็อก) ถ้ายังล็อกอยู่ (เช่นสลับออกไปแท็บอื่นระหว่างนับถอยหลังแล้วกลับมา) ให้โชว์สถานะล็อก/นับถอยหลังต่อทันที แทนที่จะไปซ่อน error message ทิ้งเฉยๆ เหมือนพฤติกรรมเดิม
   - **ข้อจำกัดที่ผู้ใช้ยอมรับแล้ว**: นับใน JS memory ล้วนๆ (`state.pinAttempts`/`pinLockUntil`) ไม่มีการเขียนอะไรลง `localStorage` หรือส่งไปเก็บที่ backend เลย เพราะฉะนั้น **reload หน้าเว็บ 1 ครั้งจะรีเซ็ตตัวนับกลับเป็น 0 ทันที** ไม่นับต่อจากที่ค้างไว้ ถ้าจะทำแบบ persist ข้าม reload จริงๆ (เช่นเก็บ `pinAttempts`/`pinLockUntil` ใน `localStorage` แล้วเช็คตอนโหลดหน้า) ยังทำได้ไม่ยากในฝั่ง frontend ล้วนๆ แต่ผู้ใช้เลือกไม่ทำเพราะนอกสโคปงานนี้ ส่วนถ้าจะให้ป้องกันได้จริงจัง (กันคนยิง `checkPin` ตรงไปที่ Apps Script Web App เองโดยไม่ผ่านหน้าเว็บเลย) **ต้องทำที่ `Code.gs`** เพิ่มการนับ/ล็อกฝั่ง server (เช่นเก็บ counter ใน `CacheService` ผูกกับ IP หรือ session) ซึ่งยังไม่ได้ทำในรอบนี้ — ดูหัวข้อ "ข้อจำกัดด้านความปลอดภัย" ด้านล่างที่อัปเดตเพิ่มแล้ว

3. **`manifest.json`** — ไฟล์ใหม่ (ต้องอัปโหลดเพิ่มเข้า repo คู่กับไฟล์อื่น อยู่ระดับเดียวกันแบบ flat) มี `name`, `short_name`, `description`, `start_url: "./index.html"`, `scope: "./"`, `display: "standalone"`, `background_color`/`theme_color` เป็น `#0B1B2B` (ค่าเดียวกับตัวแปร CSS `--ink`), และ `icons` ชี้ไปที่ `1.jpg` สองขนาด (`192x192`, `512x512` — ใช้ไฟล์เดียวกันประกาศสองขนาด ไม่ได้มีไฟล์จริงคนละขนาด เบราว์เซอร์จะ scale เอง คุณภาพอาจไม่สวยเท่าเตรียมไฟล์แยกขนาดจริง ถ้าจะปรับปรุงทีหลังค่อยทำ) — เพิ่ม `<link rel="manifest" href="manifest.json">` และ `<meta name="theme-color" content="#0B1B2B">` ใน `<head>` ของ `index.html` **ไม่มี service worker** (ตามที่ตกลงไว้ว่านอกสโคป ถ้าจะทำ offline จริงต้องเพิ่ม service worker แยกเฟสทีหลัง) ผู้ใช้กด "Add to Home Screen" จาก browser menu เองได้เลยไม่ต้องเขียนโค้ดเพิ่ม

---

## ไฟล์ (ต้องอยู่ที่เดียวกันทั้งหมด แบบ flat ไม่มีโฟลเดอร์ย่อย)

```
index.html     → หน้าเว็บหลัก (Login / Dashboard / ค้นหาเบอร์ / จัดการอุปกรณ์ / Admin)
app.js         → Logic ทั้งหมดฝั่ง Frontend (ต้องแนบไฟล์นี้ฉบับเต็มทุกครั้งที่แก้ไข ห้ามส่งเป็น diff)
Code.gs        → Backend สำหรับวางใน Google Apps Script (Extensions > Apps Script ของ Google Sheet)
manifest.json  → PWA manifest (v3.1) สำหรับ Add to Home Screen — ไม่มี service worker
1.jpg          → ไอคอน/โลโก้เว็บ — ใช้เป็น favicon (`<link rel="icon">`), โลโก้จริงในหน้าเว็บ (คลาส `.mark` ที่ header หลัก/หน้า login/Admin PIN gate) และไอคอน PWA ใน `manifest.json` (v3.1) สี่เหลี่ยมมุมโค้ง สีเขียวอมฟ้า (--teal) ตัวอักษร "IT" สีขาว
README.md      → เอกสารฉบับนี้
```

---

## โครงสร้างชีตทั้งหมด

| ชีต | หน้าที่ |
|---|---|
| **Config** | Key/Value — `pin`, `loginUser`, `loginPass`, `branches` (JSON array) |
| **SchemaTypes** | `TypeKey` \| `TypeLabel` — นิยามประเภทอุปกรณ์ทั้งหมด |
| **SchemaFields** | `TypeKey` \| `FieldKey` \| `FieldLabel` \| `FieldType` \| `FieldOptions` \| `ShowInTable` — นิยามฟิลด์ของแต่ละประเภท |
| **Log** | เวลา, การกระทำ, ประเภท, ID รายการ, รายละเอียด — บันทึกอัตโนมัติทุกการเปลี่ยนแปลง รวมถึงการแก้ที่ Admin |
| **[TypeKey ต่างๆ]** เช่น IPPhone, EDC, Pinpad, PrinterServer, PC หรือประเภทใหม่ที่เพิ่มเอง | ข้อมูลอุปกรณ์จริง — คอลัมน์เริ่มต้นเสมอด้วย `ID, สาขา, อาคาร, ชั้น, แผนก, ตำแหน่งย่อย` ตามด้วยฟิลด์เฉพาะประเภท ปิดท้ายด้วย `สำรอง, หมายเหตุ, อัปเดตล่าสุด` |

**กฎสำคัญ: ห้ามแก้ชื่อคอลัมน์ในชีตอุปกรณ์ด้วยมือโดยตรงเด็ดขาด** — ระบบอ้างอิงชื่อคอลัมน์ (FieldKey) ตรงๆ ทั้งตอนอ่านและเขียนข้อมูล
ถ้าจะเพิ่ม/ลบ/แก้ฟิลด์ ต้องทำผ่านหน้า Admin เท่านั้น ไม่งั้นข้อมูลใน Sheet กับ `SchemaFields` จะไม่ตรงกัน

**กฎสำคัญอีกข้อ: ห้ามพิมพ์ค่าทับในชีต `Config` (คอลัมน์ `Value`) โดยไม่บังคับ format เป็น Plain text ก่อนเด็ดขาด** — ถ้าพิมพ์ทับตรงๆ Google Sheets จะเดา type เอาเอง (text หรือ number) ซึ่งเป็นสาเหตุของบั๊กที่เกิดมาแล้ว 2 รอบ (ข้อ 6 และ 7 ในประวัติ v3) ถ้าจะแก้ค่าควรแก้ผ่านหน้า Admin เท่านั้น เพราะ `setConfigValue()` บังคับ `setNumberFormat('@')` ให้อัตโนมัติอยู่แล้ว

---

## API (Code.gs) — action ทั้งหมด

ไม่มีการเพิ่ม/แก้ action ใดๆ ใน v3.1 — ทั้งหมดเหมือนเดิมทุกตัวอักษรตั้งแต่ v3

**GET** (`?action=...`):
`bootstrap` (ดึงทุกอย่างในคำขอเดียว: branches, schema, data ทุกประเภท), `summary`, `spare`, `list&type=&branch=`, `search&q=`, `suggest&type=`, `fieldValues&type=&field=`, `logs&from=&to=&type=`

**POST** (JSON body ผ่าน `Content-Type: text/plain` เพื่อเลี่ยง CORS preflight):
- `login` {user, pass} — ไม่ต้องมี pin, ตรวจสิทธิ์แยกจากระบบ PIN (เทียบด้วย `String(...)` ทั้งสองฝั่ง กัน type mismatch จากชีต)
- `checkPin` {pin} — เช็คเฉยๆ ไม่เขียนอะไร (ใช้เปิดประตู Admin) — **v3.1**: ฝั่ง frontend เพิ่มการนับจำนวนครั้งที่ตอบผิดและล็อก UI ไว้ 30 วินาทีหลังผิดครบ 5 ครั้ง แต่ endpoint นี้เองยังไม่มี rate-limit ฝั่ง server เลย (ดูหัวข้อ "ข้อจำกัดด้านความปลอดภัย")
- `save` {type, data, pin}, `delete` {type, id, pin}
- `saveBranch` {mode: add/rename/delete, name, newName, pin}
- `saveSettings` {newPin, newLoginUser, newLoginPass, pin}
- `saveSchemaType` {mode: add/rename/delete, key, label, pin}
- `saveSchemaField` {mode: add/edit/delete, typeKey, key, label, fieldType, options, showInTable, pin}

ทุก action ที่มี `pin` ในพารามิเตอร์ ต้องตรงกับค่าปัจจุบันในชีต `Config` (เช็คผ่าน `checkPin()` ใน `Code.gs`) ไม่งั้นได้ `{error: 'PIN ไม่ถูกต้อง'}` กลับมา

---

## ข้อจำกัดด้านความปลอดภัย (สำคัญ ต้องรู้ไว้)

ระบบนี้ออกแบบมาสำหรับ **ใช้งานคนเดียว** ความปลอดภัยเป็นแค่ "ด่านกันคนทั่วไปเปิดเข้ามาเจอโดยบังเอิญ" ไม่ใช่ระบบยืนยันตัวตนระดับองค์กร:
- Apps Script Web App deploy แบบ "Who has access: Anyone" — ใครมี URL ก็ยิง API ตรงได้ ไม่ผ่านหน้าเว็บก็ได้ (เช่นเดา URL หรือเปิด Network tab ดู)
- PIN และ login ตรวจฝั่ง server ก็จริง แต่ยังเป็นแค่ string เทียบตรงๆ **backend (`Code.gs`) ไม่มี rate-limit / lockout ใดๆ ทั้งสิ้น** ถ้าใครสุ่ม PIN ยิงตรงไปที่ API ซ้ำๆ (ข้าม UI ไปเลย) ก็ยังทำได้ไม่จำกัดจำนวนครั้ง (โอกาสเจอ PIN 8 หลักโดยสุ่มต่ำมากในทางปฏิบัติ แต่ไม่ได้การันตีทางทฤษฎี)
- **(เพิ่มใน v3.1)** PIN lockout ที่เพิ่มเข้ามาบน Admin keypad เป็น **แค่ UI-level เท่านั้น** — ล็อกปุ่มกดในหน้าเว็บไว้ 30 วินาทีหลังผิดครบ 5 ครั้ง ป้องกันได้แค่คนที่กดผ่านหน้าเว็บจริงๆ (เช่น มือลื่นกดมั่ว หรือคนที่เดา PIN แบบนั่งกดทีละตัวบนจอ) **ไม่ได้ป้องกันคนที่ยิง POST ไปที่ `action=checkPin` ตรงๆ ผ่าน API เลย** เพราะ endpoint ฝั่ง server ไม่รู้จักแนวคิด "ครั้งที่เท่าไหร่" หรือ "ล็อกอยู่ไหม" อะไรเลย ทุก request ที่ backend เห็นเป็นแค่คำขอเดี่ยวๆ ที่ตรวจ PIN แล้วตอบกลับ ถ้าจะให้ล็อกจริงจังกันการยิง API ตรง ต้องเพิ่ม logic ฝั่ง `Code.gs` (เช่น นับจำนวนครั้งผิดต่อคีย์บางอย่างใน `CacheService` แล้วปฏิเสธ request ถ้าเกินโควตา) ซึ่งยังไม่ได้ทำ
- ถ้าต้องการความปลอดภัยจริงจังกว่านี้ (เช่น กันคนนอกองค์กรเข้าเว็บทั้งหมด) ต้องทำที่ระดับอื่น เช่น Google account restriction หรือ reverse proxy ซึ่งซับซ้อนกว่านี้มาก — ยังไม่ได้ทำในเวอร์ชันนี้

---

## สิ่งที่ยังไม่ได้ทำ / ทำได้ไม่ครบ

- **ไม่มีระบบสถานะอุปกรณ์เต็มรูปแบบ** — มีแค่ flag "สำรอง" (TRUE/FALSE) ยังไม่มี ใช้งานอยู่/ชำรุด/ส่งซ่อม ตามที่สเปกแรกขอไว้ (ผู้ใช้บอกว่ายังไม่จำเป็นตอนนี้)
- **ไม่มีการเช็คข้อมูลซ้ำ** — กรอกเบอร์ Ext./IP ที่ซ้ำกับเครื่องอื่นในสาขาเดียวกันได้ ระบบไม่เตือน
- **ไม่มีระบบแจ้งซ่อมและ QR code** — นอกสโคปตามที่ผู้ใช้ระบุไว้ชัดเจนแล้วว่าไม่ต้องทำ
- **ไม่มี undo/ถังขยะ** — การลบประเภท/ฟิลด์/สาขา/รายการอุปกรณ์เป็นการลบถาวรทั้งหมด กู้คืนไม่ได้ (มี `confirm()` เตือนก่อนเสมอ แต่ไม่มีระบบกู้คืน)
- **ยังไม่ได้ทดสอบ Admin ส่วน "ประเภท & ฟิลด์" กับข้อมูลจริงจำนวนมาก** — ฟังก์ชัน `insertColumnBefore`/`deleteColumn` ทดสอบแนวคิดแล้วว่าใช้งานได้ แต่ยังไม่ผ่านการทดสอบหนักๆ กับชีตที่มีข้อมูลเยอะๆ ในสถานการณ์จริง แนะนำให้ลองกับ Sheet ทดสอบก่อนใช้จริง
- **`1.jpg`** ยังไม่ยืนยันว่าอัปโหลดไฟล์จริงเข้า repo แล้วหรือยัง (README v2 เคยบอกว่ายังไม่เคยอัปโหลด) — ถ้ายังไม่มี ไอคอน PWA ใน `manifest.json` (v3.1) จะไม่ขึ้นด้วยเช่นกัน นอกจาก favicon/โลโก้ในหน้าเว็บที่ไม่ขึ้นอยู่แล้ว
- **PIN lockout (v3.1) เป็น UI-level เท่านั้น** — ไม่มีการล็อกฝั่ง server จริงจัง ดูรายละเอียดในหัวข้อ "ข้อจำกัดด้านความปลอดภัย" ด้านบน ถ้าจะทำแบบ persist ข้าม reload หรือกันการยิง API ตรง ต้องเพิ่มงานอีกรอบ (แก้ทั้ง frontend สำหรับ persist หรือแก้ `Code.gs` สำหรับกันยิง API ตรง)
- **ยังไม่มี service worker** — `manifest.json` (v3.1) รองรับแค่ Add to Home Screen เฉยๆ เปิดแอปได้เหมือนแอปจริงมากขึ้น (ไม่มี address bar) แต่ยังต้องมีเน็ตตอนเปิดเหมือนเดิม (ของเดิมที่ช่วย offline ได้คือ `localStorage` cache ที่มีอยู่แล้วตั้งแต่ v2 ซึ่งเป็นคนละกลไกกับ service worker)

---

## สำหรับ AI ที่จะมาทำงานต่อ (อ่านก่อนแก้โค้ดทุกครั้ง)

คุณกำลังทำงานต่อบนระบบที่ผ่านการพัฒนามาหลายรอบกับผู้ใช้ (Leeminho, GitHub handle `webthai`) ที่ทำงานเป็น IT Support โรงพยาบาลคนเดียว
สิ่งที่ควรรู้ก่อนเริ่ม:

1. **อ่านโค้ดจริงจาก repo ก่อนเสมอ อย่าเชื่อแค่เอกสารนี้** — ขอให้ผู้ใช้ส่งลิงก์ raw จาก GitHub (เช่น `https://raw.githubusercontent.com/webthai/IT/main/app.js`) แล้ว fetch มาดูโค้ดจริงที่ deploy อยู่ ก่อนแก้อะไร เพราะไฟล์อาจถูกแก้นอกบทสนทนานี้ได้ (ผู้ใช้แก้เอง หรือ AI เซสชันอื่นแก้ไปแล้ว) — README นี้อาจตามหลังโค้ดจริงได้เสมอ **(เจอเคสจริงมาแล้ว: README เคยเขียนถึง v3 ทั้งที่ repo ยังเป็น v2 อยู่ — ต้อง fetch โค้ดจริงมาเทียบกับ README เสมอ ห้ามเชื่อ README เพียงอย่างเดียวว่าเวอร์ชันตรงกับโค้ดจริง)**
2. **สไตล์การทำงานที่ผู้ใช้ต้องการ**: เสนอแผนและถามคำถามที่จำเป็นก่อนลงมือเขียนโค้ดใหญ่ๆ, รอ user ยืนยันก่อนเริ่ม implement งานที่กระทบโครงสร้าง, ตรวจ syntax ทุกไฟล์ก่อนส่ง (`node --check` สำหรับ .js/.gs, ตรวจ HTML tag สมดุลสำหรับ .html), แนบไฟล์ `app.js` ฉบับเต็มทุกครั้งที่แก้ (ไม่ส่งเป็น diff/patch)
3. **ทุกไฟล์ต้องอยู่ที่เดียวกัน (flat)** ห้ามแยกโฟลเดอร์ ไอคอนถ้ามีต้องชื่อ `1.jpg`
4. **ระวังเรื่อง Google Sheets auto-format ตัวเลข** — ค่าที่ดูเหมือนตัวเลขแต่ต้องการเก็บเป็น string เป๊ะๆ (เช่น PIN, เบอร์โทรที่ขึ้นต้นด้วย 0) ต้องบังคับ `setNumberFormat('@')` ก่อน `setValue()` เสมอ ไม่งั้น Sheets จะตัดเลข 0 นำหน้าทิ้งเอง (เจอบั๊กนี้มาแล้วจริงกับ PIN `05032540`) **และ** ต้องบังคับ `String(...)` ทุกครั้งที่อ่านค่ากลับมาเทียบในโค้ด (เจอบั๊กนี้จริงกับ `checkLogin()` — เทียบ `===` ตรงๆ ระหว่าง string จากหน้าเว็บกับ number จากชีต ไม่ตรงกันทั้งที่ค่าเดียวกัน) — สองจุดนี้เป็นบั๊กคนละสาเหตุ แก้คนละที่ อย่าคิดว่าแก้จุดเดียวจะครอบคลุมทั้งคู่
5. **Apps Script deploy ต้องกด "New version" ทุกครั้งที่แก้ Code.gs** — แค่ Save ในตัว editor ไม่พอ ถ้าลืมขั้นตอนนี้ Web App URL จะยังรันโค้ดเก่าอยู่ (เป็นสาเหตุความสับสนที่เกิดขึ้นซ้ำหลายรอบในการพัฒนาระบบนี้) ย้ำผู้ใช้ทุกครั้งที่แก้ Code.gs — **v3.1 ไม่ได้แก้ `Code.gs` เลย จึงไม่ต้อง deploy ใหม่ แค่อัปโหลด `index.html`/`app.js`/`manifest.json` ทับ/เพิ่มเข้า GitHub Pages ก็พอ**
6. **ห้ามแก้ชื่อคอลัมน์ในชีตอุปกรณ์ตรงๆ** — ต้องผ่านหน้า Admin (หรือฟังก์ชันใน Code.gs ที่เกี่ยวข้อง: `saveSchemaField`) เท่านั้น เพราะ FieldKey ถูกอ้างอิงตรงๆ ทั้งในข้อมูลและใน `SchemaFields`
7. **การลบใน Admin (ประเภท/ฟิลด์/สาขา) เป็นการลบถาวร ไม่มี undo** — เพิ่มการยืนยันสองชั้น (confirm + ผ่าน PIN gate ของ Admin) ไว้แล้ว อย่าลดขั้นตอนความปลอดภัยตรงนี้ลงโดยไม่ถามผู้ใช้ก่อน
8. **โครงสร้างข้อมูลหลัก**: `state.schema.types` (array of {key,label}), `state.schema.fieldsByType` (object keyed by TypeKey → array of field defs {key,label,type,options,showInTable}), `state.branches` (array of string), `state.db` (object keyed by TypeKey → array of row objects) — ทั้งหมดมาจาก `action=bootstrap` ตอนโหลดหน้าเว็บครั้งแรก ไม่มี hardcode ในไฟล์ `app.js` อีกแล้วตั้งแต่ v3
9. **ฟิลด์รองรับ 3 ชนิด**: `text`, `dropdown` (มี `options` เป็น array), `date` — ถ้าจะเพิ่มชนิดใหม่ต้องแก้ทั้ง `fieldInputHtml()` ใน `app.js` และฟอร์ม "เพิ่มฟิลด์" ในหน้า Admin (index.html + app.js ส่วน `renderAdminSchema`)
10. **PIN ปัจจุบันของ session Admin เก็บใน `state.adminPin`** (JS memory เท่านั้น ไม่ persist) — ทุกเรียก API ที่ต้องใช้ pin ในหน้า Admin ให้ใช้ `state.adminPin` ไม่ใช่ `prompt()` ถามซ้ำ (เปลี่ยนมาเป็นแบบนี้ตามที่ผู้ใช้ขอไว้ชัดเจน) — **v3.1**: ปุ่ม Logout จะรีเซ็ต `state.adminPin` และ `state.adminUnlocked` กลับเป็นค่าเริ่มต้นด้วย เพื่อบังคับให้ต้องใส่ PIN ใหม่หลัง login เข้ามาอีกรอบ (เดิมค่านี้จะอยู่จน reload หน้าเท่านั้น ตอนนี้ logout ก็รีเซ็ตได้เหมือนกัน)
11. **จุดที่เทียบค่าจากชีต Config กับค่าที่ส่งมาจากหน้าเว็บ (`checkPin`, `checkLogin`) ต้องครอบ `String(...)` ทั้งสองฝั่งเสมอ** — ห้ามใช้ `===`/`!==` เปล่าๆ เทียบค่าที่มาจาก `getConfig()` โดยตรง เพราะชนิดข้อมูลในชีตเปลี่ยนได้ทุกเมื่อที่มีคนพิมพ์ทับเซลล์โดยไม่ผ่าน Admin (ดูข้อ 7 ในประวัติ v3)
12. **(ใหม่ v3.1) PIN lockout บน Admin keypad เก็บ state ใน 3 ตัวแปรใน `state`**: `pinAttempts` (int), `pinLockUntil` (timestamp ms, `0` = ไม่ล็อก), `pinLockTimer` (interval id) — ทั้งหมดเป็น JS memory ล้วนๆ ไม่ persist ข้าม reload โดยตั้งใจ ถ้าจะแก้จำนวนครั้ง (ปัจจุบัน 5) หรือระยะเวลาล็อก (ปัจจุบัน 30000 ms) แก้ที่ `submitAdminPin()` (เงื่อนไข `pinAttempts >= 5`) และ `lockPinKeypad()` (`Date.now() + 30000`) ตามลำดับ — **อย่าลืม**: ปุ่ม Logout (ข้อ 1 ในประวัติ v3.1) ตั้งใจไม่แตะตัวแปรกลุ่มนี้ ถ้าจะแก้ logout ในอนาคตให้ระวังอย่าไปรีเซ็ตตัวแปรกลุ่มนี้โดยไม่ได้ตั้งใจ เพราะจะเปิดช่องให้เลี่ยง lockout ผ่านการ logout/login ซ้ำได้
13. **(ใหม่ v3.1) `manifest.json` เป็นไฟล์ static ล้วนๆ ไม่มี logic ผูกกับ `app.js` เลย** — ถ้าจะเปลี่ยนชื่อแอป/สี/ไอคอน แก้ที่ไฟล์นี้ไฟล์เดียวพอ ไม่ต้องแตะ `index.html`/`app.js` (ยกเว้นถ้าจะเปลี่ยน path ไฟล์ manifest เอง ถึงต้องแก้ `<link rel="manifest">` ใน `index.html` ด้วย)

**ก่อนส่งงานทุกครั้ง**: (1) syntax check ทุกไฟล์ที่แก้ (2) เช็คว่า id ที่เรียกใน `app.js` ผ่าน `$('...')` มีอยู่จริงใน `index.html` ครบ (3) ถ้าแก้ `Code.gs` ให้เตือนผู้ใช้เรื่อง Deploy New version เสมอ (4) ถ้าแก้โครงสร้างชีต ให้เตือนเรื่องผลกระทบต่อข้อมูลเดิมและแนะนำวิธี migrate ที่ปลอดภัย (backup ก่อน/สร้างชีตทดสอบก่อน)
