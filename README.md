# IT Asset, Phone Directory & Dashboard System

ระบบจัดการอุปกรณ์ IT และสมุดโทรศัพท์ภายใน สำหรับทีม IT Support โรงพยาบาล (ใช้งานคนเดียว, หลายสาขา)
**Frontend:** HTML + CSS ล้วน (ไม่มี framework) + Vanilla JS → โฮสต์บน GitHub Pages
**Backend:** Google Apps Script (Web App) + Google Sheets เป็นฐานข้อมูล
**Repo:** github.com/webthai/IT

---

## สถานะปัจจุบัน (v3.2)

ระบบผ่านการปรับใหญ่มาหลายรอบ จาก v1 (สเปกเริ่มต้น) → v2 (แก้ปัญหาโหลดช้า) → v3 (เพิ่มระบบ Admin + schema แบบ dynamic) → v3.1 (Logout, PIN lockout, PWA) → v3.2 (toggle ปิด/เปิด PIN ตอนเพิ่ม-ลบอุปกรณ์)
รายละเอียดการเปลี่ยนแปลงทั้งหมดอยู่ใน "ประวัติการพัฒนาโดยละเอียด" ด้านล่าง

**ค่าที่ใช้งานอยู่ตอนนี้:**
- Login เข้าเว็บ (ครั้งเดียวต่อเครื่อง): user `meen` / password `5340`
- PIN ยืนยันการเพิ่ม/แก้ไข/ลบทุกจุด (รวม Admin): `05032540`
- สาขา: อโศก, ปิ่นเกล้า, อุดร
- ประเภทอุปกรณ์: IPPhone, EDC, Pinpad, PrinterServer (Printer/Print Server รวมกัน), PC
- Toggle "ต้องใส่ PIN ตอนเพิ่ม/ลบอุปกรณ์": **เปิดอยู่ (ค่าเริ่มต้น)**

