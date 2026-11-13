// =====================================================================
// SEB v2 — Supabase Edge Function "api"
// โรงพยาบาลลานสัก · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค
// ทุกคำขอ: POST { action, args: [...] }  → { data } หรือ { error }
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// เลขรุ่น backend — ต้องตรงกับ APP_VERSION ใน public/js/core.js (ดู CHANGELOG.md)
const APP_VERSION = "2.14.0";
const SCHEMA_REQUIRED = 6; // migration ล่าสุดที่ backend รุ่นนี้ต้องใช้

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/+$/, "");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SHEET_EXPORT_KEY = Deno.env.get("SHEET_EXPORT_KEY") || "";
const BACKUP_KEY = Deno.env.get("BACKUP_KEY") || "";

const SESSION_IDLE_MIN = 30;          // ไม่ใช้งาน 30 นาที → ต้อง login ใหม่
const SESSION_MAX_HOURS = 12;         // อายุสูงสุดของ session
const PBKDF2_ITER = 100_000;
const TZ = "Asia/Bangkok";

const SECRET_SETTING_KEYS = new Set(["LINE_CHANNEL_ACCESS_TOKEN"]);

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({});
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.action && body.events) return json({ data: await handleLineWebhook(body) });
    const action = String(body.action || "");
    const args = Array.isArray(body.args) ? body.args : [];
    const fn = actions[action];
    if (!fn) throw new Error(`Unknown action: ${action}`);
    const ua = req.headers.get("user-agent") || "";
    return json({ data: await fn({ ua }, ...args) });
  } catch (err) {
    return json({ error: (err as Error)?.message || String(err) }, 400);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

type Ctx = { ua: string };
type Fn = (ctx: Ctx, ...args: any[]) => Promise<any>;

// =====================================================================
// Actions
// =====================================================================
const actions: Record<string, Fn> = {
  // ---------- public ----------
  apiHealth: async () => {
    const { data, error } = await db.from("settings").select("value").eq("key", "SCHEMA_VERSION").limit(1);
    if (error) throw error;
    const schema = Number(data?.[0]?.value || 0);
    return { ok: true, at: new Date().toISOString(), push: !!VAPID_PUBLIC_KEY, version: APP_VERSION, schema, schemaRequired: SCHEMA_REQUIRED, schemaOk: schema >= SCHEMA_REQUIRED };
  },
  apiPublicConfig: async () => {
    const s = await settingsObject();
    return {
      hospitalName: s.HOSPITAL_NAME || "",
      departmentName: s.DEPARTMENT_NAME || "",
      appName: s.APP_DISPLAY_NAME || "Smart Emergency Box",
      credit: s.APP_CREDIT_TEXT || "",
      allowSignup: (s.ALLOW_SIGNUP ?? "1") === "1",
      defaultPassword: s.DEFAULT_PASSWORD || "1234",
      vapidPublicKey: VAPID_PUBLIC_KEY,
    };
  },
  apiLogin,
  apiLogout,
  apiPublicGetBox,
  apiBackup,
  apiOpenBoxPublic,
  apiSubmitSurveyV2,
  apiCron,
  apiSheetExport,

  // ---------- authenticated ----------
  apiBootstrap,
  apiRefresh: async (_c, token) => apiBootstrap(_c, token),
  apiChangePassword,
  apiGetEvent,
  apiRevealHn,
  apiAcknowledgeEvent,
  apiConfirmReady,
  apiCancelEvent,
  apiRecordOpenStaff,
  apiRecordPaperEvent,
  apiUpdateEventTimes,
  apiSaveBox,
  apiCreateBoxFromKit,
  apiDeleteBox,
  apiRegenerateQr,
  apiSaveKit,
  apiDeleteKit,
  apiSaveLocation,
  apiDeleteLocation,
  apiListInspections,
  apiGetInspection,
  apiSaveInspection,
  apiSaveInspectionSchedule,
  apiResearchData,
  apiStartReportTiming,
  apiFinishReportTiming,
  apiSaveReportTimingPaper,
  apiSaveBaselineAggregate,
  apiDeleteBaselineAggregate,
  apiSaveObservation,
  apiResetPilotData,
  apiListLogs,
  apiListUsers,
  apiSaveUser,
  apiDeleteUser,
  apiSaveSettings,
  apiTestNotify,
  apiFlexPreview,
  apiSavePushSubscription,
  apiRemovePushSubscription,
  apiSendExpiryReport,
  apiMonthlyReport,
  apiReport,
  apiExportResearch,
  apiLineQuota,
  apiAcceptPdpa,
  apiRegister,
  apiRequestReset,
  apiListAccountRequests,
  apiHandleAccountRequest,
  apiConsentStatus,
  apiConsentView,
  apiConsentSign,
  apiConsentDecline,
  apiConsentWithdraw,
  apiListConsents,
  apiGetConsent,
  apiConsentReceive,
};

// =====================================================================
// สมัครสมาชิก / ลืมรหัสผ่าน (ผู้ดูแลระบบอนุมัติ)
// =====================================================================
const ROLES = ["admin", "pharmacist", "technician", "nurse", "viewer"];
async function defaultPassword() { const s = await settingsObject(); return String(s.DEFAULT_PASSWORD || "1234"); }

async function notifyAdmins(title: string, body: string) {
  const { data: admins } = await db.from("users").select("id").eq("role", "admin").eq("active", true);
  const ids = (admins || []).map((a: any) => a.id);
  if (!ids.length || !VAPID_PUBLIC_KEY) return;
  const { data: subs } = await db.from("pushSubscriptions").select("*").eq("active", true).in("userId", ids);
  await Promise.all((subs || []).map((s: any) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, tag: "account", url: `${appUrl()}#/users` }), { TTL: 86400 }).catch(() => null)));
}

