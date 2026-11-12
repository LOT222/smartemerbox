# คู่มือติดตั้ง SEB v2 (ปรับปรุงจากระบบ Supabase เดิม)

ระบบใช้ **GitHub Pages + Supabase + LINE** ตามโครงร่างที่ EC รับรอง เพิ่ม Web Push สำหรับแจ้งเตือนบนเครื่อง
การอัปเกรดเป็นแบบ **เพิ่มอย่างเดียว** ข้อมูลเดิมทั้งหมดยังอยู่

> ใช้เวลาประมาณ 30–45 นาที · ทำนอกเวลาที่มีการเปิดกล่องบ่อย เช่น ช่วงบ่าย

---

## โครงสร้างไฟล์

```
public/                  ← หน้าเว็บ (ลง GitHub Pages หรือ Netlify Drop)
  index.html, styles.css, sw.js, manifest.webmanifest, config.js
  js/        core · app · pages · research · public · mock (โหมดตัวอย่าง)
  vendor/    ฟอนต์ ไอคอน QR (ไม่พึ่ง CDN ใช้ออฟไลน์ได้)
  icons/
supabase/
  migrations/202611120001…0005_*.sql   ← อัปเกรดฐานข้อมูล (รันตามลำดับ · ไม่รันไฟล์ 202605240001)
  functions/api/index.ts               ← backend
  cron.sql                             ← งานอัตโนมัติ (แจ้งซ้ำ / สรุปรายวัน)
  config.toml
apps-script/Code.gs                    ← (เสริม) ส่งข้อมูลไป Google Sheets / สำรองลง Drive
.github/workflows/                     ← deploy หน้าเว็บ · deploy backend · keep-alive · สำรองข้อมูลทุกคืน
CHANGELOG.md                           ← ประวัติรุ่น และสิ่งที่ต้องทำเมื่ออัปเดต
เช็กลิสต์ทดสอบก่อนขึ้นระบบ_TH.md
คู่มือย้ายไปโปรเจกต์ใหม่_TH.md        ← ทางเลือก: ย้ายไปโปรเจกต์ใหม่ เก็บตัวเดิมเป็นสำรอง
tools/copy-to-new-project.mjs          ← คัดลอกข้อมูลโปรเจกต์เดิม → ใหม่ (Node.js)
tools/reset-new-project.sql            ← ล้างข้อมูลซ้อมในโปรเจกต์ใหม่ (มีตัวกันรันผิดโปรเจกต์)
supabase.sql                           ← ใช้เฉพาะติดตั้งใหม่ทั้งหมด
```

---

> **ต้องการสร้างโปรเจกต์ Supabase ใหม่และเก็บตัวเดิมไว้เป็นสำรอง** → ใช้ `คู่มือย้ายไปโปรเจกต์ใหม่_TH.md` แทนขั้นที่ 0–5 ของคู่มือนี้

> **ก่อนอัปเกรดตัวจริง** ทดสอบบนโปรเจกต์ Supabase สำรองตาม `เช็กลิสต์ทดสอบก่อนขึ้นระบบ_TH.md` ก่อน

## ขั้นที่ 0 · สำรองข้อมูลก่อน

Supabase Dashboard → **Database → Backups** (หรือ Table Editor → Export CSV ตาราง `openEvents`, `boxes`, `boxItems`, `auditLogs`)

## ขั้นที่ 1 · อัปเกรดฐานข้อมูล

Supabase Dashboard → **SQL Editor** → วางไฟล์ `supabase/migrations/202611120001_seb_v2.sql` → Run

สิ่งที่ migration ทำ:
- เพิ่มคอลัมน์ตัวแปรวิจัย `actualOpenedAt`, `notificationSentAt`, `acknowledgedAt`, `readyAt` และสถานะการส่งแจ้งเตือน
- ย้าย HN ไปตาราง `eventPrivate` (แยกจากข้อมูลเชิงเทคนิคตามข้อ 5.7.2)
- สร้าง `event_id` แบบสุ่มให้เหตุการณ์เดิม
- ประมาณ `readyAt` ของเหตุการณ์เดิมจาก auditLogs และติดธง `readyEstimated` (ไม่นำมาคำนวณตัวชี้วัดหลัก)
- เหตุการณ์จากระบบรุ่นแรกติดป้าย `legacy_unknown` (ไม่มีเวลาส่งแจ้งเตือน)
- สร้างจุดวางกล่องจากข้อความ location เดิม → **ต้องตรวจทานในขั้นที่ 6**
- เปลี่ยนบทบาท `user` เดิมเป็น `pharmacist`

