/* =====================================================================
   SEB v2 — core: config, API, state, utils, shell, components
   ===================================================================== */
(function () {
  const Q = new URLSearchParams(location.search);
  const CFG = window.SEB_CONFIG || {};
  const SUPABASE_URL = window.SEB_SUPABASE_URL || CFG.supabaseUrl || "";
  const ANON = window.SEB_SUPABASE_ANON_KEY || CFG.anonKey || "";
  const API_URL = window.SEB_API_URL || (SUPABASE_URL ? SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/api" : "");
  const DEMO = Q.get("demo") === "1" || !API_URL || /YOUR_PROJECT/.test(API_URL);
  const IDLE_MS = 30 * 60 * 1000;
  // ธีมหน้าจอ (แยกตามเครื่อง): light = สว่างเสมอ (ค่าตั้งต้น) · auto = ตามโหมดของเครื่อง · dark = มืดเสมอ
  const getTheme = () => { try { return localStorage.getItem("seb_theme") || "light"; } catch (_) { return "light"; } };
  const applyTheme = () => {
    const t = getTheme();
    const dark = t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#111317" : "#d62839");
  };
  const setTheme = (t) => { try { localStorage.setItem("seb_theme", t); } catch (_) {} applyTheme(); };
  applyTheme();
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (_) {}
  // เลขรุ่นหน้าเว็บ — ต้องตรงกับ APP_VERSION ใน supabase/functions/api/index.ts และ VERSION ใน sw.js (ดู CHANGELOG.md)
  const APP_VERSION = "2.12.0";

  const S = {
    demo: DEMO,
    token: sessionStorage.getItem("seb_token") || "",
    user: null,
    data: null,
    view: "dashboard",
    param: "",
    research: null,
    logs: null,
    inspections: null,
    users: null,
    pendingCase: Q.get("case") || "",
    zone: "all",
    lastActivity: Date.now(),
    installPrompt: null,
  };

  // ---------------- API ----------------
  // โหมดจำลองบทบาท (ผู้ดูแลดูหน้าตาบทบาทอื่น): อ่านได้อย่างเดียว ห้ามบันทึก/แก้ไขใด ๆ
  const SIM_READ = new Set(["apiBootstrap", "apiRefresh", "apiGetEvent", "apiListInspections", "apiGetInspection", "apiListLogs", "apiMonthlyReport", "apiReport", "apiConsentStatus", "apiListConsents", "apiGetConsent", "apiLineQuota", "apiPublicGetBox", "apiPublicConfig", "apiHealth", "apiListAccountRequests", "apiResearchData", "apiLogout"]);
  async function api(name, ...args) {
    if (S.sim && !SIM_READ.has(name)) {
      const e = new Error(`โหมดจำลองบทบาท "${ROLE[S.sim] || S.sim}" ดูได้อย่างเดียว · กด "กลับเป็นผู้ดูแลระบบ" เพื่อบันทึกหรือแก้ไข`);
      e.sim = true;
      throw e;
    }
    const netErr = () => { const e = new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต"); e.network = true; return e; };
    if (DEMO) {
      if (window.SEB_FAKE_OFFLINE || navigator.onLine === false) { await new Promise((r) => setTimeout(r, 400)); throw netErr(); }
      return window.SEBMock.call(name, args);
    }
    let res;
    try {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 20000) : null;
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: ANON, authorization: ANON ? "Bearer " + ANON : "" },
        body: JSON.stringify({ action: name, args }),
        signal: ctl ? ctl.signal : undefined,
      });
      if (timer) clearTimeout(timer);
    } catch (e) {
      throw netErr();
    }
    const p = await res.json().catch(() => ({}));
    if (!res.ok || p.error) {
      const msg = String(p.error || "เกิดข้อผิดพลาด");
      if (msg.startsWith("SESSION_EXPIRED")) {
        App.forceLogout("หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่");
        throw new Error(msg.split(":").slice(1).join(":"));
      }
      throw new Error(msg);
    }
    return p.data;
  }

  // ---------------- utils ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, cls = "") => `<i class="ti ti-${n} ${cls}" aria-hidden="true"></i>`;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d2 = (n) => String(n).padStart(2, "0");
  function fmtD(v) { if (!v) return "–"; const d = new Date(String(v).length === 10 ? v + "T00:00:00" : v); if (isNaN(d)) return "–"; return `${d.getDate()} ${TH_M[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`; }
  function fmtT(v) { if (!v) return "–"; const d = new Date(v); return isNaN(d) ? "–" : `${d2(d.getHours())}:${d2(d.getMinutes())}`; }
  function fmtDT(v) { return v ? `${fmtD(v)} ${fmtT(v)}` : "–"; }
  function ago(v) {
    if (!v) return "";
    const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
    if (m < 1) return "เมื่อสักครู่";
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    return `${Math.round(h / 24)} วันที่แล้ว`;
  }
  function minutes(a, b) { if (!a || !b) return null; return (new Date(b) - new Date(a)) / 60000; }
  function fmtMin(m) {
    if (m === null || m === undefined || isNaN(m)) return "–";
    if (m < 60) return `${Math.round(m * 10) / 10} นาที`;
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return h >= 24 ? `${Math.round((h / 24) * 10) / 10} วัน` : `${h} ชม. ${r} น.`;
  }
  function localInput(v) { const d = v ? new Date(v) : new Date(); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}T${d2(d.getHours())}:${d2(d.getMinutes())}`; }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`; }
  function daysUntil(date) { if (!date) return NaN; const t = new Date(todayStr() + "T00:00:00"); return Math.round((new Date(String(date).slice(0, 10) + "T00:00:00") - t) / 86400000); }
  function initials(name) { const s = String(name || "?").replace(/^(ภก\.|ภญ\.|นาย|นาง|นางสาว|พว\.)\s*/, ""); return s.slice(0, 2).toUpperCase(); }
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const uid = () => Math.random().toString(36).slice(2, 10);
  function download(name, text, type = "text/csv;charset=utf-8") {
    const blob = new Blob([type.startsWith("text/csv") ? "﻿" + text : text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toCsv(rows) {
    if (!rows || !rows.length) return "";
    const cols = [...rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set())];
    const cell = (v) => { const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  }

  // ---------------- status helpers ----------------
  const BOX_STATE = {
    ready: ["พร้อมใช้", "ok"], opened: ["ถูกเปิดใช้", "danger live"], refilling: ["รอเติมยา", "warn"],
    not_ready: ["ไม่พร้อมใช้", "danger"], expired: ["มียาหมดอายุ", "danger"],
  };
  const CASE_STATE = {
    open: ["รอรับทราบ", "danger live"], acknowledged: ["รอเติมยา", "warn"], ready: ["พร้อมใช้แล้ว", "ok"], cancelled: ["ยกเลิก", ""],
  };
  const ROLE = { admin: "ผู้ดูแลระบบ", pharmacist: "เภสัชกร", technician: "จพ.เภสัชกรรม", nurse: "พยาบาลวิชาชีพ", viewer: "ดูอย่างเดียว (เดิม)" };
  const ROLE_PICK = [["admin", "ผู้ดูแลระบบ"], ["pharmacist", "เภสัชกร"], ["technician", "จพ.เภสัชกรรม"], ["nurse", "พยาบาลวิชาชีพ"]];
  const UNIT_TYPES = { ER: "ER", IPD: "IPD", LR: "LR", OPD: "OPD", EMS: "EMS", PCU: "รพ.สต.", other: "อื่น ๆ" };
  const REASONS = ["CPR", "Anaphylaxis", "Shock", "ภาวะฉุกเฉินอื่น", "เปิดแต่ยกเลิกการใช้", "ซ้อมแผน", "ตรวจสอบ/อื่น ๆ"];
  // รายการตัวเลือกที่ผู้ดูแลเพิ่ม/ลด/แก้ได้เอง (เก็บใน settings ทีละบรรทัด)
  const OPTION_LISTS = [
    { key: "OPT_OPEN_REASONS", icon: "urgent", title: "เหตุผลการเปิดใช้กล่อง", hint: "ปุ่มในหน้าสแกน QR และฟอร์มบันทึกการเปิดกล่อง", def: REASONS },
    { key: "OPT_CANCEL_REASONS", icon: "circle-x", title: "เหตุผลการยกเลิกเคส", hint: "ตอนกดยกเลิกเคส", def: ["สแกน/บันทึกผิดกล่อง", "บันทึกซ้ำ", "ทดสอบระบบ", "สแกนโดยไม่ได้เปิดกล่องจริง"] },
    { key: "OPT_TIME_EDIT_REASONS", icon: "clock-edit", title: "เหตุผลการแก้ไขเวลาเปิดใช้", hint: "ตอนแก้เวลาเปิดใช้จริงของเคส", def: ["บันทึกหลังช่วยชีวิตเสร็จ", "กรอกเวลาผิด", "บันทึกจากแบบฟอร์มกระดาษ"] },
    { key: "OPT_BOX_EDIT_REASONS", icon: "pencil", title: "เหตุผลการแก้ไขรายการยาในกล่อง", hint: "บันทึกลง audit log ทุกครั้งที่แก้รายการยา", def: ["เปลี่ยน lot ยาใกล้หมดอายุ", "เติมยาที่ขาด", "ปรับรายการตามชุดมาตรฐาน", "แก้ข้อมูลที่บันทึกผิด"] },
    { key: "OPT_QTY_MISMATCH_REASONS", icon: "alert-triangle", title: "เหตุผลเมื่อจำนวน/วันหมดอายุไม่ตรงมาตรฐาน", hint: "ถามก่อนบันทึก เมื่อมียาขาด เกิน หรือหมดอายุ", def: ["ยาในคลังไม่พอ รอเบิกเติม", "รอ lot ใหม่มาเปลี่ยน", "เติมเกินชั่วคราว จะเก็บคืนห้องยา", "ค่า \"ควรมี\" ยังไม่ได้ปรับตามชุดใหม่", "ใช้ยาไปแล้ว รอเติม"] },
    { key: "OPT_INSPECT_PROBLEMS", icon: "clipboard-check", title: "ปัญหาที่พบตอนตรวจกล่อง", hint: "ปุ่มลัดในฟอร์มตรวจประจำเดือน (เลือกได้หลายข้อ)", def: ["ยาขาด เติมแล้ว", "ยาหมดอายุ เปลี่ยนแล้ว", "ยาใกล้หมดอายุ แจ้งเปลี่ยน", "ซีลขาด/เลขไม่ตรง", "กล่องชำรุด"] },
    { key: "OPT_DRUG_NAMES", icon: "pill", title: "รายการยากลาง", hint: "ชื่อยาที่ใช้ในกล่องและชุดยามาตรฐาน · รูปแบบต่อบรรทัด: ชื่อยา | ความแรง | หน่วย (ความแรง/หน่วยไม่บังคับ) · เลือกแล้วกรอกความแรงและหน่วยให้อัตโนมัติ", def: [], importable: true },
    { key: "OPT_DRUG_UNITS", icon: "pill", title: "หน่วยยา", hint: "ตัวเลือกช่องหน่วยในรายการยาและชุดยามาตรฐาน", def: ["amp", "vial", "tab", "bottle", "syringe", "bag", "ชิ้น"] },
  ];
  const optList = (key, settings) => {
    const raw = (settings || S.data?.settings || {})[key];
    const def = OPTION_LISTS.find((o) => o.key === key)?.def || [];
    if (raw == null || !String(raw).trim()) return [...def];
    return String(raw).split("\n").map((x) => x.trim()).filter(Boolean);
  };
  // รายการยากลาง: ถ้าผู้ดูแลยังไม่ได้ตั้ง ใช้ชื่อยาจากชุดยามาตรฐาน + กล่องที่มีอยู่
  const drugsFromData = () => {
    const d = S.data || {}, seen = new Map();
    const add = (n, st, u) => { n = String(n || "").trim(); if (!n) return; const k = (n + "|" + (st || "")).toLowerCase(); if (!seen.has(k)) seen.set(k, [n, st || "", u || ""].join(" | ").replace(/( \| )+$/, "")); };
    (d.kits || []).forEach((k) => (k.items || []).forEach((i) => add(i.drugName, i.strength, i.unit)));
    (d.boxes || []).forEach((b) => (b.items || []).forEach((i) => add(i.drugName, i.strength, i.unit)));
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  };
  const drugMaster = () => {
    const raw = S.data?.settings?.OPT_DRUG_NAMES;
    const lines = raw && String(raw).trim() ? optList("OPT_DRUG_NAMES") : drugsFromData();
    return lines.map((l) => { const [name, strength = "", unit = ""] = l.split("|").map((x) => x.trim()); return { name, strength, unit, label: l }; }).filter((x) => x.name);
  };
  const drugKnown = (name) => { const n = String(name || "").trim().toLowerCase(); return !n || drugMaster().some((d) => d.name.toLowerCase() === n); };
  // datalist กลางสำหรับช่องหน่วยยาและชื่อยา
  const syncLists = () => {
    const ensure = (id) => { let dl = document.getElementById(id); if (!dl) { dl = document.createElement("datalist"); dl.id = id; document.body.appendChild(dl); } return dl; };
    ensure("unitList").innerHTML = optList("OPT_DRUG_UNITS").map((u) => `<option value="${esc(u)}">`).join("");
    const names = [...new Set(drugMaster().map((d) => d.name))];
    ensure("drugList").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
  };
  // เมื่อเลือกชื่อยาจากรายการกลาง: เติมความแรง/หน่วยถ้ายังว่าง และเตือนถ้าไม่อยู่ในรายการ
  const drugPicked = (inp) => {
    const tr = inp.closest("tr");
    const v = inp.value.trim();
    const hits = drugMaster().filter((d) => d.name.toLowerCase() === v.toLowerCase());
    inp.classList.toggle("warn-in", !!v && !hits.length);
    inp.title = v && !hits.length ? "ไม่อยู่ในรายการยากลาง ตรวจการสะกด หรือให้ผู้ดูแลเพิ่มในรายการ" : "";
    if (hits.length === 1 && tr) {
      const st = tr.querySelector('[data-f="strength"],[data-g="strength"]'), un = tr.querySelector('[data-f="unit"],[data-g="unit"]');
      if (st && !st.value && hits[0].strength) st.value = hits[0].strength;
      if (un && !un.value && hits[0].unit) un.value = hits[0].unit;
    }
  };
  const boxPill = (b) => { const [t, c] = BOX_STATE[b.state] || ["–", ""]; return `<span class="pill ${c}">${t}</span>`; };
  const casePill = (e) => { const [t, c] = CASE_STATE[e.caseStatus] || ["–", ""]; return `<span class="pill ${c}">${t}</span>`; };
  const expPill = (date, nearDays) => {
    const d = daysUntil(date);
    if (!date) return `<span class="pill">ไม่ระบุ</span>`;
    if (d < 0) return `<span class="pill danger">${fmtDLong(date)} · หมดอายุ</span>`;
    if (d <= nearDays) return `<span class="pill warn">${fmtDLong(date)} · ${d} วัน</span>`;
    return `<span class="pill ok plain">${fmtDLong(date)}</span>`;
  };
  const nearDays = () => Number(S.data?.settings?.NEAR_EXPIRY_DAYS || 30);
  const isStaff = () => S.user && ["admin", "pharmacist", "technician"].includes(S.user.role);
  const canRecord = () => S.user && ["admin", "pharmacist", "technician", "nurse"].includes(S.user.role);
  const isAdmin = () => S.user && S.user.role === "admin";
  const isRealAdmin = () => (S.realUser || S.user)?.role === "admin";
  const withSim = (u) => { if (!u) return u; if (S.sim && u.role === "admin") { S.realUser = u; return { ...u, role: S.sim }; } S.sim = null; S.realUser = null; return u; };

  // ---------------- logo ----------------
  const LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7"/><path d="M12 10.5v6M9 13.5h6"/></svg>`;
  // ตราสัญลักษณ์โรงพยาบาล (เปลี่ยนรูปได้ที่ public/icons/hospital-logo-96.png และ -256.png)
  const HOSP_LOGO = window.SEB_HOSP_LOGO || "./icons/hospital-logo-96.png";
  const hospLogoAbs = () => window.SEB_HOSP_LOGO || new URL("./icons/hospital-logo-256.png", location.href).href;
  // โลโก้ระบบ: กล่องยาสีแดง + ตรา รพ. ด้านหน้า (เปลี่ยนรูปได้ที่ public/icons/seb-logo-96.png / -256.png)
  const SEB_LOGO = window.SEB_LOGO_IMG || "./icons/seb-logo-256.png";
  const LOGO_B = `<img class="brand-img" src="${SEB_LOGO}" alt="Smart Emergency Box" onerror="this.outerHTML=window.SEB.LOGO">`;

  // ---------------- toast / dialogs / drawer ----------------
  function toast(msg, isErr) {
    let wrap = $(".toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toasts"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast" + (isErr ? " err" : "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, isErr ? 4200 : 2600);
  }
  const fail = (e) => toast(e?.message || String(e), true);

  function dialog({ title, body = "", confirm = "ยืนยัน", cancel = "ยกเลิก", danger = false, input = null }) {
    return new Promise((resolve) => {
      const ov = document.createElement("div");
      ov.className = "overlay dialog-overlay";
      const dl = document.createElement("div");
      dl.className = "dialog";
      const ch = input?.choices || [];
      dl.innerHTML = `<h3>${esc(title)}</h3>${body ? `<div class="muted mt-8" style="white-space:pre-line">${body}</div>` : ""}
        ${ch.length ? `<div class="chips dlg-chips mt-16">${ch.map((c, i) => `<button type="button" class="chip" data-c="${i}">${esc(c)}</button>`).join("")}</div>` : ""}
        ${input ? `<div class="field ${ch.length ? "mt-12" : "mt-16"}">${ch.length ? `<span>หรือพิมพ์เอง</span>` : ""}${input.label ? `<span>${esc(input.label)}</span>` : ""}${input.type === "textarea" ? `<textarea class="input" id="dlgInput" placeholder="${esc(input.placeholder || "")}"></textarea>` : (input.type === "datetime-local" ? dtSel('id="dlgInput"', input.value || "", { max: true }) : `<input class="input" id="dlgInput" type="${input.type || "text"}" placeholder="${esc(input.placeholder || "")}" value="${esc(input.value || "")}">`)}</div>` : ""}
        <div class="row mt-24" style="justify-content:flex-end"><button class="btn ghost" data-r="0">${esc(cancel)}</button><button class="btn ${danger ? "danger" : "primary"}" data-r="1">${esc(confirm)}</button></div>`;
      const close = (r) => { ov.remove(); dl.remove(); resolve(r); };
      dl.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
        const inp = dl.querySelector("#dlgInput"); inp.value = ch[+b.dataset.c]; inp.classList.remove("err");
        dl.querySelectorAll("[data-c]").forEach((x) => x.classList.toggle("on", x === b));
      }));
      ov.onclick = () => close(input ? null : false);
      dl.querySelector('[data-r="0"]').onclick = () => close(input ? null : false);
      dl.querySelector('[data-r="1"]').onclick = () => {
        if (input) { const v = $("#dlgInput").value.trim(); if (input.required && !v) { $("#dlgInput").classList.add("err"); return; } close(v); } else close(true);
      };
      document.body.append(ov, dl);
      if (!ch.length) setTimeout(() => ($("#dlgInput") || dl.querySelector('[data-r="1"]')).focus(), 30);
    });
  }

  function drawer(title, body, foot = "", opts = {}) {
    closeDrawer();
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.id = "drawerOverlay";
    ov.onclick = closeDrawer;
    const dr = document.createElement("div");
    dr.className = "drawer" + (opts.wide ? " wide" : "");
    dr.id = "drawer";
    dr.innerHTML = `<div class="drawer-head"><div class="grow"><h2>${title}</h2>${opts.sub ? `<div class="small muted">${opts.sub}</div>` : ""}</div><button class="btn ghost icon" onclick="App.closeDrawer()" aria-label="ปิด">${ic("x")}</button></div>
      <div class="drawer-body" id="drawerBody">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ""}`;
    document.body.append(ov, dr);
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() { $("#drawerOverlay")?.remove(); $("#drawer")?.remove(); document.body.style.overflow = ""; }

  // ---------------- components ----------------
  const kpi = (label, value, icon, tone, foot = "", unit = "") =>
    `<div class="card kpi tone-${tone}"><div class="kpi-top"><span class="kpi-icon ic-${tone}">${ic(icon)}</span>${esc(label)}</div>
     <div class="kpi-value">${value}${unit ? `<small>${unit}</small>` : ""}</div>${foot ? `<div class="kpi-foot">${foot}</div>` : ""}</div>`;
  const empty = (text, icon = "inbox") => `<div class="empty">${ic(icon)}${esc(text)}</div>`;
  const field = (label, inner, hint = "", cls = "") => `<label class="field ${cls}"><span>${label}${hint ? ` <span class="hint">${hint}</span>` : ""}</span>${inner}</label>`;
  const opt = (list, sel) => list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel ?? "") ? "selected" : ""}>${esc(t)}</option>`).join("");

  // ---------------- shell ----------------
  const NAV = [
    { id: "dashboard", color: "#e11d48", label: "ภาพรวม", icon: "layout-dashboard" },
    { id: "cases", color: "#ea580c", label: "เคสเปิดกล่อง", icon: "urgent", badge: () => S.data?.stats?.pendingCases || 0 },
    { id: "boxes", color: "#0e9f6e", label: "กล่องยา", icon: "first-aid-kit" },
    { id: "inspections", color: "#2563eb", label: "ตรวจประจำเดือน", icon: "clipboard-check" },
    { id: "stats", color: "#7c3aed", label: "สถิติ", icon: "chart-bar" },
    { sep: "ข้อมูลหลัก" },
    { id: "kits", color: "#7c3aed", label: "ชุดยามาตรฐาน", icon: "pill" },
    { id: "locations", color: "#0891b2", label: "จุดวางกล่อง", icon: "map-pin" },
    { sep: "ติดตามผล", staff: true },
    { id: "research", color: "#c026d3", label: "งานวิจัย", icon: "microscope", admin: true },
    { id: "logs", color: "#64748b", label: "ประวัติการใช้งาน", icon: "history", staff: true },
    { id: "consent", color: "#0e9f6e", label: "เอกสารยินยอมวิจัย", icon: "file-certificate", when: () => S.data?.settings?.ECONSENT_ENABLED === "1" && !isAdmin() },
    { id: "consentAdmin", color: "#0e9f6e", label: "รับเอกสารยินยอม", icon: "file-certificate", when: () => S.data?.settings?.ECONSENT_ENABLED === "1" && !!S.user?.consentOfficer && !isAdmin() },
    { sep: "ระบบ", admin: true },
    { id: "users", color: "#d97706", label: "ผู้ใช้งาน", icon: "users", admin: true, badge: () => S.data?.pendingRequests || 0 },
    { id: "settings", color: "#475569", label: "ตั้งค่า", icon: "settings" },
  ];
  const TABS = [
    { id: "dashboard", color: "#e11d48", label: "ภาพรวม", icon: "layout-dashboard" },
    { id: "cases", color: "#ea580c", label: "เคส", icon: "urgent" },
    { id: "boxes", color: "#0e9f6e", label: "กล่องยา", icon: "first-aid-kit" },
    { id: "inspections", color: "#2563eb", label: "ตรวจ", icon: "clipboard-check" },
    { id: "more", color: "#7c3aed", label: "เมนู", icon: "menu-2" },
  ];
  const TITLES = {
    dashboard: "ภาพรวม", cases: "เคสเปิดกล่อง", case: "รายละเอียดเคส", boxes: "กล่องยา", box: "กล่องยา",
    inspections: "ตรวจประจำเดือน", inspect: "ตรวจกล่องยา", kits: "ชุดยามาตรฐาน", locations: "จุดวางกล่อง",
    research: "งานวิจัย", stats: "สถิติ", consent: "เอกสารยินยอมวิจัย", consentAdmin: "รับเอกสารยินยอม", logs: "ประวัติการใช้งาน", users: "ผู้ใช้งาน", settings: "ตั้งค่า", more: "เมนู",
  };

  function renderShell() {
    const root = $("#app");
    const u = S.user;
    const s = S.data?.settings || {};
    root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">${LOGO_B}</div><div><div class="brand-name">Smart Emergency Box</div><div class="brand-sub">${esc(s.HOSPITAL_NAME || "โรงพยาบาลลานสัก")}</div></div></div>
        <nav id="nav"></nav>
        <div class="sidebar-foot">
          <div class="user-chip"><div class="avatar">${esc(initials(u.displayName))}</div><div class="grow" style="min-width:0"><div class="small" style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.displayName)}</div><div class="xs faint">${esc(ROLE[u.role] || u.role)}</div></div>
          ${isRealAdmin() ? `<button class="btn ghost sm icon" title="ดูในมุมมองบทบาทอื่น" onclick="App.pickSimRole()">${ic("eye")}</button>` : ""}<button class="btn ghost sm icon" title="ออกจากระบบ" onclick="App.logout()">${ic("logout")}</button></div>
          <div class="credit">พัฒนาโดย ${esc(s.APP_CREDIT_TEXT || "ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ")} · v${APP_VERSION}</div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar" id="topbar">
          <div class="grow" style="min-width:0"><div class="crumb mobile-only">${esc(s.HOSPITAL_NAME || "")}</div><h1 id="pageTitle"></h1></div>
          <div class="row" id="pageActions"></div>
          <button class="btn ghost icon" id="bellBtn" onclick="App.go('settings','device')" title="การแจ้งเตือนเครื่องนี้">${ic("bell")}</button>
        </header>
        <main class="content" id="content"></main>
      </div>
    </div>
    <nav class="tabbar" id="tabbar"></nav>
    ${S.demo ? `<div class="demo-ribbon">โหมดตัวอย่าง · ข้อมูลจำลอง</div>` : ""}
    ${S.sim ? `<div class="sim-bar">${ic("eye")}<span>กำลังดูในบทบาท <b>${esc(ROLE[S.sim] || S.sim)}</b> · ดูได้อย่างเดียว</span><button class="btn sm" onclick="App.pickSimRole()">เปลี่ยนบทบาท</button><button class="btn sm primary" onclick="App.endSim()">กลับเป็นผู้ดูแลระบบ</button></div>` : ""}`;
    window.addEventListener("scroll", () => $("#topbar")?.classList.toggle("scrolled", window.scrollY > 4), { passive: true });
    renderNav();
    App.updateBell();
  }

  function renderNav() {
    const nav = $("#nav");
    if (!nav) return;
    const items = NAV.filter((n) => (!n.admin || isAdmin()) && (!n.staff || isStaff()) && (!n.when || n.when()));
    nav.innerHTML = items.map((n) => n.sep ? `<div class="nav-label">${n.sep}</div>` :
      `<button class="nav-item ${S.view === n.id || (S.view === "case" && n.id === "cases") || (S.view === "box" && n.id === "boxes") || (S.view === "inspect" && n.id === "inspections") ? "active" : ""}" onclick="App.go('${n.id}')" style="--nc:${n.color || "currentColor"}">${ic(n.icon)}<span>${n.label}</span>${n.badge && n.badge() ? `<span class="count">${n.badge()}</span>` : ""}</button>`).join("");
    const pend = S.data?.stats?.pendingCases || 0;
    const tb = $("#tabbar");
    if (tb) tb.innerHTML = TABS.map((t) => `<button class="tab ${S.view === t.id || (t.id === "cases" && S.view === "case") || (t.id === "boxes" && S.view === "box") || (t.id === "inspections" && S.view === "inspect") ? "active" : ""}" onclick="App.go('${t.id}')" style="--nc:${t.color}">${ic(t.icon)}<span>${t.label}</span>${t.id === "cases" && pend ? `<span class="dot"></span>` : ""}</button>`).join("");
  }

  function setTitle(t, actions = "") {
    $("#pageTitle").textContent = t;
    $("#pageActions").innerHTML = actions;
    document.title = `${t} · SEB`;
  }

  // ---------------- ช่องเลือกวันที่: กรอกเป็น ค.ศ. + เดือนมีเลขกำกับ, แสดงผลเป็น พ.ศ. ----------------
  // เก็บค่าจริงใน <input type="hidden" ...attrs> รูปแบบ YYYY-MM-DD เพื่อให้โค้ดเดิมอ่าน .value ได้เหมือนเดิม
  const EN_M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateSel(attrs, iso, onch) {
    const v = /^\d{4}-\d{2}-\d{2}/.test(String(iso || "")) ? String(iso).slice(0, 10) : "";
    const dd = daysUntil(v), st = !v ? "" : dd < 0 ? "exp" : dd <= nearDays() ? "near" : "";
    return `<span class="dsel dpick" data-st="${st}"><input type="hidden" ${attrs} value="${v}">
      <button type="button" class="input sm dpick-btn" data-onch="${esc(onch || "")}" title="${v ? "พ.ศ. " + fmtDLong(v) : ""}" onclick="SEB.datePick(this)"><span class="dpick-v">${v ? fmtCE(v) : `<span class="faint">วว/ดด/ปปปป</span>`}</span>${ic("calendar")}</button>
      <small class="dsel-th">${v ? "พ.ศ. " + fmtDLong(v) : ""}</small></span>`;
  }
  // ช่องวันเวลา (เปิดใช้กล่อง ฯลฯ): เลือกเป็น พ.ศ. + เวลา · เก็บใน hidden เป็น YYYY-MM-DDTHH:MM (เวลาเครื่อง) เหมือน datetime-local เดิม
  const fmtBEdt = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || "")); return m ? `${m[3]}/${m[2]}/${+m[1] + 543} ${m[4]}:${m[5]} น.` : ""; };
  function dtSel(attrs, value, opts = {}) {
    const v = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || "")) ? String(value).slice(0, 16) : "";
    return `<span class="dsel dpick dt" data-max="${opts.max ? "now" : ""}"><input type="hidden" ${attrs} value="${v}">
      <button type="button" class="input dpick-btn" data-onch="${esc(opts.onch || "")}" data-mode="dt" onclick="SEB.datePick(this)"><span class="dpick-v">${v ? fmtBEdt(v) : `<span class="faint">วว/ดด/ปปปป (พ.ศ.) ชช:นน</span>`}</span>${ic("calendar")}</button></span>`;
  }
  const fmtCE = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // ปฏิทินแบบแผ่นล่าง: เดือน "Nov (11)" · ปี ค.ศ. · แตะวันเพื่อเลือก
  let DP = null;
  function datePick(btn) {
    const w = btn.closest(".dpick"); if (!w) return;
    const v = w.querySelector('input[type="hidden"]').value;
    const dt = btn.dataset.mode === "dt";
    const base = v ? new Date(dt ? v : v + "T00:00:00") : new Date();
    const now = localInput();
    DP = { w, btn, dt, y: base.getFullYear(), m: base.getMonth() + 1, sel: dt ? (v || now).slice(0, 10) : v, h: (v || now).slice(11, 13) || "00", mi: (v || now).slice(14, 16) || "00" };
    document.querySelector(".dp-back")?.remove();
    const el = document.createElement("div");
    el.className = "dp-back";
    el.addEventListener("click", (e) => { if (e.target === el) dpClose(); });
    document.body.append(el);
    dpRender();
  }
  function dpRender() {
    const el = document.querySelector(".dp-back"); if (!el || !DP) return;
    const { y, m } = DP;
    const cur = DP.dt ? DP.sel : DP.w.querySelector('input[type="hidden"]').value;
    const be = DP.dt, maxDay = DP.dt && DP.w.dataset.max === "now" ? todayStr() : "";
    const today = todayStr();
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate(), prevDays = new Date(y, m - 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const n = i - first + 1;
      let yy = y, mm = m, d = n, out = false;
      if (n < 1) { mm = m - 1; d = prevDays + n; out = true; } else if (n > days) { mm = m + 1; d = n - days; out = true; }
      if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; }
      const val = iso(yy, mm, d);
      if (i >= 35 && n > days && i % 7 === 0) break;             // ไม่แสดงแถวที่ 6 ถ้าเป็นเดือนถัดไปทั้งแถว
      const dis = maxDay && val > maxDay;
      cells.push(`<button type="button" class="dp-d${out ? " out" : ""}${val === cur ? " sel" : ""}${val === today ? " today" : ""}${i % 7 === 0 ? " sun" : ""}"${dis ? " disabled" : ""} onclick="SEB.dpSet('${val}')">${d}</button>`);
    }
    const Y = new Date().getFullYear();
    const ys = []; for (let i = Math.min(Y - 5, y); i <= Math.max(Y + 15, y); i++) ys.push(i);
    el.innerHTML = `<div class="dp-sheet" role="dialog" aria-label="เลือกวันที่"><div class="dp-grab"></div>
      <div class="dp-nav"><button type="button" class="btn icon" onclick="SEB.dpMove(-1)" title="เดือนก่อน">${ic("chevron-left")}</button>
        <select class="input" onchange="SEB.dpMove(0,+this.value)">${EN_M.map((n, i) => `<option value="${i + 1}"${i + 1 === m ? " selected" : ""}>${n} (${i + 1})</option>`).join("")}</select>
        <select class="input dp-y" onchange="SEB.dpMove(0,0,+this.value)">${ys.map((x) => `<option value="${x}"${x === y ? " selected" : ""}>${be ? x + 543 : x}</option>`).join("")}</select>
        <button type="button" class="btn icon" onclick="SEB.dpMove(1)" title="เดือนถัดไป">${ic("chevron-right")}</button></div>
      <div class="dp-title">${be ? `<b>${EN_M[m - 1]} (${m}) ${y + 543}</b><span class="faint"> · พ.ศ.</span>` : `<b>${EN_M[m - 1]} (${m}) ${y}</b><span class="faint"> · ค.ศ. (พ.ศ. ${y + 543})</span>`}</div>
      <div class="dp-grid">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => `<span class="dp-w${i === 0 ? " sun" : ""}">${d}</span>`).join("")}${cells.join("")}</div>
      ${be ? `<div class="dp-time"><span>เวลา</span><select class="input" onchange="SEB.dpTime('h',this.value)">${Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((x) => `<option${x === DP.h ? " selected" : ""}>${x}</option>`).join("")}</select><b>:</b><select class="input" onchange="SEB.dpTime('mi',this.value)">${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((x) => `<option${x === DP.mi ? " selected" : ""}>${x}</option>`).join("")}</select><span class="faint">น.</span></div>
      <div class="dp-sum">${DP.sel ? fmtBEdt(`${DP.sel}T${DP.h}:${DP.mi}`) : "ยังไม่ได้เลือกวัน"}</div>
      <div class="dp-foot"><button type="button" class="btn" onclick="SEB.dpNow()">ตอนนี้ · Now</button><button type="button" class="btn" onclick="SEB.dpClose()">ยกเลิก</button><button type="button" class="btn primary" onclick="SEB.dpOk()">ตกลง</button></div>
      <div class="dp-note">วันที่แสดงเป็น พ.ศ.</div></div>` : `
      <div class="dp-foot"><button type="button" class="btn" onclick="SEB.dpSet('${today}')">วันนี้ · Today</button><button type="button" class="btn" onclick="SEB.dpSet('')">ล้าง</button><button type="button" class="btn" onclick="SEB.dpClose()">ปิด</button></div>
      <div class="dp-note">เลือก/กรอกเป็น ค.ศ. · ระบบแสดงผลเป็น พ.ศ.</div></div>`}`;
  }
  function dpMove(step, month, year) {
    if (!DP) return;
    if (month) DP.m = month;
    if (year) DP.y = year;
    if (step) { DP.m += step; if (DP.m < 1) { DP.m = 12; DP.y--; } if (DP.m > 12) { DP.m = 1; DP.y++; } }
    dpRender();
  }
  function dpTime(k, v) { if (DP) { DP[k] = v; const el = document.querySelector(".dp-sum"); if (el && DP.sel) el.textContent = fmtBEdt(`${DP.sel}T${DP.h}:${DP.mi}`); } }
  function dpNow() { if (!DP) return; const n = localInput(); DP.sel = n.slice(0, 10); DP.h = n.slice(11, 13); DP.mi = n.slice(14, 16); DP.y = +n.slice(0, 4); DP.m = +n.slice(5, 7); dpRender(); }
  function dpOk() {
    if (!DP || !DP.sel) return;
    let v = `${DP.sel}T${DP.h}:${DP.mi}`;
    if (DP.w.dataset.max === "now" && v > localInput()) { v = localInput(); toast("เวลาเปิดใช้ต้องไม่เกินเวลาปัจจุบัน ปรับเป็นตอนนี้ให้แล้ว"); }
    const { w, btn } = DP;
    const hid = w.querySelector('input[type="hidden"]');
    hid.value = v;
    w.querySelector(".dpick-v").textContent = fmtBEdt(v);
    dpClose();
    const f = btn.dataset.onch;
    if (f) { try { new Function(f).call(hid); } catch (e) { console.error(e); } }
  }
  function dpSet(v) {
    if (!DP) return;
    if (DP.dt) { if (v) { DP.sel = v; DP.y = +v.slice(0, 4); DP.m = +v.slice(5, 7); } dpRender(); return; }
    const { w, btn } = DP;
    const hid = w.querySelector('input[type="hidden"]');
    hid.value = v;
    w.querySelector(".dpick-v").innerHTML = v ? fmtCE(v) : `<span class="faint">วว/ดด/ปปปป</span>`;
    w.querySelector(".dsel-th").textContent = v ? "พ.ศ. " + fmtDLong(v) : "";
    btn.title = v ? "พ.ศ. " + fmtDLong(v) : "";
    const dd = daysUntil(v);
    w.dataset.st = !v ? "" : dd < 0 ? "exp" : dd <= nearDays() ? "near" : "";
    dpClose();
    const f = btn.dataset.onch;
    if (f) { try { new Function(f).call(hid); } catch (e) { console.error(e); } }
  }
  function dpClose() { document.querySelector(".dp-back")?.remove(); DP = null; }
  function dateSync() {}
  function fmtDLong(v) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? `${m[3]}/${m[2]}/${+m[1] + 543}` : ""; }


  // ---------------- export ----------------
  window.SEB = {
    S, api, DEMO, IDLE_MS, Q, dateSel, dateSync, fmtDLong, fmtCE, datePick, dpMove, dpSet, dpClose, dtSel, dpTime, dpNow, dpOk, fmtBEdt,
    APP_VERSION, getTheme, setTheme, esc, ic, $, $$, val, fmtD, fmtT, fmtDT, ago, minutes, fmtMin, localInput, todayStr, daysUntil, initials, sum, uid, download, toCsv,
    BOX_STATE, CASE_STATE, ROLE, ROLE_PICK, UNIT_TYPES, REASONS, OPTION_LISTS, optList, syncLists, drugMaster, drugsFromData, drugKnown, drugPicked, LOGO_B, HOSP_LOGO, hospLogoAbs, boxPill, casePill, expPill, nearDays, isStaff, canRecord, isAdmin, isRealAdmin, withSim, LOGO,
    toast, fail, dialog, drawer, closeDrawer, kpi, empty, field, opt, renderShell, renderNav, setTitle, TITLES,
  };
})();
