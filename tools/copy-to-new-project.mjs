#!/usr/bin/env node
// =====================================================================
// SEB · คัดลอกข้อมูลจากโปรเจกต์ Supabase เดิม → โปรเจกต์ใหม่ (โปรเจกต์เดิมไม่ถูกแก้ไขใด ๆ)
// ใช้ Node 18+ ไม่ต้องติดตั้งอะไรเพิ่ม
//
//   PowerShell (ตั้งค่าครั้งเดียวต่อหน้าต่าง · ห้ามบันทึกคีย์ลงไฟล์ใน repo):
//     $env:OLD_URL = "https://<เดิม>.supabase.co";  $env:OLD_KEY = "<secret/service_role key ของโปรเจกต์เดิม>"
//     $env:NEW_URL = "https://<ใหม่>.supabase.co";  $env:NEW_KEY = "<secret/service_role key ของโปรเจกต์ใหม่>"
//
//   node tools/copy-to-new-project.mjs check   ← ตรวจโครงสร้าง + นับแถว (ไม่เขียนอะไร)
//   node tools/copy-to-new-project.mjs copy    ← คัดลอกข้อมูล แล้วนับแถวเทียบกัน
//
// ลำดับที่ถูกต้อง: โปรเจกต์ใหม่รัน 202605240001_initial_schema.sql + SUPABASE_GRANTS.sql → check → copy
//                → แล้วจึงรัน migration 0001–0005 ในโปรเจกต์ใหม่
// =====================================================================
import { writeFileSync } from "node:fs";

const MODE = (process.argv[2] || "check").toLowerCase();
const OLD = { name: "เดิม", url: (process.env.OLD_URL || "").replace(/\/+$/, ""), key: process.env.OLD_KEY || "" };
const NEW = { name: "ใหม่", url: (process.env.NEW_URL || "").replace(/\/+$/, ""), key: process.env.NEW_KEY || "" };
// ลำดับตาม foreign key · sessions/printJobs เป็นข้อมูลชั่วคราว ไม่คัดลอก
const ORDER = ["settings", "users", "kits", "kitItems", "boxes", "boxItems", "openEvents", "surveyResponses", "auditLogs", "lineRecipients"];
const SKIP = new Set(["sessions", "printJobs"]);
const MARKER = "SEB_COPY_TARGET";
const BATCH = 500;

const die = (m) => { console.error("\n✖ " + m + "\n"); process.exit(1); };
const ok = (m) => console.log("✔ " + m);
const info = (m) => console.log("  " + m);
const warn = (m) => console.log("⚠ " + m);

if (!["check", "copy"].includes(MODE)) die("ใช้: node tools/copy-to-new-project.mjs check | copy");
for (const p of [OLD, NEW]) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(p.url) && process.env.SEB_TEST !== "1") die(`ตั้งค่า ${p === OLD ? "OLD_URL" : "NEW_URL"} ไม่ถูกต้อง (ตัวอย่าง https://abcd.supabase.co)`);
  if (!p.key) die(`ยังไม่ได้ตั้ง ${p === OLD ? "OLD_KEY" : "NEW_KEY"} (ใช้ secret key หรือ service_role key)`);
  if (/^sb_publishable_/.test(p.key) || /"role":"anon"/.test(Buffer.from((p.key.split(".")[1] || ""), "base64").toString())) die(`${p === OLD ? "OLD_KEY" : "NEW_KEY"} เป็น anon/publishable key · ต้องใช้ secret key (Settings → API Keys)`);
}
if (OLD.url === NEW.url) die("OLD_URL กับ NEW_URL เป็นโปรเจกต์เดียวกัน");

