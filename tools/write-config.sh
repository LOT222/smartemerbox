#!/bin/sh
# เขียน public/config.js สำหรับโฮสต์ทดลอง (Cloudflare Pages: smartemerbox.pages.dev)
#
# ค่าเริ่มต้น = โหมดตัวอย่าง (ข้อมูลจำลองในเบราว์เซอร์ ไม่ต่อฐานข้อมูลจริง ไม่ส่งการ์ดเข้ากลุ่ม)
#   เพราะโปรเจกต์ Supabase V.2 เป็นระบบจริงแล้ว (สลับระบบ 23 พ.ย. 2569) → เว็บทดลองห้ามต่อข้อมูลจริง
# ถ้าจำเป็นต้องต่อฐานข้อมูลจริงจริง ๆ ให้ตั้ง Environment variable SEB_LIVE=1 พร้อม SEB_SUPABASE_URL / SEB_SUPABASE_ANON_KEY
# (ระบบจริงที่ GitHub Pages เขียน config เองใน .github/workflows/pages.yml ไม่ใช้ไฟล์นี้)
if [ "$SEB_LIVE" != "1" ]; then
  printf '// โหมดตัวอย่าง (เว็บทดลอง) · ไม่ต่อฐานข้อมูลจริง\nwindow.SEB_SUPABASE_URL = "";\nwindow.SEB_SUPABASE_ANON_KEY = "";\nwindow.SEB_VAPID_PUBLIC_KEY = "";\n' > public/config.js
  echo "config.js written -> DEMO (ตั้ง SEB_LIVE=1 ถ้าต้องการต่อฐานข้อมูลจริง)"
  exit 0
fi
# ใส่เฉพาะ Publishable key เท่านั้น ห้ามใส่ Secret key
URL=$(printf '%s' "$SEB_SUPABASE_URL" | tr -d ' "\r\n' | sed 's#/*$##')
KEY=$(printf '%s' "$SEB_SUPABASE_ANON_KEY" | tr -d ' "\r\n')
if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "ERROR: ยังไม่ได้ตั้ง SEB_SUPABASE_URL หรือ SEB_SUPABASE_ANON_KEY ใน Environment variables" >&2; exit 1
fi
case "$KEY" in sb_secret_*) echo "ERROR: ใส่ Secret key ผิดช่อง ต้องเป็น Publishable key (sb_publishable_...)" >&2; exit 1;; esac
case "$URL" in https://*.supabase.co) ;; *) echo "ERROR: SEB_SUPABASE_URL ต้องเป็นรูปแบบ https://xxxx.supabase.co (ได้: $URL)" >&2; exit 1;; esac
printf 'window.SEB_SUPABASE_URL = "%s";\nwindow.SEB_SUPABASE_ANON_KEY = "%s";\nwindow.SEB_VAPID_PUBLIC_KEY = "%s";\n' "$URL" "$KEY" "$SEB_VAPID_PUBLIC_KEY" > public/config.js
echo "config.js written -> $URL"
