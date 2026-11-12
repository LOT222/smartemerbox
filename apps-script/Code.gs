/**
 * SEB v2 — ส่งออกข้อมูลไป Google Sheets (ตัวเลือกเสริม)
 * ---------------------------------------------------------------
 * ดึงชุดข้อมูลวิจัย "ไม่มี HN" จาก Supabase Edge Function มาเขียนลง Google Sheet นี้
 * ฐานข้อมูลหลักยังเป็น Supabase ตามโครงร่างวิจัยที่ EC รับรอง
 *
 * วิธีใช้
 *  1) สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วางโค้ดนี้
 *  2) แก้ค่า CONFIG ด้านล่าง แล้วรันฟังก์ชัน setup() หนึ่งครั้ง (อนุญาตสิทธิ์)
 *  3) รัน syncNow() เพื่อทดสอบ → ระบบสร้าง trigger ให้ sync ทุกวันเวลา ~06:00
 */
const CONFIG = {
  API_URL: "https://xsjenlppfpuykxwjbbfp.supabase.co/functions/v1/api",
  ANON_KEY: "sb_publishable_xT8eePLA8aZqBsE-IPnKpg_UGaTIZP3",
  // ต้องตรงกับ secret SHEET_EXPORT_KEY ที่ตั้งใน Supabase (ดูคู่มือ ข้อ 3)
  SHEET_EXPORT_KEY: "ใส่คีย์ที่นี่",
};

const SHEETS = [
  ["events", "เหตุการณ์เปิดกล่อง"],
  ["inspections", "ผลตรวจประจำเดือน"],
  ["inspectionItems", "ผลตรวจรายรายการยา"],
  ["boxes", "สถานะกล่อง"],
  ["baseline", "baseline ย้อนหลัง"],
  ["reportTimings", "เวลาทำรายงาน"],
  ["survey", "แบบสอบถาม"],
  ["surveyOpen", "แบบสอบถาม ปลายเปิด"],
];

function setup() {
  PropertiesService.getScriptProperties().setProperties({
    API_URL: CONFIG.API_URL,
    ANON_KEY: CONFIG.ANON_KEY,
    SHEET_EXPORT_KEY: CONFIG.SHEET_EXPORT_KEY,
  });
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "syncNow") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncNow").timeBased().everyDays(1).atHour(6).inTimezone("Asia/Bangkok").create();
  SpreadsheetApp.getActive().toast("ตั้งค่าเรียบร้อย · sync อัตโนมัติทุกวันเวลา 06:00", "SEB", 6);
}

function syncNow() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const res = UrlFetchApp.fetch(p.API_URL || CONFIG.API_URL, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: p.ANON_KEY || CONFIG.ANON_KEY, Authorization: "Bearer " + (p.ANON_KEY || CONFIG.ANON_KEY) },
    payload: JSON.stringify({ action: "apiSheetExport", args: [p.SHEET_EXPORT_KEY || CONFIG.SHEET_EXPORT_KEY] }),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText() || "{}");
  if (body.error) throw new Error("SEB API: " + body.error);
  const data = body.data || {};
  const ss = SpreadsheetApp.getActive();
  SHEETS.forEach(([key, name]) => writeSheet_(ss, name, data[key] || []));
  writeSheet_(ss, "_log", [{ synced_at: new Date(), generated_at: data.generatedAt, events: (data.events || []).length, inspections: (data.inspections || []).length }], true);
  ss.toast("ดึงข้อมูลล่าสุดแล้ว", "SEB", 4);
}

function writeSheet_(ss, name, rows, append) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (!rows.length) {
    if (!append) { sh.clearContents(); sh.getRange(1, 1).setValue("ไม่มีข้อมูล"); }
    return;
  }
  const cols = Object.keys(rows.reduce((a, r) => Object.assign(a, r), {}));
  const values = rows.map((r) => cols.map((c) => (r[c] === null || r[c] === undefined ? "" : typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c])));
  if (append && sh.getLastRow() > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, values.length, cols.length).setValues(values);
    return;
  }
  sh.clearContents();
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold").setBackground("#f2f2f5");
  sh.getRange(2, 1, values.length, cols.length).setValues(values);
  sh.setFrozenRows(1);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("SEB").addItem("ดึงข้อมูลตอนนี้", "syncNow").addItem("ตั้งค่า / สร้าง trigger", "setup").addToUi();
}

/* =====================================================================
 * สำรองข้อมูลทั้งระบบลง Google Drive (ตัวเลือก · ใช้บัญชี Google ของหน่วยงาน)
 * ---------------------------------------------------------------------
 * 1) ตั้ง Script Property: BACKUP_KEY (ตรงกับ secret BACKUP_KEY ใน Supabase)
 * 2) รัน setupBackup() หนึ่งครั้ง → สำรองทุกคืน ~02:00 เก็บไว้ 30 ไฟล์ล่าสุด
 * ⚠ ไฟล์มี HN และ hash รหัสผ่าน: เก็บในโฟลเดอร์ที่ไม่แชร์ให้ใคร
 * ===================================================================== */
function setupBackup() {
  ScriptApp.getProjectTriggers().forEach((t) => { if (t.getHandlerFunction() === "backupToDrive") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("backupToDrive").timeBased().everyDays(1).atHour(2).inTimezone("Asia/Bangkok").create();
  backupToDrive();
}
function backupToDrive() {
  const p = PropertiesService.getScriptProperties();
  const url = p.getProperty("API_URL") || CONFIG.API_URL, anon = p.getProperty("ANON_KEY") || CONFIG.ANON_KEY, key = p.getProperty("BACKUP_KEY");
  if (!key) throw new Error("ยังไม่ได้ตั้ง Script Property BACKUP_KEY");
  const call = (args) => {
    const r = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", headers: { apikey: anon, Authorization: "Bearer " + anon }, payload: JSON.stringify({ action: "apiBackup", args }), muteHttpExceptions: true });
    const j = JSON.parse(r.getContentText());
    if (j.error) throw new Error(j.error);
    return j.data;
  };
  const tables = call([key, "__tables"]).tables;
  const blobs = tables.map((t) => Utilities.newBlob(JSON.stringify(call([key, t]).rows), "application/json", t + ".json"));
  const stamp = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmm");
  const zip = Utilities.zip(blobs, "seb-backup-" + stamp + ".zip");
  const it = DriveApp.getFoldersByName("SEB-Backup");
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder("SEB-Backup");
  folder.createFile(zip);
  const files = [];
  const fi = folder.getFiles();
  while (fi.hasNext()) files.push(fi.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(30).forEach((f) => f.setTrashed(true));
}
