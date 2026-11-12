-- =====================================================================
-- SEB v2 — โรงพยาบาลลานสัก
-- Migration แบบ "เพิ่มอย่างเดียว" (additive) ไม่ลบตารางหรือแถวข้อมูลเดิม
-- รันได้ซ้ำโดยไม่เสียหาย (idempotent)
-- ข้อยกเว้นเดียว: คัดลอก HN ไปตาราง "eventPrivate" แล้วล้างคอลัมน์ hn ใน openEvents
-- เพื่อแยก HN ออกจากข้อมูลเชิงเทคนิคตามโครงร่างวิจัยข้อ 5.7.2
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- users: บทบาทใหม่ + รหัสบุคลากร ----------
alter table users drop constraint if exists users_role_check;
update users set role = 'pharmacist' where role = 'user';
alter table users add constraint users_role_check check (role in ('admin', 'pharmacist', 'technician', 'nurse', 'viewer'));
alter table users add column if not exists "staffCode" text;
alter table users add column if not exists "researchConsent" boolean not null default false;
alter table users add column if not exists "lastLoginAt" timestamptz;

-- ---------- จุดวางกล่อง (เพิ่มเองได้, แยกใน/นอก รพ.) ----------
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  zone text not null default 'in' check (zone in ('in', 'out')),
  "unitType" text not null default 'other',
  "inStudy" boolean not null default false,
  active boolean not null default true,
  "sortOrder" integer default 0,
  note text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table boxes add column if not exists "locationId" uuid references locations(id) on delete set null;
alter table boxes add column if not exists "sealNo" text;
alter table boxes add column if not exists "lastReadyAt" timestamptz;
alter table boxes add column if not exists "lastInspectedAt" timestamptz;

-- สร้างจุดวางกล่องจากข้อความ location เดิมของกล่อง (ตรวจทานภายหลังในหน้า "จุดวางกล่อง")
insert into locations (name, zone, "unitType", "inStudy")
select distinct trim(b.location), 'in',
  case
    when b.location ilike '%ER%' or b.location like '%ฉุกเฉิน%' then 'ER'
    when b.location ilike '%LR%' or b.location like '%คลอด%' then 'LR'
    when b.location ilike '%IPD%' or b.location like '%ผู้ป่วยใน%' then 'IPD'
    when b.location ilike '%OPD%' or b.location like '%ผู้ป่วยนอก%' then 'OPD'
    when b.location ilike '%EMS%' or b.location like '%รถ%' then 'EMS'
    else 'other' end,
  (b.location ilike '%ER%' or b.location like '%ฉุกเฉิน%' or b.location ilike '%LR%'
    or b.location like '%คลอด%' or b.location ilike '%IPD%' or b.location like '%ผู้ป่วยใน%')
from boxes b
where coalesce(trim(b.location), '') <> ''
  and not exists (select 1 from locations l where l.name = trim(b.location));

update boxes b set "locationId" = l.id
from locations l
where b."locationId" is null and l.name = trim(b.location);

-- ---------- openEvents: ตัวแปรวิจัย 4 จุดเวลา + สถานะการแจ้งเตือน ----------
alter table "openEvents" add column if not exists "eventCode" text;
alter table "openEvents" add column if not exists "locationId" uuid references locations(id) on delete set null;
alter table "openEvents" add column if not exists "locationName" text;
alter table "openEvents" add column if not exists "actualOpenedAt" timestamptz;
alter table "openEvents" add column if not exists "recordedAt" timestamptz default now();
alter table "openEvents" add column if not exists "unitNotifiedAt" timestamptz;      -- ใช้กับข้อมูล baseline กระดาษ
alter table "openEvents" add column if not exists "notificationSentAt" timestamptz;  -- เวลา server ที่ LINE ส่งสำเร็จ
alter table "openEvents" add column if not exists "notificationStatus" text;         -- sent / failed / skipped / legacy_unknown
alter table "openEvents" add column if not exists "notificationError" text;
alter table "openEvents" add column if not exists "pushSentAt" timestamptz;
alter table "openEvents" add column if not exists "pushSent" integer default 0;
alter table "openEvents" add column if not exists "pushFailed" integer default 0;
alter table "openEvents" add column if not exists "acknowledgedById" uuid;
alter table "openEvents" add column if not exists "readyAt" timestamptz;
alter table "openEvents" add column if not exists "readyBy" text;
alter table "openEvents" add column if not exists "readyEstimated" boolean not null default false;
alter table "openEvents" add column if not exists "escalatedAt" timestamptz;
alter table "openEvents" add column if not exists "caseStatus" text default 'open';  -- open / acknowledged / ready / cancelled
alter table "openEvents" add column if not exists "reasonCategory" text;
alter table "openEvents" add column if not exists "openerName" text;
alter table "openEvents" add column if not exists "source" text default 'qr';        -- qr / staff / paper
alter table "openEvents" add column if not exists "period" text;                     -- baseline_prosp / pilot / post / other
alter table "openEvents" add column if not exists "requiredFields" integer;
alter table "openEvents" add column if not exists "filledFields" integer;
alter table "openEvents" add column if not exists "dataNote" text;