รันซ้ำได้โดยไม่เสียหาย

### ขั้นที่ 1.1 · PDPA และแบบยินยอมอิเล็กทรอนิกส์

วาง `supabase/migrations/202611120002_consent_pdpa.sql` ใน SQL Editor → Run (เพิ่มตาราง `userConsents` และค่าตั้งต้น)

- ผู้ใช้ทุกคนต้องอ่านและกด "รับทราบ" ประกาศความเป็นส่วนตัวก่อนเริ่มใช้งาน ระบบบันทึกเวลาที่รับทราบ
- แบบยินยอมเข้าร่วมวิจัยแบบอิเล็กทรอนิกส์ **ปิดไว้เป็นค่าเริ่มต้น** เปิดได้ที่ ตั้งค่า → PDPA / ความยินยอม หลัง EC อนุมัติการแก้ไขโครงร่างแล้วเท่านั้น

### ขั้นที่ 1.2 · บทบาทใหม่ + สมัครสมาชิก / ลืมรหัสผ่าน

วาง `supabase/migrations/202611120003_roles_accounts.sql` ใน SQL Editor → Run

- บทบาท: ผู้ดูแลระบบ / เภสัชกร / จพ.เภสัชกรรม / พยาบาลวิชาชีพ (พยาบาลบันทึกการเปิดกล่องได้ แต่รับทราบ/เติมยา/ตรวจกล่องไม่ได้)
- เพิ่มผู้ใช้โดยเว้นรหัสผ่านว่าง = รหัสเริ่มต้น `1234` (เปลี่ยนค่าได้ที่ ตั้งค่า → ทั่วไป)
- สมัครสมาชิกและลืมรหัสผ่าน: ส่งคำขอเข้าคิว ผู้ดูแลระบบอนุมัติที่หน้า "ผู้ใช้งาน" (มีตัวเลขแจ้งบนเมนู และ Push แจ้งเครื่องของผู้ดูแล)

### ขั้นที่ 1.3 · แจ้งเตือนยาใกล้หมดอายุตามรอบ

วาง `supabase/migrations/202611120004_expiry_alerts.sql` → Run (สร้างตาราง `expiryAlerts` + ค่า `LINE_EXPIRY_ALERTS`, `EXPIRY_ALERT_MILESTONES`)

### ขั้นที่ 1.4 · บันทึกออฟไลน์ + เบอร์โทรห้องยา

วาง `supabase/migrations/202611120005_offline_queue.sql` → Run (เพิ่มคอลัมน์ `clientRequestId`, `offlineQueued`, `clientSubmittedAt` ใน `openEvents` และค่า `PHARMACY_PHONE`, `LINE_ESCALATE`)

- หน้าสแกน QR ที่ไม่มีอินเทอร์เน็ตจะเก็บบันทึกไว้ในเครื่อง แล้วส่งเองเมื่อกลับมาออนไลน์ (ไม่บันทึกซ้ำ) · เคสแบบนี้มีป้าย "ออฟไลน์" และ `recordedAt` = เวลาที่ระบบได้รับจริง
- ต้องเคยเปิดหน้าเว็บบนเครื่องนั้นอย่างน้อย 1 ครั้งตอนออนไลน์ (เพื่อให้เครื่องเก็บหน้าเว็บไว้) · แนะนำให้แต่ละหน่วยสแกน QR กล่องของตัวเองหนึ่งครั้งหลังขึ้นระบบ
- ตั้งเบอร์โทรห้องยาที่ ตั้งค่า → ทั่วไป เพื่อให้ปุ่ม "โทรแจ้งห้องยา" ขึ้นตอนออฟไลน์

## ขั้นที่ 2 · สร้างกุญแจ Web Push (VAPID)

บนคอมที่มี Node.js:

```powershell
npx web-push generate-vapid-keys
```

จะได้ **Public Key** และ **Private Key** เก็บไว้ (Private Key ห้ามใส่ในหน้าเว็บ)

## ขั้นที่ 3 · ตั้งค่า secrets และ deploy backend

