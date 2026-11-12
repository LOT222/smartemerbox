# ย้าย SEB ไปโปรเจกต์ Supabase ใหม่ (เก็บโปรเจกต์เดิมไว้เป็นสำรอง)

แนวทางนี้ **ไม่แตะโปรเจกต์เดิมเลย** ระบบเดิมใช้งานต่อได้ตามปกติจนถึงวันสลับ และถ้ามีปัญหาสลับกลับได้ทันที

| | |
|---|---|
| โปรเจกต์เดิม | `xsjenlppfpuykxwjbbfp` · อ่านอย่างเดียว ไม่มีการแก้ไข |
| โปรเจกต์ใหม่ | สร้างใหม่ · รับข้อมูลที่คัดลอกมา แล้วอัปเกรดเป็น v2 |
| หน้าเว็บ | repo `smartemerbox` เดิม → ที่อยู่เว็บเดิม → **QR ที่ติดกล่องใช้ต่อได้** |
| LINE OA | OA เดิม (token ติดมากับข้อมูลที่คัดลอก) |

แบ่งเป็น 2 ช่วง
- **ช่วง A · ซ้อม** (ทำวันไหนก็ได้ ~1.5 ชม.) ระบบเดิมยังใช้งานปกติ ไม่กระทบผู้ใช้
- **ช่วง B · วันสลับระบบ** (~40 นาที) ล้างข้อมูลซ้อม → คัดลอกข้อมูลล่าสุด → ชี้หน้าเว็บไปโปรเจกต์ใหม่

> ⚠ คีย์ secret (service_role) ของทั้ง 2 โปรเจกต์ **ห้ามบันทึกลงไฟล์ใน repo** (repo เป็นสาธารณะ) ใช้พิมพ์ใน PowerShell เท่านั้น

---

## ช่วง A · ซ้อม

### A1 · สร้างโปรเจกต์ใหม่
1. Supabase → **New project** · Organization เดิม (LOT222) · ชื่อ `seb-v2` · Region **Southeast Asia (Singapore)** · ตั้ง Database password แล้วจดไว้
   - แพ็กเกจฟรีมีโปรเจกต์ที่เปิดอยู่ได้ 2 โปรเจกต์ต่อ organization ถ้าเต็มต้องหยุด (pause) โปรเจกต์อื่นก่อน
2. รอสร้างเสร็จ → **Project Settings → API Keys** จด 3 ค่า
   - Project URL (`https://<ใหม่>.supabase.co`) และ Project ref (ส่วน `<ใหม่>`)
   - **Publishable key** (`sb_publishable_…`) → ใช้ในหน้าเว็บ
   - **Secret key** (`sb_secret_…`) → ใช้กับสคริปต์คัดลอกเท่านั้น
3. โปรเจกต์ **เดิม** → Project Settings → API Keys → จด **Secret key** (หรือ service_role key) ของโปรเจกต์เดิม

### A2 · สร้างโครงสร้างตั้งต้นในโปรเจกต์ใหม่
SQL Editor ของโปรเจกต์ **ใหม่** (ดูชื่อโปรเจกต์ที่มุมซ้ายบนทุกครั้ง)
1. วาง `supabase/migrations/202605240001_initial_schema.sql` → Run
2. วาง `SUPABASE_GRANTS.sql` → Run
3. **Database → Extensions** → เปิด `pg_cron` และ `pg_net`