create unique index if not exists "openEvents_eventCode_key" on "openEvents"("eventCode");

-- HN แยกตาราง เข้าถึงได้เฉพาะเภสัชกร/ผู้ดูแล ผ่าน Edge Function
create table if not exists "eventPrivate" (
  "eventId" uuid primary key references "openEvents"(id) on delete cascade,
  hn text,
  "createdAt" timestamptz not null default now()
);

insert into "eventPrivate" ("eventId", hn)
select id, hn from "openEvents"
where coalesce(hn, '') <> ''
on conflict ("eventId") do nothing;

update "openEvents" set hn = null
where hn is not null and exists (select 1 from "eventPrivate" p where p."eventId" = "openEvents".id);

-- ---------- เติมค่าย้อนหลังให้ข้อมูลเดิม (legacy backfill) ----------
update "openEvents" set "actualOpenedAt" = "openedAt" where "actualOpenedAt" is null;
update "openEvents" set "recordedAt" = "openedAt" where "recordedAt" is null;
-- แถวเดิม (ยังไม่มี notificationStatus) = ข้อมูลจากระบบรุ่นแรก
update "openEvents" set source = case when "openedBy" = 'QR' then 'qr' else 'staff' end where "notificationStatus" is null;
update "openEvents" set "notificationStatus" = 'legacy_unknown', "dataNote" = coalesce("dataNote", 'ข้อมูลจากระบบรุ่นแรก: ไม่มีบันทึกเวลาส่งแจ้งเตือน') where "notificationStatus" is null;
update "openEvents" e set "locationId" = b."locationId", "locationName" = l.name
from boxes b left join locations l on l.id = b."locationId"
where e."boxId" = b.id and e."locationId" is null;

-- รหัสเหตุการณ์ (event_id) แบบสุ่ม ไม่ได้คำนวณจาก HN
update "openEvents"
set "eventCode" = 'EV-' || to_char("openedAt" at time zone 'Asia/Bangkok', 'YYMM') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5))
where "eventCode" is null;

-- ready_at โดยประมาณ: การบันทึกกล่องครั้งแรกหลังเหตุการณ์ (จาก auditLogs) — ติดธง readyEstimated
update "openEvents" e set
  "readyAt" = x.at,
  "readyBy" = x.username,
  "readyEstimated" = true
from (
  select distinct on (e2.id) e2.id as event_id, a.at, a.username
  from "openEvents" e2
  join "auditLogs" a on a.action = 'save_box'
    and a."detailJson"->>'id' = e2."boxId"::text
    and a.at > e2."openedAt"
  where e2."readyAt" is null
  order by e2.id, a.at
) x
where e.id = x.event_id and e."readyAt" is null;

update "openEvents" set "caseStatus" = case
  when "readyAt" is not null then 'ready'
  when "acknowledgedAt" is not null then 'acknowledged'
  else 'open' end
where "notificationStatus" = 'legacy_unknown' and ("caseStatus" is null or "caseStatus" = 'open');

-- เคสเก่าที่ไม่มี ready_at แต่กล่องถูกเติมแล้ว (สถานะกล่องไม่ใช่ "เปิดใช้งานแล้ว") หรือมีเคสใหม่กว่าในกล่องเดียวกัน
-- → ปิดเคสอัตโนมัติ (ไม่กำหนด ready_at เพื่อไม่ให้ปนในการวิเคราะห์)
update "openEvents" e set "caseStatus" = 'ready',
  "dataNote" = coalesce(e."dataNote", '') || ' · ปิดเคสอัตโนมัติจากระบบรุ่นแรก (ไม่มีเวลาพร้อมใช้)'
