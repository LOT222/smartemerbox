import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PUBLIC_SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") || "").replace(/\/+$/, "");
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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
    if (!actions[action]) throw new Error(`Unknown action: ${action}`);
    return json({ data: await actions[action](...args) });
  } catch (err) {
    return json({ error: err?.message || String(err) }, 400);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}

const actions: Record<string, (...args: any[]) => Promise<any>> = {
  apiHealth,
  apiLogin,
  apiLogout,
  apiBootstrap,
  apiRefresh,
  apiLiveDashboard,
  apiPublicGetBox,
  apiOpenBoxPublic,
  apiSubmitSurveyPublic,
  apiGetSurveySummary,
  apiSaveSettings,
  apiTestLineAlert,
  apiSaveUser,
  apiDeleteUser,
  apiSaveKit,
  apiDeleteKit,
  apiCreateBoxFromKit,
  apiSaveBox,
  apiRenameBox,
  apiDeleteBox,
  apiSaveInspectionSchedule,
  apiRecordOpenBox,
  apiAcknowledgeOpenEvent,
  apiSendExpiryReport,
  apiCreateDrugRecordPrintJob,
  apiGetDrugRecordPrintJob,
};

async function apiHealth() {
  const { error } = await db.from("settings").select("key").limit(1);
  if (error) throw error;
  return { ok: true, appUrl: appUrl(), at: new Date().toISOString() };
}

async function apiLogin(username: string, password: string) {
  const user = await one("users", (q) => q.eq("username", username).eq("active", true));
  if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await insert("sessions", {
    token,
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt,
    createdAt: now.toISOString(),
  });
  return { token, user: publicUser(user), data: await buildAppData(user), appUrl: appUrl() };
}

async function apiLogout(token: string) {
  if (token) await db.from("sessions").delete().eq("token", token);
  return { ok: true };
}

async function apiBootstrap(token = "") {
  const user = token ? await getUserByToken(token, false) : null;
  return {
    authenticated: !!user,
    user: user ? publicUser(user) : null,
    data: await buildAppData(user),
    appUrl: appUrl(),
  };
}

async function apiRefresh(token: string) {
  const user = await requireAuth(token);
  return { user: publicUser(user), data: await buildAppData(user), appUrl: appUrl() };
}

async function apiLiveDashboard(token = "") {
  const user = token ? await getUserByToken(token, false) : null;
  return { user: user ? publicUser(user) : null, data: await buildDashboardData() };
}

async function apiPublicGetBox(boxId: string, qrToken: string) {
  const box = await boxWithItems(boxId);
  if (!box || box.qrToken !== qrToken) throw new Error("QR ไม่ถูกต้องหรือหมดอายุ");
  return { box, settings: await settingsObject(), appUrl: appUrl() };
}

async function apiOpenBoxPublic(payload: any) {
  const box = await one("boxes", (q) => q.eq("id", payload.boxId));
  if (!box || box.qrToken !== payload.qrToken) throw new Error("QR ไม่ถูกต้อง");
  const event = await recordOpenEvent(box, payload, null);
  await sendLineFlexMessage(await buildOpenBoxFlex(box, event));
  return { event };
}

async function apiSubmitSurveyPublic(payload: any) {
  const scores = payload.scores || {};
  const domainScores = scoreDomains(scores);
  const totalScore = average(Object.values(domainScores));
  const row = await insert("surveyResponses", {
    submittedAt: new Date().toISOString(),
    gender: payload.gender || "",
    ageGroup: payload.ageGroup || "",
    profession: payload.profession || "",
    professionOther: payload.professionOther || "",
    experience: payload.experience || "",
    usageFrequency: payload.usageFrequency || "",
    smartphoneSkill: payload.smartphoneSkill || "",
    scoresJson: scores,
    comparisonsJson: payload.comparisons || {},
    openAnswersJson: payload.openAnswers || {},
    ...domainScores,
    totalScore,
  });
  return { ok: true, response: row };
}

async function apiGetSurveySummary(token: string) {
  await requireAuth(token);
  return buildSurveySummary();
}

async function apiSaveSettings(token: string, settings: Record<string, string>, creditPin = "") {
  const user = await requireAdmin(token);
  if ("APP_CREDIT_TEXT" in settings && creditPin !== "2222") {
    throw new Error("ต้องยืนยันรหัสก่อนแก้ไขเครดิต");
  }
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(settings || {})) {
    await db.from("settings").upsert({
      key,
      value: String(value ?? ""),
      updatedAt: now,
      updatedBy: user.username,
    }, { onConflict: "key" });
  }
  await audit(user, "save_settings", Object.keys(settings || {}));
  return { settings: await settingsObject() };
}

