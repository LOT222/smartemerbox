/* =====================================================================
   SEB v2 — research page (ตัวชี้วัดตามโครงร่างวิจัย ตาราง 1–2)
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, api, esc, ic, $, $$, val, fmtD, fmtT, fmtDT, minutes, fmtMin, localInput, download, toCsv, isStaff, isAdmin, toast, fail, dialog, drawer, closeDrawer, kpi, empty, field, opt, setTitle, REASONS, optList } = X;
  const App = window.App;

  // ---------------- statistics ----------------
  const St = {
    sorted: (a) => [...a].sort((x, y) => x - y),
    q(s, p) { if (!s.length) return null; const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]); },
    describe(a) { const s = St.sorted(a); return { n: s.length, med: St.q(s, 0.5), q1: St.q(s, 0.25), q3: St.q(s, 0.75), min: s[0], max: s[s.length - 1] }; },
    mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; },
    sd(a) { if (a.length < 2) return null; const m = St.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); },
    rng(seed) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; },
    bootDiff(a, b, B = 2000) { // median(b) - median(a), percentile CI
      if (a.length < 2 || b.length < 2) return null;
      const r = St.rng(20261112), diffs = [];
      const med = (arr) => St.q(St.sorted(arr), 0.5);
      for (let i = 0; i < B; i++) {
        const ra = Array.from(a, () => a[Math.floor(r() * a.length)]);
        const rb = Array.from(b, () => b[Math.floor(r() * b.length)]);
        diffs.push(med(rb) - med(ra));
      }
      const s = St.sorted(diffs);
      return { est: med(b) - med(a), lo: St.q(s, 0.025), hi: St.q(s, 0.975) };
    },
    normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp((-z * z) / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; },
    mannWhitney(a, b) {
      const n1 = a.length, n2 = b.length;
      if (n1 < 2 || n2 < 2) return null;
      const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
      let i = 0, tie = 0;
      while (i < all.length) { let j = i; while (j + 1 < all.length && all[j + 1].v === all[i].v) j++; const r = (i + j + 2) / 2; for (let k = i; k <= j; k++) all[k].r = r; const t = j - i + 1; tie += t ** 3 - t; i = j + 1; }
      const R1 = all.filter((x) => x.g === 0).reduce((s, x) => s + x.r, 0);
      const U1 = R1 - (n1 * (n1 + 1)) / 2, U = Math.min(U1, n1 * n2 - U1), N = n1 + n2;
      const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
      const z = sigma ? (U - (n1 * n2) / 2 + 0.5) / sigma : 0;
      return { U, z, p: Math.min(1, 2 * St.normCdf(-Math.abs(z))) };
    },
    lnFact: (() => { const c = [0]; return (n) => { for (let i = c.length; i <= n; i++) c[i] = c[i - 1] + Math.log(i); return c[n]; }; })(),
    binomCdf(x, n, p) { if (x < 0) return 0; if (x >= n) return 1; let s = 0; for (let k = 0; k <= x; k++) s += Math.exp(St.lnFact(n) - St.lnFact(k) - St.lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p)); return Math.min(1, s); },
    exactCI(x, n) { // Clopper–Pearson
      if (!n) return null;
      const bis = (f) => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; } return (lo + hi) / 2; };
      const lo = x === 0 ? 0 : bis((p) => 1 - St.binomCdf(x - 1, n, p) >= 0.025);
      const hi = x === n ? 1 : bis((p) => St.binomCdf(x, n, p) <= 0.025);
      return { p: x / n, lo, hi };
    },
    fisher(a, b, c, d) {
      const n = a + b + c + d, r1 = a + b, c1 = a + c;
      if (!n) return null;
      const lp = (x) => St.lnFact(r1) + St.lnFact(n - r1) + St.lnFact(c1) + St.lnFact(n - c1) - St.lnFact(n) - St.lnFact(x) - St.lnFact(r1 - x) - St.lnFact(c1 - x) - St.lnFact(n - r1 - c1 + x);
      const obs = lp(a);
      let p = 0;
      for (let x = Math.max(0, r1 + c1 - n); x <= Math.min(r1, c1); x++) { const v = lp(x); if (v <= obs + 1e-7) p += Math.exp(v); }
      return Math.min(1, p);
    },
  };
  App.Stats = St;
  const r1 = (x) => (x === null || x === undefined || isNaN(x) ? "–" : (Math.round(x * 10) / 10).toLocaleString("th-TH"));
  const pct = (x) => (x === null || x === undefined || isNaN(x) ? "–" : `${(Math.round(x * 1000) / 10).toFixed(1)}%`);
  const pfmt = (p) => (p === null || p === undefined ? "–" : p < 0.001 ? "< 0.001" : p.toFixed(3));

  // ---------------- period helpers ----------------
  function effPeriod(e, s) {
    if (e.period) return e.period;
    if (e.source === "paper") return "baseline_prosp";
    const day = String(e.actualOpenedAt || e.inspectedAt || "").slice(0, 10);
    const inR = (a, b) => a && day >= a && (!b || day <= b);
    if (inR(s.STUDY_PILOT_START, s.STUDY_PILOT_END)) return "pilot";
    if (inR(s.STUDY_POST_START, s.STUDY_POST_END)) return "post";
    return "other";
  }

  function compute(R, onlyStudy) {
    const s = R.settings;
    const locIn = new Set(R.locations.filter((l) => l.inStudy).map((l) => l.id));
    const keep = (x) => !onlyStudy || locIn.has(x.locationId);
    const ev = R.events.filter((e) => e.caseStatus !== "cancelled" && keep(e)).map((e) => ({ ...e, P: effPeriod(e, s) }));
    const ins = R.inspections.filter(keep).map((i) => ({ ...i, P: i.period || effPeriod(i, s) }));
    const base = R.baseline.filter((b) => !onlyStudy || !b.locationId || locIn.has(b.locationId));
    const isBase = (P) => P === "baseline_prosp" || P === "baseline_retro";
    const outl = (x) => x !== null && x >= 0 && x <= 1440;

    // 1) Response time
    const respBase = ev.filter((e) => e.source === "paper").map((e) => minutes(e.unitNotifiedAt, e.acknowledgedAt));
    const respPostAll = ev.filter((e) => e.P === "post" && e.source !== "paper");
    const respPost = respPostAll.filter((e) => e.notificationStatus === "sent").map((e) => minutes(e.notificationSentAt, e.acknowledgedAt));
    const failed = respPostAll.filter((e) => e.notificationStatus === "failed" || e.notificationStatus === "skipped").length;
    const legacy = respPostAll.filter((e) => e.notificationStatus === "legacy_unknown").length;
    const rb = respBase.filter(outl), rp = respPost.filter(outl);
    // 2) Readiness
    const rdBase = ev.filter((e) => e.source === "paper").map((e) => minutes(e.actualOpenedAt, e.readyAt)).filter(outl);
    const rdPostEv = ev.filter((e) => e.P === "post" && e.source !== "paper");
    const rdPost = rdPostEv.filter((e) => !e.readyEstimated).map((e) => minutes(e.actualOpenedAt, e.readyAt)).filter(outl);
    const rdEst = rdPostEv.filter((e) => e.readyEstimated).length;
    // 3) Completeness (record level)
    const recBase = { tot: sum(base.map((b) => b.recordsTotal)), ok: sum(base.map((b) => b.recordsComplete)) };
    ev.filter((e) => e.source === "paper" && e.requiredFields).forEach((e) => { recBase.tot++; if (e.filledFields >= e.requiredFields) recBase.ok++; });
    const recPostRows = [...ev.filter((e) => e.P === "post" && e.source !== "paper" && e.requiredFields), ...ins.filter((i) => i.P === "post" && i.requiredFields)];
    const recPost = { tot: recPostRows.length, ok: recPostRows.filter((r) => r.filledFields >= r.requiredFields).length };
    // 4) Expired per 100 item-inspections
    const expBase = { x: sum(base.map((b) => b.itemsExpired)) + sum(ins.filter((i) => isBase(i.P)).map((i) => i.itemsExpired)), n: sum(base.map((b) => b.itemsChecked)) + sum(ins.filter((i) => isBase(i.P)).map((i) => i.itemsChecked)) };
    const expPost = { x: sum(ins.filter((i) => i.P === "post").map((i) => i.itemsExpired)), n: sum(ins.filter((i) => i.P === "post").map((i) => i.itemsChecked)) };
    // 5) Ready inspections
    const rdyBase = { x: sum(base.map((b) => b.inspectionsReady)) + ins.filter((i) => isBase(i.P) && i.isReady).length, n: sum(base.map((b) => b.inspections)) + ins.filter((i) => isBase(i.P)).length };
    const rdyPost = { x: ins.filter((i) => i.P === "post" && i.isReady).length, n: ins.filter((i) => i.P === "post").length };
    // 6) Report timing
    const timings = R.reportTimings.filter((t) => t.minutes != null);
    // By unit (post response)
    const units = {};
    respPostAll.filter((e) => e.notificationStatus === "sent").forEach((e) => { const m = minutes(e.notificationSentAt, e.acknowledgedAt); if (outl(m)) (units[e.locationName || "ไม่ระบุ"] = units[e.locationName || "ไม่ระบุ"] || []).push(m); });
    const outliers = [...respBase, ...respPost].filter((x) => x !== null && x > 1440).length;
    return { rb, rp, failed, legacy, rdBase, rdPost, rdEst, recBase, recPost, expBase, expPost, rdyBase, rdyPost, timings, units, outliers, ev, ins, nPost: respPostAll.length };
  }
  const sum = (a) => a.reduce((x, y) => x + (Number(y) || 0), 0);

  // ---------------- page ----------------
  App.pageResearch = async function () {
    if (!isAdmin()) return App.go("dashboard");
    S.resTab = S.param || S.resTab || "ind";
    S.onlyStudy = S.onlyStudy ?? true;
    setTitle("งานวิจัย", `<button class="btn" onclick="App.reloadResearch()">${ic("refresh")}</button>`);
    const tabs = [["ind", "ตัวชี้วัด"], ["base", "ข้อมูล baseline"], ["obs", "แบบสังเกต"], ["survey", "แบบสอบถาม"], ["consent", "ความยินยอม"], ["quality", "คุณภาพข้อมูล"], ["export", "ส่งออกข้อมูล"]];
    $("#content").innerHTML = `<div class="subnav">${tabs.map(([k, l]) => `<button class="${S.resTab === k ? "on" : ""}" onclick="App.go('research','${k}')">${l}</button>`).join("")}</div><div id="resBody"><div class="card">${empty("กำลังโหลดข้อมูลวิจัย…", "loader-2")}</div></div>`;
    try {
      if (!S.research) S.research = await api("apiResearchData", S.token);
      if (S.resTab === "consent") { $("#resBody").innerHTML = await App.consentListHtml(); return; }
      ({ ind: tabInd, base: tabBase, obs: tabObs, survey: tabSurvey, quality: tabQuality, export: tabExport })[S.resTab]();
    } catch (e) { $("#resBody").innerHTML = `<div class="card">${empty(e.message, "alert-circle")}</div>`; }
  };
  App.reloadResearch = () => { S.research = null; App.render(); };

  // ---------------- คุณภาพข้อมูล: หาเคสที่ข้อมูลไม่ครบ / เวลาลำดับผิด ระหว่างเก็บข้อมูล ----------------
  const H = 60; // นาที
  function qualityIssues(R) {
    const now = Date.now(), out = [];
    const t = (x) => (x ? new Date(x).getTime() : null);
    const add = (kind, ref, sev, code, msg) => out.push({ kind, ref, sev, code, msg });
    for (const e of R.events) {
      if (e.caseStatus === "cancelled") continue;
      const legacy = e.notificationStatus === "legacy_unknown";
      const A = t(e.actualOpenedAt), N = t(e.notificationSentAt), K = t(e.acknowledgedAt), Y = t(e.readyAt), Rc = t(e.recordedAt);
      if (!A) add("event", e, "error", "no_actual", "ไม่มีเวลาเปิดใช้จริง");
      if (!legacy && e.source !== "paper" && !N) add("event", e, "error", "no_notif", `ไม่มีเวลาส่งแจ้งเตือน LINE${e.notificationError ? ` (${String(e.notificationError).slice(0, 60)})` : e.notificationStatus ? ` (${e.notificationStatus})` : ""}`);
      if (e.caseStatus === "ready" && !K) add("event", e, "error", "no_ack", "เติมยาแล้ว แต่ไม่มีเวลารับทราบ");
      if (e.caseStatus === "ready" && !Y) add("event", e, "error", "no_ready", "สถานะพร้อมใช้ แต่ไม่มีเวลาพร้อมใช้");
      if (A && N && N < A - 5 * 60000) add("event", e, "error", "seq_notif", "เวลาส่งแจ้งเตือนก่อนเวลาเปิดใช้จริง");
      if (A && K && K < A) add("event", e, "error", "seq_ack", "เวลารับทราบก่อนเวลาเปิดใช้จริง");
      if (N && K && K < N) add("event", e, "warn", "seq_ack_notif", "รับทราบก่อน LINE ส่งสำเร็จ (อาจรับทราบจาก Push/โทรศัพท์) · ค่าตอบสนองติดลบ");
      if (K && Y && Y < K) add("event", e, "error", "seq_ready", "เวลาพร้อมใช้ก่อนเวลารับทราบ");
      if (e.caseStatus === "open" && Rc && now - Rc > 24 * H * 60000) add("event", e, "warn", "stale_open", "ค้างรอรับทราบเกิน 24 ชม.");
      if (e.caseStatus === "acknowledged" && K && now - K > 72 * H * 60000) add("event", e, "warn", "stale_ack", "รับทราบแล้ว ค้างรอเติมยาเกิน 72 ชม.");
      const r = minutes(e.notificationSentAt, e.acknowledgedAt), d = minutes(e.actualOpenedAt, e.readyAt);
      if (r !== null && r > 1440) add("event", e, "warn", "out_resp", `เวลาตอบสนอง ${Math.round(r)} นาที (> 24 ชม. ไม่นำมาวิเคราะห์)`);
      if (d !== null && d > 1440) add("event", e, "warn", "out_ready", `เปิดใช้ → พร้อมใช้ ${Math.round(d / 60)} ชม. (> 24 ชม. ไม่นำมาวิเคราะห์)`);
      if (A && Rc && Rc - A > 24 * H * 60000) add("event", e, "info", "retro", "บันทึกย้อนหลังเกิน 24 ชม.");
      if (!e.reasonCategory) add("event", e, "warn", "no_reason", "ไม่ระบุเหตุผลการเปิดใช้");
      if (!e.locationId) add("event", e, "warn", "no_loc", "ไม่ผูกกับจุดวางกล่อง (ไม่ทราบว่าอยู่ในหน่วยที่ศึกษาหรือไม่)");
      if (!legacy && !String(e.openerName || "").trim()) add("event", e, "warn", "no_opener", "ไม่ระบุชื่อผู้เปิดใช้");
      if (!e.period) add("event", e, "warn", "no_period", "ไม่มีช่วงการศึกษา (period)");
      if (e.readyEstimated) add("event", e, "info", "est_ready", "เวลาพร้อมใช้เป็นค่าประมาณจากระบบเดิม");
      if (e.offlineQueued) add("event", e, "info", "offline", "บันทึกตอนออฟไลน์ ส่งเข้าระบบภายหลัง");
      if (legacy) add("event", e, "info", "legacy", "เคสจากระบบรุ่นแรก (ไม่มีเวลาส่งแจ้งเตือน)");
    }
    for (const i of R.inspections || []) {
      if (i.requiredFields && i.filledFields < i.requiredFields) add("ins", i, "warn", "ins_fields", `ใบตรวจกรอกไม่ครบ ${i.filledFields}/${i.requiredFields} ช่อง`);
      if (i.durationMin == null) add("ins", i, "info", "ins_dur", "ไม่มีเวลาที่ใช้ตรวจ (บันทึกจากกระดาษ/ระบบเดิม)");
      else if (i.durationMin < 0 || i.durationMin > 120) add("ins", i, "warn", "ins_dur_out", `เวลาที่ใช้ตรวจ ${i.durationMin} นาที (ผิดปกติ)`);
    }
    return out;
  }
  function tabQuality() {
    const R = S.research;
    const all = qualityIssues(R);
    S.qSev = S.qSev || "problem";
    const show = all.filter((x) => (S.qSev === "all" ? true : S.qSev === "problem" ? x.sev !== "info" : x.sev === S.qSev));
    const evs = R.events.filter((e) => e.caseStatus !== "cancelled");
    const errIds = new Set(all.filter((x) => x.kind === "event" && x.sev === "error").map((x) => x.ref.id));
    const warnIds = new Set(all.filter((x) => x.kind === "event" && x.sev === "warn").map((x) => x.ref.id));
    const clean = evs.filter((e) => !errIds.has(e.id) && !warnIds.has(e.id)).length;
    const cnt = (sv) => all.filter((x) => x.sev === sv).length;
    const byCode = {};
    all.filter((x) => x.sev !== "info").forEach((x) => (byCode[x.code] = (byCode[x.code] || { n: 0, label: x.msg.replace(/\s*\(.*\)|\s*\d+(\/\d+)?\s*(นาที|ชม\.|ช่อง)?/g, "").trim() }), byCode[x.code].n++));
    const sevPill = { error: `<span class="pill danger">ต้องแก้</span>`, warn: `<span class="pill warn">ตรวจสอบ</span>`, info: `<span class="pill">ข้อมูล</span>` };
    const rows = show.slice(0, 500).map((x) => {
      const r = x.ref, isE = x.kind === "event";
      return `<tr class="${isE ? "click" : ""}" ${isE ? `onclick="App.go('case','${r.id}')"` : ""}><td>${sevPill[x.sev]}</td><td class="mono small">${esc(isE ? r.eventCode || "" : "ตรวจ " + (r.boxCode || ""))}</td><td class="small">${fmtDT(isE ? r.actualOpenedAt : r.inspectedAt)}</td><td class="small">${esc(isE ? r.locationName || r.boxCode || "" : r.boxCode || "")}</td><td class="small">${esc(isE ? r.period || "" : "")}</td><td>${esc(x.msg)}</td></tr>`;
    }).join("");
    $("#resBody").innerHTML = `
      <div class="grid grid-4">
        ${kpi("เคสทั้งหมด (ไม่รวมยกเลิก)", evs.length, "list-check", "accent")}
        ${kpi("ข้อมูลครบ ไม่มีปัญหา", evs.length ? Math.round((clean / evs.length) * 100) : "–", "circle-check", "ok", `${clean} เคส`, evs.length ? "%" : "")}
        ${kpi("ต้องแก้", cnt("error"), "alert-circle", "danger", `${errIds.size} เคส`)}
        ${kpi("ควรตรวจสอบ", cnt("warn"), "alert-triangle", "warn", `${warnIds.size} เคส`)}
      </div>
      <div class="card section"><div class="card-head"><h3 class="grow">รายการที่พบ</h3>
        <div class="seg">${[["problem", "ต้องแก้ + ตรวจสอบ"], ["error", "ต้องแก้"], ["warn", "ตรวจสอบ"], ["info", "ข้อมูล"], ["all", "ทั้งหมด"]].map(([k, l]) => `<button class="${S.qSev === k ? "on" : ""}" onclick="S.qSev='${k}';App.render()">${l}</button>`).join("")}</div>
        <button class="btn sm" onclick="App.exportQuality()">${ic("download")} CSV</button></div>
        ${Object.keys(byCode).length ? `<div class="card-body row wrap" style="gap:6px;border-bottom:1px solid var(--border)">${Object.values(byCode).sort((a, b) => b.n - a.n).map((v) => `<span class="tag">${esc(v.label)} · ${v.n}</span>`).join("")}</div>` : ""}
        ${show.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>ระดับ</th><th>รหัส</th><th>เวลาเปิดใช้</th><th>จุด</th><th>ช่วง</th><th>ปัญหา</th></tr></thead><tbody>${rows}</tbody></table></div>${show.length > 500 ? `<div class="xs faint card-body">แสดง 500 รายการแรก · ดาวน์โหลด CSV เพื่อดูทั้งหมด</div>` : ""}` : empty("ไม่พบปัญหาในระดับที่เลือก", "circle-check")}
      </div>
      <div class="xs faint mt-12">แตะแถวเพื่อเปิดเคสและแก้ไข (เช่น แก้เวลาเปิดใช้จริง หรือยืนยันพร้อมใช้) · ค่าที่เกิน 24 ชม. ถูกตัดออกจากการวิเคราะห์ตัวชี้วัดอัตโนมัติ · ควรตรวจหน้านี้สัปดาห์ละครั้งระหว่างเก็บข้อมูล</div>`;
  }
  App.exportQuality = () => {
    const all = qualityIssues(S.research);
    const rows = all.map((x) => ({ level: x.sev, code: x.code, ref: x.kind === "event" ? x.ref.eventCode || x.ref.id : "inspection:" + (x.ref.boxCode || x.ref.id), when: x.kind === "event" ? x.ref.actualOpenedAt : x.ref.inspectedAt, location: x.ref.locationName || x.ref.boxCode || "", period: x.ref.period || "", issue: x.msg }));
    download(`seb-data-quality-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  function tabInd() {
    const R = S.research, s = R.settings;
    const C = compute(R, S.onlyStudy);
    const target = Number(s.RESPONSE_TARGET_MIN || 5);
    const dB = St.describe(C.rb), dP = St.describe(C.rp);
    const mw = St.mannWhitney(C.rb, C.rp), bd = St.bootDiff(C.rb, C.rp);
    const eB = St.describe(C.rdBase), eP = St.describe(C.rdPost);
    const mw2 = St.mannWhitney(C.rdBase, C.rdPost), bd2 = St.bootDiff(C.rdBase, C.rdPost);
    const ciB = St.exactCI(C.recBase.ok, C.recBase.tot), ciP = St.exactCI(C.recPost.ok, C.recPost.tot);
    const fRec = St.fisher(C.recBase.ok, C.recBase.tot - C.recBase.ok, C.recPost.ok, C.recPost.tot - C.recPost.ok);
    const xB = St.exactCI(C.expBase.x, C.expBase.n), xP = St.exactCI(C.expPost.x, C.expPost.n);
    const fExp = St.fisher(C.expBase.x, C.expBase.n - C.expBase.x, C.expPost.x, C.expPost.n - C.expPost.x);
    const yB = St.exactCI(C.rdyBase.x, C.rdyBase.n), yP = St.exactCI(C.rdyPost.x, C.rdyPost.n);
    const fRdy = St.fisher(C.rdyBase.x, C.rdyBase.n - C.rdyBase.x, C.rdyPost.x, C.rdyPost.n - C.rdyPost.x);
    const within = C.rp.filter((x) => x <= target).length;
    const md = (d) => d.n ? `<b class="tabnum">${r1(d.med)}</b> <span class="faint small">(${r1(d.q1)}–${r1(d.q3)})</span><div class="xs faint">n = ${d.n}</div>` : `<span class="faint">ไม่มีข้อมูล</span>`;
    const pr = (c, x) => c ? `<b class="tabnum">${pct(c.p)}</b> <span class="faint small">(${pct(c.lo)}–${pct(c.hi)})</span><div class="xs faint">${x}</div>` : `<span class="faint">ไม่มีข้อมูล</span>`;
    const per100 = (c, x, n) => c ? `<b class="tabnum">${r1(c.p * 100)}</b> <span class="faint small">(${r1(c.lo * 100)}–${r1(c.hi * 100)})</span><div class="xs faint">${x}/${n} รายการ</div>` : `<span class="faint">ไม่มีข้อมูล</span>`;
    const good = (ok) => (ok === null ? "" : ok ? "ind-good" : "ind-bad");
    const survey = R.survey;
    const sv = survey.length ? { n: survey.length, overall: St.mean(survey.map((x) => +x.overallScore)), acc: St.exactCI(survey.filter((x) => x.accepted).length, survey.length) } : null;

    const tmByMonth = {};
    C.timings.forEach((t) => (tmByMonth[t.reportMonth] = [...(tmByMonth[t.reportMonth] || []), { m: +t.minutes, src: t.source }]));

    $("#resBody").innerHTML = `
      <div class="row between wrap mb-16 gap-12">
        <div class="seg"><button class="${S.onlyStudy ? "on" : ""}" onclick="App.setStudy(true)">เฉพาะ 4 หน่วยในงานวิจัย</button><button class="${!S.onlyStudy ? "on" : ""}" onclick="App.setStudy(false)">ทุกจุด</button></div>
        <div class="xs faint">ช่วงใช้จริง: ${s.STUDY_POST_START ? `${fmtD(s.STUDY_POST_START)} – ${fmtD(s.STUDY_POST_END)}` : `<a onclick="App.go('settings','study')" style="cursor:pointer">ยังไม่กำหนด → ตั้งค่า</a>`}</div>
      </div>
      <div class="grid grid-4">
        ${kpi("ตอบสนองมัธยฐาน (post)", r1(dP.med), "clock-bolt", "violet", `≤ ${target} นาที: ${C.rp.length ? pct(within / C.rp.length) : "–"} ของเคส`, dP.n ? " นาที" : "")}
        ${kpi("พร้อมใช้มัธยฐาน (post)", r1(eP.med), "package-import", "accent", `n = ${eP.n}${C.rdEst ? ` · ไม่รวมค่าประมาณ ${C.rdEst}` : ""}`, eP.n ? " นาที" : "")}
        ${kpi("ความครบถ้วนการบันทึก", ciP ? pct(ciP.p) : "–", "list-check", "ok", "เป้า ≥ 95%")}
        ${kpi("ความพึงพอใจรวม", sv ? r1(sv.overall) : "–", "mood-happy", "info", sv ? `ยอมรับ ${pct(sv.acc.p)} · n = ${sv.n}` : "ยังไม่มีผู้ตอบ", sv ? " / 5" : "")}
      </div>
      <div class="card section">
        <div class="card-head"><h3 class="grow">เปรียบเทียบก่อน–หลังใช้ระบบ (ภาคผนวก ก 1.3)</h3><span class="xs faint">มัธยฐาน (IQR) · ร้อยละ (95% CI แบบ exact)</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>ตัวชี้วัด</th><th>ก่อนใช้ระบบ</th><th>หลังใช้ระบบ</th><th>ผลต่าง</th><th>p (สำรวจ)</th><th>เป้าหมาย</th></tr></thead><tbody>
          <tr><td><b>1. Response time</b><div class="xs faint">ก่อน: รับทราบ − หน่วยงานแจ้ง · หลัง: acknowledged_at − notification_sent_at</div></td><td>${md(dB)}</td><td class="${good(dP.n ? dP.med <= target : null)}">${md(dP)}</td><td class="tabnum">${bd ? `${r1(bd.est)} <div class="xs faint">95% CI ${r1(bd.lo)} ถึง ${r1(bd.hi)}</div>` : "–"}</td><td class="tabnum">${mw ? pfmt(mw.p) : "–"}<div class="xs faint">Mann–Whitney U</div></td><td class="ind-target">≤ ${target} นาที</td></tr>
          <tr><td><b>2. Box readiness time</b><div class="xs faint">ready_at − actual_opened_at</div></td><td>${md(eB)}</td><td>${md(eP)}</td><td class="tabnum">${bd2 ? `${r1(bd2.est)} <div class="xs faint">95% CI ${r1(bd2.lo)} ถึง ${r1(bd2.hi)}</div>` : "–"}</td><td class="tabnum">${mw2 ? pfmt(mw2.p) : "–"}</td><td class="ind-target">ลดลงจาก baseline</td></tr>
          <tr><td><b>3. ความครบถ้วนของการบันทึก</b><div class="xs faint">แบบบันทึกที่ครบ / ทั้งหมด</div></td><td>${pr(ciB, `${C.recBase.ok}/${C.recBase.tot}`)}</td><td class="${good(ciP ? ciP.p >= 0.95 : null)}">${pr(ciP, `${C.recPost.ok}/${C.recPost.tot}`)}</td><td class="tabnum">${ciB && ciP ? `${r1((ciP.p - ciB.p) * 100)} จุด%` : "–"}</td><td class="tabnum">${pfmt(fRec)}<div class="xs faint">Fisher’s exact</div></td><td class="ind-target">≥ 95%</td></tr>
          <tr><td><b>4. ยาหมดอายุ ต่อ 100 รายการที่ตรวจ</b></td><td>${per100(xB, C.expBase.x, C.expBase.n)}</td><td class="${good(xP ? xP.p === 0 : null)}">${per100(xP, C.expPost.x, C.expPost.n)}</td><td class="tabnum">${xB && xP ? r1((xP.p - xB.p) * 100) : "–"}</td><td class="tabnum">${pfmt(fExp)}</td><td class="ind-target">0</td></tr>
          <tr><td><b>5. การตรวจที่กล่องพร้อมใช้</b><div class="xs faint">ยาครบตามชุด และไม่มีหมดอายุ</div></td><td>${pr(yB, `${C.rdyBase.x}/${C.rdyBase.n} ครั้ง`)}</td><td class="${good(yP ? yP.p >= 0.95 : null)}">${pr(yP, `${C.rdyPost.x}/${C.rdyPost.n} ครั้ง`)}</td><td class="tabnum">${yB && yP ? `${r1((yP.p - yB.p) * 100)} จุด%` : "–"}</td><td class="tabnum">${pfmt(fRdy)}</td><td class="ind-target">≥ 95%</td></tr>
          <tr><td><b>6. เวลาจัดทำรายงานประจำเดือน</b><div class="xs faint">เชิงพรรณนา ไม่ทดสอบสมมติฐาน</div></td><td colspan="4" class="small">${Object.keys(tmByMonth).length ? Object.entries(tmByMonth).sort().map(([m, a]) => `<span class="tag" style="margin:2px">${m}: ${a.map((x) => r1(x.m)).join(", ")} นาที${a[0].src === "paper" ? " (กระดาษ)" : ""}</span>`).join("") : `<span class="faint">ยังไม่มีข้อมูล · บันทึกได้ที่แท็บ "ข้อมูล baseline"</span>`}</td><td class="ind-target">≤ 30 นาที</td></tr>
        </tbody></table></div>
        <div class="card-body xs faint" style="border-top:1px solid var(--border)">
          ข้อมูลสูญหาย/คัดออก: แจ้งเตือนส่งไม่สำเร็จ ${C.failed} เคส · ข้อมูลระบบรุ่นแรก (ไม่มีเวลาส่ง) ${C.legacy} เคส · ค่าผิดปกติ &gt; 24 ชม. ${C.outliers} ค่า · ready_at ประมาณจาก log ${C.rdEst} เคส (ไม่นำมาคำนวณ)<br>
          ค่า p เป็นการวิเคราะห์เชิงสำรวจตามข้อ 5.9.6 เพราะเหตุการณ์ในหน่วยงานเดียวกันอาจไม่อิสระต่อกัน · ผลต่างมัธยฐานใช้ bootstrap 2,000 รอบ · ควรยืนยันผลด้วยโปรแกรมสถิติจากไฟล์ส่งออก
        </div>
      </div>
      <div class="grid grid-2 section">
        <div class="card"><div class="card-head"><h3 class="grow">Response time รายหน่วยงาน (post)</h3></div><div class="card-body">${Object.keys(C.units).length ? hbars(Object.entries(C.units).map(([k, a]) => [k, St.describe(a).med, `n=${a.length}`]), "นาที") : empty("ยังไม่มีข้อมูลช่วงใช้จริง", "chart-bar-off")}</div></div>
        <div class="card"><div class="card-head"><h3 class="grow">การเปิดกล่องรายเดือน</h3></div><div class="card-body">${monthBars(C.ev.filter((e) => e.source !== "paper"))}</div></div>
        <div class="card"><div class="card-head"><h3 class="grow">เหตุผลการเปิดใช้</h3></div><div class="card-body">${hbars(countBy(C.ev.filter((e) => e.source !== "paper"), (e) => e.reasonCategory || "ไม่ระบุ"), "ครั้ง")}</div></div>
        <div class="card"><div class="card-head"><h3 class="grow">ช่วงเวรที่เปิดใช้</h3></div><div class="card-body">${hbars(countBy(C.ev.filter((e) => e.source !== "paper"), (e) => { const h = new Date(e.actualOpenedAt).getHours(); return h >= 8 && h < 16 ? "เวรเช้า 08–16" : h >= 16 ? "เวรบ่าย 16–24" : "เวรดึก 00–08"; }), "ครั้ง")}</div></div>
      </div>`;
  }
  App.setStudy = (v) => { S.onlyStudy = v; tabInd(); };
  function countBy(rows, fn) { const m = {}; rows.forEach((r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, ""]); }
  function hbars(rows, unit) {
    if (!rows.length) return empty("ไม่มีข้อมูล", "chart-bar-off");
    const max = Math.max(...rows.map((r) => r[1] || 0), 1);
    return rows.map(([k, v, note]) => `<div class="hbar"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(k)}">${esc(k)}</span><div class="track"><span style="width:${Math.max(2, (v / max) * 100)}%"></span></div><span class="tabnum right"><b>${r1(v)}</b> <span class="xs faint">${note || ""}</span></span></div>`).join("") + `<div class="xs faint mt-4 right">${unit}</div>`;
  }
  function monthBars(ev) {
    const m = {};
    ev.forEach((e) => { const k = String(e.actualOpenedAt).slice(0, 7); m[k] = (m[k] || 0) + 1; });
    const keys = Object.keys(m).sort().slice(-9);
    if (!keys.length) return empty("ไม่มีข้อมูล", "chart-bar-off");
    const max = Math.max(...keys.map((k) => m[k]));
    const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `<div class="chart-bars">${keys.map((k) => `<div class="b"><b>${m[k]}</b><span style="height:${(m[k] / max) * 100}%"></span><em>${TH[+k.slice(5) - 1]} ${String(+k.slice(0, 4) + 543).slice(2)}</em></div>`).join("")}</div>`;
  }

  // ---------------- baseline entry ----------------
  function tabBase() {
    const R = S.research;
    const paper = R.events.filter((e) => e.source === "paper");
    const locs = R.locations.filter((l) => l.active !== false);
    const running = R.reportTimings.find((t) => t.startedAt && !t.finishedAt);
    const month = new Date().toISOString().slice(0, 7);
    $("#resBody").innerHTML = `
      <div class="alert info mb-16" style="padding:10px 14px"><div class="small">ใช้คีย์ข้อมูลช่วงก่อนใช้ระบบ (ข้อ 5.9.5 ข้อ 1) · ข้อมูลกระดาษไปข้างหน้า = เหตุการณ์รายครั้ง · ข้อมูลย้อนหลัง 6 เดือน = ระดับหน่วยงานรายเดือน</div></div>
      <div class="card"><div class="card-head"><h3 class="grow">1. เหตุการณ์เปิดกล่องจากแบบฟอร์มกระดาษ (prospective baseline)</h3>${isStaff() ? `<button class="btn sm primary" onclick="App.paperEventForm()">${ic("plus")} เพิ่ม</button>` : ""}</div>
        ${paper.length ? `<div class="table-wrap"><table class="t compact responsive"><thead><tr><th>รหัส</th><th>หน่วย</th><th>เปิดจริง</th><th>แจ้งห้องยา</th><th>รับทราบ</th><th>พร้อมใช้</th><th>Response</th><th>Readiness</th></tr></thead><tbody>${paper.map((e) => `<tr><td data-l="รหัส" class="mono">${esc(e.eventCode)}</td><td data-l="หน่วย">${esc(e.locationName || "")}</td><td data-l="เปิดจริง">${fmtDT(e.actualOpenedAt)}</td><td data-l="แจ้ง">${fmtT(e.unitNotifiedAt)}</td><td data-l="รับทราบ">${fmtT(e.acknowledgedAt)}</td><td data-l="พร้อมใช้">${fmtDT(e.readyAt)}</td><td data-l="Response" class="tabnum">${fmtMin(minutes(e.unitNotifiedAt, e.acknowledgedAt))}</td><td data-l="Readiness" class="tabnum">${fmtMin(minutes(e.actualOpenedAt, e.readyAt))}</td></tr>`).join("")}</tbody></table></div>` : empty("ยังไม่มีข้อมูล", "file-off")}</div>
      <div class="card section"><div class="card-head"><h3 class="grow">2. ข้อมูลย้อนหลัง 6 เดือน (ระดับหน่วยงาน)</h3>${isStaff() ? `<button class="btn sm primary" onclick="App.aggForm()">${ic("plus")} เพิ่ม</button>` : ""}</div>
        ${R.baseline.length ? `<div class="table-wrap"><table class="t compact responsive"><thead><tr><th>เดือน</th><th>หน่วย</th><th>ตรวจ (พร้อมใช้)</th><th>รายการยาที่ตรวจ</th><th>หมดอายุ</th><th>แบบบันทึกครบ</th><th></th></tr></thead><tbody>${R.baseline.map((b) => `<tr><td data-l="เดือน">${esc(b.periodMonth)}</td><td data-l="หน่วย">${esc(b.locationName || "")}</td><td data-l="ตรวจ" class="tabnum">${b.inspections} (${b.inspectionsReady})</td><td data-l="รายการ" class="tabnum">${b.itemsChecked}</td><td data-l="หมดอายุ" class="tabnum">${b.itemsExpired}</td><td data-l="ครบ" class="tabnum">${b.recordsComplete}/${b.recordsTotal}</td><td class="right">${isStaff() ? `<button class="btn ghost sm icon" onclick="App.delAgg('${b.id}')">${ic("trash")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("ยังไม่มีข้อมูล", "file-off")}</div>
      <div class="card section"><div class="card-head"><h3 class="grow">3. เวลาจัดทำรายงานประจำเดือน (5.7.8)</h3></div><div class="card-body">
        <div class="row wrap gap-12">${running ? `<span class="pill accent live">กำลังจับเวลา ${esc(running.reportMonth)} ตั้งแต่ ${fmtT(running.startedAt)}</span><button class="btn primary" onclick="App.finishTiming('${running.id}')">${ic("player-stop")} จัดทำรายงานเสร็จ</button>` : `<input class="input" type="month" id="tmMonth" value="${month}" style="width:auto"><button class="btn primary" onclick="App.startTiming()">${ic("player-play")} เริ่มจัดทำรายงาน</button>`}
        <span class="grow"></span><button class="btn" onclick="App.timingPaper()">${ic("pencil")} คีย์เวลาจากกระดาษ</button></div>
        <div class="mt-16">${R.reportTimings.length ? R.reportTimings.map((t) => `<div class="list-row" style="padding:8px 0"><span class="grow">${esc(t.reportMonth)} · ${esc(t.byUser || "")} ${t.source === "paper" ? `<span class="tag">กระดาษ</span>` : ""}</span><b class="tabnum">${t.minutes != null ? r1(t.minutes) + " นาที" : "กำลังจับเวลา"}</b></div>`).join("") : `<div class="faint small">ยังไม่มีข้อมูล</div>`}</div></div></div>`;
    App._locsOpt = opt([["", "เลือกหน่วย"], ...locs.map((l) => [l.id, l.name])], "");
  }
  App.paperEventForm = () => {
    drawer("คีย์เหตุการณ์จากแบบฟอร์มกระดาษ", `<div class="form-grid">
      ${field("หน่วยงาน", `<select class="input" id="peLoc">${App._locsOpt}</select>`)}${field("รหัสกล่อง", `<input class="input" id="peBox">`)}
      ${field("เวลาเปิดใช้จริง", X.dtSel('id="peOpen"', ""))}${field("เวลาหน่วยงานแจ้งเภสัชกร", X.dtSel('id="peNotify"', ""))}
      ${field("เวลาเภสัชกรรับทราบ", X.dtSel('id="peAck"', ""))}${field("เวลากล่องกลับมาพร้อมใช้", X.dtSel('id="peReady"', ""))}
      ${field("เหตุผล", `<select class="input" id="peReason">${opt([["", "ไม่ระบุ"], ...optList("OPT_OPEN_REASONS").map((r) => [r, r])], "")}</select>`)}<div></div>
      ${field("จำนวนฟิลด์ที่จำเป็น", `<input class="input" type="number" id="peReq" value="6">`, "ใช้นิยามเดียวกับหลังใช้ระบบ")}${field("จำนวนฟิลด์ที่บันทึกครบ", `<input class="input" type="number" id="peFill">`)}
      ${field("หมายเหตุ", `<input class="input" id="peNote">`, "", "full")}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" onclick="App.savePaperEvent()">บันทึก</button>`);
  };
  App.savePaperEvent = async () => {
    try {
      const iso = (id) => (val(id) ? new Date(val(id)).toISOString() : "");
      if (!val("peOpen")) throw new Error("กรุณาระบุเวลาเปิดใช้จริง");
      await api("apiRecordPaperEvent", S.token, { locationId: val("peLoc"), boxCode: val("peBox"), actualOpenedAt: iso("peOpen"), unitNotifiedAt: iso("peNotify"), acknowledgedAt: iso("peAck"), readyAt: iso("peReady"), reasonCategory: val("peReason"), requiredFields: val("peReq"), filledFields: val("peFill"), note: val("peNote") });
      closeDrawer(); toast("บันทึกแล้ว"); S.research = null; App.render();
    } catch (e) { fail(e); }
  };
  App.aggForm = () => {
    drawer("ข้อมูลย้อนหลังรายเดือน (ระดับหน่วยงาน)", `<div class="form-grid">
      ${field("เดือน", `<input class="input" type="month" id="agM">`)}${field("หน่วยงาน", `<select class="input" id="agLoc">${App._locsOpt}</select>`)}
      ${field("จำนวนครั้งที่ตรวจ", `<input class="input" type="number" id="agIns">`)}${field("ครั้งที่กล่องพร้อมใช้", `<input class="input" type="number" id="agRdy">`)}
      ${field("รายการยาที่ตรวจ", `<input class="input" type="number" id="agChk">`)}${field("รายการยาหมดอายุที่พบ", `<input class="input" type="number" id="agExp">`)}
      ${field("แบบบันทึกทั้งหมด", `<input class="input" type="number" id="agTot">`)}${field("แบบบันทึกที่ครบถ้วน", `<input class="input" type="number" id="agOk">`)}
      ${field("หมายเหตุ", `<input class="input" id="agNote">`, "", "full")}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" onclick="App.saveAgg()">บันทึก</button>`);
  };
  App.saveAgg = async () => {
    try {
      if (!val("agM")) throw new Error("กรุณาระบุเดือน");
      await api("apiSaveBaselineAggregate", S.token, { periodMonth: val("agM"), locationId: val("agLoc"), inspections: val("agIns"), inspectionsReady: val("agRdy"), itemsChecked: val("agChk"), itemsExpired: val("agExp"), recordsTotal: val("agTot"), recordsComplete: val("agOk"), note: val("agNote") });
      closeDrawer(); toast("บันทึกแล้ว"); S.research = null; App.render();
    } catch (e) { fail(e); }
  };
  App.delAgg = async (id) => { if (!(await dialog({ title: "ลบรายการนี้?", confirm: "ลบ", danger: true }))) return; try { await api("apiDeleteBaselineAggregate", S.token, id); S.research = null; App.render(); } catch (e) { fail(e); } };
  App.startTiming = async () => { try { await api("apiStartReportTiming", S.token, val("tmMonth")); S.research = null; toast("เริ่มจับเวลาแล้ว"); App.render(); } catch (e) { fail(e); } };
  App.finishTiming = async (id) => { try { const r = await api("apiFinishReportTiming", S.token, id); S.research = null; toast(`ใช้เวลา ${r1(r.timing.minutes)} นาที`); App.render(); } catch (e) { fail(e); } };
  App.timingPaper = () => {
    drawer("เวลาจัดทำรายงาน (กระดาษ / ก่อนใช้ระบบ)", `<div class="form-grid">${field("เดือนของรายงาน", `<input class="input" type="month" id="tpM">`)}${field("ใช้เวลา (นาที)", `<input class="input" type="number" id="tpMin">`)}${field("ผู้จัดทำ", `<input class="input" id="tpBy">`)}${field("หมายเหตุ", `<input class="input" id="tpNote">`)}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" onclick="App.saveTimingPaper()">บันทึก</button>`);
  };
  App.saveTimingPaper = async () => { try { await api("apiSaveReportTimingPaper", S.token, { reportMonth: val("tpM"), minutes: val("tpMin"), byUser: val("tpBy"), note: val("tpNote") }); closeDrawer(); S.research = null; App.render(); } catch (e) { fail(e); } };

  // ---------------- observation (ภาคผนวก ก ส่วนที่ 3) ----------------
  const OBS = ["ขั้นตอนการสแกน QR Code", "เวลาที่ใช้ในการบันทึกข้อมูล", "ความถูกต้องของข้อมูลที่กรอก", "การตอบสนองต่อการแจ้งเตือน", "ปัญหาที่พบระหว่างใช้งาน", "พฤติกรรมการใช้งานระบบ"];
  function tabObs() {
    const R = S.research;
    $("#resBody").innerHTML = `<div class="split"><div class="card card-pad"><h3>บันทึกการสังเกตภาคสนาม</h3><div class="xs faint mt-4">สำหรับผู้วิจัยเท่านั้น · ใช้รหัสแทนชื่อผู้ถูกสังเกต · ไม่รบกวนการให้บริการผู้ป่วย</div>
      <div class="form-grid mt-16">${field("วันเวลาที่สังเกต", X.dtSel('id="obT"', localInput()))}${field("สถานที่", `<select class="input" id="obP">${opt([["", "เลือก"], ...R.locations.map((l) => [l.name, l.name])], "")}</select>`)}${field("ผู้ถูกสังเกต (รหัส)", `<input class="input mono" id="obC" placeholder="เช่น N03">`)}</div>
      ${OBS.map((o, i) => `<div class="q"><div class="q-title">${o}</div><div class="row wrap mt-8"><div class="seg" data-ob="${i}">${["ดี", "ปานกลาง", "ควรปรับปรุง"].map((l) => `<button type="button" onclick="SEB.$$('[data-ob=\\'${i}\\'] button').forEach(b=>b.classList.toggle('on',b===this))">${l}</button>`).join("")}</div><input class="input sm grow" data-obd="${i}" placeholder="รายละเอียดที่พบ"></div></div>`).join("")}
      ${field("บันทึกเพิ่มเติม", `<textarea class="input" id="obN"></textarea>`)}
      <div class="row mt-16" style="justify-content:flex-end"><button class="btn primary" onclick="App.saveObs()">บันทึก</button></div></div>
      <div class="card"><div class="card-head"><h3 class="grow">บันทึกที่ผ่านมา</h3><span class="xs faint">${R.observations.length}</span></div>${R.observations.length ? R.observations.slice().reverse().map((o) => `<div class="list-row"><div class="grow"><b>${fmtDT(o.observedAt)}</b> · ${esc(o.place || "")} · <span class="mono">${esc(o.observedCode || "")}</span><div class="xs faint">${Object.values(o.items || {}).map((x) => x.level).filter(Boolean).join(" · ")}</div></div></div>`).join("") : empty("ยังไม่มีบันทึก", "eye-off")}</div></div>`;
  }
  App.saveObs = async () => {
    try {
      const items = {};
      OBS.forEach((o, i) => (items[o] = { level: $(`[data-ob="${i}"] .on`)?.textContent || "", detail: $(`[data-obd="${i}"]`).value.trim() }));
      await api("apiSaveObservation", S.token, { observedAt: new Date(val("obT")).toISOString(), place: val("obP"), observedCode: val("obC"), items, note: val("obN") });
      toast("บันทึกแล้ว"); S.research = null; App.render();
    } catch (e) { fail(e); }
  };

  // ---------------- survey summary ----------------
  function tabSurvey() {
    const R = S.research, sv = R.survey;
    const url = `${location.origin}${location.pathname}?${S.demo ? "demo=1&" : ""}page=survey`;
    const dims = [["usabilityScore", "ความง่ายในการใช้งาน", "ข้อ 1–5"], ["performanceScore", "ประสิทธิภาพของระบบ", "ข้อ 6–10"], ["usefulnessScore", "ประโยชน์ที่ได้รับ", "ข้อ 11–15"], ["trustScore", "ความเชื่อมั่นและความปลอดภัย", "ข้อ 16–19"], ["acceptanceScore", "ความพึงพอใจโดยรวมและการยอมรับ", "ข้อ 20–22"], ["overallScore", "คะแนนรวม 22 ข้อ", ""]];
    const acc = St.exactCI(sv.filter((x) => x.accepted).length, sv.length);
    const level = (m) => (m >= 4.51 ? "มากที่สุด" : m >= 3.51 ? "มาก" : m >= 2.51 ? "ปานกลาง" : m >= 1.51 ? "น้อย" : "น้อยที่สุด");
    const CMP = ["ความรวดเร็วในการรับทราบการเปิดกล่องยา", "ความครบถ้วนของข้อมูลการบันทึก", "ความสามารถในการติดตามวันหมดอายุยา", "ระยะเวลาที่ใช้ในการตรวจสอบกล่องยา", "ระยะเวลาที่ใช้ในการจัดทำรายงานประจำเดือน", "ความมั่นใจในความพร้อมใช้ของกล่องยาฉุกเฉิน"];
    $("#resBody").innerHTML = `
      <div class="split"><div class="col gap-16">
        <div class="grid grid-3">${kpi("ผู้ตอบ", sv.length, "users", "accent", "เป้าหมาย 20 คน (total population)")}${kpi("คะแนนรวมเฉลี่ย", sv.length ? r1(St.mean(sv.map((x) => +x.overallScore))) : "–", "star", "violet", "เป้า ≥ 3.51", sv.length ? " / 5" : "")}${kpi("อัตราการยอมรับ", acc ? pct(acc.p) : "–", "thumb-up", "ok", acc ? `95% CI ${pct(acc.lo)}–${pct(acc.hi)} · เป้า ≥ 80%` : "ข้อ 21 และ 22 ≥ 4")}</div>
        <div class="card"><div class="card-head"><h3 class="grow">คะแนนรายมิติ (ตอนที่ 2)</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>มิติ</th><th>Mean ± SD</th><th>มัธยฐาน (IQR)</th><th>ระดับ</th></tr></thead><tbody>
          ${dims.map(([k, l, n]) => { const a = sv.map((x) => +x[k]).filter((x) => !isNaN(x)); const d = St.describe(a); const m = St.mean(a); return `<tr><td><b>${l}</b> <span class="xs faint">${n}</span></td><td class="tabnum">${a.length ? `${r1(m)} ± ${r1(St.sd(a))}` : "–"}</td><td class="tabnum">${a.length ? `${r1(d.med)} (${r1(d.q1)}–${r1(d.q3)})` : "–"}</td><td>${a.length ? `<span class="pill ${m >= 3.51 ? "ok" : "warn"}">${level(m)}</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h3 class="grow">เปรียบเทียบก่อน–หลัง (ตอนที่ 3)</h3><span class="xs faint">ร้อยละที่ตอบ "ดีขึ้น"</span></div><div class="card-body">${sv.length ? hbars(CMP.map((c, i) => [c, (sv.filter((x) => +x.comparisons?.[`c${i + 1}`] >= 4).length / sv.length) * 100, ""]), "%") : empty("ยังไม่มีข้อมูล", "chart-bar-off")}</div></div>
      </div>
      <div class="card card-pad center"><h3>ลิงก์แบบสอบถาม</h3><div class="muted small mt-4">ให้ผู้เข้าร่วมวิจัยตอบ 1 ครั้งเมื่อสิ้นสุดการใช้ระบบ (เดือนที่ 6)</div>
        <div style="width:180px;margin:16px auto">${App.qrSvgFor(url, 4)}</div><div class="mono xs" style="word-break:break-all">${esc(url)}</div>
        <div class="row mt-12" style="justify-content:center"><button class="btn sm" onclick="navigator.clipboard.writeText('${esc(url)}').then(()=>SEB.toast('คัดลอกแล้ว'))">${ic("copy")} คัดลอกลิงก์</button><a class="btn sm" href="${esc(url)}" target="_blank">${ic("external-link")} เปิด</a></div>
        <div class="xs faint mt-16" style="text-align:left">แบบสอบถามตรงตามฉบับที่ EC รับรอง: ข้อมูลทั่วไป 6 ข้อ · Likert 22 ข้อ 5 มิติ · เปรียบเทียบ 6 ข้อ · ปลายเปิด 5 ข้อ · ผู้ตอบใช้รหัสที่ผู้วิจัยแจก ไม่ผูกกับบัญชีผู้ใช้</div></div></div>`;
  }

  // ---------------- export ----------------
  function tabExport() {
    $("#resBody").innerHTML = `<div class="grid grid-2">
      <div class="card card-pad"><h3>ชุดข้อมูลวิจัย (ไม่มี HN)</h3><div class="muted small mt-4">ใช้ event_id แทนเหตุการณ์ · ไม่มีชื่อผู้ป่วยหรือข้อมูลทางคลินิก · ทุกการส่งออกถูกบันทึกใน audit log</div>
        <div class="col mt-16">${[["events", "เหตุการณ์เปิดกล่อง (Scan log)", "list-details"], ["inspections", "ผลตรวจประจำเดือน", "clipboard-check"], ["inspectionItems", "ผลตรวจรายรายการยา", "pill"], ["baseline", "baseline ย้อนหลังรายเดือน", "history"], ["reportTimings", "เวลาจัดทำรายงาน", "clock"], ["survey", "แบบสอบถาม ตอนที่ 1–3", "forms"], ["surveyOpen", "แบบสอบถาม ตอนที่ 4 (ปลายเปิด)", "message"]].map(([k, l, i]) => `<button class="btn" style="justify-content:flex-start" onclick="App.exportSet('${k}')">${ic(i)} ${l}<span class="grow"></span>${ic("download")}</button>`).join("")}
        <button class="btn primary mt-8" onclick="App.exportSet('dictionary')">${ic("book")} Data dictionary</button></div></div>
      <div class="col gap-16"><div class="card card-pad"><h3>การจัดการข้อมูล</h3><div class="muted small mt-4">ตามข้อ 6.10 · ทำลายข้อมูลภายใน 1 ปีหลังสิ้นสุดโครงการ</div>
        ${isAdmin() ? `<button class="btn danger-ghost mt-16" onclick="App.resetPilot()">${ic("trash")} ลบข้อมูลช่วงนำร่อง (pilot)</button><div class="xs faint mt-8">ตามขั้นที่ 3: ข้อมูลทดสอบนำร่องไม่นำมาวิเคราะห์และต้องลบก่อนใช้งานจริง</div>` : `<div class="faint small mt-16">เฉพาะผู้ดูแลระบบ</div>`}</div>
        <div class="card card-pad"><h3>Google Sheets (ตัวเลือกเสริม)</h3><div class="muted small mt-4">Apps Script ในไฟล์ zip ดึงชุดข้อมูลเดียวกันนี้ (ไม่มี HN) ไปลง Google Sheet วันละครั้ง สำหรับดู/ทำรายงาน ฐานข้อมูลหลักยังเป็น Supabase ตามโครงร่าง</div></div></div></div>`;
  }
  const DICT = [
    ["events", "event_id", "รหัสเหตุการณ์แบบสุ่ม ไม่ได้คำนวณจาก HN (5.7.2)"], ["events", "period", "baseline_prosp / pilot / post / other"], ["events", "source", "qr = สแกนหน้างาน, staff = ห้องยาบันทึก, paper = แบบฟอร์มกระดาษ"],
    ["events", "in_study", "1 = หน่วยในขอบเขตวิจัย (ER, IPD ชาย, IPD หญิง, LR)"], ["events", "actual_opened_at", "เวลาเปิดใช้กล่องจริง (บันทึกย้อนหลังได้)"], ["events", "notification_sent_at", "เวลา server ที่ส่ง LINE สำเร็จ (5.7.4)"],
    ["events", "notification_status", "sent / failed / skipped / legacy_unknown / paper"], ["events", "unit_notified_at", "baseline: เวลาที่หน่วยงานแจ้งเภสัชกร"], ["events", "acknowledged_at", "เวลาเภสัชกรกดรับทราบ"], ["events", "ready_at", "เวลายืนยันกล่องพร้อมใช้"],
    ["events", "ready_estimated", "1 = ประมาณจาก audit log (ข้อมูลระบบรุ่นแรก) ไม่ควรรวมในการวิเคราะห์หลัก"], ["events", "response_min", "post: acknowledged_at − notification_sent_at · baseline: acknowledged_at − unit_notified_at (นาที)"],
    ["events", "readiness_min", "ready_at − actual_opened_at (นาที)"], ["events", "outlier_24h", "1 = เกิน 24 ชม. ต้องตรวจสอบย้อนกลับ (5.9.6 ข้อ 3)"], ["events", "complete", "1 = filled_fields ≥ required_fields (5.7.6)"], ["events", "shift", "เช้า 08–16 · บ่าย 16–24 · ดึก 00–08"],
    ["inspections", "items_checked / items_expired", "ตัวหาร/ตัวตั้งของอัตรายาหมดอายุต่อ 100 รายการ (5.7.7)"], ["inspections", "is_ready", "1 = ยาครบตามชุดและไม่มีหมดอายุ"], ["inspections", "duration_min", "เวลาที่ใช้ตรวจ จับอัตโนมัติ"],
    ["survey", "q1–q22", "Likert 1–5 ตามภาคผนวก ข ตอนที่ 2"], ["survey", "c1–c6", "5 = ดีขึ้นมาก … 1 = แย่ลงมาก (ตอนที่ 3)"], ["survey", "accepted", "1 = q21 ≥ 4 และ q22 ≥ 4 (5.7.10)"],
  ];
  App.exportSet = async (k) => {
    try {
      if (k === "dictionary") return download("seb-data-dictionary.csv", toCsv(DICT.map(([t, f, d]) => ({ table: t, field: f, description: d }))));
      if (!S.exportCache) S.exportCache = await api("apiExportResearch", S.token);
      const rows = S.exportCache[k] || [];
      if (!rows.length) return toast("ไม่มีข้อมูลในชุดนี้", true);
      download(`seb-${k}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    } catch (e) { fail(e); }
  };
  App.resetPilot = async () => {
    const t = await dialog({ title: "ลบข้อมูลช่วงนำร่อง", body: 'เหตุการณ์และผลตรวจที่ period = pilot จะถูกลบถาวร\nพิมพ์ "ลบข้อมูลนำร่อง" เพื่อยืนยัน', input: { required: true }, confirm: "ลบ", danger: true });
    if (!t) return;
    try { const r = await api("apiResetPilotData", S.token, t); toast(`ลบเหตุการณ์ ${r.deletedEvents} · ผลตรวจ ${r.deletedInspections}`); S.research = null; App.render(); } catch (e) { fail(e); }
  };
})();
