-- SEB v2.18 — ตั้งค่าการแจ้งเตือนรายบุคคล (เลือกเรื่องที่แสดงในกล่องแจ้งเตือน / เด้ง Push)
alter table users add column if not exists "notifyPrefs" jsonb not null default '{}'::jsonb;
insert into settings (key, value, description) values ('SCHEMA_VERSION', '8', 'เวอร์ชันโครงสร้างฐานข้อมูล')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
