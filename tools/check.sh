#!/bin/sh
# ตรวจ syntax ก่อน deploy (ใช้ใน GitHub Actions และรันเองในเครื่องได้: sh tools/check.sh)
# - backend: แปลง supabase/functions/api/index.ts ด้วย esbuild (จับชื่อตัวแปรซ้ำ วงเล็บไม่ครบ ฯลฯ)
# - หน้าเว็บ: node --check ทุกไฟล์ใน public/js และ public/sw.js
set -e
echo "• ตรวจ backend (Edge Function)"
npx -y esbuild@0.24.0 supabase/functions/api/index.ts --log-level=error > /dev/null
echo "• ตรวจหน้าเว็บ"
for f in public/js/*.js public/sw.js; do node --check "$f"; done
echo "✔ ผ่าน"