```powershell
supabase login
supabase link --project-ref xsjenlppfpuykxwjbbfp

supabase secrets set `
  PUBLIC_SITE_URL="https://lot222.github.io/smartemerbox" `
  VAPID_PUBLIC_KEY="<Public Key>" `
  VAPID_PRIVATE_KEY="<Private Key>" `
  VAPID_SUBJECT="mailto:<อีเมลผู้ดูแล>" `
  CRON_SECRET="<สุ่มข้อความยาว ๆ>" `
  SHEET_EXPORT_KEY="<สุ่มข้อความยาว ๆ อีกชุด>" `
  BACKUP_KEY="<สุ่มข้อความยาว ๆ ชุดที่ 3>"

supabase functions deploy api --no-verify-jwt
```

> `PUBLIC_SITE_URL` คือที่อยู่ที่ QR บนฉลากชี้ไป ถ้าใช้ GitHub Pages ที่เดิม **ฉลาก QR ที่ติดกล่องอยู่แล้วใช้ต่อได้ทันที** ไม่ต้องพิมพ์ใหม่

ตรวจว่า backend ทำงาน: เปิด Command Prompt แล้วรัน

```powershell
curl -X POST https://xsjenlppfpuykxwjbbfp.supabase.co/functions/v1/api -H "content-type: application/json" -d "{\"action\":\"apiHealth\",\"args\":[]}"
```

ควรได้ `{"data":{"ok":true,...,"push":true}}`

### ขั้นที่ 3.1 (แนะนำ) · ให้ GitHub deploy backend ให้อัตโนมัติ

ทำครั้งเดียว ต่อไปแก้ backend แล้วแค่ push ไม่ต้องพิมพ์คำสั่ง deploy
1. Supabase Dashboard → รูปโปรไฟล์ → **Account preferences → Access Tokens** → Generate new token (ตั้งชื่อ `github-seb`) → คัดลอก
2. GitHub repo → Settings → Secrets and variables → Actions
   - Secret `SUPABASE_ACCESS_TOKEN` = token ข้อ 1
   - Variable `SUPABASE_PROJECT_REF` = `xsjenlppfpuykxwjbbfp`
3. ทดสอบ: แท็บ Actions → **Deploy backend (Edge Function)** → Run workflow → ขั้น Health check ต้องเขียว

> token นี้มีสิทธิ์จัดการโปรเจกต์ Supabase ทั้งหมด เก็บไว้ใน GitHub Secrets เท่านั้น ถ้าหลุดให้ revoke ที่หน้าเดิมแล้วสร้างใหม่
> migration ฐานข้อมูล **ไม่** รันอัตโนมัติ (ตั้งใจ เพื่อป้องกันข้อมูลวิจัยเสียหาย)

## ขั้นที่ 4 · ตั้งเวลางานอัตโนมัติ

เปิด `supabase/cron.sql` แทนค่า `<PROJECT_REF>`, `<ANON_KEY>`, `<CRON_SECRET>` → วางใน SQL Editor → Run

- ทุก 5 นาที: เคสที่ไม่มีผู้รับทราบเกิน 15 นาที → แจ้งเตือนซ้ำ
- ทุกวัน 08:00 น.: แจ้ง LINE ยาใกล้หมดอายุตามรอบ 30 / 15 / 7 วัน (ส่งเฉพาะวันที่มียาถึงรอบ ครั้งเดียวต่อรอบ · ตาราง `expiryAlerts` จาก migration 0004)
- ทุกวัน 08:00 น.: สรุปยาหมดอายุ / ใกล้หมดอายุ / กล่องเลยวันตรวจ (ค่าเริ่มต้นส่งทาง Push เพื่อประหยัดโควตา LINE)

## ขั้นที่ 5 · ลงหน้าเว็บ

### ทางเลือก A — GitHub Pages ที่เดิม (แนะนำ ตรงกับโครงร่างวิจัย)

1. แทนที่ไฟล์ใน repo `lot222/smartemerbox` ด้วยไฟล์ในชุดนี้ทั้งหมด
2. GitHub → Settings → Secrets and variables → Actions → **Variables** เพิ่ม `SEB_VAPID_PUBLIC_KEY` = Public Key จากขั้นที่ 2
   (ตัวแปร `SEB_SUPABASE_URL` และ secret `SEB_SUPABASE_ANON_KEY` มีอยู่แล้ว)
3. Commit และ push → GitHub Actions จะ deploy ให้อัตโนมัติ

### ทางเลือก B — Netlify Drop

1. เปิด `public/config.js` ใส่ `SEB_VAPID_PUBLIC_KEY`
2. ลากโฟลเดอร์ `public` ไปวางที่ https://app.netlify.com/drop
3. ตั้ง secret `PUBLIC_SITE_URL` เป็น URL ของ Netlify แล้ว deploy backend ใหม่
4. ⚠️ QR ใหม่จะชี้ไป Netlify → **ต้องพิมพ์ฉลาก QR ใหม่ทุกกล่อง** (เมนู กล่องยา → พิมพ์ QR)

## ขั้นที่ 6 · ตั้งค่าในแอป (ผู้ดูแลระบบ)

1. เข้าสู่ระบบด้วย admin → ระบบจะเตือนให้เปลี่ยนรหัสผ่าน ถ้ายังเป็น `admin123`
2. **จุดวางกล่อง**: ตรวจทานทุกจุด
   - แยก **หอผู้ป่วยในชาย** และ **หอผู้ป่วยในหญิง** เป็นคนละจุด
   - เปิด "อยู่ในขอบเขตงานวิจัย" เฉพาะ ER, IPD ชาย, IPD หญิง, LR
   - เพิ่ม รพ.สต. เป็น "นอก รพ." ตามแผน
3. **ตั้งค่า → ช่วงการศึกษา**: ใส่วันที่นำร่อง (pilot) และวันเริ่ม–สิ้นสุดใช้งานจริง (เดือนที่ 4–6)
4. **ตั้งค่า → การแจ้งเตือน**: กด "ตรวจโควตา" LINE และ "ทดสอบส่ง LINE + Push"
5. **ผู้ใช้งาน**: เพิ่มบุคลากร ใส่รหัสบุคลากร (เช่น P01, N03) และติ๊ก "ลงนามยินยอมเข้าร่วมวิจัยแล้ว"

## ขั้นที่ 7 · ติดตั้งบนเครื่องของเภสัชกร

| อุปกรณ์ | วิธี |
|---|---|
| iPhone (iOS 16.4+) | Safari → ปุ่มแชร์ → **เพิ่มไปยังหน้าจอโฮม** → เปิดแอปจากไอคอน → ตั้งค่า → เปิดรับแจ้งเตือน |
| Android | Chrome → ⋮ → **ติดตั้งแอป** → ตั้งค่า → เปิดรับแจ้งเตือน · ตั้งแบตเตอรี่ Chrome เป็น "ไม่จำกัด" |
| คอมห้องยา | Chrome/Edge → ไอคอนติดตั้งที่แถบที่อยู่ → เปิดรับแจ้งเตือน (ต้องเปิดเบราว์เซอร์ค้างไว้) |

## ขั้นที่ 7.1 · สำรองข้อมูลอัตโนมัติทุกคืน (สำคัญ)

Supabase แพ็กเกจฟรีไม่มีการสำรองข้อมูลให้ เลือกอย่างน้อย 1 ทาง (ทำทั้ง 2 ทางยิ่งดี)

**ทาง A — GitHub Actions (เข้ารหัส เก็บ 30 วัน)**
1. GitHub repo → Settings → Secrets and variables → Actions → เพิ่ม
   - (ถ้ายังไม่มีจาก keep-alive) Variable `SEB_SUPABASE_URL` = URL โปรเจกต์ Supabase · Secret `SEB_SUPABASE_ANON_KEY` = anon/publishable key
   - Secret `SEB_BACKUP_KEY` = ค่าเดียวกับ `BACKUP_KEY` ในขั้นที่ 3
   - Secret `SEB_BACKUP_PASSPHRASE` = รหัสผ่านถอดรหัสไฟล์ **อย่างน้อย 16 ตัวอักษร** (จดเก็บไว้ในที่ปลอดภัย ถ้าลืมจะเปิดไฟล์สำรองไม่ได้)
2. แท็บ Actions → **Nightly Backup (encrypted)** → Run workflow เพื่อทดสอบ → ได้ไฟล์ `seb-backup-วันที่.tar.gz.enc`
3. ระบบรันเองทุกคืน 02:30 น.

> repo เป็นสาธารณะ artifact จึงต้องเข้ารหัสเสมอ ไฟล์สำรองมี HN และ hash รหัสผ่าน

**ทาง B — Google Drive ของหน่วยงาน (Apps Script)**
1. ในโปรเจกต์ Apps Script (ขั้นที่ 8) → Project Settings → Script Properties → เพิ่ม `BACKUP_KEY`
2. รัน `setupBackup()` → ได้โฟลเดอร์ **SEB-Backup** ใน Drive เก็บ 30 ไฟล์ล่าสุด
3. ห้ามแชร์โฟลเดอร์นี้

**กู้คืนข้อมูล**
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in seb-backup-XXXX.tar.gz.enc -out backup.tar.gz   # ใส่ passphrase
tar -xzf backup.tar.gz     # ได้ไฟล์ <ตาราง>.json ทีละตาราง
```
นำเข้าทีละตารางใน SQL Editor (ตัวอย่างตาราง boxes):
```sql
insert into boxes select * from json_populate_recordset(null::boxes, '<วางเนื้อหา boxes.json>') on conflict do nothing;
```
ชื่อตารางที่มีตัวพิมพ์ใหญ่ต้องใส่เครื่องหมายคำพูด เช่น `insert into "openEvents" select * from json_populate_recordset(null::"openEvents", ...)`