### A3 · ตรวจโครงสร้าง แล้วคัดลอกข้อมูล
PowerShell ในโฟลเดอร์ที่แตก zip (ต้องมี Node.js 18 ขึ้นไป · ตรวจด้วย `node --version`)
```powershell
$env:OLD_URL = "https://xsjenlppfpuykxwjbbfp.supabase.co"
$env:OLD_KEY = "<Secret key ของโปรเจกต์เดิม>"
$env:NEW_URL = "https://<ใหม่>.supabase.co"
$env:NEW_KEY = "<Secret key ของโปรเจกต์ใหม่>"

node tools/copy-to-new-project.mjs check
```
- ขึ้น `✔ พร้อมคัดลอก` → ไปต่อ
- ขึ้น `⚠ … คอลัมน์ที่โปรเจกต์ใหม่ไม่มี` → สคริปต์สร้างไฟล์ `tools/fix-columns.sql` ให้ → วางใน SQL Editor โปรเจกต์ **ใหม่** → Run → รัน `SUPABASE_GRANTS.sql` อีกครั้ง → รัน `check` ใหม่จนผ่าน
  (เกิดได้ถ้าระบบเดิมเคยเพิ่มคอลัมน์/ตารางนอกเหนือจากไฟล์ตั้งต้น)

```powershell
node tools/copy-to-new-project.mjs copy
```
ต้องจบด้วย `✔ คัดลอกครบ` และทุกตารางมีเครื่องหมาย ✔ (ไม่คัดลอก `sessions` และ `printJobs` เพราะเป็นข้อมูลชั่วคราว)

### A4 · อัปเกรดโปรเจกต์ใหม่เป็น v2
SQL Editor โปรเจกต์ **ใหม่** → วางทีละไฟล์ → Run ตามลำดับ
`202611120001_seb_v2.sql` → `…0002_consent_pdpa.sql` → `…0003_roles_accounts.sql` → `…0004_expiry_alerts.sql` → `…0005_offline_queue.sql` → `SUPABASE_GRANTS.sql`

### A5 · ลงหน้าเว็บสำหรับซ้อม (Netlify Drop · ไม่แตะเว็บจริง)
```powershell
.\write-config.ps1 -SupabaseUrl "https://<ใหม่>.supabase.co" -AnonKey "<Publishable key ใหม่>"
```
ลากโฟลเดอร์ `public` ไปวางที่ https://app.netlify.com/drop → ได้ที่อยู่เว็บชั่วคราว เช่น `https://xxx.netlify.app` (จดไว้)

### A6 · Deploy backend ไปโปรเจกต์ใหม่
```powershell
npx web-push generate-vapid-keys        # จด Public / Private Key

npx supabase login
npx supabase link --project-ref <ใหม่>

npx supabase secrets set `
  PUBLIC_SITE_URL="https://xxx.netlify.app" `
  VAPID_PUBLIC_KEY="<Public Key>" `
  VAPID_PRIVATE_KEY="<Private Key>" `
  VAPID_SUBJECT="mailto:<อีเมลผู้ดูแล>" `
  CRON_SECRET="<สุ่ม 32 ตัวอักษร ชุดที่ 1>" `
  SHEET_EXPORT_KEY="<สุ่ม ชุดที่ 2>" `
  BACKUP_KEY="<สุ่ม ชุดที่ 3>"