async function apiRegister(_c: Ctx, p: any) {
  const s = await settingsObject();
  if ((s.ALLOW_SIGNUP ?? "1") !== "1") throw new Error("ปิดรับสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ");
  const username = String(p.username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("ชื่อผู้ใช้ใช้ a-z 0-9 . _ - ยาว 3–32 ตัว");
  if (!String(p.displayName || "").trim()) throw new Error("กรุณากรอกชื่อ-นามสกุล");
  if (String(p.password || "").length < 4) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร");
  if (!["pharmacist", "technician", "nurse"].includes(p.role)) throw new Error("กรุณาเลือกบทบาท");
  if (await one("users", (q) => q.eq("username", username))) throw new Error("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
  if (await one("accountRequests", (q) => q.eq("username", username).eq("type", "signup").eq("status", "pending"))) throw new Error("ชื่อผู้ใช้นี้กำลังรออนุมัติอยู่แล้ว");
  const salt = crypto.randomUUID();
  await insert("accountRequests", {
    type: "signup", username, displayName: p.displayName.trim(), position: p.position || "", role: p.role,
    phone: p.phone || "", note: p.note || "", salt, passwordHash: await pbkdf2(p.password, salt),
  });
  await audit({ username }, "request_signup", { role: p.role });
  await notifyAdmins("มีผู้สมัครสมาชิกใหม่", `${p.displayName} (${username}) รออนุมัติ`);
  return { ok: true };
}

async function apiRequestReset(_c: Ctx, p: any) {
  const username = String(p.username || "").trim().toLowerCase();
  const user = username ? await one("users", (q) => q.eq("username", username)) : null;
  // ไม่บอกว่ามีผู้ใช้นี้หรือไม่ (กันการเดาชื่อผู้ใช้)
  if (user && user.active) {
    const dup = await one("accountRequests", (q) => q.eq("userId", user.id).eq("type", "reset").eq("status", "pending"));
    if (!dup) {
      await insert("accountRequests", { type: "reset", username, displayName: user.displayName, userId: user.id, phone: p.phone || "", note: p.note || "" });
      await audit({ username }, "request_password_reset", {});
      await notifyAdmins("คำขอรีเซ็ตรหัสผ่าน", `${user.displayName || username} ขอรีเซ็ตรหัสผ่าน`);
    }
  }
  return { ok: true };
}

async function apiListAccountRequests(_c: Ctx, token: string) {
  await requireAdmin(token);
  const { data } = await db.from("accountRequests").select("id,type,status,username,displayName,position,role,phone,note,createdAt,handledBy,handledAt").order("createdAt", { ascending: false }).limit(200);
  return { requests: data || [] };
}

async function apiHandleAccountRequest(_c: Ctx, token: string, id: string, approve: boolean, p: any = {}) {
  const admin = await requireAdmin(token);
  const r = await one("accountRequests", (q) => q.eq("id", id));
  if (!r || r.status !== "pending") throw new Error("คำขอนี้ดำเนินการไปแล้ว");
  const now = nowIso();
  let tempPassword = "";
  if (approve && r.type === "signup") {
    if (await one("users", (q) => q.eq("username", r.username))) throw new Error("ชื่อผู้ใช้นี้มีอยู่แล้ว");
    await insert("users", {
      id: crypto.randomUUID(), username: r.username, displayName: r.displayName, position: r.position || "", phone: r.phone || "",
      role: ROLES.includes(p.role) ? p.role : r.role, active: true, passwordHash: r.passwordHash, salt: r.salt, createdAt: now, updatedAt: now,
    });
  }
  if (approve && r.type === "reset") {
    tempPassword = await defaultPassword();
    const salt = crypto.randomUUID();
    await db.from("users").update({ salt, passwordHash: await pbkdf2(tempPassword, salt), updatedAt: now }).eq("id", r.userId);
    await db.from("sessions").delete().eq("userId", r.userId);
  }
  await db.from("accountRequests").update({ status: approve ? "approved" : "rejected", handledBy: admin.displayName || admin.username, handledAt: now }).eq("id", id);
  await audit(admin, approve ? "approve_account_request" : "reject_account_request", { type: r.type, username: r.username });
  return { ok: true, tempPassword, users: (await list("users", "username")).map(publicUser) };
}

// =====================================================================
// PDPA + e-consent
// =====================================================================
async function apiAcceptPdpa(ctx: Ctx, token: string, version: string) {
  const user = await requireAuth(token);
  const s = await settingsObject();
  const v = String(version || s.PDPA_NOTICE_VERSION || "1.0");
  const now = nowIso();
  await db.from("users").update({ pdpaVersion: v, pdpaAcceptedAt: now }).eq("id", user.id);
  await db.from("userConsents").insert({ userId: user.id, username: user.username, kind: "pdpa", status: "accepted", docVersion: v, userAgent: ctx.ua.slice(0, 300) });
  await audit(user, "accept_pdpa", { version: v });
  return { pdpaVersion: v };
}

async function myConsent(userId: string) {
  const { data } = await db.from("userConsents").select("*").eq("userId", userId).eq("kind", "research").order("createdAt", { ascending: false }).limit(1);
  return data?.[0] || null;
}
const stripSig = (r: any) => { if (!r) return r; const { signatureData, ...rest } = r; return { ...rest, hasSignature: !!signatureData }; };

async function apiConsentStatus(_c: Ctx, token: string) {
  const user = await requireAuth(token);
  const s = await settingsObject();
  return { enabled: s.ECONSENT_ENABLED === "1", waitDays: Number(s.CONSENT_WAIT_DAYS || 7), record: stripSig(await myConsent(user.id)) };
}

async function apiConsentView(ctx: Ctx, token: string) {
  const user = await requireAuth(token);
  const s = await settingsObject();
  if (s.ECONSENT_ENABLED !== "1") throw new Error("ยังไม่เปิดใช้แบบยินยอมอิเล็กทรอนิกส์");
  let r = await myConsent(user.id);
  if (!r || r.status === "withdrawn" || r.status === "declined") {
    r = await insert("userConsents", { userId: user.id, username: user.username, kind: "research", status: "viewed", docVersion: s.CONSENT_DOC_VERSION || "แก้ไขครั้งที่ 1", pisFirstViewedAt: nowIso(), userAgent: ctx.ua.slice(0, 300) });
    await audit(user, "view_research_pis", {});
  }
  return { record: stripSig(r), waitDays: Number(s.CONSENT_WAIT_DAYS || 7) };
}

async function apiConsentSign(ctx: Ctx, token: string, p: any) {
  const user = await requireAuth(token);
  const s = await settingsObject();
  if (s.ECONSENT_ENABLED !== "1") throw new Error("ยังไม่เปิดใช้แบบยินยอมอิเล็กทรอนิกส์");
  const r = await myConsent(user.id);
  if (!r || r.status !== "viewed") throw new Error("กรุณาอ่านเอกสารชี้แจงก่อนลงนาม");
  const wait = Number(s.CONSENT_WAIT_DAYS || 7);
  const ready = new Date(r.pisFirstViewedAt).getTime() + wait * 86400000;
  if (Date.now() < ready) throw new Error(`ลงนามได้ตั้งแต่ ${fmtDate(new Date(ready).toISOString())} (ครบ ${wait} วันหลังเปิดอ่านเอกสาร)`);
  if (!String(p.fullName || "").trim()) throw new Error("กรุณากรอกชื่อ-นามสกุล");
  const items = Array.isArray(p.agreedItems) ? p.agreedItems : [];
  if (!items.length || !items.every(Boolean)) throw new Error("กรุณาทำเครื่องหมายยินยอมให้ครบทุกข้อ");
  const sig = String(p.signatureData || "");
  if (!sig.startsWith("data:image/png;base64,") || sig.length > 400000) throw new Error("กรุณาลงลายมือชื่อ");
  const row = await updateRow("userConsents", r.id, {
    status: "signed", fullName: p.fullName.trim(), position: p.position || "", unit: p.unit || "", age: Number(p.age) || null,
    agreedItems: items, signatureData: sig, signedAt: nowIso(), updatedAt: nowIso(), userAgent: ctx.ua.slice(0, 300),
  });
  await db.from("users").update({ researchConsent: true }).eq("id", user.id);
  await audit(user, "sign_research_consent", { consentId: row.id });
  return { record: stripSig(row) };
}

async function apiConsentDecline(_c: Ctx, token: string) {
  const user = await requireAuth(token);
  const r = await myConsent(user.id);
  const row = r && r.status === "viewed"
    ? await updateRow("userConsents", r.id, { status: "declined", declinedAt: nowIso(), updatedAt: nowIso() })
    : await insert("userConsents", { userId: user.id, username: user.username, kind: "research", status: "declined", declinedAt: nowIso() });
  await db.from("users").update({ researchConsent: false }).eq("id", user.id);
  await audit(user, "decline_research_consent", {});
  return { record: stripSig(row) };
}

async function apiConsentWithdraw(_c: Ctx, token: string, reason: string) {
  const user = await requireAuth(token);
  const r = await myConsent(user.id);
  if (!r || r.status !== "signed") throw new Error("ไม่พบการยินยอมที่ถอนได้");
  const row = await updateRow("userConsents", r.id, { status: "withdrawn", withdrawnAt: nowIso(), withdrawReason: reason || "", updatedAt: nowIso() });
  await db.from("users").update({ researchConsent: false }).eq("id", user.id);
  await audit(user, "withdraw_research_consent", {});
  return { record: stripSig(row) };
}

async function requireConsentViewer(token: string) {
  const user = await requireAuth(token);
  if (user.role !== "admin" && !user.consentOfficer) throw new Error("เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่รับเอกสารยินยอม");
  return user;
}
async function apiListConsents(_c: Ctx, token: string) {
  await requireConsentViewer(token);
  const [rows, users] = await Promise.all([
    db.from("userConsents").select("*").eq("kind", "research").order("createdAt", { ascending: false }).then(rowsOf),
    list("users", "username"),
  ]);
  const latest = new Map<string, any>();
  rows.forEach((r: any) => { if (r.userId && !latest.has(r.userId)) latest.set(r.userId, r); });
  return {
    users: users.filter((u: any) => u.active).map((u: any) => ({ ...publicUser(u), consent: stripSig(latest.get(u.id) || null), pdpaAcceptedAt: u.pdpaAcceptedAt || null })),
  };
}
async function apiGetConsent(_c: Ctx, token: string, id: string) {
  const viewer = await requireAuth(token);
  const r = id === "mine" ? await myConsent(viewer.id) : await one("userConsents", (q) => q.eq("id", id));
  if (!r) throw new Error("ไม่พบเอกสาร");
  if (r.userId !== viewer.id && viewer.role !== "admin" && !viewer.consentOfficer) throw new Error("ไม่มีสิทธิ์ดูเอกสารนี้");
  await audit(viewer, "view_signed_consent", { consentId: id });
  return { record: r };
}
async function apiConsentReceive(_c: Ctx, token: string, id: string) {
  const viewer = await requireConsentViewer(token);
  if (!viewer.consentOfficer) throw new Error("เฉพาะเจ้าหน้าที่รับเอกสารยินยอมที่ได้รับมอบหมาย");
  const row = await updateRow("userConsents", id, { receivedBy: viewer.displayName || viewer.username, receivedAt: nowIso(), updatedAt: nowIso() });
  await audit(viewer, "receive_consent", { consentId: id });
  return { record: stripSig(row) };
}

// โควตาข้อความ LINE ของเดือนนี้ (ช่วยป้องกัน notification_sent_at หายเพราะโควตาหมด)
async function apiLineQuota(_c: Ctx, token: string) {
  await requireAdmin(token);
  const s = await settingsObject();
  const t = s.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) return { configured: false };
  const get = async (u: string) => { const r = await fetch(u, { headers: { authorization: `Bearer ${t}` } }); return r.ok ? r.json() : null; };
  const [quota, used] = await Promise.all([
    get("https://api.line.me/v2/bot/message/quota"),
    get("https://api.line.me/v2/bot/message/quota/consumption"),
  ]);
  return { configured: true, type: quota?.type || "", limit: quota?.value ?? null, used: used?.totalUsage ?? null };
}

// =====================================================================
// Auth
// =====================================================================
async function apiLogin(ctx: Ctx, username: string, password: string) {
  username = String(username || "").trim();
  const user = await one("users", (q) => q.eq("username", username));
  const ok = !!user && user.active && (await verifyPassword(password, user));
  await db.from("loginLogs").insert({
    userId: user?.id || null,
    username,
    success: ok,
    reason: ok ? "ok" : (!user ? "no_user" : !user.active ? "inactive" : "bad_password"),
    userAgent: ctx.ua.slice(0, 300),
  });
  if (!ok) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

  // อัปเกรด hash รุ่นเก่า (SHA-256) เป็น PBKDF2
  if (!String(user.passwordHash).startsWith("pbkdf2$")) {
    const salt = crypto.randomUUID();
    await db.from("users").update({ salt, passwordHash: await pbkdf2(password, salt) }).eq("id", user.id);
  }

  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const now = new Date();
  await db.from("sessions").insert({
    token,
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: new Date(now.getTime() + SESSION_IDLE_MIN * 60000).toISOString(),
    createdAt: now.toISOString(),
  });
  await db.from("users").update({ lastLoginAt: now.toISOString() }).eq("id", user.id);
  await db.from("sessions").delete().lt("expiresAt", now.toISOString());
  const mustChange = password === "admin123" || password === (await defaultPassword());
  return { token, user: publicUser(user), mustChangePassword: mustChange, data: await buildAppData(user) };
}

async function apiLogout(_c: Ctx, token: string) {
  if (!token) return { ok: true };
  const session = await one("sessions", (q) => q.eq("token", token));
  await db.from("sessions").delete().eq("token", token);
  if (session) {
    const { data } = await db.from("loginLogs").select("id").eq("userId", session.userId).eq("success", true)
      .is("logoutAt", null).order("at", { ascending: false }).limit(1);
    if (data?.[0]) await db.from("loginLogs").update({ logoutAt: new Date().toISOString() }).eq("id", data[0].id);
  }
  return { ok: true };
}

async function apiBootstrap(_c: Ctx, token: string) {
  const user = await requireAuth(token);
  return { user: publicUser(user), data: await buildAppData(user) };
}

async function apiChangePassword(_c: Ctx, token: string, oldPassword: string, newPassword: string) {
  const user = await requireAuth(token);
  if (!(await verifyPassword(oldPassword, user))) throw new Error("รหัสผ่านเดิมไม่ถูกต้อง");
  if (String(newPassword || "").length < 4) throw new Error("รหัสผ่านใหม่ต้องยาวอย่างน้อย 4 ตัวอักษร");
  const salt = crypto.randomUUID();
  await db.from("users").update({ salt, passwordHash: await pbkdf2(newPassword, salt), updatedAt: nowIso() }).eq("id", user.id);
  await audit(user, "change_password", {});
  return { ok: true };
}

async function getUserByToken(token: string) {
  if (!token) return null;
  const session = await one("sessions", (q) => q.eq("token", token));
  if (!session) return null;
  const now = Date.now();
  const created = new Date(session.createdAt).getTime();
  if (new Date(session.expiresAt).getTime() < now || now - created > SESSION_MAX_HOURS * 3600000) {
    await db.from("sessions").delete().eq("token", token);
    return null;
  }
  // sliding idle timeout (เขียนเมื่อเหลือน้อยกว่า 25 นาที เพื่อลดการเขียน)
  if (new Date(session.expiresAt).getTime() - now < 25 * 60000) {
    await db.from("sessions").update({ expiresAt: new Date(now + SESSION_IDLE_MIN * 60000).toISOString() }).eq("token", token);
  }
  return one("users", (q) => q.eq("id", session.userId).eq("active", true));
}

async function requireAuth(token: string) {
  const user = await getUserByToken(token);
  if (!user) throw new Error("SESSION_EXPIRED:กรุณาเข้าสู่ระบบใหม่");
  return user;
}
async function requireStaff(token: string) {
  const user = await requireAuth(token);
  if (!["admin", "pharmacist", "technician"].includes(user.role)) throw new Error("บทบาทนี้ไม่มีสิทธิ์ทำรายการนี้");
  return user;
}
async function requireAdmin(token: string) {
  const user = await requireAuth(token);
  if (user.role !== "admin") throw new Error("ต้องเป็นผู้ดูแลระบบ");
  return user;
}

function publicUser(u: any) {
  if (!u) return null;
  const displayName = u.displayName || u.username;
  return {
    id: u.id, username: u.username, displayName, role: u.role, active: u.active,
    position: u.position || "", staffCode: u.staffCode || "", phone: u.phone || "", researchConsent: !!u.researchConsent,
    lastLoginAt: u.lastLoginAt || null, pdpaVersion: u.pdpaVersion || "", consentOfficer: !!u.consentOfficer,
    displayText: u.position ? `${displayName}, ${u.position}` : displayName,
  };
}

async function pbkdf2(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return `pbkdf2$${PBKDF2_ITER}$${hex(new Uint8Array(bits))}`;
}
async function sha256Legacy(password: string, salt: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${password}:${salt}`));
  return hex(new Uint8Array(d));
}
async function verifyPassword(password: string, user: any) {
  const stored = String(user.passwordHash || "");
  if (stored.startsWith("pbkdf2$")) return (await pbkdf2(String(password || ""), user.salt)) === stored;
  return (await sha256Legacy(String(password || ""), user.salt)) === stored;
}
function hex(b: Uint8Array) { return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(""); }

// =====================================================================
// App data
// =====================================================================
async function buildAppData(user: any) {
  const [settings, locations, kits, kitItems, boxes, boxItems, events, subCount] = await Promise.all([
    settingsObject(),
    list("locations", "sortOrder"),
    list("kits", "name"),
    list("kitItems", "sortOrder"),
    list("boxes", "boxCode"),
    list("boxItems", "sortOrder"),
    db.from("openEvents").select("*").order("actualOpenedAt", { ascending: false }).limit(400).then(rowsOf),
    db.from("pushSubscriptions").select("id", { count: "exact", head: true }).eq("active", true).then((r: any) => r.count || 0),
  ]);
  const fullBoxes = boxes.map((b: any) => decorateBox(b, boxItems.filter((i: any) => i.boxId === b.id), events, locations, settings));
  return {
    settings: sanitizeSettings(settings),
    locations,
    kits: kits.map((k: any) => ({ ...k, items: kitItems.filter((i: any) => i.kitId === k.id) })),
    boxes: fullBoxes,
    events: events.map(stripEvent),
    stats: buildStats(fullBoxes, events, settings),
    pushDevices: subCount,
    pushReady: !!VAPID_PUBLIC_KEY,
    pendingRequests: user?.role === "admin" ? await db.from("accountRequests").select("id", { count: "exact", head: true }).eq("status", "pending").then((r: any) => r.count || 0) : 0,
    me: publicUser(user),
  };
}

function sanitizeSettings(s: Record<string, string>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(s)) if (!SECRET_SETTING_KEYS.has(k)) out[k] = v;
  out.LINE_TOKEN_SET = !!s.LINE_CHANNEL_ACCESS_TOKEN;
  return out;
}

function stripEvent(e: any) {
  const { hn: _hn, ...rest } = e;
  return rest;
}

function decorateBox(box: any, items: any[], events: any[], locations: any[], settings: any) {
  const loc = locations.find((l: any) => l.id === box.locationId) || null;
  const openCase = events.find((e: any) => e.boxId === box.id && ["open", "acknowledged"].includes(e.caseStatus));
  const nearDays = Number(settings.NEAR_EXPIRY_DAYS || 30);
  const today = startOfTodayBkk();
  let expired = 0, near = 0, missing = 0;
  for (const it of items) {
    const d = daysUntil(it.expiryDate, today);
    if (!it.expiryDate || Number(it.qty || 0) <= 0) missing++;
    else if (d < 0) expired++;
    else if (d <= nearDays) near++;
  }
  // นับรายการยาที่ qty รวมทุก lot น้อยกว่า requiredQty
  const byDrug: Record<string, { qty: number; req: number }> = {};
  for (const it of items) {
    const k = `${it.drugName}|${it.strength || ""}`;
    byDrug[k] = byDrug[k] || { qty: 0, req: 0 };
    byDrug[k].qty += Number(it.qty || 0);
    byDrug[k].req = Math.max(byDrug[k].req, Number(it.requiredQty || 0));
  }
  const short = Object.values(byDrug).filter((x) => x.req > 0 && x.qty < x.req).length;
  const overdue = !!box.inspectionDate && box.inspectionDate < bkkDate(new Date());
  let state = "ready";
  if (openCase) state = openCase.caseStatus === "acknowledged" ? "refilling" : "opened";
  else if (!items.length || missing > 0 || short > 0) state = "not_ready";
  else if (expired > 0) state = "expired";
  const label: Record<string, string> = {
    ready: "พร้อมใช้", opened: "ถูกเปิดใช้", refilling: "รอเติมยา", not_ready: "ไม่พร้อมใช้", expired: "มียาหมดอายุ",
  };
  return {
    ...box,
    items,
    location: loc?.name || box.location || "",
    locationZone: loc?.zone || "in",
    locationType: loc?.unitType || "",
    inStudy: !!loc?.inStudy,
    state,
    status: label[state],
    expiredCount: expired,
    nearCount: near,
    missingCount: missing + short,
    inspectionOverdue: overdue,
    openCaseId: openCase?.id || null,
    qrUrl: `${appUrl()}?page=open&boxId=${box.id}&t=${box.qrToken}`,
  };
}

function buildStats(boxes: any[], events: any[], settings: any) {
  const by = (s: string) => boxes.filter((b) => b.state === s).length;
  const responses = events
    .filter((e) => e.notificationSentAt && e.acknowledgedAt && e.period !== "pilot")
    .map((e) => minutesBetween(e.notificationSentAt, e.acknowledgedAt))
    .filter((x) => x >= 0 && x <= 1440);
  return {
    totalBoxes: boxes.length,
    ready: by("ready"),
    opened: by("opened") + by("refilling"),
    notReady: by("not_ready") + by("expired"),
    expiredItems: boxes.reduce((a, b) => a + b.expiredCount, 0),
    nearItems: boxes.reduce((a, b) => a + b.nearCount, 0),
    overdueInspections: boxes.filter((b) => b.inspectionOverdue).length,
    openCases: events.filter((e) => e.caseStatus === "open").length,
    pendingCases: events.filter((e) => ["open", "acknowledged"].includes(e.caseStatus)).length,
    medianResponseMin: median(responses),
    responseTargetMin: Number(settings.RESPONSE_TARGET_MIN || 5),
  };
}

// =====================================================================
// Public QR
// =====================================================================
async function apiPublicGetBox(_c: Ctx, boxId: string, qrToken: string) {
  const box = await one("boxes", (q) => q.eq("id", boxId));
  if (!box || box.qrToken !== qrToken) throw new Error("QR ไม่ถูกต้อง กรุณาติดต่อห้องยา");
  const [items, locations, settings, openEvents] = await Promise.all([
    listWhere("boxItems", "boxId", box.id, "sortOrder"),
    list("locations", "sortOrder"),
    settingsObject(),
    db.from("openEvents").select("id,caseStatus,boxId").eq("boxId", box.id).in("caseStatus", ["open", "acknowledged"]).then(rowsOf),
  ]);
  const d = decorateBox(box, items, openEvents, locations, settings);
  // ชื่อผู้เปิดที่เคยบันทึกในจุดเดียวกัน (180 วันล่าสุด) — ให้เลือกได้ไม่ต้องพิมพ์ซ้ำ (ไม่มี HN)
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const recentRows = box.locationId
    ? await db.from("openEvents").select("openerName,recordedAt").eq("locationId", box.locationId).gte("recordedAt", since).not("openerName", "is", null).order("recordedAt", { ascending: false }).limit(300).then(rowsOf)
    : [];
  const recentOpeners: string[] = [];
  for (const r of recentRows) { const n = String(r.openerName || "").trim(); if (n && !recentOpeners.includes(n)) recentOpeners.push(n); if (recentOpeners.length >= 12) break; }
  const nearDays = Number(settings.NEAR_EXPIRY_DAYS || 30);
  const today = startOfTodayBkk();
  return {
    box: {
      id: d.id, boxCode: d.boxCode, kitName: d.kitName, location: d.location, locationZone: d.locationZone,
      state: d.state, status: d.status, sealNo: String(settings.SEAL_ENABLED || "0") === "1" ? d.sealNo || "" : "",
      items: items.map((it: any) => {
        const dl = daysUntil(it.expiryDate, today);
        return {
          drugName: it.drugName, strength: it.strength, form: it.form, qty: it.qty, unit: it.unit, lot: it.lot,
          expiryDate: it.expiryDate,
          expiryState: !it.expiryDate ? "unknown" : dl < 0 ? "expired" : dl <= nearDays ? "near" : "ok",
        };
      }),
    },
    hospitalName: settings.HOSPITAL_NAME || "",
    recentOpeners,
    pharmacyPhone: settings.PHARMACY_PHONE || "",
    openReasons: String(settings.OPT_OPEN_REASONS || "").split("\n").map((x) => x.trim()).filter(Boolean),
  };
}

async function apiOpenBoxPublic(_c: Ctx, payload: any) {
  const box = await one("boxes", (q) => q.eq("id", payload.boxId));
  if (!box || box.qrToken !== payload.qrToken) throw new Error("QR ไม่ถูกต้อง");
  // กันส่งซ้ำจากคิวออฟไลน์: ถ้า clientRequestId นี้เคยบันทึกแล้ว คืนผลเดิม
  const reqId = String(payload.clientRequestId || "").slice(0, 64);
  if (reqId) {
    const { data: dup } = await db.from("openEvents").select("eventCode,notificationStatus,pushSent").eq("clientRequestId", reqId).limit(1);
    if (dup?.length) return { eventCode: dup[0].eventCode, notified: dup[0].notificationStatus === "sent" || dup[0].pushSent > 0, duplicate: true };
  }
  const settings = await settingsObject();
  const cooldown = Number(settings.PUBLIC_OPEN_COOLDOWN_SEC || 120);
  const { data: recent } = await db.from("openEvents").select("id,eventCode,recordedAt").eq("boxId", box.id)
    .gt("recordedAt", new Date(Date.now() - cooldown * 1000).toISOString()).limit(1);
  // คิวออฟไลน์ไม่ติดเงื่อนไขกันสแกนซ้ำ (ส่งช้ากว่าเหตุการณ์จริง และกันซ้ำด้วย clientRequestId แล้ว)
  if (recent?.length && !(payload.offlineQueued && reqId)) {
    throw new Error(`กล่องนี้เพิ่งบันทึกการเปิดไปแล้ว (${recent[0].eventCode}) ห้องยาได้รับแจ้งแล้ว`);
  }
  if (!/^\d{9}$/.test(String(payload.hn || ""))) throw new Error("กรุณากรอก HN ผู้ป่วย 9 หลัก");
  const event = await createOpenEvent(box, payload, null, "qr", settings);
  return { eventCode: event.eventCode, notified: event.notificationStatus === "sent" || event.pushSent > 0 };
}

async function apiRecordOpenStaff(_c: Ctx, token: string, payload: any) {
  const user = await requireAuth(token);
  if (!["admin", "pharmacist", "technician", "nurse"].includes(user.role)) throw new Error("บทบาทนี้ไม่มีสิทธิ์บันทึกการเปิดกล่อง");
  const box = await one("boxes", (q) => q.eq("id", payload.boxId));
  if (!box) throw new Error("ไม่พบกล่องยา");
  const settings = await settingsObject();
  const event = await createOpenEvent(box, payload, user, "staff", settings);
  return { event: stripEvent(event), data: await buildAppData(user) };
}

async function createOpenEvent(box: any, payload: any, user: any, source: string, settings: any) {
  const now = new Date();
  const actual = parseClientTime(payload.actualOpenedAt) || now;
  if (actual.getTime() > now.getTime() + 5 * 60000) throw new Error("เวลาเปิดใช้จริงต้องไม่อยู่ในอนาคต");
  const loc = box.locationId ? await one("locations", (q) => q.eq("id", box.locationId)) : null;
  const itemsUsed = (Array.isArray(payload.itemsUsed) ? payload.itemsUsed : [])
    .filter((x: any) => x && x.drugName && Number(x.qty) > 0)
    .map((x: any) => ({ drugName: String(x.drugName), strength: String(x.strength || ""), qty: Number(x.qty) }));
  const opener = String(payload.openerName || payload.openedBy || (user ? user.displayName || user.username : "")).trim();
  const fields = [box.id, actual, payload.hn, payload.reasonCategory, opener, itemsUsed.length ? 1 : ""];
  const queued = !!payload.offlineQueued;
  const submitted = parseClientTime(payload.clientSubmittedAt);
  const row = {
    id: crypto.randomUUID(),
    clientRequestId: payload.clientRequestId ? String(payload.clientRequestId).slice(0, 64) : null,
    offlineQueued: queued,
    clientSubmittedAt: submitted && submitted.getTime() <= now.getTime() + 5 * 60000 ? submitted.toISOString() : null,
    eventCode: makeEventCode(actual),
    boxId: box.id,
    boxCode: box.boxCode,
    locationId: loc?.id || null,
    locationName: loc?.name || box.location || "",
    department: loc?.name || box.location || "",
    openedAt: now.toISOString(),
    actualOpenedAt: actual.toISOString(),
    recordedAt: now.toISOString(),
    openedBy: source === "qr" ? "QR" : (user?.displayName || user?.username || ""),
    openerName: opener,
    reasonCategory: String(payload.reasonCategory || ""),
    reason: String(payload.reason || payload.reasonCategory || ""),
    note: String(payload.note || ""),
    itemsUsedJson: itemsUsed,
    source,
    period: periodFor(actual, source, settings),
    caseStatus: "open",
    requiredFields: fields.length,
    filledFields: fields.filter((f) => f !== undefined && f !== null && String(f).trim() !== "").length,
  };
  const event = await insert("openEvents", row);
  if (payload.hn) await db.from("eventPrivate").insert({ eventId: event.id, hn: String(payload.hn) });
  await db.from("boxes").update({ status: "เปิดใช้งานแล้ว", openedAt: now.toISOString(), openedBy: opener || row.openedBy, updatedAt: now.toISOString() }).eq("id", box.id);
  for (const it of itemsUsed) {
    await db.from("stockMoves").insert({ boxId: box.id, boxCode: box.boxCode, eventId: event.id, type: "use", drugName: it.drugName, strength: it.strength, qtyChange: -it.qty, byUser: opener || "QR", reason: "ใช้กับผู้ป่วย" });
  }
  await audit(user || { username: "QR" }, "open_box", { eventId: event.id, eventCode: event.eventCode, boxId: box.id, source });
  return await notifyOpen(event, box, settings);
}

// แจ้งเตือน: LINE (ตัวชี้วัดหลักตามนิยาม 5.7.4) + Web Push (ช่องทางเสริม)
async function notifyOpen(event: any, box: any, settings: any, escalation = false) {
  const title = escalation ? `ยังไม่มีผู้รับทราบ · ${box.boxCode}` : `เปิดกล่องยาฉุกเฉิน · ${box.boxCode}`;
  const bodyText = `${event.locationName || box.location || "-"} · ${event.reasonCategory || "ไม่ระบุเหตุผล"} · ${fmtTime(event.actualOpenedAt)} น.`;
  // แจ้งซ้ำ: ค่าตั้งต้นส่ง Push อย่างเดียว เพื่อประหยัดโควตา LINE (LINE_ESCALATE=1 = ส่ง LINE ด้วย)
  const lineOnEscalate = String(settings.LINE_ESCALATE || "0") === "1";
  const [line, push] = await Promise.all([
    escalation && !lineOnEscalate ? Promise.resolve({ ok: false, skipped: true } as any) : sendLine(buildOpenFlex(event, box, settings, escalation), settings),
    sendPushAll({ title, body: bodyText, tag: `case-${event.id}`, url: `${appUrl()}?case=${event.id}`, urgent: true }),
  ]);
  if (escalation) {
    return updateRow("openEvents", event.id, { escalatedAt: nowIso() });
  }
  const patch: any = {
    notificationStatus: line.skipped ? "skipped" : line.ok ? "sent" : "failed",
    notificationError: line.ok ? null : (line.message || "").slice(0, 300),
    pushSent: push.sent,
    pushFailed: push.failed,
    pushSentAt: push.sent > 0 ? nowIso() : null,
  };
  if (line.ok) patch.notificationSentAt = line.at;
  return updateRow("openEvents", event.id, patch);
}

// =====================================================================
// Case workflow
// =====================================================================
async function apiGetEvent(_c: Ctx, token: string, eventId: string) {
  await requireAuth(token);
  const event = await one("openEvents", (q) => q.eq("id", eventId));
  if (!event) throw new Error("ไม่พบเคส");
  const moves = await listWhere("stockMoves", "eventId", eventId, "at");
  const hasHn = !!(await one("eventPrivate", (q) => q.eq("eventId", eventId)));
  return { event: stripEvent(event), moves, hasHn };
}

async function apiRevealHn(_c: Ctx, token: string, eventId: string) {
  const user = await requireStaff(token);
  const row = await one("eventPrivate", (q) => q.eq("eventId", eventId));
  await audit(user, "reveal_hn", { eventId });
  return { hn: row?.hn || "" };
}

async function apiAcknowledgeEvent(_c: Ctx, token: string, eventId: string) {
  const user = await requireStaff(token);
  const ev = await one("openEvents", (q) => q.eq("id", eventId));
  if (!ev) throw new Error("ไม่พบเคส");
  if (ev.acknowledgedAt) return { event: stripEvent(ev), data: await buildAppData(user) };
  const event = await updateRow("openEvents", eventId, {
    acknowledgedAt: nowIso(), acknowledgedBy: user.displayName || user.username, acknowledgedById: user.id,
    caseStatus: ev.caseStatus === "open" ? "acknowledged" : ev.caseStatus,
  });
  await audit(user, "acknowledge_event", { eventId, eventCode: ev.eventCode });
  return { event: stripEvent(event), data: await buildAppData(user) };
}

// เติมยาครบ → ยืนยันพร้อมใช้ (ready_at)
async function apiConfirmReady(_c: Ctx, token: string, payload: any) {
  const user = await requireStaff(token);
  const ev = await one("openEvents", (q) => q.eq("id", payload.eventId));
  if (!ev) throw new Error("ไม่พบเคส");
  const box = await one("boxes", (q) => q.eq("id", ev.boxId));
  if (!box) throw new Error("ไม่พบกล่องยา");
  if (Array.isArray(payload.items)) await saveBoxItems(box, payload.items, user, ev.id, "เติมยาหลังเปิดใช้");
  if (Array.isArray(payload.itemsUsed) && payload.itemsUsed.length && !(ev.itemsUsedJson || []).length) {
    const used = payload.itemsUsed.filter((x: any) => x.drugName && Number(x.qty) > 0);
    await db.from("openEvents").update({ itemsUsedJson: used, filledFields: Math.min((ev.filledFields || 0) + 1, ev.requiredFields || 6) }).eq("id", ev.id);
  }
  const now = nowIso();
  const patch: any = { readyAt: now, readyBy: user.displayName || user.username, readyEstimated: false, caseStatus: "ready" };
  if (!ev.acknowledgedAt) Object.assign(patch, { acknowledgedAt: now, acknowledgedBy: patch.readyBy, acknowledgedById: user.id });
  const event = await updateRow("openEvents", ev.id, patch);
  const items = await listWhere("boxItems", "boxId", box.id, "sortOrder");
  const ready = items.length && items.every((i: any) => i.expiryDate && Number(i.qty) > 0);
  await db.from("boxes").update({
    status: ready ? "พร้อมใช้" : "ไม่พร้อมใช้", sealNo: payload.sealNo || box.sealNo || null,
    lastReadyAt: now, updatedAt: now,
  }).eq("id", box.id);
  await audit(user, "confirm_ready", { eventId: ev.id, eventCode: ev.eventCode, boxId: box.id, sealNo: payload.sealNo || "" });
  return { event: stripEvent(event), data: await buildAppData(user) };
}

async function apiCancelEvent(_c: Ctx, token: string, eventId: string, reason: string) {
  const user = await requireStaff(token);
  if (!String(reason || "").trim()) throw new Error("กรุณาระบุเหตุผลการยกเลิก");
  const ev = await updateRow("openEvents", eventId, { caseStatus: "cancelled", dataNote: `ยกเลิก: ${reason}` });
  await db.from("boxes").update({ status: "พร้อมใช้", updatedAt: nowIso() }).eq("id", ev.boxId);
  await audit(user, "cancel_event", { eventId, reason });
  return { data: await buildAppData(user) };
}

// แก้เวลาเปิดใช้จริง (กรณีบันทึกย้อนหลัง) — มี audit
async function apiUpdateEventTimes(_c: Ctx, token: string, eventId: string, actualOpenedAt: string, reason: string) {
  const user = await requireStaff(token);
  const ev = await one("openEvents", (q) => q.eq("id", eventId));
  const t = parseClientTime(actualOpenedAt);
  if (!ev || !t) throw new Error("ข้อมูลไม่ถูกต้อง");
  const settings = await settingsObject();
  const event = await updateRow("openEvents", eventId, { actualOpenedAt: t.toISOString(), period: periodFor(t, ev.source, settings) });
  await audit(user, "edit_actual_opened_at", { eventId, before: ev.actualOpenedAt, after: t.toISOString(), reason });
  return { event: stripEvent(event), data: await buildAppData(user) };
}

// baseline แบบไปข้างหน้า (คีย์จากแบบฟอร์มกระดาษ)
async function apiRecordPaperEvent(_c: Ctx, token: string, p: any) {
  const user = await requireAdmin(token);
  const box = p.boxId ? await one("boxes", (q) => q.eq("id", p.boxId)) : null;
  const loc = p.locationId ? await one("locations", (q) => q.eq("id", p.locationId)) : null;
  const actual = parseClientTime(p.actualOpenedAt);
  if (!actual) throw new Error("กรุณาระบุเวลาเปิดใช้จริง");
  const t = (v: string) => (parseClientTime(v)?.toISOString() || null);
  const row = await insert("openEvents", {
    id: crypto.randomUUID(),
    eventCode: makeEventCode(actual),
    boxId: box?.id || null,
    boxCode: box?.boxCode || p.boxCode || "",
    locationId: loc?.id || box?.locationId || null,
    locationName: loc?.name || box?.location || "",
    department: loc?.name || "",
    openedAt: actual.toISOString(),
    actualOpenedAt: actual.toISOString(),
    recordedAt: nowIso(),
    unitNotifiedAt: t(p.unitNotifiedAt),
    acknowledgedAt: t(p.acknowledgedAt),
    readyAt: t(p.readyAt),
    openedBy: "paper",
    reasonCategory: p.reasonCategory || "",
    source: "paper",
    period: "baseline_prosp",
    notificationStatus: "paper",
    caseStatus: "ready",
    requiredFields: Number(p.requiredFields || 0) || null,
    filledFields: Number(p.filledFields || 0) || null,
    note: p.note || "",
  });
  await audit(user, "record_paper_event", { eventId: row.id });
  return { data: await buildAppData(user) };
}

// =====================================================================
// Boxes / kits / locations
// =====================================================================
async function apiSaveBox(_c: Ctx, token: string, p: any) {
  const user = await requireStaff(token);
  const now = nowIso();
  const loc = p.locationId ? await one("locations", (q) => q.eq("id", p.locationId)) : null;
  const before = await one("boxes", (q) => q.eq("id", p.id));
  if (!before) throw new Error("ไม่พบกล่องยา");
  const box = await updateRow("boxes", p.id, {
    boxCode: p.boxCode, kitId: p.kitId || null, kitName: p.kitName || "",
    locationId: loc?.id || null, location: loc?.name || p.location || "",
    note: p.note || "", sealNo: p.sealNo || null, updatedAt: now,
  });
  if (Array.isArray(p.items)) await saveBoxItems(box, p.items, user, null, p.changeReason || "แก้ไขรายการยา");
  await audit(user, "save_box", { id: box.id, reason: p.changeReason || "" });
  return { box, data: await buildAppData(user) };
}

// บันทึกรายการยา + สร้าง stockMoves จากผลต่าง (ไม่ลบทับแบบไร้ร่องรอย)
async function saveBoxItems(box: any, items: any[], user: any, eventId: string | null, reason: string) {
  const before = await listWhere("boxItems", "boxId", box.id, "sortOrder");
  const key = (i: any) => `${i.drugName}|${i.strength || ""}|${i.lot || ""}`;
  const beforeMap = new Map<string, any>(before.map((i: any) => [key(i), i]));
  const clean = items.filter((i: any) => String(i.drugName || "").trim()).map((i: any, idx: number) => ({
    id: crypto.randomUUID(), boxId: box.id, drugName: String(i.drugName).trim(), strength: i.strength || "",
    form: i.form || "", lot: i.lot || "", expiryDate: i.expiryDate || null, qty: Number(i.qty || 0),
    unit: i.unit || "", sortOrder: idx + 1, requiredQty: Number(i.requiredQty || 0),
  }));
  const afterMap = new Map<string, any>(clean.map((i: any) => [key(i), i]));
  const moves: any[] = [];
  for (const [k, a] of afterMap) {
    const b: any = beforeMap.get(k);
    const diff = Number(a.qty) - Number(b?.qty || 0);
    if (diff !== 0) moves.push({ type: b ? (diff > 0 ? "refill" : "adjust") : "refill", item: a, diff });
  }
  for (const [k, b] of beforeMap) {
    if (!afterMap.has(k) && Number((b as any).qty) > 0) {
      const bi: any = b;
      const expired = bi.expiryDate && bi.expiryDate < bkkDate(new Date());
      moves.push({ type: expired ? "discard_expired" : "replace_lot", item: bi, diff: -Number(bi.qty) });
    }
  }
  // insert ใหม่ก่อน แล้วค่อยลบชุดเก่า (ป้องกันข้อมูลหายถ้าล้มกลางทาง)
  if (clean.length) {
    const { error } = await db.from("boxItems").insert(clean);
    if (error) throw error;
  }
  const oldIds = before.map((i: any) => i.id);
  if (oldIds.length) await db.from("boxItems").delete().in("id", oldIds);
  if (moves.length) {
    await db.from("stockMoves").insert(moves.map((m) => ({
      boxId: box.id, boxCode: box.boxCode, eventId, type: m.type, drugName: m.item.drugName, strength: m.item.strength,
      lot: m.item.lot, expiryDate: m.item.expiryDate, qtyChange: m.diff, byUser: user.displayName || user.username, reason,
    })));
  }
}

async function apiCreateBoxFromKit(_c: Ctx, token: string, p: any) {
  const user = await requireStaff(token);
  if (!String(p.boxCode || "").trim()) throw new Error("กรุณาระบุรหัสกล่อง");
  const kit = p.kitId ? await one("kits", (q) => q.eq("id", p.kitId)) : null;
  const loc = p.locationId ? await one("locations", (q) => q.eq("id", p.locationId)) : null;
  const now = nowIso();
  const box = await insert("boxes", {
    id: crypto.randomUUID(), boxCode: p.boxCode.trim(), kitId: kit?.id || null, kitName: kit?.name || "",
    locationId: loc?.id || null, location: loc?.name || "", status: "ไม่พร้อมใช้",
    qrToken: crypto.randomUUID().replaceAll("-", ""), note: p.note || "", createdAt: now, updatedAt: now,
  });
  if (kit) {
    const items = await listWhere("kitItems", "kitId", kit.id, "sortOrder");
    if (items.length) {
      await db.from("boxItems").insert(items.map((it: any, i: number) => ({
        id: crypto.randomUUID(), boxId: box.id, drugName: it.drugName, strength: it.strength || "", form: "",
        lot: "", expiryDate: null, qty: 0, unit: it.unit || "", sortOrder: i + 1, requiredQty: it.defaultQty || 0,
      })));
    }
  }
  await audit(user, "create_box", { id: box.id });
  return { box, data: await buildAppData(user) };
}

async function apiDeleteBox(_c: Ctx, token: string, boxId: string) {
  const user = await requireAdmin(token);
  await db.from("boxes").delete().eq("id", boxId);
  await audit(user, "delete_box", { boxId });
  return { data: await buildAppData(user) };
}

async function apiRegenerateQr(_c: Ctx, token: string, boxId: string) {
  const user = await requireAdmin(token);
  await db.from("boxes").update({ qrToken: crypto.randomUUID().replaceAll("-", ""), updatedAt: nowIso() }).eq("id", boxId);
  await audit(user, "regenerate_qr", { boxId });
  return { data: await buildAppData(user) };
}

async function apiSaveKit(_c: Ctx, token: string, p: any) {
  const user = await requireStaff(token);
  const now = nowIso();
  const kit = p.id
    ? await updateRow("kits", p.id, { name: p.name, description: p.description || "", active: p.active !== false, updatedAt: now })
    : await insert("kits", { id: crypto.randomUUID(), name: p.name, description: p.description || "", active: true, createdAt: now, updatedAt: now });
  await db.from("kitItems").delete().eq("kitId", kit.id);
  const items = (p.items || []).filter((i: any) => String(i.drugName || "").trim());
  if (items.length) {
    await db.from("kitItems").insert(items.map((i: any, idx: number) => ({
      id: crypto.randomUUID(), kitId: kit.id, drugName: i.drugName, strength: i.strength || "",
      defaultQty: Number(i.defaultQty || 0), unit: i.unit || "", sortOrder: idx + 1,
    })));
  }
  await audit(user, "save_kit", { id: kit.id });
  return { kit, data: await buildAppData(user) };
}

async function apiDeleteKit(_c: Ctx, token: string, kitId: string) {
  const user = await requireAdmin(token);
  await db.from("kits").delete().eq("id", kitId);
  await audit(user, "delete_kit", { kitId });
  return { data: await buildAppData(user) };
}

async function apiSaveLocation(_c: Ctx, token: string, p: any) {
  const user = await requireAdmin(token);
  if (!String(p.name || "").trim()) throw new Error("กรุณาระบุชื่อจุดวางกล่อง");
  const row = {
    code: p.code || null, name: p.name.trim(), zone: p.zone === "out" ? "out" : "in", unitType: p.unitType || "other",
    inStudy: !!p.inStudy, active: p.active !== false, sortOrder: Number(p.sortOrder || 0), note: p.note || "", updatedAt: nowIso(),
  };
  const loc = p.id ? await updateRow("locations", p.id, row) : await insert("locations", { id: crypto.randomUUID(), ...row });
  await db.from("boxes").update({ location: loc.name }).eq("locationId", loc.id);
  await audit(user, "save_location", { id: loc.id, name: loc.name, inStudy: loc.inStudy });
  return { data: await buildAppData(user) };
}

async function apiDeleteLocation(_c: Ctx, token: string, id: string) {
  const user = await requireAdmin(token);
  await db.from("locations").update({ active: false, updatedAt: nowIso() }).eq("id", id);
  await audit(user, "deactivate_location", { id });
  return { data: await buildAppData(user) };
}

// =====================================================================
// Inspections (ภาคผนวก ก 1.2)
// =====================================================================
async function apiListInspections(_c: Ctx, token: string, limit = 300) {
  await requireAuth(token);
  const { data } = await db.from("inspections").select("*").order("inspectedAt", { ascending: false }).limit(limit);
  return { inspections: data || [] };
}

// รายงานผลการดำเนินงาน (ไม่มี HN) — ช่วงวันที่ใดก็ได้ (เวลาไทย) สูงสุด 3 ปี: เดือน / ช่วงที่กำหนด / ปีงบประมาณ
async function apiReport(_c: Ctx, token: string, from: string, to: string) {
  const user = await requireAuth(token);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(String(from || "")) || !re.test(String(to || ""))) throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  if (to < from) throw new Error("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
  const bkk = (d: string, addDays = 0) => { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd + addDays) - 7 * 3600000).toISOString(); };
  const start = bkk(from), end = bkk(to, 1);
  if (new Date(end).getTime() - new Date(start).getTime() > 3 * 366 * 86400000) throw new Error("ช่วงรายงานยาวเกิน 3 ปี");
  const page = async (table: string, col: string) => {
    const out: any[] = [];
    for (let f = 0; f < 20000; f += 1000) {
      const { data } = await db.from(table).select("*").gte(col, start).lt(col, end).order(col, { ascending: true }).range(f, f + 999);
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const [events, inspections] = await Promise.all([page("openEvents", "actualOpenedAt"), page("inspections", "inspectedAt")]);
  await audit(user, "report", { from, to });
  return { from, to, events: events.map(stripEvent), inspections };
}
async function apiMonthlyReport(c: Ctx, token: string, month: string) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) throw new Error("รูปแบบเดือนไม่ถูกต้อง");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const r = await apiReport(c, token, `${month}-01`, `${month}-${String(last).padStart(2, "0")}`);
  return { ...r, month };
}

async function apiGetInspection(_c: Ctx, token: string, id: string) {
  await requireAuth(token);
  const ins = await one("inspections", (q) => q.eq("id", id));
  const items = await listWhere("inspectionItems", "inspectionId", id, "sortOrder");
  return { inspection: ins, items };
}

async function apiSaveInspection(_c: Ctx, token: string, p: any) {
  const user = await requireStaff(token);
  const box = await one("boxes", (q) => q.eq("id", p.boxId));
  if (!box) throw new Error("ไม่พบกล่องยา");
  const settings = await settingsObject();
  const items = (p.items || []) as any[];
  const counts = { expired: 0, near: 0, missing: 0 };
  let req = 5, filled = 0; // หัวแบบฟอร์ม: กล่อง, วันที่, ผู้ตรวจ, ผลสรุป, เลขซีล
  filled += [box.id, p.finishedAt || nowIso(), user.id, "x", p.sealNo].filter((v) => v && String(v).trim()).length;
  for (const it of items) {
    if (it.status === "expired") counts.expired++;
    if (it.status === "near") counts.near++;
    if (it.status === "missing" || Number(it.actualQty || 0) < Number(it.requiredQty || 0)) counts.missing++;
    req += 4; // จำนวนจริง, lot, วันหมดอายุ, สถานะ
    filled += [it.actualQty, it.lot, it.expiryDate, it.status].filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;
  }
  const isReady = counts.expired === 0 && counts.missing === 0;
  const started = parseClientTime(p.startedAt);
  const finished = parseClientTime(p.finishedAt) || new Date();
  const loc = box.locationId ? await one("locations", (q) => q.eq("id", box.locationId)) : null;
  const ins = await insert("inspections", {
    id: crypto.randomUUID(), boxId: box.id, boxCode: box.boxCode, locationId: loc?.id || null, locationName: loc?.name || box.location || "",
    inspectedAt: finished.toISOString(), startedAt: started?.toISOString() || null, finishedAt: finished.toISOString(),
    durationMin: started ? Math.round(((finished.getTime() - started.getTime()) / 60000) * 10) / 10 : null,
    inspectorId: user.id, inspectorName: user.displayName || user.username,
    itemsChecked: items.length, itemsExpired: counts.expired, itemsNearExpiry: counts.near, itemsMissing: counts.missing,
    isReady, sealNo: p.sealNo || null, problemNote: p.problemNote || "", requiredFields: req, filledFields: filled,
    source: p.source === "paper" ? "paper" : "app", period: p.source === "paper" ? "baseline_retro" : periodFor(finished, "app", settings),
  });
  if (items.length) {
    await db.from("inspectionItems").insert(items.map((it, i) => ({
      inspectionId: ins.id, drugName: it.drugName, strength: it.strength || "", form: it.form || "",
      requiredQty: Number(it.requiredQty || 0), actualQty: it.actualQty === "" ? null : Number(it.actualQty),
      lot: it.lot || "", expiryDate: it.expiryDate || null, status: it.status || "normal", note: it.note || "", sortOrder: i + 1,
    })));
  }
  const interval = Number(settings.INSPECTION_INTERVAL_DAYS || 30);
  const next = new Date(finished.getTime() + interval * 86400000);
  await db.from("boxes").update({
    lastInspectedAt: finished.toISOString(), inspectionDate: bkkDate(next),
    inspectionUpdatedAt: nowIso(), inspectionUpdatedBy: user.username, sealNo: p.sealNo || box.sealNo || null,
  }).eq("id", box.id);
  if (p.applyToBox) await saveBoxItems(box, items.filter((i) => i.status !== "missing").map((i) => ({ ...i, qty: i.actualQty })), user, null, "ปรับตามผลตรวจประจำเดือน");
  await audit(user, "save_inspection", { id: ins.id, boxId: box.id, isReady });
  return { inspection: ins, data: await buildAppData(user) };
}

async function apiSaveInspectionSchedule(_c: Ctx, token: string, p: any) {
  const user = await requireStaff(token);
  const ids = p.allBoxes ? (await list("boxes")).map((b: any) => b.id) : (p.boxIds || []);
  if (ids.length) {
    await db.from("boxes").update({
      inspectionDate: p.inspectionDate || null, inspectionNote: p.inspectionNote || "",
      inspectionUpdatedAt: nowIso(), inspectionUpdatedBy: user.username,
    }).in("id", ids);
  }
  await audit(user, "save_inspection_schedule", { count: ids.length });
  return { data: await buildAppData(user) };
}

// =====================================================================
// Research
// =====================================================================
async function apiResearchData(_c: Ctx, token: string) {
  await requireAdmin(token);
  const [events, inspections, timings, baseline, survey, observations, locations, settings] = await Promise.all([
    list("openEvents", "actualOpenedAt"),
    list("inspections", "inspectedAt"),
    list("reportTimings", "createdAt"),
    list("baselineAggregates", "periodMonth"),
    list("surveyV2", "submittedAt"),
    list("observations", "observedAt"),
    list("locations", "sortOrder"),
    settingsObject(),
  ]);
  return {
    events: events.map(stripEvent),
    inspections,
    reportTimings: timings,
    baseline,
    survey: survey.map((s: any) => ({ ...s, respondentCode: s.respondentCode ? "•••" : "" })),
    observations,
    locations,
    settings: sanitizeSettings(settings),
  };
}

async function apiStartReportTiming(_c: Ctx, token: string, month: string) {
  const user = await requireAdmin(token);
  const settings = await settingsObject();
  const row = await insert("reportTimings", { reportMonth: month, startedAt: nowIso(), byUser: user.displayName || user.username, source: "app", period: periodFor(new Date(), "app", settings) });
  return { timing: row };
}
async function apiFinishReportTiming(_c: Ctx, token: string, id: string) {
  const user = await requireAdmin(token);
  const t = await one("reportTimings", (q) => q.eq("id", id));
  if (!t) throw new Error("ไม่พบรายการ");
  const fin = new Date();
  const row = await updateRow("reportTimings", id, { finishedAt: fin.toISOString(), minutes: Math.round(((fin.getTime() - new Date(t.startedAt).getTime()) / 60000) * 10) / 10 });
  await audit(user, "finish_report_timing", { id, minutes: row.minutes });
  return { timing: row };
}
async function apiSaveReportTimingPaper(_c: Ctx, token: string, p: any) {
  const user = await requireAdmin(token);
  const row = await insert("reportTimings", { reportMonth: p.reportMonth, minutes: Number(p.minutes), byUser: p.byUser || user.displayName, source: "paper", period: "baseline_prosp", note: p.note || "" });
  return { timing: row };
}
async function apiSaveBaselineAggregate(_c: Ctx, token: string, p: any) {
  const user = await requireAdmin(token);
  const loc = p.locationId ? await one("locations", (q) => q.eq("id", p.locationId)) : null;
  const row = {
    periodMonth: p.periodMonth, locationId: loc?.id || null, locationName: loc?.name || "",
    inspections: Number(p.inspections || 0), inspectionsReady: Number(p.inspectionsReady || 0),
    itemsChecked: Number(p.itemsChecked || 0), itemsExpired: Number(p.itemsExpired || 0),
    recordsTotal: Number(p.recordsTotal || 0), recordsComplete: Number(p.recordsComplete || 0), note: p.note || "",
  };
  const saved = p.id ? await updateRow("baselineAggregates", p.id, row) : await insert("baselineAggregates", row);
  await audit(user, "save_baseline_aggregate", { id: saved.id });
  return { row: saved };
}
async function apiDeleteBaselineAggregate(_c: Ctx, token: string, id: string) {
  const user = await requireAdmin(token);
  await db.from("baselineAggregates").delete().eq("id", id);
  await audit(user, "delete_baseline_aggregate", { id });
  return { ok: true };
}
async function apiSaveObservation(_c: Ctx, token: string, p: any) {
  const user = await requireAdmin(token);
  const row = await insert("observations", { observedAt: parseClientTime(p.observedAt)?.toISOString() || nowIso(), place: p.place || "", observedCode: p.observedCode || "", items: p.items || {}, note: p.note || "", byUser: user.displayName || user.username });
  return { row };
}
async function apiResetPilotData(_c: Ctx, token: string, confirmText: string) {
  const user = await requireAdmin(token);
  if (confirmText !== "ลบข้อมูลนำร่อง") throw new Error("ข้อความยืนยันไม่ถูกต้อง");
  const { data } = await db.from("openEvents").select("id").eq("period", "pilot");
  const ids = (data || []).map((r: any) => r.id);
  if (ids.length) await db.from("openEvents").delete().in("id", ids);
  const ins = await db.from("inspections").delete().eq("period", "pilot").select("id");
  await audit(user, "reset_pilot_data", { events: ids.length, inspections: ins.data?.length || 0 });
  return { deletedEvents: ids.length, deletedInspections: ins.data?.length || 0 };
}

// ชุดข้อมูลวิจัย (ไม่มี HN) — ใช้ทั้งในหน้าเว็บและ Apps Script
async function buildResearchExport() {
  const [events, inspections, items, timings, baseline, survey, locations] = await Promise.all([
    list("openEvents", "actualOpenedAt"), list("inspections", "inspectedAt"), list("inspectionItems", "sortOrder"),
    list("reportTimings", "createdAt"), list("baselineAggregates", "periodMonth"), list("surveyV2", "submittedAt"), list("locations", "sortOrder"),
  ]);
  const locMap = new Map(locations.map((l: any) => [l.id, l]));
  const consented = new Set((await list("users", "username")).filter((u: any) => u.researchConsent).map((u: any) => u.id));
  const ev = events.filter((e: any) => e.caseStatus !== "cancelled").map((e: any) => {
    const l: any = locMap.get(e.locationId) || {};
    const responseMin = e.source === "paper"
      ? (e.unitNotifiedAt && e.acknowledgedAt ? minutesBetween(e.unitNotifiedAt, e.acknowledgedAt) : null)
      : (e.notificationSentAt && e.acknowledgedAt ? minutesBetween(e.notificationSentAt, e.acknowledgedAt) : null);
    const readinessMin = e.readyAt && e.actualOpenedAt ? minutesBetween(e.actualOpenedAt, e.readyAt) : null;
    return {
      event_id: e.eventCode, period: e.period || "", source: e.source || "", unit: l.name || e.locationName || "",
      unit_type: l.unitType || "", zone: l.zone || "", in_study: l.inStudy ? 1 : 0, box_code: e.boxCode || "",
      reason: e.reasonCategory || e.reason || "", shift: shiftOf(e.actualOpenedAt),
      actual_opened_at: e.actualOpenedAt, recorded_at: e.recordedAt, unit_notified_at: e.unitNotifiedAt || "",
      notification_sent_at: e.notificationSentAt || "", notification_status: e.notificationStatus || "",
      push_sent: e.pushSent || 0, acknowledged_at: e.acknowledgedAt || "", ready_at: e.readyAt || "",
      ready_estimated: e.readyEstimated ? 1 : 0, response_min: round1(responseMin), readiness_min: round1(readinessMin),
      outlier_24h: (responseMin !== null && responseMin > 1440) || (readinessMin !== null && readinessMin > 1440) ? 1 : 0,
      required_fields: e.requiredFields ?? "", filled_fields: e.filledFields ?? "",
      complete: e.requiredFields ? (e.filledFields >= e.requiredFields ? 1 : 0) : "",
      items_used_n: (e.itemsUsedJson || []).length, case_status: e.caseStatus || "",
      ack_by_consented: e.acknowledgedById ? (consented.has(e.acknowledgedById) ? 1 : 0) : "",
    };
  });
  const insp = inspections.map((i: any) => {
    const l: any = locMap.get(i.locationId) || {};
    return {
      inspection_id: String(i.id).slice(0, 8), period: i.period || "", source: i.source, unit: l.name || i.locationName || "",
      in_study: l.inStudy ? 1 : 0, box_code: i.boxCode, inspected_at: i.inspectedAt, duration_min: i.durationMin ?? "",
      items_checked: i.itemsChecked, items_expired: i.itemsExpired, items_near_expiry: i.itemsNearExpiry, items_missing: i.itemsMissing,
      is_ready: i.isReady ? 1 : 0, required_fields: i.requiredFields ?? "", filled_fields: i.filledFields ?? "",
      complete: i.requiredFields ? (i.filledFields >= i.requiredFields ? 1 : 0) : "",
    };
  });
  const inspItems = items.map((it: any) => ({
    inspection_id: String(it.inspectionId).slice(0, 8), drug: it.drugName, strength: it.strength, required_qty: it.requiredQty,
    actual_qty: it.actualQty, expiry_date: it.expiryDate, status: it.status,
  }));
  const surv = survey.map((s: any, i: number) => ({
    respondent: `R${String(i + 1).padStart(2, "0")}`, gender: s.gender, age_group: s.ageGroup, profession: s.profession,
    experience: s.experience, usage_frequency: s.usageFrequency, smartphone_skill: s.smartphoneSkill,
    ...Object.fromEntries(Array.from({ length: 22 }, (_, k) => [`q${k + 1}`, s.likert?.[`q${k + 1}`] ?? ""])),
    ...Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`c${k + 1}`, s.comparisons?.[`c${k + 1}`] ?? ""])),
    usability: s.usabilityScore, performance: s.performanceScore, usefulness: s.usefulnessScore, trust: s.trustScore,
    acceptance: s.acceptanceScore, overall: s.overallScore, accepted: s.accepted ? 1 : 0,
  }));
  const open = survey.map((s: any, i: number) => ({
    respondent: `R${String(i + 1).padStart(2, "0")}`,
    ...Object.fromEntries(Array.from({ length: 5 }, (_, k) => [`o${k + 1}`, s.openAnswers?.[`o${k + 1}`] ?? ""])),
  }));
  return {
    events: ev, inspections: insp, inspectionItems: inspItems,
    reportTimings: timings.map((t: any) => ({ month: t.reportMonth, minutes: t.minutes, source: t.source, period: t.period })),
    baseline: baseline.map((b: any) => ({ month: b.periodMonth, unit: b.locationName, inspections: b.inspections, inspections_ready: b.inspectionsReady, items_checked: b.itemsChecked, items_expired: b.itemsExpired, records_total: b.recordsTotal, records_complete: b.recordsComplete })),
    survey: surv, surveyOpen: open,
    generatedAt: nowIso(),
  };
}

async function apiExportResearch(_c: Ctx, token: string) {
  const user = await requireAdmin(token);
  const data = await buildResearchExport();
  await audit(user, "export_research_dataset", { events: data.events.length, inspections: data.inspections.length });
  return data;
}

async function apiSheetExport(_c: Ctx, key: string) {
  if (!SHEET_EXPORT_KEY || key !== SHEET_EXPORT_KEY) throw new Error("ไม่ได้รับอนุญาต");
  const data = await buildResearchExport();
  const boxes = await list("boxes", "boxCode");
  await audit({ username: "apps-script" }, "sheet_export", { events: data.events.length });
  return { ...data, boxes: boxes.map((b: any) => ({ box_code: b.boxCode, kit: b.kitName, location: b.location, status: b.status, seal_no: b.sealNo || "", next_inspection: b.inspectionDate || "" })) };
}

// =====================================================================
// Backup — สำรองข้อมูลทั้งตาราง (เรียกจาก GitHub Actions / Apps Script ด้วย BACKUP_KEY)
// ไม่รวมตาราง sessions (ข้อมูลชั่วคราว) · ไฟล์สำรองมี HN และ hash รหัสผ่าน ต้องเข้ารหัส/เก็บในที่ปิด
// =====================================================================
const BACKUP_TABLES: Record<string, string> = {
  settings: "key", users: "id", locations: "id", kits: "id", kitItems: "id", boxes: "id", boxItems: "id",
  openEvents: "id", eventPrivate: "eventId", stockMoves: "id", inspections: "id", inspectionItems: "id",
  auditLogs: "id", loginLogs: "id", lineRecipients: "recipientId", pushSubscriptions: "id",
  reportTimings: "id", baselineAggregates: "id", observations: "id", surveyResponses: "id", surveyV2: "id",
  userConsents: "id", accountRequests: "id", expiryAlerts: "alertKey", printJobs: "id",
};
async function apiBackup(_c: Ctx, key: string, table: string) {
  if (!BACKUP_KEY || key !== BACKUP_KEY) throw new Error("ไม่ได้รับอนุญาต");
  if (table === "__tables") return { tables: Object.keys(BACKUP_TABLES), at: nowIso() };
  const order = BACKUP_TABLES[table];
  if (!order) throw new Error("ไม่รู้จักตารางนี้");
  const rows: any[] = [];
  for (let from = 0; from < 500000; from += 1000) {
    const { data, error } = await db.from(table).select("*").order(order, { ascending: true }).range(from, from + 999);
    if (error) { if (from === 0 && /does not exist|relation/i.test(error.message)) return { table, rows: [], missing: true }; throw new Error(error.message); }
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  if (table === "settings") rows.forEach((r) => { if (r.key === "LINE_CHANNEL_ACCESS_TOKEN") r.value = r.value ? "***" : ""; });
  return { table, rows, count: rows.length, at: nowIso() };
}

// =====================================================================
// Survey (ภาคผนวก ข: 6 + 22 + 6 + 5)
// =====================================================================
async function apiSubmitSurveyV2(_c: Ctx, p: any) {
  if (!p.consent) throw new Error("กรุณายืนยันความยินยอมก่อนส่งแบบสอบถาม");
  const L = p.likert || {};
  for (let i = 1; i <= 22; i++) {
    const v = Number(L[`q${i}`]);
    if (!(v >= 1 && v <= 5)) throw new Error(`กรุณาตอบข้อ ${i} ในตอนที่ 2`);
  }
  const avg = (ks: number[]) => Math.round((ks.reduce((a, k) => a + Number(L[`q${k}`]), 0) / ks.length) * 100) / 100;
  const scores = {
    usabilityScore: avg([1, 2, 3, 4, 5]),
    performanceScore: avg([6, 7, 8, 9, 10]),
    usefulnessScore: avg([11, 12, 13, 14, 15]),
    trustScore: avg([16, 17, 18, 19]),
    acceptanceScore: avg([20, 21, 22]),
    overallScore: avg(Array.from({ length: 22 }, (_, i) => i + 1)),
  };
  const code = String(p.respondentCode || "").trim();
  if (code) {
    const dup = await one("surveyV2", (q) => q.eq("respondentCode", code));
    if (dup) throw new Error("รหัสผู้ตอบนี้ส่งแบบสอบถามแล้ว");
  }
  await insert("surveyV2", {
    respondentCode: code || null, consent: true, gender: p.gender || "", ageGroup: p.ageGroup || "",
    profession: p.profession || "", professionOther: p.professionOther || "", experience: p.experience || "",
    usageFrequency: p.usageFrequency || "", smartphoneSkill: p.smartphoneSkill || "",
    likert: L, comparisons: p.comparisons || {}, openAnswers: p.openAnswers || {}, ...scores,
    accepted: Number(L.q21) >= 4 && Number(L.q22) >= 4,
  });
  return { ok: true };
}

// =====================================================================
// Logs / users / settings
// =====================================================================
async function apiListLogs(_c: Ctx, token: string, p: any = {}) {
  await requireStaff(token);
  const from = p.from ? new Date(p.from).toISOString() : new Date(Date.now() - 30 * 86400000).toISOString();
  const to = p.to ? new Date(new Date(p.to).getTime() + 86400000).toISOString() : new Date(Date.now() + 86400000).toISOString();
  // ดึงทีละ 1,000 แถว (ข้อจำกัดของ Supabase) จนครบช่วงวันที่ สูงสุด 20,000 แถวต่อประเภท
  const all = async (table: string) => {
    const out: any[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const rows = rowsOf(await db.from(table).select("*").gte("at", from).lt("at", to).order("at", { ascending: false }).range(off, off + 999));
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  };
  const [logins, audits] = await Promise.all([all("loginLogs"), all("auditLogs")]);
  return { logins, audits };
}

async function apiListUsers(_c: Ctx, token: string) {
  await requireAdmin(token);
  return { users: (await list("users", "username")).map(publicUser) };
}

async function apiSaveUser(_c: Ctx, token: string, p: any) {
  const admin = await requireAdmin(token);
  const row: any = {
    username: String(p.username || "").trim(), displayName: p.displayName || p.username,
    role: ROLES.includes(p.role) ? p.role : "pharmacist", phone: p.phone || "",
    active: p.active !== false, position: p.position || "", staffCode: p.staffCode || "",
    researchConsent: !!p.researchConsent, consentOfficer: !!p.consentOfficer, updatedAt: nowIso(),
  };
  if (!row.username) throw new Error("กรุณาระบุชื่อผู้ใช้");
  const pw = p.password || (!p.id ? await defaultPassword() : "");
  if (pw) {
    if (String(pw).length < 4) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร");
    row.salt = crypto.randomUUID();
    row.passwordHash = await pbkdf2(pw, row.salt);
  }
  if (p.id && p.id === admin.id && (row.role !== "admin" || !row.active)) throw new Error("ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเอง");
  const saved = p.id ? await updateRow("users", p.id, row) : await insert("users", { id: crypto.randomUUID(), ...row, createdAt: nowIso() });
  if (p.id && (p.password || !row.active)) await db.from("sessions").delete().eq("userId", p.id);
  await audit(admin, "save_user", { id: saved.id, username: saved.username, role: saved.role, active: saved.active });
  return { users: (await list("users", "username")).map(publicUser) };
}

async function apiDeleteUser(_c: Ctx, token: string, userId: string) {
  const admin = await requireAdmin(token);
  if (admin.id === userId) throw new Error("ไม่สามารถลบบัญชีที่กำลังใช้งาน");
  await db.from("users").update({ active: false, updatedAt: nowIso() }).eq("id", userId);
  await db.from("sessions").delete().eq("userId", userId);
  await audit(admin, "deactivate_user", { userId });
  return { users: (await list("users", "username")).map(publicUser) };
}

async function apiSaveSettings(_c: Ctx, token: string, settings: Record<string, string>) {
  const user = await requireAdmin(token);
  const now = nowIso();
  for (const [key, value] of Object.entries(settings || {})) {
    if (key === "LINE_TOKEN_SET") continue;
    if (key === "LINE_CHANNEL_ACCESS_TOKEN" && !String(value || "").trim()) continue; // เว้นว่าง = ไม่เปลี่ยน
    await db.from("settings").upsert({ key, value: String(value ?? ""), updatedAt: now, updatedBy: user.username }, { onConflict: "key" });
  }
  await audit(user, "save_settings", Object.keys(settings || {}));
  return { data: await buildAppData(user) };
}

async function apiTestNotify(_c: Ctx, token: string) {
  const user = await requireAdmin(token);
  const settings = await settingsObject();
  const [line, push] = await Promise.all([
    sendLine(buildTestFlex(settings), settings),
    sendPushAll({ title: "ทดสอบการแจ้งเตือน SEB", body: `ส่งโดย ${user.displayName || user.username}`, tag: "test", url: appUrl() }),
  ]);
  return { line, push };
}

async function apiSavePushSubscription(ctx: Ctx, token: string, sub: any, deviceLabel: string) {
  const user = await requireAuth(token);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error("ข้อมูลการสมัครรับแจ้งเตือนไม่ครบ");
  await db.from("pushSubscriptions").upsert({
    endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: user.id, username: user.username,
    deviceLabel: deviceLabel || "", userAgent: ctx.ua.slice(0, 300), active: true, lastError: null,
  }, { onConflict: "endpoint" });
  await audit(user, "register_push_device", { deviceLabel });
  return { ok: true };
}

async function apiRemovePushSubscription(_c: Ctx, token: string, endpoint: string) {
  const user = await requireAuth(token);
  await db.from("pushSubscriptions").update({ active: false }).eq("endpoint", endpoint);
  await audit(user, "remove_push_device", {});
  return { ok: true };
}

async function apiSendExpiryReport(_c: Ctx, token: string) {
  const user = await requireStaff(token);
  const res = await sendDailyDigest(true);
  await audit(user, "send_expiry_report", res);
  return res;
}

// =====================================================================
// Cron (เรียกจาก pg_cron ทุก 5 นาที และทุกเช้า)
// =====================================================================
async function apiCron(_c: Ctx, secret: string, kind: string) {
  if (!CRON_SECRET || secret !== CRON_SECRET) throw new Error("ไม่ได้รับอนุญาต");
  if (kind === "daily") {
    const expiry = await sendExpiryMilestones();
    const digest = await sendDailyDigest(false);
    return { expiry, digest };
  }
  // tick: แจ้งเตือนซ้ำเมื่อไม่มีผู้รับทราบ
  const settings = await settingsObject();
  const mins = Number(settings.ESCALATE_AFTER_MIN || 15);
  const { data } = await db.from("openEvents").select("*").eq("caseStatus", "open").is("escalatedAt", null)
    .lt("recordedAt", new Date(Date.now() - mins * 60000).toISOString()).limit(20);
  let n = 0;
  for (const ev of data || []) {
    const box = await one("boxes", (q) => q.eq("id", ev.boxId));
    if (box) { await notifyOpen(ev, box, settings, true); n++; }
  }
  return { escalated: n };
}

// แจ้งเตือนยาใกล้หมดอายุตามรอบ (ค่าตั้งต้น 30 / 15 / 7 วัน) — ส่ง LINE ครั้งเดียวต่อยา 1 รายการต่อรอบ
// ถ้าวันไหน cron ไม่ได้ทำงาน วันถัดไปจะยังส่งรอบที่ค้างอยู่ (ไม่ตกหล่น) แต่จะส่งเฉพาะรอบล่าสุดที่ถึงแล้ว
async function sendExpiryMilestones() {
  const settings = await settingsObject();
  if (String(settings.LINE_EXPIRY_ALERTS ?? "1") !== "1") return { skipped: true, reason: "ปิดอยู่" };
  const ms = String(settings.EXPIRY_ALERT_MILESTONES || "30,15,7").split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!ms.length) return { skipped: true };
  const data = await buildAppData(null);
  const today = startOfTodayBkk();
  const cands: any[] = [];
  for (const b of data.boxes) for (const it of b.items) {
    if (!it.expiryDate) continue;
    const days = daysUntil(it.expiryDate, today);
    if (days < 0) continue;
    const m = ms.find((x) => days <= x); // รอบที่เล็กที่สุดที่ถึงแล้ว
    if (m == null) continue;
    cands.push({ ...it, boxId: b.id, boxCode: b.boxCode, location: b.location, days, milestone: m, alertKey: [b.id, it.drugName, it.lot || "", it.expiryDate].join("|") });
  }
  if (!cands.length) return { sent: 0 };
  const keys = [...new Set(cands.map((c) => c.alertKey))];
  const done = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data: rows } = await db.from("expiryAlerts").select("alertKey,milestone").in("alertKey", keys.slice(i, i + 200));
    (rows || []).forEach((r: any) => done.add(`${r.alertKey}#${r.milestone}`));
  }
  const due = cands.filter((c) => !done.has(`${c.alertKey}#${c.milestone}`)).sort((a, b) => a.days - b.days);
  if (!due.length) return { sent: 0 };
  const line = await sendLine(buildExpiryFlex(due, settings), settings);
  // บันทึกว่าส่งแล้ว (รวมรอบที่ใหญ่กว่าด้วย เพื่อไม่ส่งย้อนหลัง เช่น ยาที่เพิ่งเพิ่มเข้ากล่องตอนเหลือ 10 วัน จะได้แจ้งรอบ 15 ครั้งเดียว)
  if (line.ok) {
    const rows = due.flatMap((c) => ms.filter((x) => x >= c.milestone).map((x) => ({ alertKey: c.alertKey, milestone: x, boxCode: c.boxCode, drugName: c.drugName, expiryDate: c.expiryDate, lineOk: true })));
    for (let i = 0; i < rows.length; i += 500) await db.from("expiryAlerts").upsert(rows.slice(i, i + 500), { onConflict: "alertKey,milestone", ignoreDuplicates: true });
  }
  await sendPushAll({ title: "ยาใกล้หมดอายุ", body: due.slice(0, 3).map((c) => `${c.drugName} · ${c.boxCode} (${c.days} วัน)`).join(" / ") + (due.length > 3 ? ` และอีก ${due.length - 3} รายการ` : ""), tag: "expiry", url: `${appUrl()}?view=boxes` });
  return { sent: due.length, line };
}
function buildExpiryFlex(due: any[], settings: any) {
  const groups = [...new Set(due.map((d) => d.milestone))].sort((a, b) => a - b);
  const contents: any[] = [];
  for (const m of groups) {
    const list = due.filter((d) => d.milestone === m);
    contents.push(txt(m === 0 ? "หมดอายุวันนี้" : `ภายใน ${m} วัน`, "xs", m <= 7 ? C.red : m <= 15 ? C.amber : C.accent, true, { margin: contents.length ? "lg" : "none" }));
    for (const it of list.slice(0, 10)) contents.push({
      type: "box", layout: "horizontal", margin: "md",
      contents: [
        { type: "box", layout: "vertical", flex: 5, contents: [txt(`${it.drugName} ${it.strength || ""}`, "sm", C.ink, true), txt(`${it.boxCode} · ${it.location || "-"} · lot ${it.lot || "-"}`, "xxs", C.muted)] },
        { type: "box", layout: "vertical", flex: 2, contents: [txt(`${it.days} วัน`, "sm", it.days <= 7 ? C.red : it.days <= 15 ? C.amber : C.ink, true, { align: "end" }), txt(`หมด ${fmtDateNum(it.expiryDate)}`, "xxs", C.muted, false, { align: "end" })] },
      ],
    });
    if (list.length > 10) contents.push(txt(`และอีก ${list.length - 10} รายการ`, "xs", C.muted, false, { margin: "sm" }));
  }
  return {
    type: "flex", altText: `[SEB] ยาใกล้หมดอายุ ${due.length} รายการ`,
    contents: {
      type: "bubble",
      header: band("ยาใกล้หมดอายุ", `${due.length} รายการ · ${fmtDateNum(nowIso())}`, "#D97706"),
      body: { type: "box", layout: "vertical", paddingAll: "18px", contents },
      footer: footer(settings),
    },
  };
}

