#!/bin/sh
# เขียน public/config.js จาก Environment variables ของโฮสต์ (Cloudflare Pages / Netlify)
# ใส่เฉพาะ Publishable key เท่านั้น ห้ามใส่ Secret key
printf 'window.SEB_SUPABASE_URL = "%s";\nwindow.SEB_SUPABASE_ANON_KEY = "%s";\nwindow.SEB_VAPID_PUBLIC_KEY = "%s";\n' \
  "$SEB_SUPABASE_URL" "$SEB_SUPABASE_ANON_KEY" "$SEB_VAPID_PUBLIC_KEY" > public/config.js
echo "config.js written (URL: $SEB_SUPABASE_URL)"