ลำดับที่แนะนำ: settings → users → locations → kits → kitItems → boxes → boxItems → openEvents → eventPrivate → ตารางอื่น ๆ · LINE token ในไฟล์สำรองถูกปิดเป็น `***` ต้องใส่ใหม่ที่หน้า ตั้งค่า

## ขั้นที่ 8 (เสริม) · ส่งข้อมูลไป Google Sheets

1. สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วาง `apps-script/Code.gs`
2. แก้ `SHEET_EXPORT_KEY` ให้ตรงกับขั้นที่ 3 → รัน `setup()` → อนุญาตสิทธิ์
3. ระบบดึงข้อมูล (ไม่มี HN) ลงชีตทุกวัน 06:00 น. หรือกดเมนู **SEB → ดึงข้อมูลตอนนี้**

---

## ข้อควรระวังด้านงานวิจัย

- **โควตา LINE**: แพ็กเกจฟรีของ LINE OA ในไทยมี 300 ข้อความ/เดือน และนับตามจำนวนผู้รับ ถ้าโควตาหมด เหตุการณ์จะไม่มี `notification_sent_at` (ถูกนับเป็นข้อมูลสูญหาย) ควรตรวจโควตาเป็นระยะ หรืออัปเกรดแพ็กเกจในช่วงเก็บข้อมูล
- **เหตุการณ์จากระบบรุ่นแรก**: ไม่มีเวลาส่งแจ้งเตือน และ `readyAt` เป็นค่าประมาณ ระบบแยกออกจากการคำนวณตัวชี้วัดหลักอัตโนมัติ ควรรายงานเป็นข้อจำกัด
- **ข้อมูลนำร่อง**: ลบได้ที่ งานวิจัย → ส่งออกข้อมูล → ลบข้อมูลช่วงนำร่อง (ตามขั้นที่ 3 ของโครงร่าง)
- **การทำลายข้อมูล**: ภายใน 1 ปีหลังสิ้นสุดโครงการ ตามข้อ 6.10

