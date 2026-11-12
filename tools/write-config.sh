#!/bin/sh
# เขียน public/config.js จาก Environment variables ของโฮสต์ (Cloudflare Pages / Netlify)
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