ค่าทั้งหมดข้างบนนี้ **แก้ไขได้จากหน้าเว็บ (แท็บ Admin) แล้ว ไม่ต้องแก้โค้ด** — ค่าที่เขียนไว้ตรงนี้คือค่า ณ เวลาที่เขียนเอกสารนี้เท่านั้น
AI/คนที่มาทำงานต่อควรดึงค่าจริงจากชีต `Config` เสมอ อย่ายึดตามตัวเลขในเอกสารนี้เพียงอย่างเดียว

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
3. **แท็บ Admin ใหม่** มี 4 ส่วน: สาขา, ตั้งค่า PIN/Login, Log (ย้อนหลัง 200 รายการ กรองวันที่/ประเภทได้), ประเภท & ฟิลด์ (เพิ่ม/แก้ชื่อ/**ลบจริง**ประเภทและฟิลด์ ใช้คำสั่ง Apps Script จริง `insertColumnBefore`/`deleteColumn`/`insertSheet`/`deleteSheet` ไม่ใช่แค่ซ่อนใน UI)
4. **Admin PIN gate แยกต่างหาก** — ใส่ PIN ครั้งเดียวใช้ได้ทั้ง session (JS memory เท่านั้น รีเซ็ตทุกครั้งที่ reload) ทุกปุ่มย่อยใน Admin เลยไม่ต้องขอ PIN ซ้ำ มีแค่ `confirm()` เตือนก่อนลบ
5. **PIN gate เป็นปุ่มกดตัวเลข (numeric keypad)** แทนช่องพิมพ์ กันปัญหาคีย์บอร์ดมือถือ (เลขไทย ๐-๙, autofill)
6. **แก้บั๊ก PIN ตัดเลข 0 หน้า** — Google Sheets auto-detect `05032540` เป็นตัวเลขแล้วตัดเลข 0 หน้าทิ้งเอง แก้โดยบังคับ format คอลัมน์ `Value` ในชีต `Config` เป็น Plain text (`setNumberFormat('@')`) ทุกครั้งที่เขียนค่าใหม่
7. **แก้บั๊ก login ไม่ผ่านทั้งที่ user/password ถูก** — สาเหตุคือถ้าใครพิมพ์ค่าทับในชีต `Config` โดยไม่บังคับ format ก่อน Google Sheets จะเก็บเป็น **number** แทน **string** แล้ว `checkLogin()` เดิมเทียบด้วย `===` ตรงๆ (`"5340" === 5340` เป็น `false` เสมอ) — แก้ 2 จุด: `getConfig()` ครอบ `String(...)` ทุกค่า และ `checkLogin()` เทียบด้วย `String(...)` ทั้งสองฝั่งเหมือน `checkPin()` ที่ทำถูกอยู่แล้ว
8. **เปลี่ยนโลโก้จากตัวอักษรในกล่อง CSS มาเป็นรูป `1.jpg` จริง** — 3 จุด (header, login, Admin PIN gate) เปลี่ยนจาก `<div class="mark mono">IT</div>` เป็น `<img class="mark" src="1.jpg">`

### v3.1 — Logout, PIN lockout (Admin keypad), PWA manifest
ไม่แตะ `Code.gs`/backend เลย แก้เฉพาะ `index.html` + `app.js` และเพิ่มไฟล์ใหม่ `manifest.json`:

1. **ปุ่ม "ออกจากระบบ"** — `handleLogout()` ลบ `localStorage['it.auth']`, เอา class `authed` ออกจาก `<html>` (สลับกลับไปหน้า login ทันทีไม่ต้อง reload), รีเซ็ต `state.adminUnlocked`/`adminPin`/`pinBuffer` (กันเข้า Admin ต่อได้เองหลัง login ใหม่โดยไม่ผ่าน PIN gate) — **ไม่รีเซ็ต** `pinAttempts`/`pinLockUntil` (กัน logout แล้ว login ใหม่เพื่อเลี่ยง lockout)
2. **PIN lockout บน Admin PIN keypad** — ผิดครบ 5 ครั้งติดกัน ล็อกปุ่มกด 30 วินาที นับถอยหลังโชว์ใน `#adminGateError` เดิม เก็บ state ใน `pinAttempts`/`pinLockUntil`/`pinLockTimer` (JS memory ล้วนๆ ไม่ persist ข้าม reload — เป็นข้อจำกัดที่ผู้ใช้ยอมรับแล้ว) จุดเดียว ไม่กระทบ PIN ธรรมดาในฟอร์มอุปกรณ์ (`#f_pin`) หรือ `prompt()` ตอนลบ เพราะสองจุดนั้นไม่มี keypad
3. **`manifest.json`** — ใหม่ สำหรับ Add to Home Screen (`display: standalone`, ไอคอนชี้ไป `1.jpg`) **ไม่มี service worker** (ยังต้องมีเน็ตตอนเปิดเหมือนเดิม, `localStorage` cache ที่มีอยู่แล้วช่วยได้บางส่วนคนละกลไกกัน)

### v3.2 — Toggle ปิด/เปิด PIN ตอนเพิ่ม-ลบอุปกรณ์
เพิ่มสวิตช์ในหน้า Admin > "ตั้งค่า PIN/Login" ให้เลือกได้ว่าตอนเพิ่ม/แก้ไข/ลบ**อุปกรณ์**ในแท็บ "จัดการอุปกรณ์" ต้องกรอก PIN ยืนยันทุกครั้งหรือไม่ (ค่าเริ่มต้น: **ต้องใส่**) แก้ทั้ง 3 ไฟล์:

1. **`Code.gs`**:
   - เพิ่ม `Config` key ใหม่ `itemPinRequired` (ค่าเริ่มต้น `'true'`, seed ตอน `setupSheets()` เหมือน key อื่นๆ, ใช้ `setNumberFormat('@')` เหมือนเดิมกัน Sheets ตีความผิด)
   - `getConfig()` แปลงค่านี้เป็น boolean ส่งออกมาด้วย (`cfg.itemPinRequired`)
   - **แยก logic การเช็ค PIN ใน `doPost()` เป็น 2 เส้นทาง**: action `save`/`delete` (อุปกรณ์) เช็ค PIN แบบมีเงื่อนไข — ข้ามได้ถ้า `cfg.itemPinRequired` เป็น `false` ส่วน action Admin อื่นๆ ทั้งหมด (`checkPin`, `saveBranch`, `saveSettings`, `saveSchemaType`, `saveSchemaField`) **ยังคงต้องผ่าน `checkPin()` เสมอ ไม่มีข้อยกเว้น** ไม่ว่า toggle นี้จะเป็นค่าอะไร (ป้องกันด้วย Admin PIN gate อยู่แล้วเป็นอีกชั้น ตามที่ผู้ใช้ยืนยันไว้ว่าต้องการแบบนี้)
   - `saveRow()`/`deleteRow()` รับพารามิเตอร์ `pinSkipped` เพิ่ม ใช้ต่อท้ายรายละเอียดใน Log ว่า `[ข้าม PIN]` เมื่อบันทึก/ลบโดยไม่ผ่าน PIN (ตามที่ขอไว้ว่าอยากให้เห็นใน Log ด้วย)
   - `saveSettings()` รับพารามิเตอร์ `itemPinRequired` เพิ่ม (optional — ส่งมาเป็น boolean เมื่อไหร่ค่อยอัปเดต Config เมื่อนั้น)
   - `getAll()` (bootstrap) ส่ง `itemPinRequired` ออกมาด้วย ให้ frontend รู้สถานะตั้งแต่โหลดหน้าเว็บครั้งแรก
2. **`app.js`**:
   - `state.itemPinRequired` (default `true` จนกว่า bootstrap จะโหลดเสร็จ) อ่านค่าจริงจาก `loadAll()`/`loadFromCache()`, เก็บลง `localStorage` cache ด้วยเหมือนฟิลด์อื่นใน `persist()`
   - `applyItemPinUI()` — ฟังก์ชันใหม่ ซ่อน/แสดงช่อง PIN (`#f_pin` และ label ของมัน) ในฟอร์มเพิ่ม/แก้ไขอุปกรณ์ตาม toggle พร้อมสลับ attribute `required` ให้ตรงกัน (กันฟอร์มส่งไม่ได้เพราะช่องที่ซ่อนอยู่ยัง `required`) เรียกหลัง `loadAll()`/`loadFromCache()` ทุกครั้งที่ข้อมูลอัปเดต และหลังบันทึกตั้งค่าใน Admin
   - `deleteCurrentItem()` — ถ้า toggle ปิดอยู่ ข้าม `prompt()` ถาม PIN ไปเลย แต่ยังมี `confirm()` ถามยืนยันก่อนลบเสมอ (กันลบพลาดแม้ไม่มี PIN)
   - `renderAdminSettings()` — ฟังก์ชันใหม่ ตั้งค่า checkbox `#s_itemPinRequired` ให้ตรงกับ `state.itemPinRequired` ทุกครั้งที่เปิดหน้า Admin เรียกจาก `renderAdmin()`
   - ฟอร์ม `#settingsForm` ส่ง `itemPinRequired: $('s_itemPinRequired').checked` ไปกับทุกครั้งที่กด "บันทึกการตั้งค่า" (รวมกับ PIN/login ในฟอร์มเดียวกัน ไม่ต้องกดปุ่มแยก) — **การกดบันทึกค่านี้ต้องผ่าน Admin PIN gate เหมือนเมนูอื่นทุกอย่าง** (ส่ง `pin: state.adminPin` เหมือนปุ่ม Admin อื่น) ตามที่ผู้ใช้ยืนยันไว้ว่า "ตัวสวิตช์เองต้องมี PIN คุม"
3. **`index.html`**:
   - เพิ่ม CSS คลาส `.switch-row`/`.switch`/`.track` ใหม่ (toggle switch แบบเลื่อน ไม่ใช่ checkbox ธรรมดา) ในหมวด "toggle switch (Admin > ตั้งค่า)"
   - เพิ่ม markup สวิตช์ (`#s_itemPinRequired`) เป็นแถวบนสุดของ `#settingsForm` ในหน้า Admin > ตั้งค่า PIN/Login พร้อมคำอธิบายสั้นๆ ใต้หัวข้อว่าเมนู Admin อื่นยังต้องใส่ PIN เหมือนเดิม

**ข้อจำกัดที่ควรรู้**: toggle นี้ปิดได้แค่ PIN ตอนเพิ่ม/แก้ไข/ลบ**อุปกรณ์**เท่านั้น ไม่กระทบ Admin PIN gate (ยังต้องใส่ PIN เข้า Admin เหมือนเดิมเสมอ) และไม่กระทบ Login (user/password) เข้าเว็บเหมือนเดิม — เป็นการลดขั้นตอนเฉพาะงานประจำวัน (เพิ่ม/ลบอุปกรณ์) ให้เร็วขึ้นเวลาที่ไม่ต้องการความรัดกุมระดับนั้น ไม่ใช่การปิดระบบความปลอดภัยทั้งหมด

---

## ไฟล์ (ต้องอยู่ที่เดียวกันทั้งหมด แบบ flat ไม่มีโฟลเดอร์ย่อย)

```
index.html     → หน้าเว็บหลัก (Login / Dashboard / ค้นหาเบอร์ / จัดการอุปกรณ์ / Admin)
app.js         → Logic ทั้งหมดฝั่ง Frontend (ต้องแนบไฟล์นี้ฉบับเต็มทุกครั้งที่แก้ไข ห้ามส่งเป็น diff)
Code.gs        → Backend สำหรับวางใน Google Apps Script (Extensions > Apps Script ของ Google Sheet)
manifest.json  → PWA manifest (v3.1) สำหรับ Add to Home Screen — ไม่มี service worker
1.jpg          → ไอคอน/โลโก้เว็บ — favicon, โลโก้จริงในหน้าเว็บ (header หลัก/หน้า login/Admin PIN gate) และไอคอน PWA
README.md      → เอกสารฉบับนี้
```

---

## โครงสร้างชีตทั้งหมด

| ชีต | หน้าที่ |
|---|---|
| **Config** | Key/Value — `pin`, `loginUser`, `loginPass`, `branches` (JSON array), `itemPinRequired` (v3.2, 'true'/'false') |
| **SchemaTypes** | `TypeKey` \| `TypeLabel` — นิยามประเภทอุปกรณ์ทั้งหมด |
| **SchemaFields** | `TypeKey` \| `FieldKey` \| `FieldLabel` \| `FieldType` \| `FieldOptions` \| `ShowInTable` — นิยามฟิลด์ของแต่ละประเภท |
| **Log** | เวลา, การกระทำ, ประเภท, ID รายการ, รายละเอียด — บันทึกอัตโนมัติทุกการเปลี่ยนแปลง (v3.2: ต่อท้าย `[ข้าม PIN]` ถ้าเพิ่ม/ลบอุปกรณ์ตอน toggle ปิดอยู่) |
| **[TypeKey ต่างๆ]** เช่น IPPhone, EDC, Pinpad, PrinterServer, PC หรือประเภทใหม่ที่เพิ่มเอง | ข้อมูลอุปกรณ์จริง — คอลัมน์เริ่มต้นเสมอด้วย `ID, สาขา, อาคาร, ชั้น, แผนก, ตำแหน่งย่อย` ตามด้วยฟิลด์เฉพาะประเภท ปิดท้ายด้วย `สำรอง, หมายเหตุ, อัปเดตล่าสุด` |

**กฎสำคัญ: ห้ามแก้ชื่อคอลัมน์ในชีตอุปกรณ์ด้วยมือโดยตรงเด็ดขาด** — ต้องทำผ่านหน้า Admin เท่านั้น ไม่งั้นข้อมูลใน Sheet กับ `SchemaFields` จะไม่ตรงกัน

**กฎสำคัญอีกข้อ: ห้ามพิมพ์ค่าทับในชีต `Config` (คอลัมน์ `Value`) โดยไม่บังคับ format เป็น Plain text ก่อนเด็ดขาด** — เป็นสาเหตุของบั๊กที่เกิดมาแล้ว 2 รอบ (PIN ตัดเลข 0 / login type mismatch) ถ้าจะแก้ค่าควรแก้ผ่านหน้า Admin เท่านั้น เพราะ `setConfigValue()` บังคับ `setNumberFormat('@')` ให้อัตโนมัติอยู่แล้ว

---

## API (Code.gs) — action ทั้งหมด

**GET** (`?action=...`):
`bootstrap` (ดึงทุกอย่างในคำขอเดียว: branches, itemPinRequired, schema, data ทุกประเภท — **v3.2** เพิ่ม `itemPinRequired`), `summary`, `spare`, `list&type=&branch=`, `search&q=`, `suggest&type=`, `fieldValues&type=&field=`, `logs&from=&to=&type=`

**POST** (JSON body ผ่าน `Content-Type: text/plain` เพื่อเลี่ยง CORS preflight):
- `login` {user, pass} — ไม่ต้องมี pin, ตรวจสิทธิ์แยกจากระบบ PIN
- `checkPin` {pin} — เช็คเฉยๆ ไม่เขียนอะไร (ใช้เปิดประตู Admin) — **ต้องผ่าน PIN เสมอ ไม่ขึ้นกับ toggle `itemPinRequired`**
- `save` {type, data, pin} — **v3.2**: `pin` เช็คก็ต่อเมื่อ `itemPinRequired` เป็น `true` เท่านั้น
- `delete` {type, id, pin} — **v3.2**: เหมือน `save`
- `saveBranch` {mode: add/rename/delete, name, newName, pin} — ต้องผ่าน PIN เสมอ
- `saveSettings` {newPin, newLoginUser, newLoginPass, itemPinRequired, pin} — **v3.2** เพิ่มพารามิเตอร์ `itemPinRequired` (boolean, optional) — ต้องผ่าน PIN เสมอ
- `saveSchemaType` {mode: add/rename/delete, key, label, pin} — ต้องผ่าน PIN เสมอ
- `saveSchemaField` {mode: add/edit/delete, typeKey, key, label, fieldType, options, showInTable, pin} — ต้องผ่าน PIN เสมอ

---

## ข้อจำกัดด้านความปลอดภัย (สำคัญ ต้องรู้ไว้)

ระบบนี้ออกแบบมาสำหรับ **ใช้งานคนเดียว** ความปลอดภัยเป็นแค่ "ด่านกันคนทั่วไปเปิดเข้ามาเจอโดยบังเอิญ" ไม่ใช่ระบบยืนยันตัวตนระดับองค์กร:
- Apps Script Web App deploy แบบ "Who has access: Anyone" — ใครมี URL ก็ยิง API ตรงได้ ไม่ผ่านหน้าเว็บก็ได้
- PIN และ login ตรวจฝั่ง server ก็จริง แต่ **backend ไม่มี rate-limit / lockout ใดๆ ทั้งสิ้น** ถ้าใครสุ่ม PIN ยิงตรงไปที่ API ซ้ำๆ (ข้าม UI ไปเลย) ก็ยังทำได้ไม่จำกัดจำนวนครั้ง
- PIN lockout ที่เพิ่มใน v3.1 เป็น **แค่ UI-level เท่านั้น** ป้องกันได้แค่คนที่กดผ่านหน้าเว็บจริงๆ ไม่ได้ป้องกันคนที่ยิง POST ไปที่ `action=checkPin` ตรงๆ ผ่าน API
- **(เพิ่มใน v3.2)** Toggle "ไม่ต้องใส่ PIN ตอนเพิ่ม/ลบอุปกรณ์" ถ้าเปิดใช้ (ปิด PIN) จะทำให้ **ใครก็ตามที่เข้าเว็บได้ (ผ่าน login แล้ว) เพิ่ม/แก้ไข/ลบอุปกรณ์ได้ทันทีโดยไม่ต้องรู้ PIN เลย** เหมาะกับสถานการณ์ที่ผู้ใช้งานเป็นคนเดียวกันตลอด ไม่มีความเสี่ยงคนอื่นมาใช้เครื่องต่อ — ถ้าเครื่องมีโอกาสถูกคนอื่นใช้ต่อ (เช่น เครื่องสาธารณะ, หลายคนสลับกันใช้ล็อกอินเดียวกัน) **แนะนำให้เปิด PIN ไว้เสมอ (ค่าเริ่มต้น)**
- ถ้าต้องการความปลอดภัยจริงจังกว่านี้ ต้องทำที่ระดับอื่น เช่น Google account restriction หรือ reverse proxy ซึ่งยังไม่ได้ทำในเวอร์ชันนี้

---

## สิ่งที่ยังไม่ได้ทำ / ทำได้ไม่ครบ

- **ไม่มีระบบสถานะอุปกรณ์เต็มรูปแบบ** — มีแค่ flag "สำรอง" (TRUE/FALSE) ยังไม่มี ใช้งานอยู่/ชำรุด/ส่งซ่อม
- **ไม่มีการเช็คข้อมูลซ้ำ** — กรอกเบอร์ Ext./IP ที่ซ้ำกับเครื่องอื่นในสาขาเดียวกันได้ ระบบไม่เตือน
- **ไม่มีระบบแจ้งซ่อมและ QR code** — นอกสโคปตามที่ผู้ใช้ระบุไว้ชัดเจนแล้วว่าไม่ต้องทำ
- **ไม่มี undo/ถังขยะ** — การลบประเภท/ฟิลด์/สาขา/รายการอุปกรณ์เป็นการลบถาวรทั้งหมด กู้คืนไม่ได้
- **ยังไม่ได้ทดสอบ Admin ส่วน "ประเภท & ฟิลด์" กับข้อมูลจริงจำนวนมาก** — แนะนำให้ลองกับ Sheet ทดสอบก่อนใช้จริง
- **`1.jpg`** ยังไม่ยืนยันว่าอัปโหลดไฟล์จริงเข้า repo แล้วหรือยัง
- **PIN lockout (v3.1) เป็น UI-level เท่านั้น** — ไม่มีการล็อกฝั่ง server จริงจัง
- **ยังไม่มี service worker** — `manifest.json` รองรับแค่ Add to Home Screen เฉยๆ

---

## สำหรับ AI ที่จะมาทำงานต่อ (อ่านก่อนแก้โค้ดทุกครั้ง)

คุณกำลังทำงานต่อบนระบบที่ผ่านการพัฒนามาหลายรอบกับผู้ใช้ (Leeminho, GitHub handle `webthai`) ที่ทำงานเป็น IT Support โรงพยาบาลคนเดียว
สิ่งที่ควรรู้ก่อนเริ่ม:

1. **อ่านโค้ดจริงจาก repo ก่อนเสมอ อย่าเชื่อแค่เอกสารนี้** — ขอให้ผู้ใช้ส่งลิงก์ raw จาก GitHub แล้ว fetch มาดูโค้ดจริงที่ deploy อยู่ ก่อนแก้อะไร **(เจอเคสจริงมาแล้ว: README เคยเขียนถึง v3 ทั้งที่ repo ยังเป็น v2 อยู่)**
2. **สไตล์การทำงานที่ผู้ใช้ต้องการ**: เสนอแผนและถามคำถามที่จำเป็นก่อนลงมือเขียนโค้ดใหญ่ๆ, รอ user ยืนยันก่อนเริ่ม implement งานที่กระทบโครงสร้าง, ตรวจ syntax ทุกไฟล์ก่อนส่ง, แนบไฟล์ `app.js` ฉบับเต็มทุกครั้งที่แก้ (ไม่ส่งเป็น diff/patch)
3. **ทุกไฟล์ต้องอยู่ที่เดียวกัน (flat)** ห้ามแยกโฟลเดอร์ ไอคอนถ้ามีต้องชื่อ `1.jpg`
4. **ระวังเรื่อง Google Sheets auto-format ตัวเลข** — ค่าที่ดูเหมือนตัวเลขแต่ต้องการเก็บเป็น string เป๊ะๆ ต้องบังคับ `setNumberFormat('@')` ก่อน `setValue()` เสมอ **และ** ต้องบังคับ `String(...)` ทุกครั้งที่อ่านค่ากลับมาเทียบในโค้ด — สองจุดนี้เป็นบั๊กคนละสาเหตุ แก้คนละที่
5. **Apps Script deploy ต้องกด "New version" ทุกครั้งที่แก้ Code.gs** — แค่ Save ในตัว editor ไม่พอ — **v3.2 แก้ `Code.gs` ด้วย (ต่างจาก v3.1) ต้อง deploy new version**
6. **ห้ามแก้ชื่อคอลัมน์ในชีตอุปกรณ์ตรงๆ** — ต้องผ่านหน้า Admin (`saveSchemaField`) เท่านั้น
7. **การลบใน Admin (ประเภท/ฟิลด์/สาขา) เป็นการลบถาวร ไม่มี undo** — มีการยืนยันสองชั้น (confirm + ผ่าน PIN gate ของ Admin) ไว้แล้ว อย่าลดขั้นตอนความปลอดภัยตรงนี้ลงโดยไม่ถามผู้ใช้ก่อน
8. **โครงสร้างข้อมูลหลัก**: `state.schema.types`, `state.schema.fieldsByType`, `state.branches`, `state.db`, **`state.itemPinRequired`** (v3.2) — ทั้งหมดมาจาก `action=bootstrap` ตอนโหลดหน้าเว็บครั้งแรก ไม่มี hardcode ในไฟล์ `app.js`
9. **ฟิลด์รองรับ 3 ชนิด**: `text`, `dropdown`, `date` — ถ้าจะเพิ่มชนิดใหม่ต้องแก้ทั้ง `fieldInputHtml()` ใน `app.js` และฟอร์ม "เพิ่มฟิลด์" ในหน้า Admin
10. **PIN ปัจจุบันของ session Admin เก็บใน `state.adminPin`** (JS memory เท่านั้น ไม่ persist) — ทุกเรียก API ที่ต้องใช้ pin ในหน้า Admin ให้ใช้ `state.adminPin` ไม่ใช่ `prompt()` ถามซ้ำ ปุ่ม Logout จะรีเซ็ตค่านี้ด้วย
11. **จุดที่เทียบค่าจากชีต Config กับค่าที่ส่งมาจากหน้าเว็บ (`checkPin`, `checkLogin`) ต้องครอบ `String(...)` ทั้งสองฝั่งเสมอ**
12. **PIN lockout บน Admin keypad** เก็บ state ใน `state.pinAttempts`/`pinLockUntil`/`pinLockTimer` — JS memory ล้วนๆ ไม่ persist ข้าม reload โดยตั้งใจ ปุ่ม Logout ตั้งใจไม่แตะตัวแปรกลุ่มนี้ (กันเลี่ยง lockout ผ่าน logout/login ซ้ำ)
13. **`manifest.json` เป็นไฟล์ static ล้วนๆ** ไม่มี logic ผูกกับ `app.js` เลย
14. **(ใหม่ v3.2) Toggle `itemPinRequired`** — คุมว่าต้องใส่ PIN ตอนเพิ่ม/ลบ**อุปกรณ์**ไหม (ไม่กระทบ Admin PIN gate หรือ Login) ถ้าจะเพิ่ม toggle ทำนองนี้อีกในอนาคต (เช่น ปิด PIN เฉพาะตอนเพิ่ม แต่ตอนลบยังคุมไว้) ให้ทำตามแพทเทิร์นเดียวกัน: เพิ่ม key ใหม่ใน `Config`, parse boolean ใน `getConfig()`, ส่งออกทาง `getAll()`/bootstrap, เช็คเงื่อนไขใน `doPost()` เฉพาะจุดที่เกี่ยวข้อง — **อย่าลืม**: ทุก toggle แบบนี้ต้องแก้ผ่าน `saveSettings()` (หรือ action ใหม่ที่ผ่าน `checkPin()` เท่านั้น) ห้ามเปิดช่องให้แก้ config โดยไม่ผ่าน PIN เด็ดขาด เพราะเป็นจุดควบคุมความปลอดภัยของทั้งระบบ

**ก่อนส่งงานทุกครั้ง**: (1) syntax check ทุกไฟล์ที่แก้ (2) เช็คว่า id ที่เรียกใน `app.js` ผ่าน `$('...')` มีอยู่จริงใน `index.html` ครบ (3) ถ้าแก้ `Code.gs` ให้เตือนผู้ใช้เรื่อง Deploy New version เสมอ (4) ถ้าแก้โครงสร้างชีต ให้เตือนเรื่องผลกระทบต่อข้อมูลเดิมและแนะนำวิธี migrate ที่ปลอดภัย
