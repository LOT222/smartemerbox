-- SEB v2.10 · บันทึกการเปิดกล่องแบบออฟไลน์ (คิวในเครื่อง ส่งเข้าระบบเมื่อกลับมาออนไลน์)
alter table "openEvents" add column if not exists "clientRequestId" text;
alter table "openEvents" add column if not exists "offlineQueued" boolean not null default false;
alter table "openEvents" add column if not exists "clientSubmittedAt" timestamptz;
-- กันบันทึกซ้ำเมื่อเครื่องส่งคิวเดิมซ้ำ (เช่น ส่งสำเร็จแต่ไม่ได้รับคำตอบ)
create unique index if not exists "openEvents_clientRequestId_key" on "openEvents" ("clientRequestId") where "clientRequestId" is not null;
comment on column "openEvents"."offlineQueued" is 'บันทึกตอนไม่มีอินเทอร์เน็ต แล้วส่งเข้าระบบภายหลัง (recordedAt = เวลาที่ระบบได้รับ, clientSubmittedAt = เวลากดบันทึกบนเครื่อง)';

insert into settings (key, value, description) values
  ('PHARMACY_PHONE', '', 'เบอร์โทรห้องยา แสดงในหน้าสแกน QR เมื่อส่งแจ้งเตือนไม่ได้'),
  ('LINE_ESCALATE', '0', 'แจ้งซ้ำเมื่อไม่มีผู้รับทราบ: 0 = Push อย่างเดียว, 1 = LINE + Push')
on conflict (key) do nothing;


-- เลขรุ่นฐานข้อมูล (backend ตรวจผ่าน apiHealth) · เลื่อนขึ้นเท่านั้น ไม่ถอยลงถ้ารันไฟล์เก่าซ้ำ
insert into settings (key, value, description) values ('SCHEMA_VERSION', '5', 'เลข migration ล่าสุดที่รันแล้ว')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