async function apiTestLineAlert(token: string, settings: any) {
  await requireAdmin(token);
  return sendLineFlexMessage({
    type: "text",
    text: `ทดสอบระบบแจ้งเตือน Smart Emergency Box\n${new Date().toLocaleString("th-TH")}`,
  }, settings);
}

async function apiSaveUser(token: string, payload: any) {
  const user = await requireAdmin(token);
  const now = new Date().toISOString();
  const row: any = {
    username: payload.username,
    displayName: payload.displayName || payload.username,
    role: payload.role || "user",
    active: payload.active !== false && payload.active !== "false",
    updatedAt: now,
    position: payload.position || "",
  };
  if (payload.password) {
    row.salt = crypto.randomUUID();
    row.passwordHash = await hashPassword(payload.password, row.salt);
  }
  const saved = payload.id
    ? await updateById("users", payload.id, row)
    : await insert("users", { id: crypto.randomUUID(), ...row, createdAt: now });
  await audit(user, "save_user", { id: saved.id, username: saved.username });
  return { user: publicUser(saved), data: await buildAppData(user) };
}

async function apiDeleteUser(token: string, userId: string) {
  const user = await requireAdmin(token);
  if (user.id === userId) throw new Error("ไม่สามารถลบผู้ใช้ที่กำลังใช้งานอยู่");
  await db.from("users").delete().eq("id", userId);
  await audit(user, "delete_user", { userId });
  return { data: await buildAppData(user) };
}