## ทดลองโหมดตัวอย่าง (ไม่แตะข้อมูลจริง)

เปิด `index.html?demo=1` → ผู้ใช้ `admin` / `demo1234`

---

## การอัปเดตระบบภายหลัง

ทุกรุ่นใหม่ดูใน `CHANGELOG.md` ว่ามีป้ายอะไร แล้วทำตามลำดับ **[DB] → [Backend] → [เว็บ]**

| ป้าย | ต้องทำ |
|---|---|
| **[DB 000X]** | SQL Editor → วางเฉพาะไฟล์ migration ใหม่ → Run (รันซ้ำได้ไม่เสียหาย) |
| **[Backend]** | ถ้าทำขั้นที่ 3.1 แล้ว: push อย่างเดียว · ถ้ายัง: `npx supabase functions deploy api --no-verify-jwt` |
| **[เว็บ]** | คัดลอกไฟล์ทับใน repo → Commit + Push (GitHub Pages deploy ให้เอง) |
| **[วิจัย]** | จดวันที่และเลขรุ่นในบันทึกโครงการวิจัย |

หลังอัปเดต: แอป → ตั้งค่า → เครื่องนี้ → **เวอร์ชันระบบ** ต้องขึ้น "ตรงกัน" ทั้ง 3 แถว (หน้าเว็บ / Backend / ฐานข้อมูล) แล้วกด "ทดสอบส่ง LINE + Push" หนึ่งครั้ง
มือถือที่ติดตั้งแอปจะอัปเดตเองเมื่อเปิดครั้งถัดไป ถ้ายังเห็นรุ่นเก่า ให้ปิดแอปให้สนิทแล้วเปิดใหม่ (คอม: Ctrl+F5)
