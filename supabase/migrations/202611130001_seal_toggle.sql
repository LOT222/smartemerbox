-- SEB v2.14 — เปิด/ปิดระบบเลขซีล (ค่าเริ่มต้น: ปิด จนกว่าจะมีซีลใช้จริง)
insert into settings (key, value, description) values
  ('SEAL_ENABLED', '0', 'ใช้ระบบเลขซีล (1 = เปิด, 0 = ปิด ซ่อนช่องเลขซีลทุกหน้า)')
on conflict (key) do nothing;
insert into settings (key, value, description) values ('SCHEMA_VERSION', '6', 'เวอร์ชันโครงสร้างฐานข้อมูล')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