async function sendDailyDigest(force: boolean) {
  const settings = await settingsObject();
  if (!force && String(settings.LINE_DAILY_DIGEST || "0") === "off") return { skipped: true, reason: "ปิดสรุปรายวัน" };
  const data = await buildAppData(null);
  const nearDays = Number(settings.NEAR_EXPIRY_DAYS || 30);
  const today = startOfTodayBkk();
  const items = data.boxes.flatMap((b: any) => b.items.map((it: any) => ({ ...it, boxCode: b.boxCode, location: b.location, days: daysUntil(it.expiryDate, today) })))
    .filter((it: any) => it.expiryDate && it.days <= nearDays).sort((a: any, b: any) => a.days - b.days);
  const overdue = data.boxes.filter((b: any) => b.inspectionOverdue);
  if (!force && !items.length && !overdue.length) return { skipped: true };
  const expired = items.filter((i: any) => i.days < 0).length;
  // LINE โควตาฟรีมีจำกัด (นับตามจำนวนผู้รับ) → สรุปรายวันส่ง LINE เฉพาะเมื่อเปิดใช้ หรือกดส่งเอง
  const useLine = force || String(settings.LINE_DAILY_DIGEST || "0") === "1";
  const line = useLine ? await sendLine(buildDigestFlex(items, overdue, settings), settings) : { ok: false, skipped: true, message: "สรุปรายวันส่งผ่าน Push เท่านั้น" };
  const push = await sendPushAll({
    title: "สรุปกล่องยาฉุกเฉินประจำวัน",
    body: `หมดอายุ ${expired} · ใกล้หมดอายุ ${items.length - expired} · เลยวันตรวจ ${overdue.length} กล่อง`,
    tag: "daily", url: `${appUrl()}?view=boxes`,
  });
  return { items: items.length, overdue: overdue.length, line, push };
}

