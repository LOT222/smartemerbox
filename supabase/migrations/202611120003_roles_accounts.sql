-- =====================================================================
-- SEB v2 — บทบาทใหม่ (จพ.เภสัชกรรม / พยาบาลวิชาชีพ) + สมัครสมาชิก / ลืมรหัสผ่าน
-- เพิ่มอย่างเดียว · รันซ้ำได้
-- =====================================================================
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('admin', 'pharmacist', 'technician', 'nurse', 'viewer'));
alter table users add column if not exists phone text;

create table if not exists "accountRequests" (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('signup', 'reset')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  username text,
  "displayName" text,
  position text,
  role text,
  phone text,
  note text,
  "passwordHash" text,
  salt text,
  "userId" uuid references users(id) on delete set null,
  "handledBy" text,
  "handledAt" timestamptz,
  "createdAt" timestamptz not null default now()
);
create index if not exists "accountRequests_status_idx" on "accountRequests"(status);
alter table "accountRequests" enable row level security;
grant select, insert, update, delete on "accountRequests" to service_role;
revoke all on "accountRequests" from anon, authenticated;

insert into settings (key, value, description) values
  ('DEFAULT_PASSWORD', '1234', 'รหัสผ่านเริ่มต้นเมื่อเพิ่มผู้ใช้/รีเซ็ตรหัสผ่าน'),
  ('ALLOW_SIGNUP', '1', 'เปิดให้สมัครสมาชิกเอง (ต้องรอผู้ดูแลอนุมัติ)')
on conflict (key) do nothing;

update settings set value = 'ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลลานสัก'
where key = 'APP_CREDIT_TEXT' and (value is null or value = '' or value like 'Developed by Natee%');
insert into settings (key, value, description) values
  ('APP_CREDIT_TEXT', 'ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลลานสัก', 'ผู้พัฒนาระบบ')
on conflict (key) do nothing;


-- เลขรุ่นฐานข้อมูล (backend ตรวจผ่าน apiHealth) · เลื่อนขึ้นเท่านั้น ไม่ถอยลงถ้ารันไฟล์เก่าซ้ำ
insert into settings (key, value, description) values ('SCHEMA_VERSION', '3', 'เลข migration ล่าสุดที่รันแล้ว')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