npx supabase functions deploy api --no-verify-jwt
```
ช่วงซ้อม `PUBLIC_SITE_URL` ชี้ไปเว็บ Netlify เพื่อให้ลิงก์ QR ในระบบซ้อมเปิดหน้าซ้อม (ฉลาก QR จริงที่ติดกล่องยังชี้ระบบเดิมตามปกติ)

### A7 · งานอัตโนมัติ
เปิด `supabase/cron.sql` แทน `<PROJECT_REF>` = ref ใหม่, `<ANON_KEY>` = Publishable key ใหม่, `<CRON_SECRET>` = ชุดที่ 1 → วางใน SQL Editor โปรเจกต์ **ใหม่** → Run

### A8 · กันข้อความซ้อมเข้า LINE ของทุกคน (สำคัญ)
ข้อมูลที่คัดลอกมามี LINE token ของ OA จริง และโหมด Broadcast → ข้อความทดสอบจะไปถึงผู้ติดตามทุกคน
1. เปิดเว็บ Netlify → login ด้วยบัญชี admin เดิม → รับทราบ PDPA
2. **ตั้งค่า → การแจ้งเตือน** → โหมดการส่ง **Push (ระบุกลุ่ม/ผู้ใช้)** → LINE To ID = **User ID ของตัวเอง** (LINE Developers → Channel → Basic settings → Your user ID) → บันทึก
3. วันสลับระบบ ค่านี้จะกลับเป็นค่าของระบบเดิม (Broadcast) ให้เองตอนคัดลอกรอบจริง

### A9 · ทดสอบ
ทำตาม `เช็กลิสต์ทดสอบก่อนขึ้นระบบ_TH.md` ส่วน B–F และ H บนเว็บ Netlify (ส่วน A ทำไปแล้วในขั้นข้างบน)
- เคสทดสอบไม่ต้องลบ ช่วง B จะล้างข้อมูลซ้อมทั้งหมดให้
- ค่าที่ตั้งไว้ในหน้า **ตั้งค่า** ตอนซ้อม (ช่วงการศึกษา เบอร์ห้องยา รายการตัวเลือก ฯลฯ) **จะถูกเก็บไว้** ใช้ต่อวันจริง
- แต่ **จุดวางกล่อง / ผู้ใช้ / รายการยา** ที่แก้ตอนซ้อมจะถูกล้าง → วันจริงต้องตั้งจุดวางกล่องใหม่ (~10 นาที)

ซ้อมผ่านแล้ว ส่งผลมาให้ผู้พัฒนาดูก่อนกำหนดวันสลับ

---

## ช่วง B · วันสลับระบบ (~40 นาที)

เลือกช่วงที่มีเคสน้อย · **แจ้งทุกหน่วยล่วงหน้า: ระหว่างนี้ถ้าเปิดกล่องยาให้โทรแจ้งห้องยา** (เคสที่เกิดระหว่างสลับ ห้องยาบันทึกย้อนหลังในระบบใหม่ด้วยเมนู "บันทึกการเปิดกล่อง" ใส่เวลาเปิดใช้จริง)

| เวลา | ขั้นตอน |
|---|---|
| B1 | **สำรองโปรเจกต์เดิมอีกครั้ง**: Table Editor → export CSV ทุกตาราง |
| B2 | SQL Editor โปรเจกต์ **ใหม่** → วาง `tools/reset-new-project.sql` → Run (ล้างข้อมูลซ้อม เก็บ settings · ถ้าเผลอเปิดโปรเจกต์เดิม ไฟล์นี้จะหยุดเองโดยไม่ลบอะไร) |
| B3 | PowerShell (ตั้ง `$env:OLD_URL/OLD_KEY/NEW_URL/NEW_KEY` เหมือน A3) → `node tools/copy-to-new-project.mjs check` → `node tools/copy-to-new-project.mjs copy` → ต้องได้ `✔ คัดลอกครบ` |
| B4 | SQL Editor โปรเจกต์ **ใหม่** → รัน migration 0001 → 0005 อีกรอบ แล้ว `SUPABASE_GRANTS.sql` (รันซ้ำได้ ใช้แปลงข้อมูลที่เพิ่งคัดลอก) |
| B5 | `npx supabase secrets set PUBLIC_SITE_URL="https://lot222.github.io/smartemerbox"` (ไม่ต้อง deploy ใหม่) |
| B6 | **LINE Developers** → Channel → Messaging API → **Webhook URL** ถ้าเป็นที่อยู่ของโปรเจกต์เดิม ให้เปลี่ยนเป็น `https://<ใหม่>.supabase.co/functions/v1/api` → Verify (ถ้าช่องนี้ว่างหรือปิดอยู่ ข้ามได้) |
| B7 | **GitHub repo** → Settings → Secrets and variables → Actions: Variable `SEB_SUPABASE_URL` = URL ใหม่ · Secret `SEB_SUPABASE_ANON_KEY` = Publishable key ใหม่ · Variable `SEB_VAPID_PUBLIC_KEY` = Public Key (A6) · (ถ้าใช้ deploy อัตโนมัติ) Variable `SUPABASE_PROJECT_REF` = ref ใหม่ + Secret `SUPABASE_ACCESS_TOKEN` |
| B8 | แทนไฟล์ใน repo ด้วยไฟล์ชุด v2 ทั้งหมด (คงโฟลเดอร์ `.git` ไว้) → Settings → Pages → Source = **GitHub Actions** → Commit + Push → รอ "Deploy static SPA" เขียว |
| B9 | เปิด `https://lot222.github.io/smartemerbox` (Ctrl+F5) → login admin → **ตั้งค่า → การแจ้งเตือน** ตรวจว่าโหมดเป็นตามที่ต้องการ (Broadcast หรือกลุ่มเภสัชกร) → **จุดวางกล่อง** ตั้งใหม่ (แยก IPD ชาย/หญิง, ในงานวิจัย 4 หน่วย, รพ.สต. นอก รพ.) → **ตั้งค่า → รายการตัวเลือก** ดึงรายการยากลาง |
| B10 | ทดสอบจริง: สแกน QR กล่องจริง 1 กล่อง → LINE + Push มาถึง → รับทราบ → พร้อมใช้ → **ยกเลิกเคส** (เหตุผล "ทดสอบระบบ") |
| B11 | **ตั้งค่า → เครื่องนี้ → เวอร์ชันระบบ** ต้อง "ตรงกัน" ทั้ง 3 แถว · Actions → เปิด (Enable) **Keep Supabase Alive** และ **Nightly Backup** · ตั้ง secret `SEB_BACKUP_KEY` / `SEB_BACKUP_PASSPHRASE` |
| B12 | แจ้งทุกหน่วยว่าใช้งานได้ตามปกติ · จดวันเวลาสลับระบบ + เลขรุ่น v2.12.0 ในบันทึกโครงการวิจัย |