const headers = (p, extra = {}) => ({ apikey: p.key, ...(p.key.startsWith("sb_") ? {} : { Authorization: `Bearer ${p.key}` }), ...extra });
async function req(p, path, opt = {}) {
  const r = await fetch(`${p.url}/rest/v1/${path}`, { ...opt, headers: headers(p, opt.headers) });
  const text = await r.text();
  if (!r.ok) throw new Error(`[${p.name}] ${opt.method || "GET"} ${path.split("?")[0]} → ${r.status} ${text.slice(0, 300)}`);
  return { data: text ? JSON.parse(text) : null, headers: r.headers };
}
async function schema(p) {
  const { data } = await req(p, "", { headers: { Accept: "application/openapi+json" } });
  const defs = data?.definitions || {};
  const out = {};
  for (const [t, d] of Object.entries(defs)) {
    const cols = {};
    for (const [c, v] of Object.entries(d.properties || {})) cols[c] = { type: v.format || v.type || "text", pk: /<pk\/>/.test(v.description || ""), required: (d.required || []).includes(c) };
    out[t] = cols;
  }
  return out;
}
const pkOf = (cols) => Object.keys(cols).find((c) => cols[c].pk) || (cols.id ? "id" : Object.keys(cols)[0]);
async function count(p, t) {
  const { headers: h } = await req(p, `${encodeURIComponent(t)}?select=*&limit=1`, { headers: { Prefer: "count=exact" } });
  const cr = h.get("content-range") || "";
  return Number(cr.split("/")[1] || 0);
}
async function readAll(p, t, pk) {
  const rows = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await req(p, `${encodeURIComponent(t)}?select=*&order=${encodeURIComponent(pk)}.asc&limit=1000&offset=${off}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

console.log(`\nSEB · คัดลอกข้อมูล (${MODE})\n  เดิม: ${OLD.url}\n  ใหม่: ${NEW.url}\n`);
const [so, sn] = await Promise.all([schema(OLD), schema(NEW)]).catch((e) => die(e.message));
if (!Object.keys(sn).length) die("โปรเจกต์ใหม่ยังไม่มีตาราง · รัน 202605240001_initial_schema.sql และ SUPABASE_GRANTS.sql ใน SQL Editor ของโปรเจกต์ใหม่ก่อน");

// กันสลับเดิม/ใหม่: โปรเจกต์ที่เคยเป็นปลายทางจะมี marker
const oldMarker = so.settings ? (await req(OLD, `settings?select=key&key=eq.${MARKER}`)).data : [];
if (oldMarker.length) die(`โปรเจกต์ "เดิม" (${OLD.url}) มีเครื่องหมายว่าเป็นปลายทางการคัดลอก · น่าจะสลับ OLD/NEW กัน หยุดเพื่อความปลอดภัย`);

const tables = [...ORDER.filter((t) => so[t]), ...Object.keys(so).filter((t) => !ORDER.includes(t) && !SKIP.has(t))];
const fix = [];
let problems = 0;
console.log("โครงสร้างตาราง");
for (const t of tables) {
  const oc = so[t], nc = sn[t];
  if (!nc) {
    problems++;
    warn(`${t}: ไม่มีในโปรเจกต์ใหม่ → เพิ่มคำสั่งสร้างตารางใน tools/fix-columns.sql`);
    const pk = pkOf(oc);
    fix.push(`create table if not exists public.${q(t)} (\n${Object.entries(oc).map(([c, v]) => `  ${q(c)} ${v.type}${c === pk ? " primary key" : ""}`).join(",\n")}\n);\nalter table public.${q(t)} enable row level security;`);
    continue;
  }
  const missing = Object.keys(oc).filter((c) => !nc[c]);
  if (missing.length) {
    problems++;
    warn(`${t}: คอลัมน์ที่โปรเจกต์ใหม่ไม่มี ${missing.join(", ")}`);
    fix.push(missing.map((c) => `alter table public.${q(t)} add column if not exists ${q(c)} ${oc[c].type};`).join("\n"));
  } else ok(`${t}: โครงสร้างตรงกัน`);
}
if (fix.length) {
  writeFileSync(new URL("./fix-columns.sql", import.meta.url), `-- สร้างโดย copy-to-new-project.mjs · รันใน SQL Editor ของโปรเจกต์ "ใหม่" เท่านั้น แล้วรัน SUPABASE_GRANTS.sql อีกครั้ง\n\n${fix.join("\n\n")}\n`);
  console.log(`\n→ สร้างไฟล์ tools/fix-columns.sql แล้ว: เปิด SQL Editor ของโปรเจกต์ใหม่ วางไฟล์นี้ → Run → รัน SUPABASE_GRANTS.sql → แล้วรัน check อีกครั้ง`);
}

console.log("\nจำนวนแถว (เดิม → ใหม่)");
const counts = {};
for (const t of tables.filter((x) => sn[x])) {
  counts[t] = [await count(OLD, t), await count(NEW, t)];
  info(`${t.padEnd(18)} ${String(counts[t][0]).padStart(6)} → ${counts[t][1]}`);
}
if (MODE === "check") {
  console.log(problems ? `\n✖ พบ ${problems} จุดต้องแก้ก่อนคัดลอก (ดูด้านบน)\n` : "\n✔ พร้อมคัดลอก · รัน: node tools/copy-to-new-project.mjs copy\n");
  process.exit(problems ? 1 : 0);
}
if (problems) die("โครงสร้างยังไม่ตรงกัน · แก้ตาม tools/fix-columns.sql แล้วรัน check ก่อน");

// ---------- copy ----------
const newUsers = sn.users ? await readAll(NEW, "users", "id") : [];
const oldUsers = so.users ? await readAll(OLD, "users", "id") : [];
// ผู้ใช้ admin ตั้งต้นของไฟล์ initial_schema (salt = seed-admin) ชนชื่อกับ admin เดิม → ลบออกก่อน
for (const u of newUsers) {
  const clash = oldUsers.find((o) => o.username === u.username && o.id !== u.id);
  if (clash && u.salt === "seed-admin") { await req(NEW, `users?id=eq.${u.id}`, { method: "DELETE" }); info(`ลบผู้ใช้ตั้งต้น "${u.username}" ในโปรเจกต์ใหม่ (จะใช้บัญชีเดิมแทน)`); }
  else if (clash) die(`ผู้ใช้ "${u.username}" มีอยู่แล้วในโปรเจกต์ใหม่แต่คนละ id · ลบออกใน Table Editor ของโปรเจกต์ใหม่ แล้วรันใหม่`);
}
console.log("\nคัดลอก");
for (const t of tables) {
  const cols = sn[t], pk = pkOf(so[t]);
  let rows = t === "users" ? oldUsers : await readAll(OLD, t, pk);
  // ปลายทางที่รัน migration แล้ว (รอบจริงหลังซ้อม) ไม่รับบทบาท "user" เดิม → แปลงเป็นเภสัชกร (เหมือนที่ migration 0001 ทำ)
  if (t === "users" && cols.staffCode) rows = rows.map((u) => (u.role === "user" ? { ...u, role: "pharmacist" } : u));
  // settings: ค่าจากโปรเจกต์เดิมทับค่าตั้งต้น · ตารางอื่น: เพิ่มเฉพาะแถวที่ยังไม่มี (ไม่ทับข้อมูลที่ปรับแล้วในโปรเจกต์ใหม่)
  const prefer = t === "settings" ? "resolution=merge-duplicates,return=minimal" : "resolution=ignore-duplicates,return=minimal";
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => Object.fromEntries(Object.entries(r).filter(([c]) => cols[c])));
    await req(NEW, `${encodeURIComponent(t)}?on_conflict=${encodeURIComponent(pk)}`, { method: "POST", headers: { "Content-Type": "application/json", Prefer: prefer }, body: JSON.stringify(chunk) }).catch((e) => die(`${t}: ${e.message}`));
    n += chunk.length;
  }
  ok(`${t}: ${n} แถว`);
}
await req(NEW, "settings?on_conflict=key", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ key: MARKER, value: new Date().toISOString(), description: "โปรเจกต์นี้เป็นปลายทางการคัดลอกจากโปรเจกต์เดิม (ใช้กันรันสคริปต์ผิดโปรเจกต์)" }]) });

console.log("\nตรวจจำนวนแถว (เดิม → ใหม่)");
let bad = 0;
for (const t of tables) {
  const a = await count(OLD, t), b = await count(NEW, t);
  const good = t === "settings" || t === "users" ? b >= a : b >= a;
  if (!good) bad++;
  console.log(`${good ? "✔" : "✖"} ${t.padEnd(18)} ${String(a).padStart(6)} → ${b}`);
}
console.log(bad ? `\n✖ มี ${bad} ตารางที่จำนวนไม่ครบ · ส่งผลด้านบนให้ผู้พัฒนาตรวจ\n` : "\n✔ คัดลอกครบ · ขั้นต่อไป: รัน migration 0001 → 0005 ใน SQL Editor ของโปรเจกต์ใหม่ แล้วรัน SUPABASE_GRANTS.sql\n");
process.exit(bad ? 1 : 0);
