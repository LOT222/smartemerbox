create extension if not exists pgcrypto;

create table if not exists settings (
  key text primary key,
  value text,
  description text,
  "updatedAt" timestamptz,
  "updatedBy" text
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  "displayName" text,
  role text not null default 'user' check (role in ('admin', 'user')),
  "passwordHash" text not null,
  salt text not null,
  active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  position text
);

create table if not exists sessions (
  token text primary key,
  "userId" uuid references users(id) on delete cascade,
  username text,
  role text,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists kits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "kitItems" (
  id uuid primary key default gen_random_uuid(),
  "kitId" uuid references kits(id) on delete cascade,
  "drugName" text not null,
  strength text,
  "defaultQty" numeric default 0,
  unit text,
  "sortOrder" integer default 0
);

create table if not exists boxes (
  id uuid primary key default gen_random_uuid(),
  "boxCode" text unique not null,
  "kitId" uuid references kits(id) on delete set null,
  "kitName" text,
  location text,
  status text default 'พร้อมใช้',
  "qrToken" text not null default encode(gen_random_bytes(16), 'hex'),
  note text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "openedAt" timestamptz,
  "openedBy" text,
  "inspectionDate" date,
  "inspectionNote" text,
  "inspectionUpdatedAt" timestamptz,
  "inspectionUpdatedBy" text
);

create table if not exists "boxItems" (
  id uuid primary key default gen_random_uuid(),
  "boxId" uuid references boxes(id) on delete cascade,
  "drugName" text not null,
  strength text,
  form text,
  lot text,
  "expiryDate" date,
  qty numeric default 0,
  unit text,
  "sortOrder" integer default 0,
  "requiredQty" numeric default 0
);

create table if not exists "openEvents" (
  id uuid primary key default gen_random_uuid(),
  "boxId" uuid references boxes(id) on delete set null,
  "boxCode" text,
  "openedAt" timestamptz not null default now(),
  "openedBy" text,
  department text,
  reason text,
  "itemsUsedJson" jsonb default '[]'::jsonb,
  note text,
  hn text,
  "acknowledgedAt" timestamptz,
  "acknowledgedBy" text
);

create table if not exists "surveyResponses" (
  id uuid primary key default gen_random_uuid(),
  "submittedAt" timestamptz not null default now(),
  gender text,
  "ageGroup" text,
  profession text,
  "professionOther" text,
  experience text,
  "usageFrequency" text,
  "smartphoneSkill" text,
  "scoresJson" jsonb default '{}'::jsonb,
  "comparisonsJson" jsonb default '{}'::jsonb,
  "openAnswersJson" jsonb default '{}'::jsonb,
  "usabilityScore" numeric,
  "performanceScore" numeric,
  "usefulnessScore" numeric,
  "trustScore" numeric,
  "acceptanceScore" numeric,
  "totalScore" numeric
);

create table if not exists "auditLogs" (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  "userId" uuid,
  username text,
  action text not null,
  "detailJson" jsonb default '{}'::jsonb
);

create table if not exists "lineRecipients" (
  "recipientId" text primary key,
  "sourceType" text,
  "displayName" text,
  active boolean not null default true,
  "followedAt" timestamptz,
  "lastSeenAt" timestamptz,
  "lastEventType" text
);

create table if not exists "printJobs" (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null default now() + interval '30 minutes'
);

alter table settings enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table kits enable row level security;
alter table "kitItems" enable row level security;
alter table boxes enable row level security;
alter table "boxItems" enable row level security;
alter table "openEvents" enable row level security;
alter table "surveyResponses" enable row level security;
alter table "auditLogs" enable row level security;
alter table "lineRecipients" enable row level security;
alter table "printJobs" enable row level security;

insert into settings (key, value, description)
values
  ('APP_DISPLAY_NAME', 'Smart Emergency Box', 'Application display name'),
  ('APP_SHORT_NAME', 'SEB', 'Application short name'),
  ('APP_CREDIT_TEXT', 'Developed by Natee I.,Pharm D.', 'Sidebar credit'),
  ('EXPIRY_ALERT_DAYS', '90', 'Days before expiry to alert'),
  ('HOSPITAL_NAME', '', 'Hospital name'),
  ('LINE_CHANNEL_ACCESS_TOKEN', '', 'LINE long-lived channel access token'),
  ('LINE_SEND_MODE', 'broadcast', 'LINE send mode: broadcast or push'),
  ('LINE_TO_ID', '', 'LINE user/group/room ids separated by newline or pipe')
on conflict (key) do nothing;

insert into users (username, "displayName", role, "passwordHash", salt, active, position)
values ('admin', 'Administrator', 'admin', '643be0b351855986da38431b05670bca70d637f6be0c6b32c8cedf66d54b2618', 'seed-admin', true, 'เภสัชกร')
on conflict (username) do nothing;