### หลังสลับ
- มือถือเภสัชกร: ติดตั้งแอป + **เปิดรับแจ้งเตือนใหม่ทุกเครื่อง** (การสมัครรับแจ้งเตือนผูกกับโปรเจกต์ใหม่)
- ทุกหน่วยสแกน QR กล่องของตัวเอง 1 ครั้ง (ให้เครื่องเก็บหน้าไว้ใช้ตอนออฟไลน์)
- เว็บ Netlify ที่ใช้ซ้อม: ลบทิ้งได้ (Netlify → Site settings → Delete site)
- **โปรเจกต์เดิม**: ไม่ต้องทำอะไร เก็บไว้เป็นสำรอง · แพ็กเกจฟรีจะหยุดโปรเจกต์ชั่วคราวเองเมื่อไม่มีการใช้งาน ~7 วัน ข้อมูลยังอยู่ กด Restore ได้จาก Dashboard · ถ้าใช้ระบบใหม่ครบ 1–2 เดือนไม่มีปัญหา ค่อยตัดสินใจลบ (export CSV เก็บไว้ก่อน)

### ถ้าต้องสลับกลับระบบเดิม
1. GitHub → Variables/Secrets: `SEB_SUPABASE_URL` / `SEB_SUPABASE_ANON_KEY` กลับเป็นของโปรเจกต์เดิม
2. แทนไฟล์ใน repo ด้วย ZIP ของ repo เดิมที่ดาวน์โหลดไว้ (ขั้นที่ 0) → Commit + Push
3. LINE Webhook URL (ถ้าเปลี่ยนใน B6) กลับเป็นที่อยู่เดิม
4. ถ้าโปรเจกต์เดิมถูกหยุดชั่วคราว → Dashboard → Restore project ก่อน

เคสที่บันทึกในระบบใหม่หลังสลับจะไม่อยู่ในโปรเจกต์เดิม (export จากโปรเจกต์ใหม่เก็บไว้ได้)
