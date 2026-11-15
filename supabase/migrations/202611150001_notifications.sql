-- SEB v2.15 — กล่องแจ้งเตือนในระบบ (Inbox)
-- ทุกครั้งที่ระบบส่ง Push (สรุปรายวัน · ยาใกล้หมดอายุ · เปิดกล่อง · แจ้งซ้ำ · คำขอบัญชี · ทดสอบ)
-- จะเก็บสำเนาไว้ที่นี่ด้วย กดแจ้งเตือนบนมือถือแล้วจะเปิดมาที่รายการนั้นในระบบ ไม่หายไปไหน
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                    -- daily | expiry | case | escalate | account | test
  title text not null,
  body text not null default '',
  link text not null default '',         -- หน้าในแอปที่เกี่ยวข้อง เช่น boxes · case/<id> · users
  detail jsonb,                          -- รายละเอียดสำหรับแสดงในหน้าแจ้งเตือน (รายการยา/กล่อง)
  audience text not null default 'all',  -- all | admin
  "createdAt" timestamptz not null default now()
);
create index if not exists notifications_created_idx on notifications ("createdAt" desc);

-- สถานะอ่านแล้ว แยกรายคน
create table if not exists "notificationReads" (
  "userId" uuid not null,
  "notificationId" uuid not null references notifications(id) on delete cascade,
  "readAt" timestamptz not null default now(),
  primary key ("userId", "notificationId")
);

alter table notifications enable row level security;
alter table "notificationReads" enable row level security;
revoke all on notifications from anon, authenticated;
revoke all on "notificationReads" from anon, authenticated;
grant select, insert, update, delete on notifications, "notificationReads" to service_role;

insert into settings (key, value, description) values
  ('NOTIFY_KEEP_DAYS', '90', 'เก็บรายการในกล่องแจ้งเตือนกี่วัน (เก่ากว่านี้ลบอัตโนมัติทุกเช้า)')
on conflict (key) do nothing;

insert into settings (key, value, description) values ('SCHEMA_VERSION', '7', 'เวอร์ชันโครงสร้างฐานข้อมูล')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
