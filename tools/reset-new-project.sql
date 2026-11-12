-- =====================================================================
-- SEB · ล้างข้อมูลในโปรเจกต์ "ใหม่" ก่อนคัดลอกรอบจริง (วันขึ้นระบบ)
-- ⚠ รันใน SQL Editor ของโปรเจกต์ใหม่เท่านั้น
--   ไฟล์นี้ตรวจเครื่องหมาย SEB_COPY_TARGET ก่อน: ถ้าเผลอรันในโปรเจกต์เดิม จะหยุดทันทีโดยไม่ลบอะไร
-- ลบ: ข้อมูลทุกตาราง (กล่อง ยา เคส log ผู้ใช้ จุดวางกล่อง ฯลฯ) ที่ได้จากการคัดลอกรอบซ้อม + ข้อมูลทดสอบ
-- เก็บไว้: ตาราง settings (ค่าที่ตั้งไว้ตอนซ้อม เช่น ช่วงการศึกษา เบอร์ห้องยา รายการตัวเลือก)
-- =====================================================================
do $$
declare
  t text;
begin
  if not exists (select 1 from settings where key = 'SEB_COPY_TARGET') then
    raise exception 'หยุด: ไม่พบเครื่องหมาย SEB_COPY_TARGET · โปรเจกต์นี้ไม่ใช่ปลายทางการคัดลอก (อาจเป็นโปรเจกต์เดิม) ไม่มีการลบข้อมูล';
  end if;
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'settings'
  loop
    execute format('truncate table public.%I restart identity cascade', t);
  end loop;
  raise notice 'ล้างข้อมูลแล้ว (ยกเว้น settings) · ขั้นต่อไป: node tools/copy-to-new-project.mjs copy';
end $$;