from boxes b
where e."boxId" = b.id
  and e."notificationStatus" = 'legacy_unknown'
  and e."readyAt" is null
  and e."caseStatus" in ('open', 'acknowledged')
  and (
    coalesce(b.status, '') <> 'เปิดใช้งานแล้ว'
    or exists (select 1 from "openEvents" n where n."boxId" = e."boxId" and n."openedAt" > e."openedAt")
  );

-- ---------- การตรวจกล่องประจำเดือน (ภาคผนวก ก 1.2) ----------
create table if not exists inspections (
  id uuid primary key default gen_random_uuid(),
  "boxId" uuid references boxes(id) on delete set null,
  "boxCode" text,
  "locationId" uuid references locations(id) on delete set null,
  "locationName" text,
  "inspectedAt" timestamptz not null default now(),
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "durationMin" numeric,
  "inspectorId" uuid,
  "inspectorName" text,
  "itemsChecked" integer default 0,
  "itemsExpired" integer default 0,
  "itemsNearExpiry" integer default 0,
  "itemsMissing" integer default 0,
  "isReady" boolean,
  "sealNo" text,
  "problemNote" text,
  "requiredFields" integer,
  "filledFields" integer,
  source text not null default 'app',  -- app / paper
  period text,
  "createdAt" timestamptz not null default now()
);

create table if not exists "inspectionItems" (
  id uuid primary key default gen_random_uuid(),
  "inspectionId" uuid references inspections(id) on delete cascade,
  "drugName" text,
  strength text,
  form text,
  "requiredQty" numeric,
  "actualQty" numeric,
  lot text,
  "expiryDate" date,
  status text check (status in ('normal', 'near', 'expired', 'missing')),
  note text,
  "sortOrder" integer default 0
);

-- ---------- การเคลื่อนไหวของยา (ไม่ลบทับแบบเดิม) ----------
create table if not exists "stockMoves" (
  id uuid primary key default gen_random_uuid(),
  "boxId" uuid references boxes(id) on delete set null,
  "boxCode" text,
  "eventId" uuid references "openEvents"(id) on delete set null,
  type text not null check (type in ('use', 'refill', 'replace_lot', 'discard_expired', 'adjust')),
  "drugName" text,
  strength text,
  lot text,
  "expiryDate" date,
  "qtyChange" numeric,
  at timestamptz not null default now(),
  "byUser" text,
  reason text
);

-- ---------- log การเข้าใช้งาน ----------
create table if not exists "loginLogs" (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  "userId" uuid,
  username text,
  success boolean not null,
  reason text,
  "userAgent" text,
  "logoutAt" timestamptz
);

-- ---------- อุปกรณ์รับแจ้งเตือน (Web Push) ----------
create table if not exists "pushSubscriptions" (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  "userId" uuid,
  username text,
  "deviceLabel" text,
  "userAgent" text,
  active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "lastSuccessAt" timestamptz,
  "lastError" text
);

-- ---------- เวลาจัดทำรายงานประจำเดือน (5.7.8) ----------
create table if not exists "reportTimings" (
  id uuid primary key default gen_random_uuid(),
  "reportMonth" text not null,            -- YYYY-MM
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  minutes numeric,
  "byUser" text,
  source text not null default 'app',     -- app / paper
  period text,
  note text,
  "createdAt" timestamptz not null default now()
);

-- ---------- baseline ย้อนหลัง 6 เดือน (ระดับหน่วยงาน) ----------
create table if not exists "baselineAggregates" (
  id uuid primary key default gen_random_uuid(),
  "periodMonth" text not null,            -- YYYY-MM
  "locationId" uuid references locations(id) on delete set null,
  "locationName" text,
  inspections integer default 0,
  "inspectionsReady" integer default 0,
  "itemsChecked" integer default 0,
  "itemsExpired" integer default 0,
  "recordsTotal" integer default 0,
  "recordsComplete" integer default 0,
  note text,
  "createdAt" timestamptz not null default now()
);

-- ---------- แบบสังเกตภาคสนาม (ภาคผนวก ก ส่วนที่ 3) ----------
create table if not exists observations (
  id uuid primary key default gen_random_uuid(),
  "observedAt" timestamptz not null default now(),
  place text,
  "observedCode" text,
  items jsonb default '{}'::jsonb,
  note text,
  "byUser" text
);

