-- =====================================================================
-- SEB v2 — ประกาศ PDPA + แบบยินยอมเข้าร่วมวิจัยแบบอิเล็กทรอนิกส์ (e-consent)
-- เพิ่มอย่างเดียว · รันซ้ำได้
-- =====================================================================
alter table users add column if not exists "pdpaVersion" text;
alter table users add column if not exists "pdpaAcceptedAt" timestamptz;
alter table users add column if not exists "consentOfficer" boolean not null default false;

create table if not exists "userConsents" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references users(id) on delete set null,
  username text,
  kind text not null check (kind in ('pdpa', 'research')),
  status text not null check (status in ('accepted', 'viewed', 'signed', 'declined', 'withdrawn')),
  "docVersion" text,
  "fullName" text,
  position text,
  unit text,
  age integer,
  "agreedItems" jsonb default '[]'::jsonb,
  "signatureData" text,          -- PNG data URL ของลายมือชื่อ
  "pisFirstViewedAt" timestamptz,
  "signedAt" timestamptz,
  "declinedAt" timestamptz,
  "withdrawnAt" timestamptz,
  "withdrawReason" text,
  "receivedBy" text,             -- เจ้าหน้าที่ผู้รับเอกสารยินยอมที่ได้รับมอบหมาย
  "receivedAt" timestamptz,
  "userAgent" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists "userConsents_user_kind_idx" on "userConsents"("userId", kind);
alter table "userConsents" enable row level security;
grant select, insert, update, delete on "userConsents" to service_role;
revoke all on "userConsents" from anon, authenticated;

insert into settings (key, value, description) values
  ('PDPA_NOTICE_VERSION', '1.0', 'เวอร์ชันประกาศความเป็นส่วนตัว (เปลี่ยนเลขเมื่อแก้ข้อความ ผู้ใช้ทุกคนต้องรับทราบใหม่)'),
  ('PDPA_NOTICE_TEXT', '', 'ข้อความประกาศ PDPA (เว้นว่าง = ใช้ข้อความตั้งต้น)'),
  ('ECONSENT_ENABLED', '0', 'เปิดใช้แบบยินยอมเข้าร่วมวิจัยแบบอิเล็กทรอนิกส์ (ต้องได้รับอนุมัติจาก EC ก่อน)'),
  ('CONSENT_WAIT_DAYS', '7', 'จำนวนวันขั้นต่ำหลังเปิดอ่านเอกสารชี้แจง ก่อนลงนามได้'),
  ('CONSENT_DOC_VERSION', '', 'เวอร์ชันเอกสารชี้แจง/แบบยินยอม (เว้นว่าง = ฉบับแก้ไขครั้งที่ 1)'),
  ('PIS_TEXT', '', 'ข้อความเอกสารชี้แจง (เว้นว่าง = ข้อความตั้งต้นจากภาคผนวก ค)')
on conflict (key) do nothing;


-- เลขรุ่นฐานข้อมูล (backend ตรวจผ่าน apiHealth) · เลื่อนขึ้นเท่านั้น ไม่ถอยลงถ้ารันไฟล์เก่าซ้ำ
insert into settings (key, value, description) values ('SCHEMA_VERSION', '2', 'เลข migration ล่าสุดที่รันแล้ว')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