// =====================================================================
// Notifications
// =====================================================================
async function sendPushAll(payload: any) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { sent: 0, failed: 0, skipped: true };
  const { data: subs } = await db.from("pushSubscriptions").select("*").eq("active", true);
  let sent = 0, failed = 0;
  await Promise.all((subs || []).map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: payload.urgent ? "high" : "normal" },
      );
      sent++;
      await db.from("pushSubscriptions").update({ lastSuccessAt: nowIso(), lastError: null }).eq("id", s.id);
    } catch (e: any) {
      failed++;
      const gone = e?.statusCode === 404 || e?.statusCode === 410;
      await db.from("pushSubscriptions").update({ active: !gone, lastError: String(e?.body || e?.message || e).slice(0, 300) }).eq("id", s.id);
    }
  }));
  return { sent, failed };
}

async function sendLine(message: any, settings: any) {
  const token = settings.LINE_CHANNEL_ACCESS_TOKEN || "";
  const mode = String(settings.LINE_SEND_MODE || "broadcast").toLowerCase();
  if (!token) return { ok: false, skipped: true, message: "ยังไม่ได้ตั้งค่า LINE Channel Access Token" };
  const post = (url: string, body: any) => fetch(url, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    if (mode === "broadcast") {
      const res = await post("https://api.line.me/v2/bot/message/broadcast", { messages: [message] });
      const at = nowIso();
      const body = await res.text();
      return { ok: res.ok, at, status: res.status, message: res.ok ? "ส่ง LINE สำเร็จ" : `LINE ${res.status}: ${body.slice(0, 200)}` };
    }
    const ids = await getLineTargets(settings);
    if (!ids.length) return { ok: false, skipped: true, message: "ยังไม่มีผู้รับ LINE" };
    let okCount = 0, firstAt = "", lastErr = "";
    for (const to of ids) {
      const res = await post("https://api.line.me/v2/bot/message/push", { to, messages: [message] });
      if (res.ok) { okCount++; if (!firstAt) firstAt = nowIso(); } else lastErr = `LINE ${res.status}: ${(await res.text()).slice(0, 150)}`;
    }
    return { ok: okCount > 0, at: firstAt, sent: okCount, failed: ids.length - okCount, message: okCount ? `ส่ง LINE สำเร็จ ${okCount} รายการ` : lastErr };
  } catch (e: any) {
    return { ok: false, message: `เชื่อมต่อ LINE ไม่ได้: ${e?.message || e}` };
  }
}