async function apiSaveKit(token: string, kitPayload: any) {
  const user = await requireAuth(token);
  const now = new Date().toISOString();
  const kit = kitPayload.id
    ? await updateById("kits", kitPayload.id, {
      name: kitPayload.name,
      description: kitPayload.description || "",
      active: kitPayload.active !== false,
      updatedAt: now,
    })
    : await insert("kits", {
      id: crypto.randomUUID(),
      name: kitPayload.name,
      description: kitPayload.description || "",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  await replaceChildren("kitItems", "kitId", kit.id, (kitPayload.items || []).map((item: any, i: number) => ({
    id: crypto.randomUUID(),
    kitId: kit.id,
    drugName: item.drugName || "",
    strength: item.strength || "",
    defaultQty: Number(item.defaultQty || item.qty || 0),
    unit: item.unit || "",
    sortOrder: i + 1,
  })));
  await audit(user, "save_kit", { id: kit.id });
  return { kit, data: await buildAppData(user) };
}

async function apiDeleteKit(token: string, kitId: string) {
  const user = await requireAuth(token);
  await db.from("kits").delete().eq("id", kitId);
  await audit(user, "delete_kit", { kitId });
  return { data: await buildAppData(user) };
}

async function apiCreateBoxFromKit(token: string, payload: any) {
  const user = await requireAuth(token);
  const kit = payload.kitId ? await one("kits", (q) => q.eq("id", payload.kitId)) : null;
  const now = new Date().toISOString();
  const box = await insert("boxes", {
    id: crypto.randomUUID(),
    boxCode: payload.boxCode,
    kitId: kit?.id || null,
    kitName: kit?.name || "",
    location: payload.location || "",
    status: "พร้อมใช้",
    qrToken: crypto.randomUUID().replaceAll("-", ""),
    note: payload.note || "",
    createdAt: now,
    updatedAt: now,
  });
  if (kit) {
    const { data } = await db.from("kitItems").select("*").eq("kitId", kit.id).order("sortOrder");
    await replaceChildren("boxItems", "boxId", box.id, (data || []).map((item: any, i: number) => ({
      id: crypto.randomUUID(),
      boxId: box.id,
      drugName: item.drugName,
      strength: item.strength || "",
      form: "",
      lot: "",
      expiryDate: null,
      qty: item.defaultQty || 0,
      unit: item.unit || "",
      sortOrder: i + 1,
      requiredQty: item.defaultQty || 0,
    })));
  }
  await audit(user, "create_box", { id: box.id });
  return { box, data: await buildAppData(user) };
}

async function apiSaveBox(token: string, boxPayload: any) {
  const user = await requireAuth(token);
  const now = new Date().toISOString();
  const box = await updateById("boxes", boxPayload.id, {
    boxCode: boxPayload.boxCode,
    kitId: boxPayload.kitId || null,
    kitName: boxPayload.kitName || "",
    location: boxPayload.location || "",
    status: autoBoxStatus(boxPayload),
    note: boxPayload.note || "",
    updatedAt: now,
  });
  await replaceChildren("boxItems", "boxId", box.id, (boxPayload.items || []).map((item: any, i: number) => ({
    id: crypto.randomUUID(),
    boxId: box.id,
    drugName: item.drugName || "",
    strength: item.strength || "",
    form: item.form || "",
    lot: item.lot || "",
    expiryDate: item.expiryDate || null,
    qty: Number(item.qty || 0),
    unit: item.unit || "",
    sortOrder: i + 1,
    requiredQty: Number(item.requiredQty || 0),
  })));
  await audit(user, "save_box", { id: box.id, reason: boxPayload.changeReason || "" });
  return { box, data: await buildAppData(user) };
}

async function apiRenameBox(token: string, boxId: string, boxCode: string) {
  const user = await requireAuth(token);
  const box = await updateById("boxes", boxId, { boxCode, updatedAt: new Date().toISOString() });
  await audit(user, "rename_box", { boxId, boxCode });
  return { box, data: await buildAppData(user) };
}

async function apiDeleteBox(token: string, boxId: string) {
  const user = await requireAuth(token);
  await db.from("boxes").delete().eq("id", boxId);
  await audit(user, "delete_box", { boxId });
  return { data: await buildAppData(user) };
}

async function apiSaveInspectionSchedule(token: string, payload: any) {
  const user = await requireAuth(token);
  const ids = payload.allBoxes
    ? (await list("boxes")).map((b: any) => b.id)
    : (payload.boxIds || []);
  for (const id of ids) {
    await updateById("boxes", id, {
      inspectionDate: payload.inspectionDate || null,
      inspectionNote: payload.inspectionNote || "",
      inspectionUpdatedAt: new Date().toISOString(),
      inspectionUpdatedBy: user.username,
      updatedAt: new Date().toISOString(),
    });
  }
  await audit(user, "save_inspection_schedule", { count: ids.length });
  return { data: await buildAppData(user) };
}

async function apiRecordOpenBox(token: string, payload: any) {
  const user = await requireAuth(token);
  const box = await one("boxes", (q) => q.eq("id", payload.boxId));
  const event = await recordOpenEvent(box, payload, user);
  await sendLineFlexMessage(await buildOpenBoxFlex(box, event));
  return { event, data: await buildAppData(user) };
}

async function apiAcknowledgeOpenEvent(token: string, eventId: string) {
  const user = await requireAuth(token);
  const event = await updateById("openEvents", eventId, {
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: user.displayName || user.username,
  });
  await audit(user, "acknowledge_open_event", { eventId });
  return { event, data: await buildAppData(user) };
}

async function apiSendExpiryReport(token: string) {
  const user = await requireAuth(token);
  const expiring = await getExpiringItems();
  const result = await sendLineFlexMessage(await buildExpiryFlex(expiring));
  await audit(user, "send_expiry_report", { count: expiring.length });
  return { result };
}

async function apiCreateDrugRecordPrintJob(token: string, payload: any) {
  await requireAuth(token);
  const job = await insert("printJobs", {
    id: crypto.randomUUID(),
    payload,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  return { printId: job.id, url: `${appUrl("drug-record-print.html")}?printId=${job.id}` };
}

async function apiGetDrugRecordPrintJob(printId: string) {
  const job = await one("printJobs", (q) => q.eq("id", printId).gt("expiresAt", new Date().toISOString()));
  if (!job) throw new Error("ไม่พบงานพิมพ์หรือหมดอายุแล้ว");
  return job.payload;
}

async function buildAppData(user: any) {
  const [settings, kits, kitItems, boxes, boxItems, events, users, surveySummary] = await Promise.all([
    settingsObject(),
    list("kits", "name"),
    list("kitItems", "sortOrder"),
    list("boxes", "boxCode"),
    list("boxItems", "sortOrder"),
    list("openEvents", "openedAt", false),
    user?.role === "admin" ? list("users", "username") : Promise.resolve([]),
    buildSurveySummary(),
  ]);
  const fullBoxes = boxes.map((box: any) => decorateBox(box, boxItems.filter((i: any) => i.boxId === box.id)));
  const fullKits = kits.map((kit: any) => ({ ...kit, items: kitItems.filter((i: any) => i.kitId === kit.id) }));
  const expiringItems = getExpiringItemsFromRows(settings, fullBoxes);
  return {
    settings,
    kits: fullKits,
    boxes: fullBoxes,
    events: events.map((event: any) => ({ ...event, box: fullBoxes.find((b: any) => b.id === event.boxId) || null })),
    users: users.map(publicUser),
    loginUsers: users.map(publicUser),
    expiringItems,
    surveySummary,
    stats: buildStats(fullBoxes, events, expiringItems.length),
  };
}

async function buildDashboardData() {
  const data = await buildAppData(null);
  return { ...data, users: [] };
}

async function boxWithItems(id: string) {
  const box = await one("boxes", (q) => q.eq("id", id));
  if (!box) return null;
  const items = await listWhere("boxItems", "boxId", id, "sortOrder");
  return decorateBox(box, items);
}

function decorateBox(box: any, items: any[]) {
  return { ...box, items, qrUrl: `${appUrl()}?page=open&boxId=${box.id}&t=${box.qrToken}` };
}

async function recordOpenEvent(box: any, payload: any, user: any) {
  const now = new Date().toISOString();
  const event = await insert("openEvents", {
    id: crypto.randomUUID(),
    boxId: box.id,
    boxCode: box.boxCode,
    openedAt: now,
    openedBy: user ? (user.displayName || user.username) : "QR",
    department: payload.department || "",
    reason: payload.reason || "",
    itemsUsedJson: payload.itemsUsed || [],
    note: payload.note || "",
    hn: payload.hn || "",
  });
  await updateById("boxes", box.id, {
    status: "เปิดใช้งานแล้ว",
    openedAt: now,
    openedBy: event.openedBy,
    updatedAt: now,
  });
  return event;
}

async function settingsObject() {
  const rows = await list("settings", "key");
  return Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
}

async function getUserByToken(token: string, cleanup: boolean) {
  if (cleanup) await db.from("sessions").delete().lt("expiresAt", new Date().toISOString());
  const session = await one("sessions", (q) => q.eq("token", token).gt("expiresAt", new Date().toISOString()));
  if (!session) return null;
  return one("users", (q) => q.eq("id", session.userId).eq("active", true));
}

async function requireAuth(token: string) {
  const user = await getUserByToken(token, true);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  return user;
}

async function requireAdmin(token: string) {
  const user = await requireAuth(token);
  if (user.role !== "admin") throw new Error("ต้องเป็นผู้ดูแลระบบ");
  return user;
}

function publicUser(user: any) {
  if (!user) return null;
  const displayName = user.displayName || user.username;
  return {
    id: user.id,
    username: user.username,
    displayName,
    role: user.role,
    active: user.active,
    position: user.position || "",
    displayText: user.position ? `${displayName}, ${user.position}` : displayName,
  };
}

async function hashPassword(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${password}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function autoBoxStatus(box: any) {
  const items = box.items || [];
  if (items.some((item: any) => !item.expiryDate || Number(item.qty || 0) <= 0)) return "ไม่พร้อมใช้";
  return box.status === "เปิดใช้งานแล้ว" ? "เปิดใช้งานแล้ว" : "พร้อมใช้";
}

function getExpiringItemsFromRows(settings: any, boxes: any[]) {
  const days = Number(settings.EXPIRY_ALERT_DAYS || 90);
  const limit = Date.now() + days * 86400000;
  return boxes.flatMap((box: any) => (box.items || []).map((item: any) => {
    const exp = item.expiryDate ? new Date(item.expiryDate).getTime() : NaN;
    return Number.isFinite(exp) && exp <= limit ? {
      ...item,
      boxId: box.id,
      boxCode: box.boxCode,
      box,
      daysLeft: Math.ceil((exp - Date.now()) / 86400000),
    } : null;
  }).filter(Boolean));
}

async function getExpiringItems() {
  const data = await buildDashboardData();
  return data.expiringItems;
}

function buildStats(boxes: any[], events: any[], expiringCount: number) {
  const byStatus = boxes.reduce((acc: any, box: any) => {
    acc[box.status || "ไม่ระบุ"] = (acc[box.status || "ไม่ระบุ"] || 0) + 1;
    return acc;
  }, {});
  return {
    totalBoxes: boxes.length,
    readyBoxes: byStatus["พร้อมใช้"] || 0,
    openedBoxes: byStatus["เปิดใช้งานแล้ว"] || 0,
    expiringCount,
    totalOpenEvents: events.length,
    byStatus,
  };
}

function scoreDomains(scores: Record<string, number>) {
  const domainKeys: Record<string, string[]> = {
    usabilityScore: ["u1", "u2", "u3", "u4", "u5"],
    performanceScore: ["p1", "p2", "p3"],
    usefulnessScore: ["f1", "f2", "f3"],
    trustScore: ["t1", "t2", "t3"],
    acceptanceScore: ["a1", "a2", "a3"],
  };
  return Object.fromEntries(Object.entries(domainKeys).map(([key, keys]) => [
    key,
    average(keys.map((k) => Number(scores[k] || 0)).filter(Boolean)),
  ]));
}

async function buildSurveySummary() {
  const rows = await list("surveyResponses", "submittedAt");
  const avgKeys = ["usabilityScore", "performanceScore", "usefulnessScore", "trustScore", "acceptanceScore", "totalScore"];
  return {
    count: rows.length,
    averages: Object.fromEntries(avgKeys.map((key) => [key, average(rows.map((r: any) => Number(r[key] || 0)).filter(Boolean))])),
    professionCounts: countBy(rows, (r: any) => r.profession || r.professionOther || "ไม่ระบุ"),
    usageCounts: countBy(rows, (r: any) => r.usageFrequency || "ไม่ระบุ"),
  };
}

function average(values: any[]) {
  const nums = values.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : 0;
}

function countBy(rows: any[], fn: (row: any) => string) {
  return rows.reduce((acc: any, row) => {
    const key = fn(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function sendLineFlexMessage(message: any, overrideSettings?: any) {
  const settings = overrideSettings || await settingsObject();
  const token = settings.LINE_CHANNEL_ACCESS_TOKEN || "";
  const ids = String(settings.LINE_TO_ID || "").split(/\n|\|/).map((s) => s.trim()).filter(Boolean);
  if (!token || !ids.length) return { sent: 0, skipped: true };
  const results = [];
  for (const to of ids) {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ to, messages: [message.type ? message : { type: "text", text: String(message) }] }),
    });
    results.push({ to, status: res.status, body: await res.text() });
  }
  return { sent: results.filter((r) => r.status >= 200 && r.status < 300).length, results };
}

async function buildOpenBoxFlex(box: any, event: any) {
  return { type: "text", text: `เปิดกล่องยาฉุกเฉิน\nกล่อง: ${box.boxCode}\nHN: ${event.hn || "-"}\nเวลา: ${event.openedAt}` };
}

async function buildExpiryFlex(items: any[]) {
  const lines = items.slice(0, 20).map((i) => `${i.boxCode || i.box?.boxCode || "-"}: ${i.drugName} Lot ${i.lot || "-"} Exp ${i.expiryDate || "-"}`);
  return { type: "text", text: `รายงานยาใกล้หมดอายุ\n${lines.join("\n") || "ไม่พบรายการ"}` };
}

async function handleLineWebhook(payload: any) {
  let saved = 0;
  for (const event of payload.events || []) {
    const source = event.source || {};
    const recipientId = source.userId || source.groupId || source.roomId || "";
    if (!recipientId) continue;
    const active = !(event.type === "unfollow" || event.type === "leave");
    await db.from("lineRecipients").upsert({
      recipientId,
      sourceType: source.type || "",
      active,
      followedAt: active ? new Date().toISOString() : null,
      lastSeenAt: new Date().toISOString(),
      lastEventType: event.type || "",
    }, { onConflict: "recipientId" });
    saved += 1;
  }
  return { saved };
}

async function audit(user: any, action: string, detail: any) {
  await db.from("auditLogs").insert({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId: user?.id || null,
    username: user?.username || "",
    action,
    detailJson: detail || {},
  });
}

async function list(table: string, order = "id", ascending = true) {
  const { data, error } = await db.from(table).select("*").order(order, { ascending });
  if (error) throw error;
  return data || [];
}

async function listWhere(table: string, col: string, value: any, order = "id") {
  const { data, error } = await db.from(table).select("*").eq(col, value).order(order);
  if (error) throw error;
  return data || [];
}

async function one(table: string, filter: (q: any) => any) {
  const { data, error } = await filter(db.from(table).select("*")).maybeSingle();
  if (error) throw error;
  return data;
}

async function insert(table: string, row: any) {
  const { data, error } = await db.from(table).insert(row).select("*").single();
  if (error) throw error;
  return data;
}

async function updateById(table: string, id: string, row: any) {
  const { data, error } = await db.from(table).update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

async function replaceChildren(table: string, fk: string, id: string, rows: any[]) {
  const del = await db.from(table).delete().eq(fk, id);
  if (del.error) throw del.error;
  if (!rows.length) return [];
  const { data, error } = await db.from(table).insert(rows).select("*");
  if (error) throw error;
  return data || [];
}

function appUrl(path = "index.html") {
  if (!PUBLIC_SITE_URL) return "";
  return path === "index.html" ? `${PUBLIC_SITE_URL}/index.html` : `${PUBLIC_SITE_URL}/${path}`;
}
