/* =====================================================================
   SEB v2 — public pages: QR open box (หน้างาน) + survey (ภาคผนวก ข)
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { api, esc, ic, $, $$, fmtD, fmtT, localInput, daysUntil, toast, fail, LOGO, REASONS } = X;
  const App = window.App;
  let P = { box: null, reason: "", used: {}, editTime: false, boxId: "", t: "" };

  // =================================================================
  // QR open
  // =================================================================
  App.renderPublicOpen = async function (boxId, t) {
    P = { box: null, reason: "", used: {}, editTime: false, boxId, t, offline: false };
    document.title = "เปิดกล่องยาฉุกเฉิน · SEB";
    $("#app").innerHTML = `<div class="public"><div class="public-wrap"><div class="card public-hero">${X.empty("กำลังโหลดข้อมูลกล่อง…", "loader-2")}</div></div></div>`;
    const cacheKey = `seb_box_${boxId}`;
    const apply = (r) => {
      P.box = r.box;
      P.hospital = r.hospitalName;
      P.phone = r.pharmacyPhone || "";
      P.recent = r.recentOpeners || [];
      P.reasons = r.openReasons && r.openReasons.length ? r.openReasons : REASONS;
    };
    try {
      const r = await api("apiPublicGetBox", boxId, t);
      apply(r);
      try { localStorage.setItem(cacheKey, JSON.stringify({ ...r, cachedAt: new Date().toISOString() })); } catch (_) {}
      renderOpen();
    } catch (e) {
      if (e.network) {
        // ออฟไลน์: ใช้ข้อมูลกล่องที่เคยโหลดไว้ ถ้าไม่มี ใช้ฟอร์มขั้นต่ำ (HN / เหตุผล / ผู้เปิด / เวลา)
        let c = null;
        try { c = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch (_) {}
        apply(c || { box: { id: boxId, boxCode: "กล่องยาฉุกเฉิน", items: [], state: "unknown", status: "ออฟไลน์" }, hospitalName: "" });
        P.offline = true;
        P.cachedAt = c?.cachedAt || "";
        renderOpen();
        return;
      }
      $("#app").innerHTML = `<div class="public"><div class="public-wrap"><div class="card card-pad center"><div class="success-mark" style="background:var(--danger-soft);color:var(--danger-text)">${ic("qrcode-off")}</div><h2>ไม่พบข้อมูลกล่องยา</h2><div class="muted mt-8">${esc(e.message)}</div><div class="small mt-16">ถ้าต้องใช้ยาเร่งด่วน ใช้ยาได้ทันที แล้วแจ้งห้องยาทางโทรศัพท์</div></div></div></div>`;
    }
  };

  function renderOpen() {
    const b = P.box;
    const counts = b.items.reduce((a, it) => { a[it.expiryState] = (a[it.expiryState] || 0) + 1; return a; }, {});
    const drugs = [];
    b.items.forEach((it) => { if (!drugs.find((d) => d.drugName === it.drugName && d.strength === it.strength)) drugs.push({ drugName: it.drugName, strength: it.strength || "", unit: it.unit || "" }); });
    P.drugs = drugs;
    const savedName = localStorage.getItem("seb_opener") || "";
    let mine = [];
    try { mine = JSON.parse(localStorage.getItem("seb_openers") || "[]"); } catch (e) { mine = []; }
    if (savedName && !mine.includes(savedName)) mine.unshift(savedName);
    const names = [...new Set([...mine, ...(P.recent || [])])].slice(0, 12);
    P.names = names;
    const statePill = b.state === "ready" ? `<span class="pill ok">พร้อมใช้</span>` : b.state === "opened" || b.state === "refilling" ? `<span class="pill warn">มีเคสเปิดค้างอยู่</span>` : `<span class="pill danger">${esc(b.status)}</span>`;
    $("#app").innerHTML = `
    <div class="public"><div class="public-wrap">${demoBack()}
      <div class="row between"><div class="row"><div class="brand-mark">${window.SEB.LOGO_B}</div><div><div style="font-weight:650;font-size:13px">กล่องยาฉุกเฉิน</div><div class="xs faint">${esc(P.hospital || "")}</div></div></div>${statePill}</div>
      <div class="card public-hero">
        <div class="xs faint">${esc(b.location || "")} · ${b.locationZone === "out" ? "นอก รพ." : "ใน รพ."}</div>
        <div class="public-code mt-4">${esc(b.boxCode)}</div>
        <div class="row wrap mt-12 small muted">${esc(b.kitName || "")}${b.sealNo ? ` · ซีล <span class="mono">${esc(b.sealNo)}</span>` : ""}</div>
        ${P.offline ? `<div class="alert warn mt-16" style="padding:10px 12px"><div class="small"><b>${ic("wifi-off")} ไม่มีอินเทอร์เน็ต</b> บันทึกได้ตามปกติ ระบบจะเก็บไว้ในเครื่องและส่งให้ห้องยาอัตโนมัติเมื่อกลับมาออนไลน์${P.cachedAt ? ` · ข้อมูลกล่อง ณ ${fmtD(P.cachedAt)} ${fmtT(P.cachedAt)} น.` : ""}</div></div>` : ""}
        ${outboxCount() ? `<div class="alert warn mt-12" style="padding:10px 12px"><div class="grow small">มีบันทึกที่ยังไม่ได้ส่ง <b>${outboxCount()}</b> รายการ</div><button class="btn sm" onclick="App.flushOutbox(true)">ส่งตอนนี้</button></div>` : ""}
        <div class="alert info mt-16" style="padding:10px 12px"><div class="small"><b>รักษาผู้ป่วยก่อนเสมอ</b> ใช้ยาได้ทันทีโดยไม่ต้องสแกนก่อน แล้วค่อยกลับมาบันทึกเมื่อสถานการณ์ปลอดภัย</div></div>
      </div>

      <div class="card card-pad">
        <div class="label">HN ผู้ป่วย <span style="color:var(--danger)">*</span></div>
        <div class="hn-grid mt-8" id="hnGrid">${Array.from({ length: 9 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" data-hn="${i}" aria-label="HN หลักที่ ${i + 1}">`).join("")}</div>
        <div class="xs faint mt-8">ตัวเลข 9 หลัก พิมพ์ต่อเนื่องหรือวางทั้งชุดได้ · HN ไม่แสดงในข้อความแจ้งเตือน</div>
        <details class="pdpa-mini mt-12"><summary>${ic("shield-lock")} การคุ้มครองข้อมูลส่วนบุคคล</summary><div class="xs muted mt-8">${esc(window.SEB_TEXT.PDPA_PUBLIC)}</div></details>
      </div>

      <div class="card card-pad">
        <div class="row between"><div class="label">เวลาเปิดใช้จริง</div><button class="btn ghost sm" onclick="App.pubToggleTime()">${ic("clock-edit")} บันทึกย้อนหลัง</button></div>
        <div id="timeBox" class="mt-8"><div style="font-size:20px;font-weight:650" class="tabnum">ตอนนี้ · ${fmtT(new Date().toISOString())} น.</div></div>
      </div>

      <div class="card card-pad">
        <div class="label">เหตุผลการเปิดใช้ <span style="color:var(--danger)">*</span></div>
        <div class="chips reason-chips mt-8">${P.reasons.map((r, i) => `<button type="button" class="chip" onclick="App.pubReason(this,${i})">${esc(r)}</button>`).join("")}</div>
        <div class="field mt-16"><span>ผู้เปิดใช้</span><input class="input" id="pubOpener" list="openerList" autocomplete="off" value="${esc(savedName)}" placeholder="ชื่อ-ตำแหน่ง เช่น พว.สมใจ" oninput="App.pubOpenerSync()"></div>
        <datalist id="openerList">${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        ${names.length ? `<div class="xs faint mt-12">เคยบันทึก · แตะเพื่อเลือก</div><div class="chips opener-chips mt-8">${names.map((n, i) => `<button type="button" class="chip${n === savedName ? " on" : ""}" data-op="${i}" onclick="App.pubOpener(${i})">${ic("user")} ${esc(n)}</button>`).join("")}</div>` : ""}
      </div>

      ${drugs.length ? "" : "<!--"}<details class="card card-pad">
        <summary style="cursor:pointer;font-weight:600">ยาที่ใช้ไป <span class="xs faint" style="font-weight:400">(ไม่บังคับ · ห้องยาบันทึกต่อได้)</span></summary>
        <div class="mt-12">${drugs.map((d, i) => `<div class="list-row" style="padding:10px 0"><div class="grow">${esc(d.drugName)} <span class="muted small">${esc(d.strength)}</span></div><div class="stepper"><button onclick="App.pubStep(${i},-1)">−</button><span id="st${i}">0</span><button onclick="App.pubStep(${i},1)">+</button></div></div>`).join("")}</div>
      </details>

      ${drugs.length ? "" : "-->"}${b.items.length ? "" : "<!--"}<details class="card card-pad">
        <summary style="cursor:pointer;font-weight:600">รายการยาในกล่อง <span class="xs faint" style="font-weight:400">${counts.expired ? `· หมดอายุ ${counts.expired}` : ""}${counts.near ? ` · ใกล้หมด ${counts.near}` : ""}</span></summary>
        <div class="mt-12">${b.items.map((it) => `<div class="list-row" style="padding:10px 0"><div class="grow"><div>${esc(it.drugName)} <span class="muted small">${esc(it.strength || "")}</span></div><div class="xs faint">lot ${esc(it.lot || "–")} · ${esc(it.qty)} ${esc(it.unit || "")}</div></div>${it.expiryState === "expired" ? `<span class="pill danger">หมดอายุ</span>` : it.expiryState === "near" ? `<span class="pill warn">${fmtD(it.expiryDate)}</span>` : `<span class="pill ok plain">${fmtD(it.expiryDate)}</span>`}</div>`).join("")}</div>
      </details>${b.items.length ? "" : "-->"}
    </div></div>
    <div class="sticky-cta"><div><button class="btn emergency block" id="pubBtn" onclick="App.pubSubmit()">${ic("urgent")} ยืนยันเปิดกล่องและแจ้งห้องยา</button></div></div>`;
    bindHn();
  }

  function bindHn() {
    const inputs = $$("[data-hn]");
    inputs.forEach((inp, i) => {
      inp.addEventListener("input", (e) => {
        const v = inp.value.replace(/\D/g, "");
        if (v.length > 1) { fillFrom(i, v); return; }
        inp.value = v;
        inp.classList.toggle("filled", !!v);
        if (v && i < 8) inputs[i + 1].focus();
      });
      inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && i > 0) { inputs[i - 1].focus(); inputs[i - 1].value = ""; inputs[i - 1].classList.remove("filled"); } });
      inp.addEventListener("paste", (e) => { e.preventDefault(); fillFrom(0, (e.clipboardData.getData("text") || "").replace(/\D/g, "")); });
    });
    function fillFrom(start, digits) {
      digits.split("").slice(0, 9 - start).forEach((d, k) => { inputs[start + k].value = d; inputs[start + k].classList.add("filled"); });
      inputs[Math.min(8, start + digits.length)].focus();
    }
  }
  // ---------- คิวออฟไลน์ (เก็บในเครื่องจนกว่าจะส่งสำเร็จ แล้วลบทิ้งทันที) ----------
  const OUT = "seb_outbox";
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const readOut = () => { try { return JSON.parse(localStorage.getItem(OUT) || "[]"); } catch (_) { return []; } };
  const writeOut = (a) => { try { a.length ? localStorage.setItem(OUT, JSON.stringify(a)) : localStorage.removeItem(OUT); } catch (_) {} };
  const outboxCount = () => readOut().length;
  App.outboxCount = outboxCount;
  function queueOpen(payload) {
    const a = readOut();
    a.push({ ...payload, offlineQueued: true, boxCode: P.box?.boxCode || "", queuedAt: new Date().toISOString() });
    writeOut(a);
    scheduleFlush();
  }
  let flushing = false, flushTimer = null;
  function scheduleFlush() { if (!flushTimer) flushTimer = setInterval(() => App.flushOutbox(), 30000); }
  App.flushOutbox = async function (manual = false) {
    if (flushing) return;
    const a = readOut();
    if (!a.length) { if (flushTimer) { clearInterval(flushTimer); flushTimer = null; } return; }
    flushing = true;
    let sent = 0, dropped = 0;
    const keep = [];
    for (const p of a) {
      try {
        const { boxCode, queuedAt, ...body } = p;
        await api("apiOpenBoxPublic", body);
        sent++;
      } catch (e) {
        if (e.network) keep.push(p);
        else { dropped++; try { const f = JSON.parse(localStorage.getItem("seb_outbox_failed") || "[]"); f.push({ boxCode: p.boxCode, at: p.actualOpenedAt, error: e.message }); localStorage.setItem("seb_outbox_failed", JSON.stringify(f.slice(-20))); } catch (_) {} }
      }
    }
    writeOut(keep);
    flushing = false;
    if (keep.length) scheduleFlush(); else if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    if (sent) toast(`ส่งบันทึกที่ค้างไว้ให้ห้องยาแล้ว ${sent} รายการ`);
    else if (manual && keep.length) toast("ยังเชื่อมต่อไม่ได้ ระบบจะลองส่งใหม่อัตโนมัติ", true);
    if (dropped) toast(`มี ${dropped} รายการที่ระบบไม่รับ (เช่น บันทึกซ้ำ) กรุณาแจ้งห้องยา`, true);
  };
  window.addEventListener("online", () => App.flushOutbox());
  if (readOut().length) setTimeout(() => App.flushOutbox(), 1500);

  function renderQueued() {
    const tel = P.phone ? `<a class="btn emergency block mt-16" href="tel:${esc(P.phone)}">${ic("phone")} โทรแจ้งห้องยา ${esc(P.phone)}</a>` : `<div class="small mt-16"><b>กรุณาโทรแจ้งห้องยา</b></div>`;
    $("#app").innerHTML = `<div class="public"><div class="public-wrap" style="padding-top:48px"><div class="card card-pad center" style="padding:32px 24px">
      <div class="success-mark" style="background:var(--warn-soft);color:var(--warn-text)">${ic("wifi-off")}</div><h2 style="font-size:22px">บันทึกไว้ในเครื่องแล้ว</h2>
      <div class="muted mt-8">ตอนนี้ไม่มีอินเทอร์เน็ต <b>ห้องยายังไม่ได้รับแจ้ง</b> ระบบจะส่งให้อัตโนมัติเมื่อเครื่องกลับมาออนไลน์ (เวลาเปิดใช้จริงที่บันทึกไว้ไม่เปลี่ยน)</div>
      ${tel}
      <div class="card mt-24" style="padding:14px;background:var(--surface-2)"><div class="xs faint">รอส่ง</div><div style="font-size:22px;font-weight:700" id="qCount">${outboxCount()} รายการ</div><div class="small muted mt-4">${esc(P.box?.boxCode || "")}</div></div>
      <button class="btn mt-16" onclick="App.flushOutbox(true).then(()=>{const n=App.outboxCount();SEB.$('#qCount').textContent=n+' รายการ';if(!n)SEB.$('#qCount').textContent='ส่งแล้ว ✓'})">${ic("refresh")} ลองส่งตอนนี้</button>
      <div class="xs faint mt-16">อย่าล้างข้อมูลเบราว์เซอร์จนกว่าจะส่งสำเร็จ · HN ถูกลบจากเครื่องทันทีหลังส่ง</div></div>${demoBack()}</div></div>`;
  }

  const demoBack = () => (X.DEMO ? `<button class="btn ghost sm" style="align-self:flex-start" onclick="App.renderLogin()">${ic("arrow-left")} กลับหน้าเข้าสู่ระบบ (โหมดตัวอย่าง)</button>` : "");
  App._demoBack = demoBack;
  const hnValue = () => $$("[data-hn]").map((i) => i.value).join("");

  App.pubToggleTime = () => {
    P.editTime = !P.editTime;
    $("#timeBox").innerHTML = P.editTime ? `<input class="input" type="datetime-local" id="pubTime" value="${localInput()}" max="${localInput()}"><div class="xs faint mt-8">ระบบเก็บทั้งเวลาเปิดจริงและเวลาที่บันทึก แยกกัน</div>` : `<div style="font-size:20px;font-weight:650" class="tabnum">ตอนนี้ · ${fmtT(new Date().toISOString())} น.</div>`;
  };
  App.pubReason = (btn, i) => { P.reason = P.reasons[i]; $$(".reason-chips .chip").forEach((c) => c.classList.toggle("on", c === btn)); };
  App.pubOpener = (i) => { $("#pubOpener").value = P.names[i]; App.pubOpenerSync(); };
  App.pubOpenerSync = () => { const v = $("#pubOpener").value.trim(); $$("[data-op]").forEach((c) => c.classList.toggle("on", P.names[+c.dataset.op] === v)); };
  App.pubStep = (i, d) => { P.used[i] = Math.max(0, (P.used[i] || 0) + d); $(`#st${i}`).textContent = P.used[i]; };

  App.pubSubmit = async function () {
    const hn = hnValue();
    if (!/^\d{9}$/.test(hn)) { $$("[data-hn]").forEach((i) => !i.value && i.classList.add("err")); $("#hnGrid").scrollIntoView({ behavior: "smooth", block: "center" }); return toast("กรุณากรอก HN ผู้ป่วยให้ครบ 9 หลัก", true); }
    if (!P.reason) return toast("กรุณาเลือกเหตุผลการเปิดใช้", true);
    const opener = $("#pubOpener").value.trim();
    if (opener) {
      localStorage.setItem("seb_opener", opener);
      try { const m = JSON.parse(localStorage.getItem("seb_openers") || "[]").filter((n) => n !== opener); m.unshift(opener); localStorage.setItem("seb_openers", JSON.stringify(m.slice(0, 10))); } catch (e) {}
    }
    const btn = $("#pubBtn");
    btn.disabled = true;
    btn.innerHTML = `${ic("loader-2")} กำลังบันทึกและแจ้งห้องยา…`;
    const actual = P.editTime && $("#pubTime")?.value ? new Date($("#pubTime").value).toISOString() : new Date().toISOString();
    const itemsUsed = Object.entries(P.used).filter(([, q]) => q > 0).map(([i, q]) => ({ ...P.drugs[i], qty: q }));
    const payload = { boxId: P.boxId, qrToken: P.t, hn, reasonCategory: P.reason, openerName: opener, actualOpenedAt: actual, itemsUsed, clientRequestId: uuid(), clientSubmittedAt: new Date().toISOString() };
    try {
      let r;
      try {
        r = await api("apiOpenBoxPublic", payload);
      } catch (e) {
        if (!e.network) throw e;
        queueOpen(payload);
        return renderQueued();
      }
      $("#app").innerHTML = `<div class="public"><div class="public-wrap" style="padding-top:48px"><div class="card card-pad center" style="padding:32px 24px">
        <div class="success-mark">${ic("check")}</div><h2 style="font-size:22px">บันทึกแล้ว</h2>
        <div class="muted mt-8">${r.notified ? "ห้องยาได้รับการแจ้งเตือนแล้ว เภสัชกรจะมาเติมยาโดยเร็ว" : "บันทึกเรียบร้อย กรุณาโทรแจ้งห้องยาด้วย (ระบบแจ้งเตือนขัดข้อง)"}</div>
        <div class="card mt-24" style="padding:14px;background:var(--surface-2)"><div class="xs faint">รหัสเหตุการณ์</div><div class="mono" style="font-size:22px;font-weight:700;letter-spacing:.04em">${esc(r.eventCode)}</div><div class="small muted mt-4">${esc(P.box.boxCode)} · ${esc(P.box.location || "")}</div></div>
        <div class="xs faint mt-16">ปิดหน้านี้ได้เลย</div></div>${demoBack()}</div></div>`;
    } catch (e) {
      fail(e);
      btn.disabled = false;
      btn.innerHTML = `${ic("urgent")} ยืนยันเปิดกล่องและแจ้งห้องยา`;
    }
  };

  // =================================================================
  // Survey — ตรงตามภาคผนวก ข (ฉบับ EC รับรอง)
  // =================================================================
  const PART1 = [
    ["gender", "1. เพศ", ["ชาย", "หญิง", "ไม่ระบุ"]],
    ["ageGroup", "2. อายุ", ["< 25 ปี", "25–34 ปี", "35–44 ปี", "45 ปีขึ้นไป"]],
    ["profession", "3. ตำแหน่ง/วิชาชีพ", ["เภสัชกร", "พยาบาลวิชาชีพ", "เจ้าพนักงานเภสัชกรรม", "เจ้าพนักงานสาธารณสุข", "อื่น ๆ"]],
    ["experience", "4. ประสบการณ์การทำงาน", ["น้อยกว่า 2 ปี", "2–5 ปี", "6–10 ปี", "มากกว่า 10 ปี"]],
    ["usageFrequency", "5. ความถี่ในการใช้งานระบบ SEB", ["ทุกวัน", "2–3 ครั้ง/สัปดาห์", "1 ครั้ง/สัปดาห์", "1 ครั้ง/เดือน"]],
    ["smartphoneSkill", "6. ความคุ้นเคยกับการใช้สมาร์ตโฟน", ["ใช้ได้คล่อง", "ใช้ได้บ้าง", "ไม่คล่อง"]],
  ];
  const PART2 = [
    ["ด้านที่ 1: ความง่ายในการใช้งาน (Usability)", ["การสแกน QR Code เพื่อเปิดกล่องยาทำได้ง่ายและรวดเร็ว", "หน้าจอแสดงผลมีความชัดเจน เข้าใจง่าย", "ขั้นตอนการบันทึกข้อมูลไม่ซับซ้อน ใช้เวลาน้อย", "ระบบสามารถใช้งานได้บนโทรศัพท์มือถือได้สะดวก", "การเรียนรู้ระบบทำได้ง่าย ไม่ต้องใช้เวลานาน"]],
    ["ด้านที่ 2: ประสิทธิภาพของระบบ (System Performance)", ["ระบบแจ้งเตือนเภสัชกรได้รวดเร็วเมื่อมีการเปิดกล่องยา", "การแจ้งเตือนยาใกล้หมดอายุผ่านการแจ้งเตือนในระบบมีความทันเวลา", "ข้อมูลในระบบมีความถูกต้องและครบถ้วน", "ระบบทำงานได้เสถียร ไม่เกิดข้อผิดพลาดบ่อย", "ความเร็วในการตอบสนองของระบบอยู่ในระดับที่พอใจ"]],
    ["ด้านที่ 3: ประโยชน์ที่ได้รับ (Perceived Usefulness)", ["ระบบ SEB ช่วยลดภาระงานเอกสารได้จริง", "ระบบช่วยให้การประสานงานระหว่างแผนกรวดเร็วขึ้น", "ระบบช่วยลดความเสี่ยงจากยาหมดอายุในกล่องยาฉุกเฉิน", "ข้อมูลสถิติจากระบบมีประโยชน์ต่อการวางแผนงาน", "ระบบช่วยเพิ่มความมั่นใจในความพร้อมใช้ของกล่องยา"]],
    ["ด้านที่ 4: ความเชื่อมั่นและความปลอดภัย (Trust & Safety)", ["ท่านเชื่อมั่นในความถูกต้องของข้อมูลในระบบ", "ระบบ SEB ช่วยเพิ่มความปลอดภัยให้กับผู้ป่วยได้จริง", "ท่านรู้สึกมั่นใจในการใช้ระบบ SEB แทนระบบกระดาษเดิม", "ระบบมีความปลอดภัยด้านข้อมูล ไม่รั่วไหล"]],
    ["ด้านที่ 5: ความพึงพอใจโดยรวมและการยอมรับระบบ", ["ท่านพึงพอใจต่อระบบ SEB โดยรวม", "ท่านต้องการใช้งานระบบ SEB ต่อไปในอนาคต", "หากมีโอกาสท่านจะแนะนำระบบนี้ให้โรงพยาบาลอื่นนำไปใช้"]],
  ];
  const PART3 = ["ความรวดเร็วในการรับทราบการเปิดกล่องยา", "ความครบถ้วนของข้อมูลการบันทึก", "ความสามารถในการติดตามวันหมดอายุยา", "ระยะเวลาที่ใช้ในการตรวจสอบกล่องยา", "ระยะเวลาที่ใช้ในการจัดทำรายงานประจำเดือน", "ความมั่นใจในความพร้อมใช้ของกล่องยาฉุกเฉิน"];
  const CMP = [[5, "ดีขึ้นมาก"], [4, "ดีขึ้นบ้าง"], [3, "เหมือนเดิม"], [2, "แย่ลงบ้าง"], [1, "แย่ลงมาก"]];
  const PART4 = ["ท่านคิดว่าจุดเด่นที่สำคัญที่สุดของระบบ SEB คืออะไร", "ท่านพบปัญหาหรืออุปสรรคในการใช้ระบบ SEB อะไรบ้าง และมีข้อเสนอแนะในการแก้ไขอย่างไร", "ท่านต้องการให้เพิ่มเติมหรือปรับปรุงฟังก์ชันใดในระบบ SEB", "ท่านคิดว่าระบบ SEB มีผลต่อความปลอดภัยของผู้ป่วยอย่างไร", "ข้อเสนอแนะอื่น ๆ เพื่อการพัฒนาระบบ SEB ในอนาคต"];
  const SV = { p1: {}, L: {}, C: {} };

  App.renderSurvey = function () {
    document.title = "แบบสอบถามความพึงพอใจ · SEB";
    let qn = 0;
    $("#app").innerHTML = `<div class="public"><div class="public-wrap" style="width:min(720px,100%);padding-bottom:48px">${App._demoBack ? App._demoBack() : ""}
      <div class="row"><div class="brand-mark">${window.SEB.LOGO_B}</div><div><div style="font-weight:650;font-size:13px">Smart Emergency Box</div><div class="xs faint">โรงพยาบาลลานสัก</div></div></div>
      <div class="card card-pad"><h1 style="font-size:20px">แบบสอบถามความพึงพอใจและประสบการณ์ผู้ใช้งาน</h1>
        <div class="muted small mt-8">แบบสอบถามนี้เป็นส่วนหนึ่งของโครงการวิจัย "การพัฒนาและประเมินผลระบบจัดการกล่องยาฉุกเฉินด้วยเทคโนโลยีดิจิทัลในโรงพยาบาลชุมชนแห่งหนึ่ง จังหวัดอุทัยธานี" ซึ่งได้รับการรับรองจากคณะกรรมการจริยธรรมการวิจัยเกี่ยวกับมนุษย์ สำนักงานสาธารณสุขจังหวัดอุทัยธานี ประกอบด้วย 4 ตอน ใช้เวลาประมาณ 15–20 นาที การตอบเป็นไปโดยสมัครใจ ท่านมีสิทธิไม่ตอบข้อใดข้อหนึ่งหรือยุติการตอบได้ทุกเมื่อโดยไม่มีผลกระทบต่อการปฏิบัติงาน ข้อมูลทั้งหมดเป็นความลับ วิเคราะห์และรายงานผลเป็นภาพรวมโดยไม่ระบุตัวบุคคล หากมีข้อสงสัยติดต่อ ภก.นที อิ่มใจจิตร์ โทร. 098 341 5222</div>
        <div class="form-grid mt-16"><label class="field"><span>รหัสผู้ตอบ <span class="hint">(ผู้วิจัยเป็นผู้แจก)</span></span><input class="input mono" id="svCode" placeholder="เช่น R07"></label></div>
        <label class="check mt-16"><input type="checkbox" id="svConsent"> ข้าพเจ้ายินยอมตอบแบบสอบถามโดยสมัครใจ</label></div>

      <div class="card card-pad"><h2>ตอนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม</h2>
        ${PART1.map(([k, l, o]) => `<div class="q" data-q="p1-${k}"><div class="q-title">${l}</div><div class="chips mt-8">${o.map((x) => `<button type="button" class="chip" onclick="App.svPick('p1','${k}','${esc(x)}',this)">${esc(x)}</button>`).join("")}</div>${k === "profession" ? `<input class="input mt-8 hidden" id="svProfOther" placeholder="ระบุ">` : ""}</div>`).join("")}</div>

      <div class="card card-pad"><h2>ตอนที่ 2: ความพึงพอใจต่อระบบ SEB</h2><div class="muted small mt-4">5 = เห็นด้วยอย่างยิ่ง · 4 = เห็นด้วย · 3 = ไม่แน่ใจ · 2 = ไม่เห็นด้วย · 1 = ไม่เห็นด้วยอย่างยิ่ง</div>
        ${PART2.map(([title, items]) => `<h3 class="mt-24">${title}</h3>${items.map((t) => { qn++; const n = qn; return `<div class="q" data-q="L-q${n}"><div class="q-title">${n}. ${esc(t)}</div><div class="likert">${[1, 2, 3, 4, 5].map((v) => `<button type="button" onclick="App.svPick('L','q${n}',${v},this)">${v}</button>`).join("")}</div><div class="scale-legend"><span>ไม่เห็นด้วยอย่างยิ่ง</span><span>เห็นด้วยอย่างยิ่ง</span></div></div>`; }).join("")}`).join("")}</div>

      <div class="card card-pad"><h2>ตอนที่ 3: เปรียบเทียบก่อนและหลังใช้ระบบ SEB</h2>
        ${PART3.map((t, i) => `<div class="q" data-q="C-c${i + 1}"><div class="q-title">${i + 1}. ${esc(t)}</div><div class="likert five-text">${CMP.map(([v, l]) => `<button type="button" onclick="App.svPick('C','c${i + 1}',${v},this)">${l}</button>`).join("")}</div></div>`).join("")}</div>

      <div class="card card-pad"><h2>ตอนที่ 4: ความคิดเห็นและข้อเสนอแนะ</h2>
        ${PART4.map((t, i) => `<div class="q"><div class="q-title">${i + 1}. ${esc(t)}</div><textarea class="input mt-8" id="svO${i + 1}"></textarea></div>`).join("")}</div>

      <button class="btn primary lg block" id="svBtn" onclick="App.svSubmit()">ส่งแบบสอบถาม</button>
      <div class="xs faint center">ขอขอบคุณที่สละเวลาตอบแบบสอบถาม</div>
    </div></div>`;
  };
  App.svPick = (part, key, v, btn) => {
    (part === "p1" ? SV.p1 : part === "L" ? SV.L : SV.C)[key] = v;
    btn.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
    btn.closest(".q")?.classList.remove("missing");
    if (key === "profession") $("#svProfOther").classList.toggle("hidden", v !== "อื่น ๆ");
  };
  App.svSubmit = async () => {
    if (!$("#svConsent").checked) return toast("กรุณาทำเครื่องหมายยินยอมก่อนส่ง", true);
    const missing = [];
    for (let i = 1; i <= 22; i++) if (!SV.L[`q${i}`]) missing.push(`L-q${i}`);
    $$(".q.missing").forEach((q) => q.classList.remove("missing"));
    if (missing.length) {
      missing.forEach((m) => $(`[data-q="${m}"]`)?.classList.add("missing"));
      $(`[data-q="${missing[0]}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
      return toast(`ยังไม่ได้ตอบตอนที่ 2 อีก ${missing.length} ข้อ`, true);
    }
    const btn = $("#svBtn");
    btn.disabled = true;
    btn.textContent = "กำลังส่ง…";
    try {
      await api("apiSubmitSurveyV2", {
        consent: true, respondentCode: $("#svCode").value.trim(), ...SV.p1, professionOther: $("#svProfOther").value.trim(),
        likert: SV.L, comparisons: SV.C, openAnswers: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`o${i}`, $(`#svO${i}`).value.trim()])),
      });
      $("#app").innerHTML = `<div class="public"><div class="public-wrap" style="padding-top:64px"><div class="card card-pad center" style="padding:36px 24px"><div class="success-mark">${ic("check")}</div><h2>ขอบคุณที่ตอบแบบสอบถาม</h2><div class="muted mt-8">คำตอบของท่านถูกบันทึกเรียบร้อยแล้ว</div></div>${App._demoBack()}</div></div>`;
    } catch (e) { fail(e); btn.disabled = false; btn.textContent = "ส่งแบบสอบถาม"; }
  };
})();