async function getLineTargets(settings: any) {
  const configured = String(settings.LINE_TO_ID || "").split(/\n|\|/).map((s) => s.trim()).filter(Boolean);
  const { data } = await db.from("lineRecipients").select("recipientId").eq("active", true);
  return [...new Set([...configured, ...(data || []).map((r: any) => r.recipientId).filter(Boolean)])];
}

async function handleLineWebhook(payload: any) {
  for (const event of payload.events || []) {
    const src = event.source || {};
    const id = src.groupId || src.roomId || src.userId;
    if (!id) continue;
    const active = !(event.type === "unfollow" || event.type === "leave");
    await db.from("lineRecipients").upsert({
      recipientId: id, sourceType: src.type || "", active,
      followedAt: active ? nowIso() : null, lastSeenAt: nowIso(), lastEventType: event.type || "",
    }, { onConflict: "recipientId" });
  }
  return { ok: true };
}

// ---------- LINE Flex (ไม่มี HN ตามโครงร่างวิจัย) ----------
const C = { ink: "#111113", muted: "#6B6B76", line: "#E7E7EA", accent: "#4F46E5", red: "#E5484D", amber: "#B45309", green: "#12A594", pale: "#F7F7F8" };
function txt(text: string, size = "sm", color = C.ink, bold = false, extra: any = {}) {
  return { type: "text", text: String(text || "-"), size, color, weight: bold ? "bold" : "regular", wrap: true, ...extra };
}
function row(label: string, value: string) {
  return { type: "box", layout: "horizontal", contents: [txt(label, "sm", C.muted, false, { flex: 2 }), txt(value, "sm", C.ink, true, { flex: 4, align: "end" })] };
}
function footer(settings: any) {
  return {
    type: "box", layout: "vertical", paddingAll: "14px", backgroundColor: C.pale,
    contents: [{ type: "button", style: "primary", color: C.ink, height: "sm", action: { type: "uri", label: "เปิดระบบ SEB", uri: appUrl() } },
      txt(`${settings.HOSPITAL_NAME || ""} · ${settings.DEPARTMENT_NAME || ""}`, "xxs", C.muted, false, { margin: "md", align: "center" })],
  };
}
// แถบหัวการ์ดสีทึบ (แดง = เปิดกล่อง, ส้ม = ยังไม่มีผู้รับทราบ / ยาใกล้หมดอายุ)
function band(title: string, sub: string, bg: string) {
  return { type: "box", layout: "vertical", paddingAll: "18px", paddingBottom: "16px", backgroundColor: bg,
    contents: [txt(title, "xl", "#FFFFFF", true), txt(sub, "xs", "#FFFFFFCC", false, { margin: "xs" })] };
}
function irow(icon: string, label: string, value: string, opts: any = {}) {
  return { type: "box", layout: "horizontal", spacing: "md", margin: opts.margin || "md",
    contents: [txt(`${icon} ${label}`, "sm", C.muted, false, { flex: 4 }), txt(value, opts.size || "sm", opts.color || C.ink, true, { flex: 6 })] };
}
function fmtDateNum(iso: string) { const p = bkkParts(new Date(iso)); return `${p.d}/${p.m}/${Number(p.y) + 543}`; }
function buildOpenFlex(event: any, box: any, settings: any, escalation: boolean) {
  const color = escalation ? "#D97706" : "#C8363B";
  const at = event.actualOpenedAt || nowIso();
  const mins = escalation ? Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000)) : 0;
  return {
    type: "flex",
    altText: `[SEB] ${escalation ? "ยังไม่มีผู้รับทราบ" : "เปิดกล่องยา"} ${box.boxCode} · ${event.locationName || box.location || ""}`,
    contents: {
      type: "bubble",
      header: band(escalation ? "ยังไม่มีผู้รับทราบ!" : "เปิดกล่องยาฉุกเฉิน!", escalation ? `เปิดกล่องมาแล้ว ${mins} นาที · กรุณารับทราบในระบบ` : "Smart Emergency Box (SEB)", color),
      body: {
        type: "box", layout: "vertical", paddingAll: "18px",
        contents: [
          irow("📦", "กล่องยา", box.boxCode, { size: "lg", color, margin: "none" }),
          irow("📍", "สถานที่", event.locationName || box.location || "-", { size: "md" }),
          { type: "separator", margin: "lg", color: C.line },
          irow("📅", "วันที่", fmtDateNum(at), { margin: "lg" }),
          irow("⏰", "เวลาเปิดใช้", `${fmtTime(at)} น.`),
          irow("🩺", "เหตุผล", event.reasonCategory || "-"),
        ],
      },
      footer: footer(settings),
      styles: { footer: { separator: true, separatorColor: C.line } },
    },
  };
}
// ตัวอย่างการ์ดสำหรับหน้า "ตั้งค่า" — ใช้ฟังก์ชันจริงชุดเดียวกับที่ส่ง LINE
async function apiFlexPreview(_c: Ctx, token: string) {
  await requireAdmin(token);
  const settings = await settingsObject();
  const now = nowIso();
  const box = { boxCode: "ER-01", location: "ห้องอุบัติเหตุ-ฉุกเฉิน (ER)" };
  const ev = { eventCode: "EV-2611-AB12C", reasonCategory: "CPR", actualOpenedAt: new Date(Date.now() - 12 * 60000).toISOString(), openerName: "พว.ตัวอย่าง", locationName: box.location };
  const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const due = [
    { milestone: 7, drugName: "Adrenaline inj.", strength: "1 mg/ml", boxCode: "ER-01", location: box.location, lot: "J690045", expiryDate: d(6), days: 6 },
    { milestone: 30, drugName: "Atropine inj.", strength: "0.6 mg/ml", boxCode: "WARD-1", location: "หอผู้ป่วยใน", lot: "J670368", expiryDate: d(28), days: 28 },
  ];
  return { open: buildOpenFlex(ev, box, settings, false), escalate: buildOpenFlex(ev, box, settings, true), expiry: buildExpiryFlex(due, settings), test: buildTestFlex(settings), at: now };
}
function buildDigestFlex(items: any[], overdue: any[], settings: any) {
  const lines = items.slice(0, 8).map((it) => ({
    type: "box", layout: "horizontal", margin: "md",
    contents: [
      { type: "box", layout: "vertical", flex: 5, contents: [txt(`${it.drugName} ${it.strength || ""}`, "sm", C.ink, true), txt(`${it.boxCode} · lot ${it.lot || "-"}`, "xxs", C.muted)] },
      txt(it.days < 0 ? "หมดอายุ" : `${it.days} วัน`, "sm", it.days < 0 ? C.red : it.days <= 14 ? C.amber : C.ink, true, { flex: 2, align: "end" }),
    ],
  }));
  if (!lines.length) lines.push(txt("ไม่มียาใกล้หมดอายุ", "sm", C.muted) as any);
  if (overdue.length) {
    lines.push({ type: "separator", margin: "lg", color: C.line } as any);
    lines.push(txt(`เลยกำหนดตรวจ ${overdue.length} กล่อง: ${overdue.map((b) => b.boxCode).slice(0, 6).join(", ")}`, "xs", C.amber, true, { margin: "md" }) as any);
  }
  return {
    type: "flex", altText: `[SEB] สรุปประจำวัน ยาใกล้หมดอายุ ${items.length} รายการ`,
    contents: {
      type: "bubble",
      header: band("สรุปประจำวัน", `ยาใกล้หมดอายุ / เลยวันตรวจ · ${fmtDateNum(nowIso())}`, "#4F46E5"),
      body: { type: "box", layout: "vertical", paddingAll: "18px", contents: lines },
      footer: footer(settings),
    },
  };
}
function buildTestFlex(settings: any) {
  return {
    type: "flex", altText: "[SEB] ทดสอบการแจ้งเตือน",
    contents: { type: "bubble", header: band("ทดสอบการแจ้งเตือน", "Smart Emergency Box (SEB)", "#C8363B"), body: { type: "box", layout: "vertical", paddingAll: "18px", contents: [txt(`${fmtDateNum(nowIso())} ${fmtTime(nowIso())} น. · ระบบทำงานปกติ`, "sm", C.ink, true)] }, footer: footer(settings) },
  };
}

