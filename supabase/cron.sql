-- =====================================================================
-- SEB v2 — ตั้งเวลางานอัตโนมัติ (รันใน Supabase SQL Editor หลัง deploy Edge Function)
-- แทนค่า 3 จุด: <PROJECT_REF>, <ANON_KEY>, <CRON_SECRET>
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ลบงานเดิม (ถ้ามี) เพื่อรันซ้ำได้
select cron.unschedule(jobid) from cron.job where jobname in ('seb-tick', 'seb-daily');

-- ทุก 5 นาที: แจ้งเตือนซ้ำ (escalate) เคสที่ยังไม่มีผู้รับทราบเกินเวลาที่กำหนด
select cron.schedule('seb-tick', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/api',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>","apikey":"<ANON_KEY>"}'::jsonb,
    body := '{"action":"apiCron","args":["<CRON_SECRET>","tick"]}'::jsonb
  );
$$);

-- ทุกวัน 08:00 น. (01:00 UTC): สรุปยาหมดอายุ / ใกล้หมดอายุ / กล่องที่เลยวันตรวจ
select cron.schedule('seb-daily', '0 1 * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/api',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>","apikey":"<ANON_KEY>"}'::jsonb,
    body := '{"action":"apiCron","args":["<CRON_SECRET>","daily"]}'::jsonb
  );
$$);
