# วิธีติดตั้งแบบง่าย

Production URL ของระบบนี้:

```text
https://lot222.github.io/smartemerbox/
```

ระบบนี้ถ้าต้องการให้ทำงานครบถ้วนต้องมี 3 ส่วน:

1. `index.html` และ `config.js` สำหรับหน้าเว็บ
2. `supabase.sql` สำหรับสร้างตารางและ admin เริ่มต้น
3. `supabase/functions/api/index.ts` สำหรับ backend เช่น login, session, LINE และ print job

ถ้ามีแค่ `index.html` + `supabase.sql` หน้า login จะขึ้นได้ แต่จะกด login ไม่ได้ เพราะยังไม่มี API backend

## 1) สร้างฐานข้อมูล

ใน Supabase SQL Editor ให้รันไฟล์:

```text
supabase.sql
```

ระบบจะสร้าง user เริ่มต้น:

```text
User: admin
Password: admin123
```

ถ้าแก้ `passwordHash` เอง ห้ามใส่ password ตรง ๆ ต้องเป็น SHA-256 ของ `password:salt`

## 2) Deploy backend

ติดตั้ง Supabase CLI แล้ว login:

```powershell
supabase login
```

จากโฟลเดอร์โปรเจกต์นี้ รัน:

```powershell
.\deploy-supabase.ps1 -ProjectRef xsjenlppfpuykxwjbbfp -PublicSiteUrl "https://lot222.github.io/smartemerbox/"
```

คำสั่งนี้จะ:

- link project
- push schema
- ตั้งค่า `PUBLIC_SITE_URL`
- deploy Edge Function ชื่อ `api`

## 3) ใส่ค่า config สำหรับทดสอบบนเครื่อง

ไปที่ Supabase dashboard:

```text
Project Settings > API
```

คัดลอก:

- Project URL
- anon public key

แล้วรัน:

```powershell
.\write-config.ps1 -SupabaseUrl "https://xsjenlppfpuykxwjbbfp.supabase.co" -AnonKey "YOUR_ANON_PUBLIC_KEY"
```

สคริปต์จะสร้าง/แก้:

```text
config.js
public/config.js
```

## 4) ตั้งค่า GitHub Pages

ใน GitHub repository `lot222/smartemerbox` ให้ไปที่:

```text
Settings > Secrets and variables > Actions
```

เพิ่ม Repository variable:

```text
SEB_SUPABASE_URL = https://xsjenlppfpuykxwjbbfp.supabase.co
```

เพิ่ม Repository secret:

```text
SEB_SUPABASE_ANON_KEY = YOUR_ANON_PUBLIC_KEY
```

Workflow จะสร้าง `public/config.js` ให้อัตโนมัติตอน deploy GitHub Pages

## 5) เช็ค API ก่อน login

เปิด:

```text
check-api.html
```

ถ้าสำเร็จควรเห็น:

```json
{"data":{"ok":true}}
```

ถ้าเห็น HTTP 404 หรือเชื่อมต่อไม่ได้ แปลว่า Edge Function `api` ยังไม่ได้ deploy หรือ config ผิด

## 6) Login

เปิด:

```text
https://lot222.github.io/smartemerbox/
```

Login:

```text
admin / admin123
```

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ในหน้าเว็บเด็ดขาด เพราะ service role key ใช้เฉพาะใน Supabase Edge Function เท่านั้น