// =====================================================================
// Helpers
// =====================================================================
async function settingsObject() {
  const rows = await list("settings", "key");
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value ?? ""])) as Record<string, string>;
}
async function audit(user: any, action: string, detail: any) {
  await db.from("auditLogs").insert({ at: nowIso(), userId: user?.id || null, username: user?.username || "", action, detailJson: detail || {} });
}
function rowsOf(r: any) { if (r.error) throw r.error; return r.data || []; }
async function list(table: string, order = "id", ascending = true) {
  return rowsOf(await db.from(table).select("*").order(order, { ascending }));
}
async function listWhere(table: string, col: string, value: any, order = "id") {
  return rowsOf(await db.from(table).select("*").eq(col, value).order(order, { ascending: true }));
}
async function one(table: string, filter: (q: any) => any) {
  const { data, error } = await filter(db.from(table).select("*")).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}
async function insert(table: string, row: any) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw error;
  return data;
}
async function updateRow(table: string, id: string, row: any) {
  const { data, error } = await db.from(table).update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
function appUrl() { return PUBLIC_SITE_URL ? `${PUBLIC_SITE_URL}/` : ""; }
function nowIso() { return new Date().toISOString(); }
function parseClientTime(v: any) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}
function minutesBetween(a: string, b: string) { return (new Date(b).getTime() - new Date(a).getTime()) / 60000; }
function round1(x: number | null) { return x === null || x === undefined ? "" : Math.round(x * 10) / 10; }
function median(a: number[]) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}
function bkkParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour") === "24" ? "00" : g("hour"), mi: g("minute") };
}
function bkkDate(d: Date) { const p = bkkParts(d); return `${p.y}-${p.m}-${p.d}`; }
function startOfTodayBkk() { return new Date(`${bkkDate(new Date())}T00:00:00+07:00`); }
function daysUntil(date: string | null, today: Date) {
  if (!date) return NaN;
  return Math.round((new Date(`${String(date).slice(0, 10)}T00:00:00+07:00`).getTime() - today.getTime()) / 86400000);
}
function fmtTime(iso: string) { const p = bkkParts(new Date(iso)); return `${p.h}:${p.mi}`; }
function fmtDate(iso: string) {
  const p = bkkParts(new Date(iso));
  const th = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${Number(p.d)} ${th[Number(p.m) - 1]} ${Number(p.y) + 543}`;
}
function shiftOf(iso: string) {
  if (!iso) return "";
  const h = Number(bkkParts(new Date(iso)).h);
  return h >= 8 && h < 16 ? "เช้า" : h >= 16 ? "บ่าย" : "ดึก";
}
function makeEventCode(d: Date) {
  const p = bkkParts(d);
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 5).toUpperCase();
  return `EV-${p.y.slice(2)}${p.m}-${rnd}`;
}
function periodFor(d: Date, source: string, s: any) {
  if (source === "paper") return "baseline_prosp";
  const day = bkkDate(d);
  const inRange = (a: string, b: string) => a && day >= a && (!b || day <= b);
  if (inRange(s.STUDY_PILOT_START, s.STUDY_PILOT_END)) return "pilot";
  if (inRange(s.STUDY_POST_START, s.STUDY_POST_END)) return "post";
  return "other";
}
