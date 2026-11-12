/* =====================================================================
   SEB v2 — ประกาศ PDPA (ทุกผู้ใช้ต้องรับทราบก่อนเริ่มใช้งาน)
            + แบบยินยอมเข้าร่วมวิจัยแบบอิเล็กทรอนิกส์ (e-consent)
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, api, esc, ic, $, $$, fmtD, fmtDT, toast, fail, dialog, drawer, closeDrawer, empty, isAdmin, setTitle } = X;
  const App = window.App;
  const T = () => window.SEB_TEXT;
  const set = () => (S.data && S.data.settings) || {};
  const pdpaVersion = () => set().PDPA_NOTICE_VERSION || T().PDPA_VERSION;
  const pdpaText = () => set().PDPA_NOTICE_TEXT || T().PDPA;
  const pisText = () => set().PIS_TEXT || T().PIS;
  const econsentOn = () => set().ECONSENT_ENABLED === "1";
  const waitDays = () => Number(set().CONSENT_WAIT_DAYS || 7);
  const thDate = (v) => { if (!v) return ""; const d = new Date(v); return `${d.getDate()} ${["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"][d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`; };

  // ข้อความแบบย่อ: "## " หัวข้อ, "- " รายการ, บรรทัดว่าง = ย่อหน้า
  function md(text) {
    const out = [];
    let list = null;
    const flush = () => { if (list) { out.push(`<ul class="doc-ul">${list.join("")}</ul>`); list = null; } };
    String(text || "").split("\n").forEach((raw) => {
      const line = raw.trim();
      if (!line) return flush();
      if (line.startsWith("## ")) { flush(); out.push(`<h3 class="doc-h">${esc(line.slice(3))}</h3>`); return; }
      if (line.startsWith("- ")) { (list = list || []).push(`<li>${esc(line.slice(2))}</li>`); return; }
      flush();
      out.push(`<p class="doc-p">${esc(line)}</p>`);
    });
    flush();
    return out.join("");
  }
  App.md = md;

  // =================================================================
  // PDPA gate — เรียกหลังเข้าสู่ระบบทุกครั้ง
  // =================================================================
  App.checkPdpa = function () {
    if (!S.user || S.user.pdpaVersion === pdpaVersion()) return;
    const ov = document.createElement("div");
    ov.className = "overlay pdpa-overlay";
    ov.id = "pdpaGate";
    ov.innerHTML = `<div class="pdpa-card">
      <div class="pdpa-head"><div class="kpi-icon ic-accent" style="width:36px;height:36px;font-size:19px">${ic("shield-lock")}</div>
        <div><h2>การคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h2><div class="xs faint">เวอร์ชัน ${esc(pdpaVersion())} · กรุณาอ่านและรับทราบก่อนเริ่มใช้งาน</div></div></div>
      <div class="pdpa-body" id="pdpaBody">${md(pdpaText())}</div>
      <div class="pdpa-foot">
        <label class="check"><input type="checkbox" id="pdpaChk" onchange="SEB.$('#pdpaOk').disabled=!this.checked"> ข้าพเจ้าได้อ่านและรับทราบประกาศความเป็นส่วนตัวนี้แล้ว</label>
        <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" onclick="App.logout()">ออกจากระบบ</button><button class="btn primary" id="pdpaOk" disabled onclick="App.acceptPdpa()">รับทราบและเริ่มใช้งาน</button></div>
      </div></div>`;
    document.body.appendChild(ov);
  };
  App.acceptPdpa = async function () {
    try {
      const r = await api("apiAcceptPdpa", S.token, pdpaVersion());
      S.user.pdpaVersion = r.pdpaVersion;
      $("#pdpaGate")?.remove();
      toast("รับทราบแล้ว ขอบคุณครับ");
      App.render();
    } catch (e) { fail(e); }
  };
  App.showPdpa = () => drawer("ประกาศความเป็นส่วนตัว (PDPA)", `<div class="doc">${md(pdpaText())}</div><div class="xs faint mt-16">เวอร์ชัน ${esc(pdpaVersion())}${S.user?.pdpaVersion ? ` · คุณรับทราบแล้ว` : ""}</div>`);

  // =================================================================
  // คำเชิญบนหน้าแรก (เฉพาะเมื่อเปิด e-consent และยังไม่ตอบ)
  // =================================================================
  App.consentInviteHtml = function () {
    if (!econsentOn() || !S.user) return "";
    const st = S.consentStatus;
    if (st && st.record && ["signed", "declined"].includes(st.record.status)) return "";
    if (sessionStorage.getItem("seb_hide_consent")) return "";
    return `<div class="alert info mb-16"><div class="a-icon">${ic("file-certificate")}</div>
      <div class="grow"><div class="a-title">คำเชิญเข้าร่วมโครงการวิจัย (สมัครใจ)</div><div class="a-sub">อ่านเอกสารชี้แจง แล้วตัดสินใจภายหลังได้ การไม่เข้าร่วมไม่มีผลต่อการทำงานหรือการใช้ระบบ</div></div>
      <div class="row"><button class="btn ghost sm" onclick="sessionStorage.setItem('seb_hide_consent','1');this.closest('.alert').remove()">ภายหลัง</button><button class="btn sm" onclick="App.go('consent')">อ่านเอกสาร</button></div></div>`;
  };
  App.loadConsentStatus = async function () {
    if (!econsentOn()) return;
    try { S.consentStatus = await api("apiConsentStatus", S.token); } catch (_) {}
  };

  // =================================================================
  // หน้าแบบยินยอม (ผู้เข้าร่วม)
  // =================================================================
  App.pageConsent = async function () {
    setTitle("เอกสารยินยอมเข้าร่วมวิจัย");
    if (!econsentOn()) { $("#content").innerHTML = `<div class="card">${empty("ยังไม่เปิดใช้แบบยินยอมอิเล็กทรอนิกส์ ใช้แบบฟอร์มกระดาษตามขั้นตอนเดิม", "file-off")}</div>`; return; }
    $("#content").innerHTML = `<div class="card">${empty("กำลังโหลด…", "loader-2")}</div>`;
    try {
      let st = await api("apiConsentStatus", S.token);
      const r0 = st.record;
      if (!r0 || ["withdrawn", "declined"].includes(r0.status) && S.param === "restart") st = { ...st, ...(await api("apiConsentView", S.token)) };
      else if (!r0) st = { ...st, ...(await api("apiConsentView", S.token)) };
      S.consentStatus = st;
      renderConsent(st);
    } catch (e) { $("#content").innerHTML = `<div class="card">${empty(e.message, "alert-circle")}</div>`; }
  };

  function renderConsent(st) {
    const r = st.record || {};
    const wait = st.waitDays ?? waitDays();
    const readyAt = r.pisFirstViewedAt ? new Date(new Date(r.pisFirstViewedAt).getTime() + wait * 86400000) : null;
    const canSign = r.status === "viewed" && readyAt && Date.now() >= readyAt.getTime();
    const statusCard = {
      signed: `<div class="alert mb-16" style="background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 30%,var(--border))"><div class="a-icon" style="color:var(--ok)">${ic("circle-check")}</div><div class="grow"><div class="a-title">ท่านลงนามยินยอมแล้ว</div><div class="a-sub">เมื่อ ${fmtDT(r.signedAt)}${r.receivedAt ? ` · เจ้าหน้าที่รับเอกสารแล้ว` : ""}</div></div><div class="row"><button class="btn sm" onclick="App.printMyConsent()">${ic("printer")} สำเนาของท่าน</button><button class="btn sm danger-ghost" onclick="App.withdrawConsent()">ถอนความยินยอม</button></div></div>`,
      declined: `<div class="alert warn mb-16"><div class="a-icon">${ic("circle-x")}</div><div class="grow"><div class="a-title">ท่านแจ้งไม่ประสงค์เข้าร่วม</div><div class="a-sub">ข้อมูลของท่านจะไม่ถูกนำเข้าสู่ชุดข้อมูลวิจัย ท่านยังใช้ระบบได้ตามปกติ</div></div><button class="btn sm" onclick="App.go('consent','restart')">เปลี่ยนใจ / อ่านอีกครั้ง</button></div>`,
      withdrawn: `<div class="alert warn mb-16"><div class="a-icon">${ic("arrow-back-up")}</div><div class="grow"><div class="a-title">ท่านถอนความยินยอมแล้ว</div><div class="a-sub">เมื่อ ${fmtDT(r.withdrawnAt)} ข้อมูลที่ยังไม่ถูกวิเคราะห์จะถูกลบออกจากชุดข้อมูลวิจัย</div></div><button class="btn sm" onclick="App.go('consent','restart')">เริ่มใหม่</button></div>`,
    }[r.status] || "";
    const items = T().CONSENT_ITEMS;
    const u = S.user;
    $("#content").innerHTML = `${statusCard}
      <div class="split">
        <div class="card"><div class="card-head"><h3 class="grow">1. เอกสารชี้แจงข้อมูลสำหรับอาสาสมัครวิจัย</h3><span class="xs faint">ภาคผนวก ค</span></div>
          <div class="card-body doc" style="max-height:70vh;overflow:auto">${md(pisText())}</div></div>
        <div class="col gap-16">
          ${r.status === "viewed" ? `
          <div class="card card-pad">
            <h3>2. ระยะเวลาพิจารณา</h3>
            <div class="muted small mt-4">ตามโครงร่างวิจัย ท่านมีเวลาพิจารณาอย่างน้อย ${wait} วันก่อนลงนาม และสามารถสอบถามผู้วิจัยได้ก่อนตัดสินใจ</div>
            <div class="row between mt-12 small"><span class="muted">เปิดอ่านครั้งแรก</span><b>${fmtDT(r.pisFirstViewedAt)}</b></div>
            <div class="row between mt-4 small"><span class="muted">ลงนามได้ตั้งแต่</span><b class="${canSign ? "ind-good" : ""}">${readyAt ? fmtDT(readyAt.toISOString()) : "-"}</b></div>
            ${canSign ? "" : `<div class="alert warn mt-12" style="padding:10px 12px"><div class="small">ยังไม่ครบระยะเวลาพิจารณา กลับมาลงนามได้หลังวันที่ข้างต้น</div></div>`}
          </div>
          <div class="card card-pad">
            <h3>3. แบบยินยอม (ภาคผนวก ง)</h3>
            <div class="form-grid mt-12">
              <label class="field full"><span>ชื่อ-นามสกุล (ตัวบรรจง)</span><input class="input" id="csName" value="${esc(u.displayName || "")}"></label>
              <label class="field"><span>ตำแหน่ง</span><input class="input" id="csPos" value="${esc(u.position || "")}"></label>
              <label class="field"><span>อายุ (ปี)</span><input class="input" id="csAge" type="number" min="18" max="80"></label>
              <label class="field full"><span>หน่วยงาน</span><input class="input" id="csUnit" placeholder="เช่น ห้องอุบัติเหตุ-ฉุกเฉิน"></label>
            </div>
            <div class="doc small mt-16">${md(T().CONSENT_INTRO)}</div>
            <div class="label mt-12">ข้าพเจ้าเข้าใจ และยินยอมในประเด็นต่อไปนี้</div>
            <div class="col gap-8 mt-8">${items.map((t, i) => `<label class="check small" style="align-items:flex-start"><input type="checkbox" data-cs="${i}" style="margin-top:3px"> <span>${i + 1}) ${esc(t)}</span></label>`).join("")}</div>
            <div class="doc small mt-12">${md(T().CONSENT_CLOSE)}</div>
            <div class="label mt-16">ลายมือชื่ออาสาสมัคร</div>
            <div class="sig-wrap mt-8"><canvas id="sigPad"></canvas><button class="btn ghost sm sig-clear" onclick="App.sigClear()">ล้าง</button><div class="sig-hint">เซ็นชื่อในกรอบนี้ด้วยนิ้วหรือเมาส์</div></div>
            <div class="row wrap mt-16" style="justify-content:flex-end"><button class="btn ghost" onclick="App.declineConsent()">ไม่ประสงค์เข้าร่วม</button><button class="btn primary" id="csBtn" ${canSign ? "" : "disabled"} onclick="App.signConsent()">${ic("signature")} ลงนามยินยอม</button></div>
          </div>` : `<div class="card card-pad"><h3>สิทธิของท่าน</h3><div class="muted small mt-8">การเข้าร่วมเป็นไปโดยสมัครใจ ท่านถอนตัวได้ทุกเมื่อโดยไม่ต้องระบุเหตุผล และไม่มีผลกระทบต่อการปฏิบัติงาน สอบถามสิทธิอาสาสมัครได้ที่เลขานุการคณะกรรมการจริยธรรมการวิจัยฯ สสจ.อุทัยธานี โทร. 0 5651 1565 ต่อ 101</div></div>`}
        </div>
      </div>`;
    if (r.status === "viewed") initSig();
  }

  // ---------------- signature pad ----------------
  let sig = { drawn: false };
  function initSig() {
    const c = $("#sigPad");
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const w = c.parentElement.clientWidth, h = 160;
    c.width = w * ratio; c.height = h * ratio; c.style.width = w + "px"; c.style.height = h + "px";
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    let down = false, last = null;
    const pos = (e) => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    c.onpointerdown = (e) => { down = true; last = pos(e); c.setPointerCapture(e.pointerId); e.preventDefault(); };
    c.onpointermove = (e) => { if (!down) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; sig.drawn = true; c.parentElement.classList.add("signed"); };
    c.onpointerup = c.onpointercancel = () => { down = false; };
    sig = { drawn: false, c };
  }
  App.sigClear = () => { const c = $("#sigPad"); if (!c) return; c.getContext("2d").clearRect(0, 0, c.width, c.height); sig.drawn = false; c.parentElement.classList.remove("signed"); };

  App.signConsent = async function () {
    const agreed = $$("[data-cs]").map((el) => el.checked);
    if (!agreed.every(Boolean)) return toast("กรุณาทำเครื่องหมายยินยอมให้ครบทุกข้อ", true);
    if (!$("#csName").value.trim()) return toast("กรุณากรอกชื่อ-นามสกุล", true);
    if (!sig.drawn) return toast("กรุณาลงลายมือชื่อในกรอบ", true);
    const ok = await dialog({ title: "ยืนยันการลงนามยินยอม", body: "ท่านยืนยันว่าได้อ่านเอกสารชี้แจงครบถ้วน และลงนามโดยสมัครใจ ไม่มีผู้วิจัยหลักหรือผู้บังคับบัญชาอยู่ด้วยขณะตัดสินใจ", confirm: "ยืนยันลงนาม" });
    if (!ok) return;
    try {
      const r = await api("apiConsentSign", S.token, { fullName: $("#csName").value.trim(), position: $("#csPos").value.trim(), age: $("#csAge").value, unit: $("#csUnit").value.trim(), agreedItems: agreed, signatureData: sig.c.toDataURL("image/png") });
      S.consentStatus = { ...S.consentStatus, record: r.record };
      toast("บันทึกการลงนามแล้ว ขอบคุณที่เข้าร่วมโครงการ");
      App.render();
    } catch (e) { fail(e); }
  };
  App.declineConsent = async function () {
    if (!(await dialog({ title: "ไม่ประสงค์เข้าร่วมโครงการวิจัย?", body: "ท่านยังใช้ระบบได้ตามปกติทุกประการ และไม่มีผลกระทบต่อการปฏิบัติงาน", confirm: "ยืนยัน" }))) return;
    try { const r = await api("apiConsentDecline", S.token); S.consentStatus = { ...S.consentStatus, record: r.record }; App.render(); } catch (e) { fail(e); }
  };
  App.withdrawConsent = async function () {
    const reason = await dialog({ title: "ถอนความยินยอม", body: "ไม่จำเป็นต้องระบุเหตุผล ข้อมูลที่ยังไม่ถูกวิเคราะห์จะถูกลบออกจากชุดข้อมูลวิจัย", input: { placeholder: "เหตุผล (ไม่บังคับ)" }, confirm: "ถอนความยินยอม", danger: true });
    if (reason === null) return;
    try { const r = await api("apiConsentWithdraw", S.token, reason); S.consentStatus = { ...S.consentStatus, record: r.record }; toast("ถอนความยินยอมแล้ว"); App.render(); } catch (e) { fail(e); }
  };

  // ---------------- พิมพ์สำเนาแบบยินยอม (2 ฉบับ) ----------------
  function consentDoc(r, copies) {
    const items = T().CONSENT_ITEMS;
    const page = (n) => `<section class="pg"><div class="cp">ฉบับที่ ${n}${n === 1 ? " (อาสาสมัคร)" : " (ผู้วิจัย)"}</div>
      <h1>เอกสารแสดงความยินยอมโดยได้รับการบอกกล่าว</h1>
      <p>ข้าพเจ้า <u>${esc(r.fullName || "")}</u> อายุ <u>${esc(r.age || "-")}</u> ปี ตำแหน่ง <u>${esc(r.position || "-")}</u> หน่วยงาน <u>${esc(r.unit || "-")}</u> โรงพยาบาลลานสัก</p>
      ${md(T().CONSENT_INTRO)}
      <p><b>ข้าพเจ้าเข้าใจ และยินยอมในประเด็นต่อไปนี้</b></p>
      <ol>${items.map((t, i) => `<li>${(r.agreedItems || [])[i] ? "☑" : "☐"} ${esc(t)}</li>`).join("")}</ol>
      ${md(T().CONSENT_CLOSE)}
      <div class="sigs"><div><img src="${r.signatureData || ""}" alt=""><div>ลงนาม อาสาสมัครวิจัย</div><div>(${esc(r.fullName || "")})</div><div>วันที่ ${thDate(r.signedAt)}</div></div>
        <div><div class="line"></div><div>ลงนาม ผู้ชี้แจงข้อมูล</div><div>(นายนที อิ่มใจจิตร์)</div><div>วันที่ ........................................</div></div>
        <div><div class="line">${r.receivedBy ? esc(r.receivedBy) : ""}</div><div>ผู้รับเอกสารยินยอมที่ได้รับมอบหมาย</div><div>วันที่ ${r.receivedAt ? thDate(r.receivedAt) : "........................................"}</div></div></div>
      <div class="meta">ลงนามอิเล็กทรอนิกส์ผ่านระบบ SEB · รหัสเอกสาร ${esc(String(r.id || "").slice(0, 8))} · เปิดอ่านเอกสารชี้แจงครั้งแรก ${fmtDT(r.pisFirstViewedAt)} · ลงนาม ${fmtDT(r.signedAt)} · ${esc(r.docVersion || "")}</div></section>`;
    const css = `*{box-sizing:border-box}body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:11pt;color:#111;margin:0}@page{size:A4;margin:16mm}
      .pg{page-break-after:always}.pg:last-child{page-break-after:auto}.cp{text-align:right;font-size:9pt;color:#666}
      h1{font-size:14pt;text-align:center;margin:4mm 0 5mm}p,li{line-height:1.6;margin:0 0 2mm}ol{padding-left:0;list-style:none}h3{font-size:11pt;margin:3mm 0 1mm}ul{margin:0 0 2mm 5mm;padding:0}
      .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:8mm;text-align:center;font-size:10pt}.sigs img{height:18mm;max-width:100%;object-fit:contain;border-bottom:0.3mm solid #333;display:block;margin:0 auto 1mm}
      .line{height:18mm;border-bottom:0.3mm solid #333;margin-bottom:1mm;display:flex;align-items:flex-end;justify-content:center}.meta{margin-top:8mm;font-size:8pt;color:#777;border-top:0.2mm solid #ccc;padding-top:2mm}`;
    const href = new URL("./vendor/fonts.css", location.href).href;
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="${href}"><style>${css}</style></head><body>${Array.from({ length: copies }, (_, i) => page(i + 1)).join("")}</body></html>`;
  }
  function printDoc(html) {
    drawer("พิมพ์แบบยินยอม", `<div class="print-preview" style="min-height:70vh"><iframe id="csFrame" style="width:794px;height:1123px"></iframe></div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ปิด</button><button class="btn primary" onclick="try{SEB.$('#csFrame').contentWindow.print()}catch(e){SEB.toast('พิมพ์จากหน้านี้ไม่ได้',true)}">${ic("printer")} พิมพ์</button>`, { wide: true });
    const fr = $("#csFrame");
    fr.srcdoc = html;
    fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + "px"; } catch (_) {} const sc = Math.min(1, ($(".print-preview").clientWidth - 32) / 794); fr.style.transform = `scale(${sc})`; fr.style.transformOrigin = "top center"; };
  }
  App.printMyConsent = () => App.printConsent("mine", 1);
  App.printConsent = async (id, copies = 2) => { try { const r = await api("apiGetConsent", S.token, id); printDoc(consentDoc(r.record, copies)); } catch (e) { fail(e); } };

  // =================================================================
  // ผู้ดูแล / เจ้าหน้าที่รับเอกสาร: รายการความยินยอม
  // =================================================================
  const STATUS = { viewed: ["เปิดอ่านแล้ว", "info"], signed: ["ยินยอม", "ok"], declined: ["ไม่ประสงค์เข้าร่วม", ""], withdrawn: ["ถอนตัว", "warn"] };
  App.consentListHtml = async function () {
    const r = await api("apiListConsents", S.token);
    S.consentList = r.users;
    const rows = r.users;
    const n = (s) => rows.filter((u) => u.consent?.status === s).length;
    const paper = rows.filter((u) => u.researchConsent && u.consent?.status !== "signed").length;
    return `<div class="grid grid-4 mb-16">${X.kpi("ยินยอม (อิเล็กทรอนิกส์)", n("signed"), "signature", "ok")}${X.kpi("ยินยอม (กระดาษ)", paper, "file-text", "accent", "ติ๊กในหน้าผู้ใช้งาน")}${X.kpi("กำลังพิจารณา", n("viewed"), "hourglass", "warn")}${X.kpi("ไม่เข้าร่วม / ถอนตัว", n("declined") + n("withdrawn"), "user-x", "violet")}</div>
      <div class="card"><div class="table-wrap"><table class="t responsive"><thead><tr><th>ผู้ใช้</th><th>รหัส</th><th>PDPA</th><th>สถานะความยินยอม</th><th>เปิดอ่าน</th><th>ลงนาม</th><th>รับเอกสาร</th><th></th></tr></thead><tbody>
      ${rows.map((u) => { const c = u.consent; const [t, cl] = c ? STATUS[c.status] : [u.researchConsent ? "ยินยอม (กระดาษ)" : "ยังไม่ตอบ", u.researchConsent ? "ok" : ""];
        return `<tr><td data-l="ผู้ใช้"><b>${esc(u.displayName)}</b><div class="xs faint">${esc(u.position)}</div></td><td data-l="รหัส" class="mono">${esc(u.staffCode || "-")}</td><td data-l="PDPA">${u.pdpaAcceptedAt ? `<span class="pill ok plain">${fmtD(u.pdpaAcceptedAt)}</span>` : `<span class="faint small">ยังไม่รับทราบ</span>`}</td>
          <td data-l="สถานะ"><span class="pill ${cl}">${t}</span></td><td data-l="เปิดอ่าน" class="tabnum">${c?.pisFirstViewedAt ? fmtD(c.pisFirstViewedAt) : "-"}</td><td data-l="ลงนาม" class="tabnum">${c?.signedAt ? fmtDT(c.signedAt) : "-"}</td>
          <td data-l="รับเอกสาร">${c?.receivedAt ? `<span class="xs">${esc(c.receivedBy)}<br>${fmtD(c.receivedAt)}</span>` : c?.status === "signed" && S.user.consentOfficer ? `<button class="btn sm" onclick="App.receiveConsent('${c.id}')">ยืนยันรับ</button>` : "-"}</td>
          <td class="right">${c?.status === "signed" ? `<button class="btn sm" onclick="App.printConsent('${c.id}')">${ic("printer")} พิมพ์ 2 ฉบับ</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div></div>
      <div class="xs faint mt-12">${ic("lock")} ดูลายมือชื่อได้เฉพาะผู้ดูแลระบบและเจ้าหน้าที่รับเอกสารยินยอมที่ได้รับมอบหมาย ทุกครั้งที่เปิดดูถูกบันทึกใน audit log</div>`;
  };
  App.receiveConsent = async (id) => { try { await api("apiConsentReceive", S.token, id); toast("บันทึกการรับเอกสารแล้ว"); App.render(); } catch (e) { fail(e); } };

  // หน้าสำหรับเจ้าหน้าที่รับเอกสาร (ไม่ใช่ admin)
  App.pageConsentAdmin = async function () {
    setTitle("รับเอกสารยินยอม");
    $("#content").innerHTML = `<div class="card">${empty("กำลังโหลด…", "loader-2")}</div>`;
    try { $("#content").innerHTML = await App.consentListHtml(); } catch (e) { $("#content").innerHTML = `<div class="card">${empty(e.message, "alert-circle")}</div>`; }
  };
})();
