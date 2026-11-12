-- SEB v2.9 · แจ้งเตือนยาใกล้หมดอายุทาง LINE ตามรอบ 30 / 15 / 7 วัน (ส่งครั้งเดียวต่อยา 1 รายการต่อ 1 รอบ)
create table if not exists "expiryAlerts" (
  "alertKey" text not null,           -- boxId|drugName|lot|expiryDate (ไม่ใช้ id ของ boxItems เพราะเปลี่ยนทุกครั้งที่บันทึกรายการยา)
  "milestone" int not null,           -- 30 / 15 / 7 (วันก่อนหมดอายุ)
  "boxCode" text,
  "drugName" text,
  "expiryDate" date,
  "sentAt" timestamptz default now(),
  "lineOk" boolean,
  primary key ("alertKey", "milestone")
);
alter table "expiryAlerts" enable row level security;
revoke all on "expiryAlerts" from anon, authenticated;

insert into settings (key, value, description) values
  ('LINE_EXPIRY_ALERTS', '1', 'ส่ง LINE แจ้งยาใกล้หมดอายุตามรอบวัน (1=เปิด 0=ปิด)'),
  ('EXPIRY_ALERT_MILESTONES', '30,15,7', 'รอบวันแจ้งเตือนก่อนหมดอายุ คั่นด้วยจุลภาค เช่น 30,15,7 (ใส่ 0 = แจ้งวันที่หมดอายุด้วย)')
on conflict (key) do nothing;


-- เลขรุ่นฐานข้อมูล (backend ตรวจผ่าน apiHealth) · เลื่อนขึ้นเท่านั้น ไม่ถอยลงถ้ารันไฟล์เก่าซ้ำ
insert into settings (key, value, description) values ('SCHEMA_VERSION', '4', 'เลข migration ล่าสุดที่รันแล้ว')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