-- ---------- แบบสอบถามฉบับ EC (ภาคผนวก ข) ----------
create table if not exists "surveyV2" (
  id uuid primary key default gen_random_uuid(),
  "submittedAt" timestamptz not null default now(),
  "respondentCode" text,
  consent boolean not null default false,
  gender text,
  "ageGroup" text,
  profession text,
  "professionOther" text,
  experience text,
  "usageFrequency" text,
  "smartphoneSkill" text,
  likert jsonb default '{}'::jsonb,       -- q1..q22
  comparisons jsonb default '{}'::jsonb,  -- c1..c6
  "openAnswers" jsonb default '{}'::jsonb,-- o1..o5
  "usabilityScore" numeric,
  "performanceScore" numeric,
  "usefulnessScore" numeric,
  "trustScore" numeric,
  "acceptanceScore" numeric,
  "overallScore" numeric,
  accepted boolean
);
create unique index if not exists "surveyV2_respondentCode_key" on "surveyV2"("respondentCode") where "respondentCode" is not null and "respondentCode" <> '';

-- ---------- ค่าตั้งต้นใหม่ ----------
insert into settings (key, value, description) values
  ('HOSPITAL_NAME', 'โรงพยาบาลลานสัก', 'ชื่อโรงพยาบาล'),
  ('DEPARTMENT_NAME', 'กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค', 'ชื่อหน่วยงาน'),
  ('NEAR_EXPIRY_DAYS', '30', 'จำนวนวันที่ถือว่าใกล้หมดอายุ'),
  ('RESPONSE_TARGET_MIN', '5', 'เป้าหมายระยะเวลาตอบสนอง (นาที)'),
  ('ESCALATE_AFTER_MIN', '15', 'แจ้งเตือนซ้ำเมื่อยังไม่มีผู้รับทราบ (นาที)'),
  ('PUBLIC_OPEN_COOLDOWN_SEC', '120', 'กันการกดเปิดซ้ำจาก QR (วินาที)'),
  ('INSPECTION_INTERVAL_DAYS', '30', 'รอบการตรวจกล่อง (วัน)'),
  ('STUDY_PILOT_START', '', 'วันเริ่มทดสอบนำร่อง (YYYY-MM-DD)'),
  ('STUDY_PILOT_END', '', 'วันสิ้นสุดทดสอบนำร่อง'),
  ('STUDY_POST_START', '', 'วันเริ่มใช้งานจริง (เดือนที่ 4)'),
  ('STUDY_POST_END', '', 'วันสิ้นสุดใช้งานจริง (เดือนที่ 6)'),
  ('DAILY_DIGEST_HOUR', '8', 'ชั่วโมงส่งสรุปประจำวัน'),
  ('LINE_DAILY_DIGEST', '0', 'ส่งสรุปรายวันทาง LINE ด้วย (1) หรือ Push อย่างเดียว (0) เพื่อประหยัดโควตา')
on conflict (key) do nothing;

-- ---------- RLS: เปิดทุกตาราง (เข้าถึงผ่าน Edge Function ด้วย service role เท่านั้น) ----------
alter table locations enable row level security;
alter table "eventPrivate" enable row level security;
alter table inspections enable row level security;
alter table "inspectionItems" enable row level security;
alter table "stockMoves" enable row level security;
alter table "loginLogs" enable row level security;
alter table "pushSubscriptions" enable row level security;
alter table "reportTimings" enable row level security;
alter table "baselineAggregates" enable row level security;
alter table observations enable row level security;
alter table "surveyV2" enable row level security;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- ตัดสิทธิ์ anon/authenticated ออกจากตาราง (หน้าเว็บคุยกับ Edge Function เท่านั้น)
revoke all on all tables in schema public from anon, authenticated;

-- ---------- indexes ----------
create index if not exists "openEvents_boxId_idx" on "openEvents"("boxId");
create index if not exists "openEvents_actualOpenedAt_idx" on "openEvents"("actualOpenedAt");
create index if not exists "inspections_boxId_idx" on inspections("boxId");
create index if not exists "auditLogs_at_idx" on "auditLogs"(at);
create index if not exists "loginLogs_at_idx" on "loginLogs"(at);


-- เลขรุ่นฐานข้อมูล (backend ตรวจผ่าน apiHealth) · เลื่อนขึ้นเท่านั้น ไม่ถอยลงถ้ารันไฟล์เก่าซ้ำ
insert into settings (key, value, description) values ('SCHEMA_VERSION', '1', 'เลข migration ล่าสุดที่รันแล้ว')
on conflict (key) do update set value = greatest(settings.value::int, excluded.value::int)::text;
