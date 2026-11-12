/* =====================================================================
   SEB v2 — staff pages
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, api, esc, ic, $, $$, val, fmtD, fmtT, fmtDT, ago, minutes, fmtMin, localInput, daysUntil, initials, download, toCsv,
    ROLE, ROLE_PICK, UNIT_TYPES, REASONS, OPTION_LISTS, optList, syncLists, drugMaster, drugsFromData, drugKnown, drugPicked, boxPill, casePill, expPill, nearDays, isStaff, canRecord, isAdmin, toast, fail, dialog, drawer, closeDrawer,
    kpi, empty, field, opt, setTitle, dateSel, fmtDLong } = X;
  const App = window.App;

  const D = () => S.data;
  const boxById = (id) => D().boxes.find((b) => b.id === id);
  const locById = (id) => D().locations.find((l) => l.id === id);
  const activeLocs = () => D().locations.filter((l) => l.active !== false);
  const zoneTag = (z) => `<span class="tag">${z === "out" ? "นอก รพ." : "ใน รพ."}</span>`;
  const responseOf = (e) => (e.source === "paper" ? minutes(e.unitNotifiedAt, e.acknowledgedAt) : minutes(e.notificationSentAt, e.acknowledgedAt));
  const readinessOf = (e) => minutes(e.actualOpenedAt, e.readyAt);
  const pending = () => D().events.filter((e) => ["open", "acknowledged"].includes(e.caseStatus));
  function withBusy(btn, fn) {
    return async (...a) => {
      const b = typeof btn === "string" ? $(btn) : btn;
      if (b) { b.disabled = true; b.dataset.t = b.innerHTML; b.innerHTML = `${ic("loader-2")} กำลังบันทึก…`; }
      try { return await fn(...a); } catch (e) { fail(e); } finally { if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = b.dataset.t; } }
    };
  }

  // =================================================================
  // Dashboard
  // =================================================================
  App.pageDashboard = function () {
    const d = D(), st = d.stats;
    const hour = new Date().getHours();
    const hello = hour < 12 ? "สวัสดีตอนเช้า" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
    setTitle("ภาพรวม", canRecord() ? `<button class="btn primary desktop-only" onclick="App.openRecordDrawer()">${ic("plus")} บันทึกการเปิดกล่อง</button>` : "");
    const pend = pending();
    const zoneBoxes = d.boxes.filter((b) => S.zone === "all" || b.locationZone === S.zone);
    const nd = nearDays();
    const expiring = d.boxes.flatMap((b) => b.items.map((it) => ({ ...it, box: b, days: daysUntil(it.expiryDate) })))
      .filter((it) => it.expiryDate && it.days <= nd).sort((a, b) => a.days - b.days);
    const overdue = d.boxes.filter((b) => b.inspectionOverdue);
    const target = st.responseTargetMin || 5;
    const med = st.medianResponseMin;
    $("#content").innerHTML = `
      <div class="row between wrap mb-16"><div class="muted">${hello}, ${esc(S.user.displayName)} · ${fmtD(new Date().toISOString())}</div>
        <div class="row"><span class="pill ${st.pendingCases ? "danger live" : "ok"}">${st.pendingCases ? `${st.pendingCases} เคสรอดำเนินการ` : "ไม่มีเคสค้าง"}</span></div></div>
      <div id="pushPrompt"></div>${App.consentInviteHtml ? App.consentInviteHtml() : ""}
      ${pend.length ? `<div class="col gap-8 mb-16">${pend.map(alertCase).join("")}</div>` : ""}
      <div class="grid grid-4">
        ${kpi("กล่องพร้อมใช้", `${st.ready}`, "circle-check", "ok", `${st.notReady ? `ไม่พร้อมใช้ ${st.notReady} กล่อง` : "ทุกกล่องพร้อมใช้งาน"}`, `/${st.totalBoxes}`)}
        ${kpi("เคสรอดำเนินการ", st.pendingCases, "urgent", st.pendingCases ? "danger" : "accent", `รอรับทราบ ${st.openCases} เคส`)}
        ${kpi("ยาหมดอายุ", st.expiredItems, "alert-triangle", st.expiredItems ? "danger" : "ok", `ใกล้หมดอายุ (≤${nd} วัน) ${st.nearItems} รายการ`, " รายการ")}
        ${kpi("ตอบสนองมัธยฐาน", med === null || med === undefined ? "–" : med, "clock-bolt", "violet", `เป้าหมาย ≤ ${target} นาที`, med === null || med === undefined ? "" : " นาที")}
      </div>
      ${App.dashTrendHtml ? App.dashTrendHtml() : ""}
      <div class="split section">
        <div class="card">
          <div class="card-head"><h3 class="grow">สถานะกล่องยา</h3>
            <div class="seg">${[["all", "ทั้งหมด"], ["in", "ใน รพ."], ["out", "นอก รพ."]].map(([z, t]) => `<button class="${S.zone === z ? "on" : ""}" onclick="App.setZone('${z}')">${t}</button>`).join("")}</div></div>
          <div class="card-body">${zoneBoxes.length ? `<div class="tiles">${zoneBoxes.map(tile).join("")}</div>` : empty("ยังไม่มีกล่องในกลุ่มนี้", "box-off")}</div>
        </div>
        <div class="col gap-16">
          <div class="card">
            <div class="card-head"><h3 class="grow">ยาใกล้หมดอายุ</h3><span class="xs faint">≤ ${nd} วัน</span></div>
            ${expiring.length ? expiring.slice(0, 7).map((it) => `<div class="list-row click" onclick="App.go('box','${it.box.id}')">
              <div class="grow" style="min-width:0"><div style="font-weight:550">${esc(it.drugName)} <span class="muted">${esc(it.strength || "")}</span></div>
              <div class="xs faint">${esc(it.box.boxCode)} · lot ${esc(it.lot || "–")}</div></div>${expPill(it.expiryDate, nd)}</div>`).join("") +
              (expiring.length > 7 ? `<div class="list-row xs faint">และอีก ${expiring.length - 7} รายการ</div>` : "") : empty("ไม่มียาใกล้หมดอายุ", "mood-smile")}
          </div>
          <div class="card">
            <div class="card-head"><h3 class="grow">ถึงรอบตรวจ</h3><button class="btn ghost sm" onclick="App.go('inspections')">ดูทั้งหมด</button></div>
            ${overdue.length ? overdue.slice(0, 5).map((b) => `<div class="list-row click" onclick="App.go('inspect','${b.id}')"><div class="grow"><div style="font-weight:550">${esc(b.boxCode)}</div><div class="xs faint">${esc(b.location)}</div></div><span class="pill warn">ครบกำหนด ${fmtD(b.inspectionDate)}</span></div>`).join("") : empty("ตรวจตามรอบครบทุกกล่อง", "calendar-check")}
          </div>
        </div>
      </div>`;
    renderPushPrompt();
  };
  App.setZone = (z) => { S.zone = z; App.render(); };

  function alertCase(e) {
    const isOpen = e.caseStatus === "open";
    return `<div class="alert ${isOpen ? "" : "warn"}">
      <div class="a-icon">${ic(isOpen ? "urgent" : "package-import")}</div>
      <div class="grow" style="min-width:0"><div class="a-title">${esc(e.boxCode)} · ${esc(e.locationName || "")} ${isOpen ? "ถูกเปิดใช้" : "รอเติมยา"}</div>
        <div class="a-sub">${esc(e.reasonCategory || "ไม่ระบุเหตุผล")} · เปิดใช้ ${fmtT(e.actualOpenedAt)} น. (${ago(e.actualOpenedAt)}) · ${notifText(e)}</div></div>
      <div class="row">${isOpen && isStaff() ? `<button class="btn primary sm" onclick="event.stopPropagation();App.ack('${e.id}')">รับทราบ</button>` : ""}
        <button class="btn sm" onclick="App.go('case','${e.id}')">${isOpen ? "ดูเคส" : "เติมยา"}</button></div></div>`;
  }
  function notifText(e) {
    if (e.notificationStatus === "sent") return `แจ้ง LINE ${fmtT(e.notificationSentAt)}${e.pushSent ? ` · Push ${e.pushSent} เครื่อง` : ""}`;
    if (e.notificationStatus === "failed") return `LINE ส่งไม่สำเร็จ${e.pushSent ? ` · Push ${e.pushSent} เครื่อง` : ""}`;
    if (e.notificationStatus === "legacy_unknown") return "ระบบรุ่นแรก";
    return e.pushSent ? `Push ${e.pushSent} เครื่อง` : "ยังไม่ได้ตั้งค่าแจ้งเตือน";
  }

  function tile(b) {
    const nd = nearDays();
    return `<div class="tile state-${b.state}" onclick="App.go('box','${b.id}')">
      <div class="row between"><div class="tile-code">${esc(b.boxCode)}</div>${boxPill(b)}</div>
      <div class="tile-loc">${esc(b.location || "ยังไม่กำหนดจุด")} · ${b.locationZone === "out" ? "นอก รพ." : "ใน รพ."}</div>
      <div class="tile-stats"><span><b>${b.items.length}</b> รายการ</span>${b.expiredCount ? `<span style="color:var(--danger-text)"><b style="color:inherit">${b.expiredCount}</b> หมดอายุ</span>` : ""}${b.nearCount ? `<span style="color:var(--warn-text)"><b style="color:inherit">${b.nearCount}</b> ใกล้หมด</span>` : ""}</div>
      <div class="xs ${b.inspectionOverdue ? "" : "faint"}" style="${b.inspectionOverdue ? "color:var(--warn-text);font-weight:600" : ""}">${ic("calendar")} ตรวจถัดไป ${b.inspectionDate ? fmtD(b.inspectionDate) : "ยังไม่นัด"}</div></div>`;
  }

  async function renderPushPrompt() {
    const el = $("#pushPrompt");
    if (!el || !isStaff()) return;
    let on = false;
    try { on = S.demo ? localStorage.getItem("seb_demo_push") === "1" : !!(await App.currentSubscription()); } catch (_) {}
    if (on || sessionStorage.getItem("seb_hide_push")) return;
    const sup = App.pushSupport();
    el.innerHTML = `<div class="alert info mb-16"><div class="a-icon">${ic("bell-ringing")}</div>
      <div class="grow"><div class="a-title">รับแจ้งเตือนบนเครื่องนี้</div><div class="a-sub">${sup.needsInstall ? "iPhone ต้องติดตั้งแอปลงหน้าจอโฮมก่อน จึงจะรับแจ้งเตือนได้แม้ปิดหน้าจอ" : "เมื่อมีการเปิดกล่องยา เครื่องนี้จะแจ้งเตือนทันที แม้ปิดหน้าจอ"}</div></div>
      <div class="row"><button class="btn ghost sm" onclick="sessionStorage.setItem('seb_hide_push','1');this.closest('.alert').remove()">ภายหลัง</button><button class="btn accent sm" onclick="App.enablePush()">${sup.needsInstall ? "วิธีติดตั้ง" : "เปิดรับแจ้งเตือน"}</button></div></div>`;
  }

  // =================================================================
  // Cases
  // =================================================================
  App.pageCases = function () {
    S.caseFilter = S.caseFilter || "pending";
    setTitle("เคสเปิดกล่อง", canRecord() ? `<button class="btn primary" onclick="App.openRecordDrawer()">${ic("plus")} <span class="desktop-only">บันทึกการเปิดกล่อง</span></button>` : "");
    const f = S.caseFilter;
    const all = D().events.filter((e) => e.source !== "paper");
    const rows = all.filter((e) => f === "all" ? e.caseStatus !== "cancelled" : f === "pending" ? ["open", "acknowledged"].includes(e.caseStatus) : f === "ready" ? e.caseStatus === "ready" : e.caseStatus === "cancelled");
    $("#content").innerHTML = `
      <div class="row between wrap mb-16"><div class="seg">${[["pending", "รอดำเนินการ"], ["ready", "เสร็จสิ้น"], ["all", "ทั้งหมด"], ["cancelled", "ยกเลิก"]].map(([k, t]) => `<button class="${f === k ? "on" : ""}" onclick="S_setCaseFilter('${k}')">${t}</button>`).join("")}</div>
        <div class="xs faint">${rows.length} เคส</div></div>
      <div class="card">${rows.length ? `<div class="table-wrap"><table class="t responsive"><thead><tr><th>รหัสเหตุการณ์</th><th>กล่อง / จุด</th><th>เหตุผล</th><th>เปิดใช้จริง</th><th>ตอบสนอง</th><th>พร้อมใช้ใน</th><th>สถานะ</th></tr></thead><tbody>
        ${rows.map((e) => `<tr class="click" onclick="App.go('case','${e.id}')">
          <td data-l="รหัส"><span class="mono">${esc(e.eventCode || "")}</span></td>
          <td data-l="กล่อง"><div style="font-weight:600">${esc(e.boxCode)}</div><div class="xs faint">${esc(e.locationName || "")}</div></td>
          <td data-l="เหตุผล">${esc(e.reasonCategory || e.reason || "–")}</td>
          <td data-l="เปิดใช้จริง" class="tabnum">${fmtDT(e.actualOpenedAt)}</td>
          <td data-l="ตอบสนอง" class="tabnum">${fmtMin(responseOf(e))}</td>
          <td data-l="พร้อมใช้ใน" class="tabnum">${fmtMin(readinessOf(e))}${e.readyEstimated ? ` <span class="xs faint">(ประมาณ)</span>` : ""}</td>
          <td data-l="สถานะ">${casePill(e)}</td></tr>`).join("")}</tbody></table></div>` : empty(f === "pending" ? "ไม่มีเคสค้าง ทุกกล่องพร้อมใช้" : "ไม่มีข้อมูล", "checks")}</div>`;
  };
  window.S_setCaseFilter = (k) => { S.caseFilter = k; App.render(); };

  App.ack = withBusy(null, async (id) => {
    const res = await api("apiAcknowledgeEvent", S.token, id);
    S.data = res.data;
    X.renderNav();
    toast("รับทราบแล้ว");
    App.render();
  });

  App.pageCase = async function () {
    const e = D().events.find((x) => x.id === S.param);
    if (!e) {
      // เคสเก่ากว่า 400 รายการล่าสุด (เช่น เปิดจากหน้าคุณภาพข้อมูล): ดึงจากเซิร์ฟเวอร์
      try { const r = await api("apiGetEvent", S.token, S.param); if (r.event) { D().events.push(r.event); return App.pageCase(); } } catch (_) {}
      $("#content").innerHTML = empty("ไม่พบเคสนี้", "search-off"); return;
    }
    setTitle(`เคส ${e.eventCode || ""}`, `<button class="btn ghost" onclick="App.go('cases')">${ic("arrow-left")} กลับ</button>`);
    const box = boxById(e.boxId);
    const resp = responseOf(e), ready = readinessOf(e);
    const target = Number(D().settings.RESPONSE_TARGET_MIN || 5);
    const step = (done, icon, title, sub, time) => `<div class="tl ${done ? "done" : ""}"><div class="dot">${ic(icon)}</div><div><div class="t-title">${title}</div><div class="t-sub">${sub}</div></div><div class="t-time">${time}</div></div>`;
    const canAct = isStaff() && !["ready", "cancelled"].includes(e.caseStatus);
    $("#content").innerHTML = `
      <div class="split">
        <div class="col gap-16">
          <div class="card card-pad">
            <div class="row between wrap"><div><div class="xs faint">${esc(e.locationName || "")} · ${e.source === "qr" ? "สแกน QR" : e.source === "staff" ? "บันทึกโดยห้องยา" : "แบบฟอร์มกระดาษ"}${e.offlineQueued ? ` · <span class="pill warn" title="บันทึกตอนไม่มีอินเทอร์เน็ต ส่งเข้าระบบภายหลัง">ออฟไลน์ ส่งเข้าระบบ ${fmtT(e.recordedAt)} น.</span>` : ""}</div><h2 style="font-size:22px;margin-top:2px">${esc(e.boxCode)}</h2></div>${casePill(e)}</div>
            <div class="timeline mt-24">
              ${step(true, "box", "เปิดใช้กล่องจริง", `${esc(e.openerName || e.openedBy || "")} · ${esc(e.reasonCategory || "")}${e.recordedAt && Math.abs(minutes(e.actualOpenedAt, e.recordedAt)) > 2 ? ` · บันทึกย้อนหลัง ${fmtT(e.recordedAt)}` : ""}`, fmtDT(e.actualOpenedAt))}
              ${step(!!(e.notificationSentAt || e.pushSentAt || e.unitNotifiedAt), "send", e.source === "paper" ? "หน่วยงานแจ้งห้องยา" : "ระบบส่งแจ้งเตือน", e.source === "paper" ? "ตามกระบวนการเดิม" : notifText(e) + (e.notificationError ? ` · ${esc(e.notificationError)}` : ""), fmtT(e.notificationSentAt || e.unitNotifiedAt || e.pushSentAt))}
              ${step(!!e.acknowledgedAt, "eye-check", "เภสัชกรรับทราบ", e.acknowledgedAt ? `${esc(e.acknowledgedBy || "")} · ตอบสนอง ${fmtMin(resp)}` : "รอการรับทราบ", fmtT(e.acknowledgedAt))}
              ${step(!!e.readyAt, "circle-check", "กล่องกลับมาพร้อมใช้", e.readyAt ? `${esc(e.readyBy || "")} · รวม ${fmtMin(ready)}${e.readyEstimated ? " (ประมาณจาก log)" : ""}` : "รอเติมยาและยืนยัน", fmtT(e.readyAt))}
            </div>
            ${canAct ? `<div class="row wrap mt-24">${!e.acknowledgedAt ? `<button class="btn primary" onclick="App.ack('${e.id}')">${ic("eye-check")} รับทราบ</button>` : ""}
              <button class="btn ${e.acknowledgedAt ? "primary" : ""}" onclick="App.openRefill('${e.id}')">${ic("package-import")} เติมยาและยืนยันพร้อมใช้</button></div>` : ""}
          </div>
          <div class="card"><div class="card-head"><h3 class="grow">ยาที่ใช้ไป</h3></div>
            ${(e.itemsUsedJson || []).length ? (e.itemsUsedJson || []).map((it) => `<div class="list-row"><div class="grow">${esc(it.drugName)} <span class="muted">${esc(it.strength || "")}</span></div><b class="tabnum">${esc(it.qty)}</b></div>`).join("") : empty("ไม่ได้ระบุรายการยาที่ใช้ (ระบุได้ตอนเติมยา)", "pill-off")}</div>
          <div class="card"><div class="card-head"><h3 class="grow">การเคลื่อนไหวของยา</h3></div><div id="caseMoves">${empty("กำลังโหลด…", "loader-2")}</div></div>
        </div>
        <div class="col gap-16">
          <div class="card card-pad">
            <h3>ตัวชี้วัด</h3>
            <div class="grid grid-2 mt-12">
              <div><div class="xs faint">Response time</div><div style="font-size:22px;font-weight:650" class="tabnum ${resp !== null && resp <= target ? "ind-good" : ""}">${fmtMin(resp)}</div><div class="xs faint">เป้า ≤ ${target} นาที</div></div>
              <div><div class="xs faint">Box readiness</div><div style="font-size:22px;font-weight:650" class="tabnum">${fmtMin(ready)}</div><div class="xs faint">เปิดจริง → พร้อมใช้</div></div>
            </div>
            ${isAdmin() ? `<div class="xs faint mt-12">ช่วงการศึกษา: <b>${periodLabel(e.period)}</b> · ความครบถ้วน ${e.requiredFields ? `${e.filledFields}/${e.requiredFields}` : "–"}</div>` : ""}
          </div>
          <div class="card card-pad">
            <h3>ข้อมูลผู้ป่วย</h3>
            <div class="row between mt-12"><div class="muted small">${ic("lock")} HN เก็บแยก เห็นเฉพาะเภสัชกร</div>
              ${isStaff() ? `<button class="btn sm" id="hnBtn" onclick="App.revealHn('${e.id}')">${ic("eye")} แสดง HN</button>` : ""}</div>
            <div id="hnBox" class="mono mt-8" style="font-size:18px;letter-spacing:.08em"></div>
          </div>
          <div class="card card-pad small">
            <div class="row between"><span class="muted">กล่อง</span><a onclick="App.go('box','${e.boxId}')" style="cursor:pointer">${esc(e.boxCode)} ${ic("arrow-up-right")}</a></div>
            <div class="row between mt-8"><span class="muted">บันทึกเข้าระบบ</span><span class="tabnum">${fmtDT(e.recordedAt)}</span></div>
            ${e.note ? `<div class="mt-8"><span class="muted">หมายเหตุ</span><div>${esc(e.note)}</div></div>` : ""}
            ${e.dataNote ? `<div class="mt-8 xs" style="color:var(--warn-text)">${esc(e.dataNote)}</div>` : ""}
            ${isStaff() && e.caseStatus !== "cancelled" ? `<div class="row wrap mt-16"><button class="btn sm" onclick="App.editActualTime('${e.id}')">${ic("clock-edit")} แก้เวลาเปิดจริง</button>${e.caseStatus !== "ready" ? `<button class="btn sm danger-ghost" onclick="App.cancelCase('${e.id}')">${ic("ban")} ยกเลิกเคส</button>` : ""}</div>` : ""}
          </div>
        </div>
      </div>`;
    try {
      const r = await api("apiGetEvent", S.token, e.id);
      const TYPES = { use: "ใช้กับผู้ป่วย", refill: "เติมยา", replace_lot: "เปลี่ยน lot", discard_expired: "ทิ้งยาหมดอายุ", adjust: "ปรับจำนวน" };
      $("#caseMoves").innerHTML = r.moves.length ? r.moves.map((m) => `<div class="list-row"><div class="grow"><div>${esc(m.drugName)} <span class="muted">${esc(m.strength || "")}</span></div><div class="xs faint">${TYPES[m.type] || m.type} · ${esc(m.byUser || "")} · ${fmtDT(m.at)}</div></div><b class="tabnum" style="color:${m.qtyChange < 0 ? "var(--danger-text)" : "var(--ok-text)"}">${m.qtyChange > 0 ? "+" : ""}${m.qtyChange}</b></div>`).join("") : empty("ยังไม่มีรายการ", "arrows-exchange");
      if (!r.hasHn && $("#hnBtn")) { $("#hnBtn").remove(); $("#hnBox").innerHTML = `<span class="small faint" style="letter-spacing:0">ไม่มีข้อมูล HN</span>`; }
    } catch (err) { $("#caseMoves").innerHTML = empty(err.message, "alert-circle"); }
  };
  const periodLabel = (p) => ({ post: "ใช้งานจริง (post)", pilot: "นำร่อง (pilot)", baseline_prosp: "baseline ไปข้างหน้า", baseline_retro: "baseline ย้อนหลัง", other: "นอกช่วงศึกษา" }[p] || "ยังไม่กำหนด");
  App.periodLabel = periodLabel;

  App.revealHn = async function (id) {
    try { const r = await api("apiRevealHn", S.token, id); $("#hnBox").textContent = r.hn || "–"; $("#hnBtn")?.remove(); } catch (e) { fail(e); }
  };
  App.editActualTime = async function (id) {
    const e = D().events.find((x) => x.id === id);
    const v = await dialog({ title: "แก้เวลาเปิดใช้จริง", body: "ใช้กรณีบันทึกย้อนหลังหลังสถานการณ์ปลอดภัย การแก้ไขจะถูกบันทึกใน audit log", input: { type: "datetime-local", value: localInput(e.actualOpenedAt), required: true }, confirm: "ถัดไป" });
    if (!v) return;
    const reason = await dialog({ title: "เหตุผลการแก้ไข", input: { placeholder: "เหตุผล", required: true, choices: optList("OPT_TIME_EDIT_REASONS") }, confirm: "บันทึก" });
    if (!reason) return;
    try { const r = await api("apiUpdateEventTimes", S.token, id, new Date(v).toISOString(), reason); S.data = r.data; toast("แก้ไขแล้ว"); App.render(); } catch (err) { fail(err); }
  };
  App.cancelCase = async function (id) {
    const reason = await dialog({ title: "ยกเลิกเคสนี้?", body: "ใช้เมื่อบันทึกผิดหรือสแกนโดยไม่ได้เปิดใช้จริง เคสที่ยกเลิกจะไม่นำไปวิเคราะห์", input: { placeholder: "เหตุผล", required: true, choices: optList("OPT_CANCEL_REASONS") }, confirm: "ยกเลิกเคส", danger: true });
    if (!reason) return;
    try { const r = await api("apiCancelEvent", S.token, id, reason); S.data = r.data; toast("ยกเลิกเคสแล้ว"); App.go("cases"); } catch (e) { fail(e); }
  };

  // ---------- refill & confirm ready ----------
  App.openRefill = function (eventId) {
    const e = D().events.find((x) => x.id === eventId);
    const box = boxById(e.boxId);
    if (!box) return fail(new Error("ไม่พบกล่องยา"));
    const needUsed = !(e.itemsUsedJson || []).length;
    const drugs = uniqueDrugs(box.items);
    drawer(`เติมยา · ${esc(box.boxCode)}`, `
      <div class="alert info mb-16" style="padding:10px 12px"><div class="small">ปรับ lot / วันหมดอายุ / จำนวน ให้ตรงกับยาที่เติมจริง ระบบจะบันทึกการเคลื่อนไหวของยาให้อัตโนมัติ เมื่อกดยืนยัน เวลานี้จะเป็น <b>ready_at</b></div></div>
      ${needUsed ? `<h3 class="mb-8">ยาที่ใช้ไปในเคสนี้ <span class="xs faint">(ถ้าทราบ)</span></h3><div class="card mb-16">${drugs.map((d, i) => `<div class="list-row"><div class="grow">${esc(d.drugName)} <span class="muted">${esc(d.strength)}</span></div><input class="input sm" style="width:84px" type="number" min="0" inputmode="numeric" placeholder="0" data-used="${i}"></div>`).join("")}</div>` : ""}
      <h3 class="mb-8">รายการยาในกล่องหลังเติม</h3>
      ${itemsEditor(box.items)}
      <div class="form-grid mt-16">${field("เลขซีลใหม่", `<input class="input" id="rfSeal" value="${esc(box.sealNo || "")}" placeholder="เช่น 004513">`)}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="rfBtn" onclick="App.confirmReady('${eventId}')">${ic("circle-check")} ยืนยันกล่องพร้อมใช้</button>`, { wide: true });
    App._refillDrugs = drugs;
  };
  App.confirmReady = withBusy("#rfBtn", async (eventId) => {
    const items = collectItems();
    const bad = items.find((i) => !i.expiryDate || Number(i.qty) <= 0);
    if (bad) {
      const ok = await dialog({ title: "ยังมีรายการไม่ครบ", body: `${bad.drugName}: ยังไม่ระบุวันหมดอายุหรือจำนวนเป็น 0\nยืนยันพร้อมใช้ต่อหรือไม่?`, confirm: "ยืนยันต่อ" });
      if (!ok) return;
    }
    const used = $$("[data-used]").map((el) => ({ ...App._refillDrugs[+el.dataset.used], qty: Number(el.value || 0) })).filter((x) => x.qty > 0);
    const res = await api("apiConfirmReady", S.token, { eventId, items, itemsUsed: used, sealNo: val("rfSeal") });
    S.data = res.data;
    closeDrawer();
    X.renderNav();
    toast("กล่องกลับมาพร้อมใช้แล้ว");
    App.render();
  });
  function uniqueDrugs(items) {
    const m = new Map();
    items.forEach((i) => { const k = `${i.drugName}|${i.strength || ""}`; if (!m.has(k)) m.set(k, { drugName: i.drugName, strength: i.strength || "" }); });
    return [...m.values()];
  }

  // ---------- staff record open ----------
  App.openRecordDrawer = function (boxId = "") {
    const boxes = D().boxes;
    drawer("บันทึกการเปิดกล่อง", `
      <div class="form-grid">
        ${field("กล่องยา", `<select class="input" id="rcBox">${opt([["", "เลือกกล่อง"], ...boxes.map((b) => [b.id, `${b.boxCode} · ${b.location}`])], boxId)}</select>`, "", "full")}
        ${field("เวลาเปิดใช้จริง", `<input class="input" type="datetime-local" id="rcTime" value="${localInput()}">`, "บันทึกย้อนหลังได้")}
        ${field("HN ผู้ป่วย", `<input class="input mono" id="rcHn" inputmode="numeric" maxlength="9" placeholder="9 หลัก">`)}
        ${field("ผู้เปิดใช้", `<input class="input" id="rcOpener" placeholder="ชื่อ-ตำแหน่ง">`)}
        ${field("เหตุผล", `<select class="input" id="rcReason">${opt(optList("OPT_OPEN_REASONS").map((r) => [r, r]), optList("OPT_OPEN_REASONS")[0])}</select>`)}
        ${field("หมายเหตุ", `<textarea class="input" id="rcNote"></textarea>`, "", "full")}
      </div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="rcBtn" onclick="App.saveRecord()">บันทึกและแจ้งเตือน</button>`);
  };
  App.saveRecord = withBusy("#rcBtn", async () => {
    if (!val("rcBox")) throw new Error("กรุณาเลือกกล่องยา");
    if (val("rcHn") && !/^\d{9}$/.test(val("rcHn"))) throw new Error("HN ต้องเป็นตัวเลข 9 หลัก");
    const res = await api("apiRecordOpenStaff", S.token, { boxId: val("rcBox"), actualOpenedAt: new Date(val("rcTime")).toISOString(), hn: val("rcHn"), openerName: val("rcOpener"), reasonCategory: val("rcReason"), note: val("rcNote") });
    S.data = res.data;
    closeDrawer();
    X.renderNav();
    toast(`บันทึก ${res.event.eventCode} และส่งแจ้งเตือนแล้ว`);
    App.go("case", res.event.id);
  });

  // =================================================================
  // Boxes
  // =================================================================
  App.pageBoxes = function () {
    S.boxQ = S.boxQ || "";
    setTitle("กล่องยา", `${isStaff() ? `<button class="btn" onclick="App.printQr()">${ic("qrcode")} <span class="desktop-only">พิมพ์ QR</span></button><button class="btn" onclick="App.printAppt()">${ic("calendar")} <span class="desktop-only">ฉลากนัดตรวจ</span></button><button class="btn primary" onclick="App.openNewBox()">${ic("plus")} <span class="desktop-only">เพิ่มกล่อง</span></button>` : ""}`);
    const q = S.boxQ.toLowerCase();
    const list = D().boxes.filter((b) => (S.zone === "all" || b.locationZone === S.zone) && (!q || `${b.boxCode} ${b.location} ${b.kitName}`.toLowerCase().includes(q)));
    const groups = activeLocs().map((l) => ({ l, boxes: list.filter((b) => b.locationId === l.id) })).filter((g) => g.boxes.length);
    const orphan = list.filter((b) => !b.locationId);
    $("#content").innerHTML = `
      <div class="row between wrap mb-16 gap-12">
        <div class="seg">${[["all", "ทั้งหมด"], ["in", "ใน รพ."], ["out", "นอก รพ."]].map(([z, t]) => `<button class="${S.zone === z ? "on" : ""}" onclick="App.setZone('${z}')">${t}</button>`).join("")}</div>
        <input class="input" style="max-width:280px" placeholder="ค้นหารหัสกล่อง / จุด" value="${esc(S.boxQ)}" oninput="App.searchBox(this.value)">
      </div>
      ${groups.map((g) => `<div class="mb-16"><div class="row mb-8"><h3>${esc(g.l.name)}</h3>${zoneTag(g.l.zone)}${g.l.inStudy && isAdmin() ? `<span class="tag" style="color:var(--violet-text)">ในงานวิจัย</span>` : ""}<span class="xs faint">${g.boxes.length} กล่อง</span></div><div class="tiles">${g.boxes.map(tile).join("")}</div></div>`).join("")}
      ${orphan.length ? `<div class="mb-16"><div class="row mb-8"><h3>ยังไม่กำหนดจุด</h3></div><div class="tiles">${orphan.map(tile).join("")}</div></div>` : ""}
      ${!list.length ? `<div class="card">${empty("ไม่พบกล่องยา", "box-off")}</div>` : ""}`;
  };
  App.searchBox = (v) => { S.boxQ = v; clearTimeout(App._sb); App._sb = setTimeout(() => { App.render(); const i = $("#content input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 250); };

  App.openNewBox = function () {
    drawer("เพิ่มกล่องยา", `<div class="form-grid">
      ${field("รหัสกล่อง", `<input class="input" id="nbCode" placeholder="เช่น ER-02">`)}
      ${field("จุดวางกล่อง", `<select class="input" id="nbLoc">${opt([["", "เลือกจุด"], ...activeLocs().map((l) => [l.id, `${l.name} (${l.zone === "out" ? "นอก" : "ใน"} รพ.)`])], "")}</select>`)}
      ${field("ชุดยามาตรฐาน", `<select class="input" id="nbKit">${opt([["", "ไม่ใช้ชุดมาตรฐาน"], ...D().kits.map((k) => [k.id, `${k.name} (${k.items.length} รายการ)`])], "")}</select>`, "", "full")}
      ${field("หมายเหตุ", `<input class="input" id="nbNote">`, "", "full")}</div>
      <div class="xs faint mt-12">ระบบจะคัดลอกรายการยาจากชุดมาตรฐาน แล้วกรอก lot / วันหมดอายุ / จำนวนในหน้ากล่อง</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="nbBtn" onclick="App.createBox()">สร้างกล่อง</button>`);
  };
  App.createBox = withBusy("#nbBtn", async () => {
    const r = await api("apiCreateBoxFromKit", S.token, { boxCode: val("nbCode"), locationId: val("nbLoc"), kitId: val("nbKit"), note: val("nbNote") });
    S.data = r.data;
    closeDrawer();
    toast("สร้างกล่องแล้ว");
    App.go("box", r.box.id);
  });

  App.pageBox = function () {
    const b = boxById(S.param);
    if (!b) { $("#content").innerHTML = empty("ไม่พบกล่องยา", "box-off"); return; }
    setTitle(b.boxCode, `<button class="btn ghost" onclick="App.go('boxes')">${ic("arrow-left")} <span class="desktop-only">กล่องทั้งหมด</span></button>`);
    const qrSvg = qrSvgFor(b.qrUrl, 3);
    $("#content").innerHTML = `
      <div class="split box-split">
        <div class="col gap-16">
          <div class="card card-pad">
            <div class="row between wrap gap-12"><div><div class="xs faint">${esc(b.kitName || "ไม่ได้ผูกชุดมาตรฐาน")}</div><h2 style="font-size:24px">${esc(b.boxCode)}</h2><div class="muted small">${esc(b.location || "ยังไม่กำหนดจุด")} · ${b.locationZone === "out" ? "นอก รพ." : "ใน รพ."}</div></div>${boxPill(b)}</div>
            <div class="row wrap mt-16">
              ${canRecord() ? `<button class="btn" onclick="App.openRecordDrawer('${b.id}')">${ic("urgent")} บันทึกการเปิด</button>` : ""}${isStaff() ? `<button class="btn" onclick="App.go('inspect','${b.id}')">${ic("clipboard-check")} ตรวจประจำเดือน</button>` : ""}
              <button class="btn" onclick="App.printDrugRecord('${b.id}')">${ic("file-text")} พิมพ์ใบบันทึกยา</button><button class="btn" onclick="App.printAppt(['${b.id}'])">${ic("calendar")} ฉลากนัดตรวจ</button>
              ${b.openCaseId ? `<button class="btn primary" onclick="App.go('case','${b.openCaseId}')">${ic("arrow-right")} ไปที่เคสที่ค้าง</button>` : ""}
            </div>
          </div>
          <div class="card">
        <div class="card-head"><h3 class="grow">รายการยาในกล่อง</h3><span class="xs faint">${groupDrugs(b.items).length} รายการยา · ${b.items.length} lot</span></div>
        <div class="card-body">${isStaff() ? itemsEditor(b.items) : itemsReadonly(b.items)}</div>
        ${isStaff() ? `<div class="card-body row" style="border-top:1px solid var(--border);justify-content:flex-end"><button class="btn primary" onclick="App.saveBox('${b.id}')">บันทึกรายการยา</button></div>` : ""}
      </div>
          <div class="card" id="boxHist"></div>
        </div>
        <div class="col gap-16 box-side">
          <div class="card card-pad center">
            <div style="width:168px;margin:0 auto" class="qr">${qrSvg}</div>
            <div class="xs faint mt-8">QR สำหรับหน้างาน · สแกนแล้วบันทึกการเปิดได้ทันที</div>
            <div class="row mt-12" style="justify-content:center"><button class="btn sm" onclick="App.printQr(['${b.id}'])">${ic("printer")} พิมพ์ฉลาก</button><button class="btn sm" onclick="navigator.clipboard.writeText('${esc(b.qrUrl)}').then(()=>SEB.toast('คัดลอกลิงก์แล้ว'))">${ic("copy")} ลิงก์</button>${isAdmin() ? `<button class="btn sm ghost" title="สร้าง QR ใหม่ (ฉลากเดิมจะใช้ไม่ได้)" onclick="App.regenQr('${b.id}')">${ic("refresh")}</button>` : ""}</div>
          </div>
          <div class="card card-pad small">
            <div class="row between"><span class="muted">ตรวจล่าสุด</span><span>${fmtD(b.lastInspectedAt)}</span></div>
            <div class="row between mt-8"><span class="muted">ตรวจครั้งถัดไป</span><span style="${b.inspectionOverdue ? "color:var(--warn-text);font-weight:600" : ""}">${b.inspectionDate ? fmtD(b.inspectionDate) : "ยังไม่นัด"}</span></div>
            <div class="row between mt-8"><span class="muted">พร้อมใช้ล่าสุด</span><span>${fmtDT(b.lastReadyAt)}</span></div>
            <div class="row between mt-8"><span class="muted">เลขซีล</span><span class="mono">${esc(b.sealNo || "–")}</span></div>
          </div>
          ${isStaff() ? `<div class="card card-pad"><h3 class="mb-12">ข้อมูลกล่อง</h3><div class="form-grid">
            ${field("รหัสกล่อง", `<input class="input" id="bxCode" value="${esc(b.boxCode)}">`)}
            ${field("จุดวางกล่อง", `<select class="input" id="bxLoc">${opt([["", "ยังไม่กำหนด"], ...activeLocs().map((l) => [l.id, l.name])], b.locationId)}</select>`)}
            ${field("ชุดยามาตรฐาน", `<select class="input" id="bxKit">${opt([["", "ไม่ผูก"], ...D().kits.map((k) => [k.id, k.name])], b.kitId)}</select>`)}
            ${field("เลขซีล", `<input class="input" id="bxSeal" value="${esc(b.sealNo || "")}">`)}
            ${field("หมายเหตุ", `<input class="input" id="bxNote" value="${esc(b.note || "")}">`, "", "full")}</div>
            <div class="row mt-16" style="justify-content:flex-end">${isAdmin() ? `<button class="btn danger-ghost" onclick="App.deleteBox('${b.id}')">${ic("trash")} ลบกล่อง</button>` : ""}<span class="grow"></span><button class="btn primary" id="bxBtn" onclick="App.saveBox('${b.id}')">บันทึกการเปลี่ยนแปลง</button></div></div>` : ""}
        </div>
      </div>`;
    App.closeDrugSheet();
    if (S.histBox !== b.id) { S.histBox = b.id; S.histPage = 1; S.histAll = null; }
    App.boxHist();
  };

  // ---------- ประวัติการเปิด: เลือก 10/30/50/ทั้งหมด + เลื่อนหน้า ----------
  const HIST_SIZES = [10, 30, 50, 0];          // 0 = ทั้งหมด
  App.boxHist = async (patch) => {
    const el = $("#boxHist"); if (!el) return;
    const id = S.histBox;
    if (patch) Object.assign(S, patch);
    let size = S.histSize ?? (+localStorage.getItem("seb_hist_size") || 10);
    if (!HIST_SIZES.includes(size)) size = 10;
    S.histSize = size;
    try { localStorage.setItem("seb_hist_size", String(size)); } catch (_) {}
    // ข้อมูลในเครื่องเก็บการเปิด 400 ครั้งล่าสุดของทั้งระบบ — ถ้าเต็มโควตา ให้ดึงประวัติเต็มของกล่องนี้จากเซิร์ฟเวอร์
    let all = S.histAll || D().events.filter((e) => e.boxId === id);
    const truncated = !S.histAll && D().events.length >= 400;
    if (truncated && (size === 0 || all.length > 0 && Math.ceil(all.length / (size || all.length)) <= (S.histPage || 1))) {
      el.innerHTML = `<div class="card-head"><h3 class="grow">ประวัติการเปิด</h3></div><div class="card-body xs faint">กำลังโหลดประวัติทั้งหมด…</div>`;
      try {
        const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
        const r = await api("apiReport", S.token, "2015-01-01", today);
        if (S.histBox !== id) return;
        S.histAll = all = (r.events || []).filter((e) => e.boxId === id).sort((x, y) => String(y.actualOpenedAt).localeCompare(String(x.actualOpenedAt)));
      } catch (_) { /* ใช้ข้อมูลในเครื่องแทน */ }
    }
    const total = all.length;
    const pages = size ? Math.max(1, Math.ceil(total / size)) : 1;
    const page = Math.min(Math.max(1, S.histPage || 1), pages);
    S.histPage = page;
    const rows = size ? all.slice((page - 1) * size, page * size) : all;
    const seg = `<div class="seg">${HIST_SIZES.map((n) => `<button type="button" class="${n === size ? "on" : ""}" onclick="App.boxHist({histSize:${n},histPage:1})">${n || "ทั้งหมด"}</button>`).join("")}</div>`;
    // ปุ่มเลขหน้า: แสดงหน้าแรก/สุดท้าย และรอบ ๆ หน้าปัจจุบัน
    const nums = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…");
    const pager = pages > 1 ? `<div class="pager">
        <button class="btn ghost sm icon" ${page <= 1 ? "disabled" : ""} onclick="App.boxHist({histPage:${page - 1}})" title="ก่อนหน้า">${ic("chevron-left")}</button>
        ${nums.map((n) => n === "…" ? `<span class="xs faint">…</span>` : `<button class="btn sm ${n === page ? "primary" : "ghost"}" onclick="App.boxHist({histPage:${n}})">${n}</button>`).join("")}
        <button class="btn ghost sm icon" ${page >= pages ? "disabled" : ""} onclick="App.boxHist({histPage:${page + 1}})" title="ถัดไป">${ic("chevron-right")}</button></div>` : "";
    const from = total ? (size ? (page - 1) * size + 1 : 1) : 0, to = size ? Math.min(total, page * size) : total;
    el.innerHTML = `<div class="card-head wrap gap-8"><h3 class="grow">ประวัติการเปิด <span class="xs faint" style="font-weight:400">${total ? `${from}–${to} จาก ${total} ครั้ง` : ""}</span></h3>${total > 10 ? seg : ""}</div>
      ${rows.length ? rows.map((e) => `<div class="list-row click" onclick="App.go('case','${e.id}')"><div class="grow"><div class="small" style="font-weight:550">${fmtDT(e.actualOpenedAt)}</div><div class="xs faint">${esc(e.reasonCategory || "")} · ${esc(e.eventCode || "")}</div></div>${casePill(e)}</div>`).join("") : empty("ยังไม่เคยถูกเปิด", "history-off")}
      ${pager ? `<div class="card-body" style="border-top:1px solid var(--border)">${pager}</div>` : ""}`;
  };

  App.saveBox = withBusy("#bxBtn", async (id) => {
    App.closeDrugSheet();
    const reason = await dialog({ title: "เหตุผลการแก้ไข", body: "บันทึกไว้ใน audit log เพื่อการตรวจสอบย้อนหลัง", input: { placeholder: "เหตุผล", required: true, choices: optList("OPT_BOX_EDIT_REASONS") }, confirm: "บันทึก" });
    if (!reason) return;
    const kit = D().kits.find((k) => k.id === val("bxKit"));
    const r = await api("apiSaveBox", S.token, { id, boxCode: val("bxCode"), locationId: val("bxLoc"), kitId: val("bxKit"), kitName: kit?.name || "", sealNo: val("bxSeal"), note: val("bxNote"), items: collectItems(), changeReason: reason });
    S.data = r.data;
    toast("บันทึกแล้ว");
    App.render();
  });
  App.deleteBox = async (id) => {
    if (!(await dialog({ title: "ลบกล่องยานี้?", body: "ประวัติการเปิดและการตรวจยังคงอยู่ แต่ QR ของกล่องนี้จะใช้ไม่ได้", confirm: "ลบ", danger: true }))) return;
    try { const r = await api("apiDeleteBox", S.token, id); S.data = r.data; toast("ลบแล้ว"); App.go("boxes"); } catch (e) { fail(e); }
  };
  App.regenQr = async (id) => {
    if (!(await dialog({ title: "สร้าง QR ใหม่?", body: "ฉลาก QR เดิมที่ติดกล่องจะใช้ไม่ได้ทันที ต้องพิมพ์ฉลากใหม่", confirm: "สร้างใหม่", danger: true }))) return;
    try { const r = await api("apiRegenerateQr", S.token, id); S.data = r.data; toast("สร้าง QR ใหม่แล้ว"); App.render(); } catch (e) { fail(e); }
  };

  // ---------- items editor ----------
  // ข้อมูลยังเก็บแยกแถวละ 1 lot (แต่ละ lot มีวันหมดอายุของตัวเอง ใช้แจ้งเตือน 30/15/7 วัน)
  // แต่หน้าจอรวมเป็น "ยา 1 รายการ + lot ย่อย" — ชื่อ/ความแรง/หน่วย/ควรมี กรอกครั้งเดียวที่แถวแรก
  const drugKey = (it) => `${String(it.drugName || "").trim().toLowerCase()}|${String(it.strength || "").trim().toLowerCase()}`;
  function groupDrugs(items) {
    const m = new Map();
    items.forEach((it) => { const k = drugKey(it); if (!m.has(k)) m.set(k, []); m.get(k).push(it); });
    return [...m.values()];
  }
  // ประเด็นของยา 1 รายการ (รวมทุก lot): หมดอายุ > ใกล้หมดอายุ > จำนวนไม่ครบ
  function drugIssue(lots, req) {
    const nd = nearDays();
    const tot = lots.reduce((a, x) => a + Number(x.qty || 0), 0);
    const ds = lots.filter((x) => x.exp).map((x) => daysUntil(x.exp));
    const minD = ds.length ? Math.min(...ds) : NaN;
    const out = [];
    if (minD < 0) out.push({ k: "exp", t: `หมดอายุแล้ว ${-minD} วัน` });
    else if (minD <= nd) out.push({ k: "near", t: minD === 0 ? "หมดอายุวันนี้" : `ใกล้หมดอายุ · อีก ${minD} วัน` });
    if (req && tot < req) out.push({ k: "short", t: `ขาด ${req - tot}` });
    const lv = out.some((x) => x.k === "exp") ? "exp" : out.some((x) => x.k === "near") ? "near" : out.length ? "short" : "";
    return { lv, list: out, tot, minD };
  }
  const ISS_ICON = { exp: "alert-circle", near: "alert-triangle", short: "alert-triangle" };
  const issBadges = (iss) => iss.list.map((x) => `<span class="iss-badge iss-${x.k}">${ic(ISS_ICON[x.k])} ${x.t}</span>`).join("");
  const domLots = (tb) => [...tb.querySelectorAll("tr[data-lot]")].map((tr) => ({ lot: tr.querySelector('[data-f="lot"]').value.trim(), exp: tr.querySelector('[data-f="expiryDate"]').value, qty: Number(tr.querySelector('[data-f="qty"]').value || 0) }));
  // อัปเดตสี/ป้ายของแถวยาในตาราง + กล่องสรุปด้านบน (เรียกเมื่อโหลด และทุกครั้งที่แก้จำนวน/วันที่)
  App.itemFlags = () => {
    const tbs = $$("tbody[data-drug]");
    const issues = [];
    tbs.forEach((tb) => {
      const g = (f) => (tb.querySelector(`[data-g="${f}"]`)?.value || "").trim();
      const iss = drugIssue(domLots(tb), Number(g("requiredQty") || 0));
      tb.dataset.issue = iss.lv;
      const slot = tb.querySelector(".iss-slot");
      if (slot) slot.innerHTML = issBadges(iss);
      tb.querySelectorAll("tr[data-lot]").forEach((tr) => {
        const d = daysUntil(tr.querySelector('[data-f="expiryDate"]').value);
        tr.dataset.lotst = d < 0 ? "exp" : d <= nearDays() ? "near" : "";
      });
      if (iss.lv && g("drugName")) issues.push({ name: `${g("drugName")} ${g("strength")}`.trim(), iss, tb });
    });
    renderIssueBox(issues);
  };
  function renderIssueBox(issues) {
    const el = $("#issBox"); if (!el) return;
    if (!issues.length) { el.innerHTML = `<div class="iss-ok">${ic("circle-check")} ยาทุกรายการครบและยังไม่ใกล้หมดอายุ</div>`; return; }
    const rank = { exp: 0, near: 1, short: 2 };
    issues.sort((a, b) => rank[a.iss.lv] - rank[b.iss.lv] || (a.iss.minD || 0) - (b.iss.minD || 0));
    const nExp = issues.filter((x) => x.iss.lv === "exp").length;
    el.innerHTML = `<div class="iss-box ${nExp ? "lv-exp" : "lv-near"}">
      <div class="iss-head">${ic(nExp ? "alert-circle" : "alert-triangle")} <b>ต้องจัดการ ${issues.length} รายการ</b></div>
      ${issues.map((x, i) => `<button type="button" class="iss-item" onclick="App.goIssue(${i})"><span class="grow">${esc(x.name)}</span>${issBadges(x.iss)}</button>`).join("")}</div>`;
    App._issues = issues;
  }
  App.goIssue = (i) => {
    const x = App._issues?.[i]; if (!x) return;
    const tbs = $$("#itemsTable tbody[data-drug]");
    const idx = tbs.indexOf(x.tb);
    if (window.matchMedia("(max-width: 760px)").matches && idx >= 0) return App.editDrug(idx);
    x.tb.scrollIntoView({ behavior: "smooth", block: "center" });
    x.tb.classList.add("iss-flash"); setTimeout(() => x.tb.classList.remove("iss-flash"), 1400);
  };

  function itemsEditor(items) {
    return `<div id="issBox"></div><div class="items-m" id="itemsM"></div><div class="table-wrap items-desk"><table class="t compact itbl" id="itemsTable"><thead><tr><th>ชื่อยา</th><th>ความแรง</th><th>Lot</th><th>วันหมดอายุ</th><th>จำนวน</th><th>ควรมี</th><th>หน่วย</th><th></th></tr></thead>
      ${groupDrugs(items).map(drugGroup).join("")}</table></div>
      <div class="row mt-12 wrap"><button class="btn sm" onclick="App.addItemRow()">${ic("plus")} เพิ่มยา</button><span class="xs faint items-desk">ยาเดียวกันหลาย lot ให้กด ${ic("plus")} lot ที่แถวของยานั้น</span><span class="xs faint items-mhint">แตะที่ยาเพื่อแก้ไข / เพิ่ม lot</span></div>`;
  }
  function lotCells(it) {
    const nd = nearDays();
    const dd = daysUntil(it.expiryDate);
    const color = !it.expiryDate ? "" : dd < 0 ? "color:var(--danger-text)" : dd <= nd ? "color:var(--warn-text)" : "";
    return `<td data-a="lot" data-l="Lot"><input class="input sm" data-f="lot" value="${esc(it.lot || "")}" placeholder="Lot"></td>
      <td data-a="exp" data-l="วันหมดอายุ">${dateSel('data-f="expiryDate"', it.expiryDate, "App.itemFlags()")}</td>
      <td data-a="qty" data-l="จำนวน"><input class="input sm" type="number" min="0" data-f="qty" value="${esc(it.qty ?? 0)}" oninput="App.lotSum(this)"></td>`;
  }
  function lotRow(it = {}) {
    return `<tr data-lot class="lot-sub"><td colspan="2" data-a="tag"><span class="lot-tag">${ic("corner-down-right")} lot เพิ่ม</span></td>${lotCells(it)}<td class="m-hide"></td><td class="m-hide"></td>
      <td class="nowrap" data-a="act"><span class="btn sm icon" style="visibility:hidden"></span><button class="btn ghost sm icon" title="ลบ lot นี้" onclick="App.delLot(this)">${ic("x")}</button></td></tr>`;
  }
  function drugGroup(lots = [{}]) {
    const h = lots[0] || {};
    const req = Math.max(0, ...lots.map((x) => Number(x.requiredQty || 0)));
    return `<tbody data-drug>
      <tr data-lot class="lot-head"><td data-a="name" data-l="ชื่อยา"><input class="input sm${drugKnown(h.drugName) ? "" : " warn-in"}" data-g="drugName" list="drugList" autocomplete="off" onchange="SEB.drugPicked(this)" value="${esc(h.drugName || "")}"><div class="iss-slot"></div></td>
        <td data-a="str" data-l="ความแรง"><input class="input sm" data-g="strength" value="${esc(h.strength || "")}"></td>
        ${lotCells(h)}
        <td data-a="req" data-l="ควรมี (รวม)"><input class="input sm" type="number" min="0" data-g="requiredQty" value="${esc(req)}" title="จำนวนที่ควรมีรวมทุก lot" oninput="App.lotSum(this)"></td>
        <td data-a="unit" data-l="หน่วย"><input class="input sm" data-g="unit" list="unitList" value="${esc(h.unit || "")}"><input type="hidden" data-g="form" value="${esc(h.form || "")}"></td>
        <td class="nowrap" data-a="act"><button class="btn ghost sm icon" title="เพิ่ม lot ของยานี้" onclick="App.dupItem(this)">${ic("plus")}</button><button class="btn ghost sm icon" title="ลบ" onclick="App.delLot(this)">${ic("x")}</button></td></tr>
      ${lots.slice(1).map(lotRow).join("")}
      ${sumRow(lots)}
    </tbody>`;
  }
  function sumRow(lots) {
    const tot = lots.reduce((a, x) => a + Number(x.qty || 0), 0);
    const req = Math.max(0, ...lots.map((x) => Number(x.requiredQty || 0)));
    const short = req && tot < req;
    return `<tr class="lot-sum" ${lots.length > 1 ? "" : "hidden"}><td colspan="4" class="xs faint" data-a="sl" style="text-align:right">รวม <span data-n>${lots.length}</span> lot</td>
      <td class="tabnum" data-tot data-a="st" style="font-weight:650;${short ? "color:var(--danger-text)" : ""}">${tot}</td><td colspan="3" class="xs ${short ? "" : "faint"}" data-msg data-a="sm" style="${short ? "color:var(--danger-text)" : ""}">${short ? `ขาด ${req - tot}` : req ? "ครบ" : ""}</td></tr>`;
  }
  App.lotSum = (el) => {
    const tb = el.closest("tbody[data-drug]"); if (!tb) return;
    const lots = [...tb.querySelectorAll("tr[data-lot]")];
    const tot = lots.reduce((a, tr) => a + Number(tr.querySelector('[data-f="qty"]').value || 0), 0);
    const req = Number(tb.querySelector('[data-g="requiredQty"]').value || 0);
    const sr = tb.querySelector("tr.lot-sum");
    sr.hidden = lots.length < 2;
    sr.querySelector("[data-n]").textContent = lots.length;
    const short = req && tot < req;
    const t = sr.querySelector("[data-tot]"); t.textContent = tot; t.style.color = short ? "var(--danger-text)" : "";
    const m = sr.querySelector("[data-msg]"); m.textContent = short ? `ขาด ${req - tot}` : req ? "ครบ" : ""; m.style.color = short ? "var(--danger-text)" : "";
    m.classList.toggle("faint", !short);
    App.itemFlags();
  };
  function itemsReadonly(items) {
    const nd = nearDays();
    if (!items.length) return empty("ยังไม่มีรายการยา", "pill-off");
    const rows = groupDrugs(items).map((lots) => {
      const tot = lots.reduce((a, x) => a + Number(x.qty || 0), 0);
      const req = Math.max(0, ...lots.map((x) => Number(x.requiredQty || 0)));
      const h = lots[0];
      const iss = drugIssue(lots.map((x) => ({ exp: x.expiryDate, qty: x.qty })), req);
      return lots.map((it, i) => `<tr class="${i ? "lot-sub" : ""}" data-issue="${iss.lv}"><td data-l="ยา">${i ? `<span class="lot-tag">${ic("corner-down-right")} lot เพิ่ม</span>` : `${esc(h.drugName)} <span class="muted">${esc(h.strength || "")}</span>${iss.list.length ? `<div>${issBadges(iss)}</div>` : ""}`}</td><td data-l="Lot">${esc(it.lot || "–")}</td><td data-l="หมดอายุ">${expPill(it.expiryDate, nd)}</td><td data-l="จำนวน" class="tabnum">${esc(it.qty)}${i ? "" : ` / ${esc(req || "–")} ${esc(h.unit || "")}`}${!i && lots.length > 1 ? ` <span class="xs faint">(รวม ${tot})</span>` : ""}</td></tr>`).join("");
    }).join("");
    return `<div class="table-wrap"><table class="t compact responsive"><thead><tr><th>ชื่อยา</th><th>Lot</th><th>วันหมดอายุ</th><th>จำนวน</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;
  App.addItemRow = () => {
    $("#itemsTable").insertAdjacentHTML("beforeend", drugGroup([{}]));
    const tbs = $$("#itemsTable tbody[data-drug]");
    if (isMobile()) return App.editDrug(tbs.length - 1, true);
    tbs[tbs.length - 1].querySelector('[data-g="drugName"]').focus();
  };

  // ---------- มือถือ: รายการสรุปอ่านง่าย + แตะเพื่อแก้ไขในแผ่นล่าง ----------
  // แผ่นแก้ไขย้าย <tbody> ตัวจริงเข้าไปชั่วคราว แล้วย้ายกลับเมื่อกด "เสร็จ" — ข้อมูลจึงมีชุดเดียว บันทึกด้วยปุ่มเดิม
  App.itemsM = () => {
    App.itemFlags();
    const el = $("#itemsM"); if (!el) return;
    const nd = nearDays();
    const tbs = $$("#itemsTable tbody[data-drug]");
    el.innerHTML = tbs.length ? tbs.map((tb, i) => {
      const g = (f) => (tb.querySelector(`[data-g="${f}"]`)?.value || "").trim();
      const lots = [...tb.querySelectorAll("tr[data-lot]")].map((tr) => ({ lot: tr.querySelector('[data-f="lot"]').value.trim(), exp: tr.querySelector('[data-f="expiryDate"]').value, qty: Number(tr.querySelector('[data-f="qty"]').value || 0) }));
      const req = Number(g("requiredQty") || 0);
      const iss = drugIssue(lots, req), tot = iss.tot;
      return `<button type="button" class="im-row" data-issue="${iss.lv}" onclick="App.editDrug(${i})">
        <div class="im-top"><div class="grow"><b>${esc(g("drugName") || "(ยังไม่ระบุชื่อ)")}</b> <span class="muted">${esc(g("strength"))}</span></div>
          <span class="pill ${iss.list.some((x) => x.k === "short") ? "danger" : "ok"}">${tot}${req ? "/" + req : ""} ${esc(g("unit"))}</span>${ic("chevron-right")}</div>
        ${iss.list.length ? `<div class="im-iss">${issBadges(iss)}</div>` : ""}
        <div class="im-lots">${lots.map((x) => `<div class="im-lot"><span class="mono">${esc(x.lot || "ไม่ระบุ lot")}</span>${x.exp ? expPill(x.exp, nd) : `<span class="xs faint">ไม่ระบุวันหมดอายุ</span>`}<span class="tabnum">× ${x.qty}</span></div>`).join("")}</div>
      </button>`;
    }).join("") : empty("ยังไม่มีรายการยา", "pill-off");
  };
  App.editDrug = (idx, isNew) => {
    const tb = $$("#itemsTable tbody[data-drug]")[idx]; if (!tb) return;
    App.closeDrugSheet();
    const ph = document.createComment("drug-slot");
    tb.before(ph);
    S._sheet = { tb, ph };
    const el = document.createElement("div");
    el.className = "sheet-back";
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h3 class="grow">${isNew ? "เพิ่มยา" : "แก้ไขรายการยา"}</h3><button class="btn ghost sm icon" title="ปิด" onclick="App.closeDrugSheet()">${ic("x")}</button></div>
      <div class="sheet-body"><table class="itbl sheet-tbl"></table>
        <button class="btn sm mt-12" style="width:100%;justify-content:center" onclick="App.dupItem(document.querySelector('.sheet-tbl tbody [title=\'เพิ่ม lot ของยานี้\']'))">${ic("plus")} เพิ่ม lot ของยานี้</button></div>
      <div class="sheet-foot"><button class="btn danger-ghost" onclick="App.delDrugSheet()">${ic("trash")} ลบยานี้</button><span class="grow"></span><button class="btn primary" onclick="App.closeDrugSheet()">เสร็จ</button></div></div>`;
    el.addEventListener("click", (e) => { if (e.target === el) App.closeDrugSheet(); });
    document.body.append(el);
    el.querySelector(".sheet-tbl").append(tb);
    document.body.classList.add("sheet-open");
    if (isNew) setTimeout(() => tb.querySelector('[data-g="drugName"]').focus(), 50);
  };
  App.closeDrugSheet = () => {
    const sh = S._sheet;
    if (sh) {
      if (sh.tb.isConnected || sh.ph.isConnected) {
        if (sh.ph.isConnected) sh.ph.replaceWith(sh.tb);
        if (!sh.tb.querySelector('[data-g="drugName"]')?.value.trim() && ![...sh.tb.querySelectorAll('[data-f="lot"]')].some((x) => x.value.trim())) sh.tb.remove();
      }
      S._sheet = null;
    }
    $$(".sheet-back").forEach((x) => x.remove());
    document.body.classList.remove("sheet-open");
    App.itemsM();
  };
  App.delDrugSheet = () => {
    const sh = S._sheet; if (!sh) return;
    sh.tb.remove(); sh.ph.remove();
    App.closeDrugSheet();
  };
  App.dupItem = (btn) => {
    const tb = btn.closest("tbody[data-drug]");
    tb.querySelector("tr.lot-sum").insertAdjacentHTML("beforebegin", lotRow({ qty: 0 }));
    const rows = tb.querySelectorAll("tr[data-lot]");
    rows[rows.length - 1].querySelector('[data-f="lot"]').focus();
    App.lotSum(btn);
  };
  App.delLot = (btn) => {
    const tr = btn.closest("tr"), tb = tr.closest("tbody[data-drug]");
    const lots = [...tb.querySelectorAll("tr[data-lot]")];
    if (lots.length === 1) { if (S._sheet?.tb === tb) return App.delDrugSheet(); tb.remove(); App.itemsM(); return; }   // lot เดียว = ลบยารายการนี้
    if (tr.classList.contains("lot-head")) {                      // ลบ lot แรก: ยก lot ถัดไปขึ้นมาแทน
      const nx = lots[1];
      ["lot", "exp", "qty"].forEach((a) => tr.querySelector(`td[data-a="${a}"]`).replaceChildren(...nx.querySelector(`td[data-a="${a}"]`).childNodes));
      nx.remove();
    } else tr.remove();
    App.lotSum(tb.querySelector("input"));
  };
  function collectItems() {
    const out = [];
    $$("#itemsTable tbody[data-drug]").forEach((tb) => {
      const g = (f) => (tb.querySelector(`[data-g="${f}"]`)?.value || "").trim();
      const drugName = g("drugName"); if (!drugName) return;
      const base = { drugName, strength: g("strength"), unit: g("unit"), form: g("form"), requiredQty: Number(g("requiredQty") || 0) };
      tb.querySelectorAll("tr[data-lot]").forEach((tr) => {
        const f = (k) => tr.querySelector(`[data-f="${k}"]`).value.trim();
        out.push({ ...base, lot: f("lot"), expiryDate: f("expiryDate"), qty: Number(f("qty") || 0) });
      });
    });
    return out;
  }

  // ---------- QR / print ----------
  function qrSvgFor(text, cell = 4) {
    if (!window.qrcode || !text) return "";
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
  }
  function printHtml(title, body, css = "") {
    const w = window.open("", "_blank");
    if (!w) return fail(new Error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up"));
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <link rel="stylesheet" href="${new URL("./vendor/fonts.css", location.href).href}">
      <style>*{box-sizing:border-box}body{font-family:"IBM Plex Sans Thai",sans-serif;margin:0;color:#111;font-size:12px}@page{size:A4;margin:12mm}${css}</style></head><body>${body}
      <script>document.fonts.ready.then(()=>setTimeout(()=>{window.print()},250))<\/script></body></html>`);
    w.document.close();
  }
  App.printHtml = printHtml;
  App.printQr = function (ids) {
    const boxes = ids ? D().boxes.filter((b) => ids.includes(b.id)) : D().boxes;
    const hosp = D().settings.HOSPITAL_NAME || "";
    printHtml("ฉลาก QR กล่องยาฉุกเฉิน", `<div class="grid">${boxes.map((b) => `<div class="lbl"><div class="qr">${qrSvgFor(b.qrUrl, 4)}</div><div class="txt"><div class="h">กล่องยาฉุกเฉิน</div><div class="code">${esc(b.boxCode)}</div><div class="loc">${esc(b.location)}</div><div class="hint">เปิดใช้กล่อง → สแกน QR → กรอก HN<br>รักษาผู้ป่วยก่อน บันทึกทีหลังได้</div><div class="hosp">${esc(hosp)} · ห้องยา</div></div></div>`).join("")}</div>`,
      `.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}.lbl{border:1.2px solid #111;border-radius:4mm;padding:4mm;display:flex;gap:4mm;align-items:center;break-inside:avoid;height:52mm}.qr{width:40mm;flex:none}.qr svg{width:100%;height:auto;display:block}.h{font-size:10px;font-weight:600;color:#c62828;letter-spacing:.04em}.code{font-size:24px;font-weight:700;line-height:1.1}.loc{font-size:12px;color:#444}.hint{font-size:10px;margin-top:2mm;color:#333}.hosp{font-size:9px;color:#777;margin-top:2mm}`);
  };
  App.printDrugRecord = function (id) {
    const b = boxById(id);
    const hosp = D().settings.HOSPITAL_NAME || "";
    const rows = b.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.drugName)}</td><td>${esc(it.strength || "")}</td><td>${esc(it.form || "")}</td><td class="c">${esc(it.requiredQty || "")}</td><td></td><td>${esc(it.lot || "")}</td><td>${it.expiryDate ? fmtD(it.expiryDate) : ""}</td><td>☐ ปกติ ☐ ใกล้หมด ☐ หมดอายุ</td><td></td></tr>`).join("");
    printHtml(`ใบบันทึกตรวจ ${b.boxCode}`, `<h2>แบบบันทึกผลการตรวจสอบกล่องยาฉุกเฉินประจำเดือน</h2><div class="sub">${esc(hosp)} · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค</div>
      <div class="meta">รหัสกล่องยา: <b>${esc(b.boxCode)}</b> &nbsp; ชุดยา: ${esc(b.kitName || "-")} &nbsp; แผนก/ตึก: ${esc(b.location || "-")}<br>วันที่ตรวจสอบ: ........................ ผู้ตรวจสอบ: ........................................ เลขซีล: ..................</div>
      <table><thead><tr><th>#</th><th>ชื่อยา</th><th>ความแรง</th><th>รูปแบบ</th><th>ควรมี</th><th>จริง</th><th>Lot No.</th><th>วันหมดอายุ</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="meta" style="margin-top:6mm">สรุปผล: ☐ ผ่าน — ยาครบถ้วน ไม่มีหมดอายุ &nbsp; ☐ ไม่ผ่าน (ระบุ): ...............................................<br>เวลาที่ใช้ในการตรวจสอบ (นาที): .............. ลายมือชื่อผู้ตรวจสอบ: ................................................</div>`,
      `h2{font-size:16px;margin:0}.sub{color:#666;margin-bottom:4mm}.meta{line-height:2}table{width:100%;border-collapse:collapse;margin-top:3mm}th,td{border:1px solid #333;padding:2mm 1.5mm;font-size:11px;text-align:left}th{background:#f2f2f2}.c{text-align:center}`);
  };

  // =================================================================
  // Inspections
  // =================================================================
  App.pageInspections = async function () {
    S.insTab = S.insTab || "due";
    setTitle("ตรวจประจำเดือน", isStaff() ? `<button class="btn" onclick="App.printAppt()">${ic("printer")} <span class="desktop-only">ฉลากนัดตรวจ</span></button><button class="btn" onclick="App.openSchedule()">${ic("calendar-plus")} <span class="desktop-only">นัดตรวจ</span></button>` : "");
    const t = S.insTab;
    const boxes = [...D().boxes].sort((a, b) => String(a.inspectionDate || "0").localeCompare(String(b.inspectionDate || "0")));
    $("#content").innerHTML = `<div class="subnav"><button class="${t === "due" ? "on" : ""}" onclick="App.insTab('due')">กล่องที่ต้องตรวจ</button><button class="${t === "hist" ? "on" : ""}" onclick="App.insTab('hist')">ประวัติการตรวจ</button></div><div id="insBody"></div>`;
    if (t === "due") {
      $("#insBody").innerHTML = `<div class="card"><div class="table-wrap"><table class="t responsive"><thead><tr><th>กล่อง</th><th>จุด</th><th>ตรวจล่าสุด</th><th>ครบกำหนด</th><th>สถานะกล่อง</th><th></th></tr></thead><tbody>
        ${boxes.map((b) => `<tr><td data-l="กล่อง"><b>${esc(b.boxCode)}</b></td><td data-l="จุด">${esc(b.location)}</td><td data-l="ตรวจล่าสุด">${fmtD(b.lastInspectedAt)}</td>
          <td data-l="ครบกำหนด">${b.inspectionDate ? `<span class="pill ${b.inspectionOverdue ? "warn" : "plain"}">${fmtD(b.inspectionDate)}</span>` : `<span class="faint">ยังไม่นัด</span>`}</td><td data-l="สถานะ">${boxPill(b)}</td>
          <td class="right">${isStaff() ? `<button class="btn sm ${b.inspectionOverdue ? "primary" : ""}" onclick="App.go('inspect','${b.id}')">เริ่มตรวจ</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`;
    } else {
      $("#insBody").innerHTML = `<div class="card">${empty("กำลังโหลด…", "loader-2")}</div>`;
      try {
        if (!S.inspections) S.inspections = (await api("apiListInspections", S.token)).inspections;
        const rows = S.inspections;
        $("#insBody").innerHTML = `<div class="card">${rows.length ? `<div class="table-wrap"><table class="t responsive"><thead><tr><th>วันที่ตรวจ</th><th>กล่อง</th><th>ผู้ตรวจ</th><th>ใช้เวลา</th><th>ตรวจ</th><th>หมดอายุ</th><th>ขาด</th><th>ผล</th></tr></thead><tbody>
          ${rows.map((r) => `<tr class="click" onclick="App.viewInspection('${r.id}')"><td data-l="วันที่" class="tabnum">${fmtDT(r.inspectedAt)}</td><td data-l="กล่อง"><b>${esc(r.boxCode)}</b> <span class="xs faint">${r.source === "paper" ? "กระดาษ" : ""}</span></td><td data-l="ผู้ตรวจ">${esc(r.inspectorName || "")}</td><td data-l="ใช้เวลา" class="tabnum">${r.durationMin != null ? r.durationMin + " นาที" : "–"}</td><td data-l="ตรวจ" class="tabnum">${r.itemsChecked}</td><td data-l="หมดอายุ" class="tabnum">${r.itemsExpired}</td><td data-l="ขาด" class="tabnum">${r.itemsMissing}</td><td data-l="ผล">${r.isReady ? `<span class="pill ok">ผ่าน</span>` : `<span class="pill danger">ไม่ผ่าน</span>`}</td></tr>`).join("")}</tbody></table></div>` : empty("ยังไม่มีประวัติการตรวจ", "clipboard-off")}</div>`;
      } catch (e) { $("#insBody").innerHTML = `<div class="card">${empty(e.message, "alert-circle")}</div>`; }
    }
  };
  App.insTab = (t) => { S.insTab = t; App.render(); };
  App.viewInspection = async (id) => {
    try {
      const r = await api("apiGetInspection", S.token, id);
      const i = r.inspection;
      const ST = { normal: ["ปกติ", "ok"], near: ["ใกล้หมด", "warn"], expired: ["หมดอายุ", "danger"], missing: ["ขาด", "danger"] };
      drawer(`ผลตรวจ ${esc(i.boxCode)}`, `<div class="grid grid-3 mb-16"><div><div class="xs faint">วันที่</div><b>${fmtDT(i.inspectedAt)}</b></div><div><div class="xs faint">ผู้ตรวจ</div><b>${esc(i.inspectorName || "")}</b></div><div><div class="xs faint">ผล</div>${i.isReady ? `<span class="pill ok">ผ่าน</span>` : `<span class="pill danger">ไม่ผ่าน</span>`}</div></div>
        <div class="card"><table class="t compact"><thead><tr><th>ยา</th><th>ควรมี/จริง</th><th>Lot</th><th>หมดอายุ</th><th>สถานะ</th></tr></thead><tbody>${r.items.map((x) => `<tr><td>${esc(x.drugName)} <span class="muted">${esc(x.strength || "")}</span></td><td class="tabnum">${esc(x.requiredQty)} / ${esc(x.actualQty ?? "–")}</td><td>${esc(x.lot || "")}</td><td>${fmtD(x.expiryDate)}</td><td><span class="pill ${ST[x.status]?.[1] || ""}">${ST[x.status]?.[0] || x.status}</span></td></tr>`).join("")}</tbody></table></div>
        ${i.problemNote ? `<div class="mt-12"><div class="xs faint">ปัญหาที่พบ</div>${esc(i.problemNote)}</div>` : ""}<div class="xs faint mt-12">ความครบถ้วนของการบันทึก ${i.filledFields}/${i.requiredFields} · ใช้เวลา ${i.durationMin ?? "–"} นาที · ซีล ${esc(i.sealNo || "–")}</div>`);
    } catch (e) { fail(e); }
  };
  App.openSchedule = () => {
    drawer("นัดวันตรวจกล่อง", `<div class="form-grid">${field("วันที่นัดตรวจ", `<input class="input" type="date" id="scDate">`)}${field("หมายเหตุ", `<input class="input" id="scNote">`)}</div>
      <label class="check mt-16"><input type="checkbox" id="scAll" onchange="SEB.$$('[data-sc]').forEach(c=>c.checked=this.checked)"> เลือกทุกกล่อง</label>
      <div class="card mt-8">${D().boxes.map((b) => `<label class="list-row check"><input type="checkbox" data-sc="${b.id}"> <span class="grow">${esc(b.boxCode)} <span class="faint small">${esc(b.location)}</span></span><span class="xs faint">${b.inspectionDate ? fmtD(b.inspectionDate) : ""}</span></label>`).join("")}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="scBtn" onclick="App.saveSchedule()">บันทึกวันนัด</button>`);
  };
  App.saveSchedule = withBusy("#scBtn", async () => {
    const ids = $$("[data-sc]").filter((c) => c.checked).map((c) => c.dataset.sc);
    if (!val("scDate") || !ids.length) throw new Error("กรุณาเลือกวันที่และกล่อง");
    const r = await api("apiSaveInspectionSchedule", S.token, { boxIds: ids, inspectionDate: val("scDate"), inspectionNote: val("scNote") });
    S.data = r.data; closeDrawer(); toast(`นัดตรวจ ${ids.length} กล่องแล้ว`); App.render();
  });

  // ---------- inspect form ----------
  App.pageInspect = function () {
    const b = boxById(S.param);
    if (!b) { $("#content").innerHTML = empty("ไม่พบกล่องยา", "box-off"); return; }
    S.inspectStart = new Date().toISOString();
    setTitle(`ตรวจ ${b.boxCode}`, `<span class="pill accent" id="insTimer">00:00</span>`);
    const nd = nearDays();
    const autoStatus = (it) => { const d = daysUntil(it.expiryDate); if (Number(it.qty || 0) <= 0) return "missing"; if (!it.expiryDate) return "normal"; return d < 0 ? "expired" : d <= nd ? "near" : "normal"; };
    $("#content").innerHTML = `
      <div class="alert info mb-16" style="padding:10px 14px"><div class="small">ตรวจตามแบบบันทึก (ภาคผนวก ก 1.2) · ระบบจับเวลาการตรวจอัตโนมัติ · สถานะคำนวณจากวันหมดอายุ แก้ไขเองได้</div></div>
      <div class="card"><div class="card-head"><div class="grow"><h3>${esc(b.boxCode)} · ${esc(b.location)}</h3><div class="xs faint">${esc(b.kitName || "")}</div></div><div id="insSummary" class="row wrap"></div></div>
        <div class="table-wrap"><table class="t compact" id="insTable"><thead><tr><th style="min-width:160px">ชื่อยา</th><th>ควรมี</th><th>จำนวนจริง</th><th>Lot</th><th>วันหมดอายุ</th><th>สถานะ</th></tr></thead><tbody>
        ${b.items.map((it, i) => `<tr data-ins="${i}" data-drug="${esc(it.drugName)}" data-strength="${esc(it.strength || "")}" data-form="${esc(it.form || "")}" data-req="${esc(it.requiredQty || 0)}">
          <td data-a="name"><b>${esc(it.drugName)}</b> <span class="muted">${esc(it.strength || "")}</span></td><td class="tabnum" data-a="req" data-l="ควรมี">${esc(it.requiredQty || "–")}</td>
          <td data-a="qty" data-l="จำนวนจริง"><input class="input sm" type="number" min="0" data-f="actualQty" value="${esc(it.qty ?? "")}" style="width:76px" oninput="App.insAuto(this)"></td>
          <td data-a="lot" data-l="Lot"><input class="input sm" data-f="lot" value="${esc(it.lot || "")}" style="width:100px"></td>
          <td data-a="exp" data-l="วันหมดอายุ">${dateSel('data-f="expiryDate"', it.expiryDate, "App.insAuto(this)")}</td>
          <td data-a="st" data-l="สถานะ"><select class="input sm" data-f="status" onchange="this.dataset.manual=1;App.insSummary()">${opt([["normal", "ปกติ"], ["near", "ใกล้หมด"], ["expired", "หมดอายุ"], ["missing", "ขาด"]], autoStatus(it))}</select></td></tr>`).join("")}</tbody></table></div></div>
      <div class="card card-pad mt-16"><div class="form-grid">
        ${field("เลขซีล", `<input class="input" id="insSeal" value="${esc(b.sealNo || "")}">`)}
        ${field("ปัญหาที่พบ (ถ้ามี)", `<input class="input" id="insNote" placeholder="แตะปุ่มด้านล่าง หรือพิมพ์เอง">`)}
        <div class="full"><div class="chips">${optList("OPT_INSPECT_PROBLEMS").map((p, i) => `<button type="button" class="chip" data-ip="${i}" onclick="App.insProblem(${i})">${esc(p)}</button>`).join("")}</div></div>
        <label class="check full"><input type="checkbox" id="insApply" checked> ปรับรายการยาในกล่องตามผลตรวจนี้ (lot / วันหมดอายุ / จำนวน)</label></div>
        <div class="row mt-16" style="justify-content:flex-end"><button class="btn ghost" onclick="App.go('inspections')">ยกเลิก</button><button class="btn primary" id="insBtn" onclick="App.saveInspection('${b.id}')">${ic("check")} บันทึกผลตรวจ</button></div></div>`;
    App.insSummary();
    clearInterval(App._insT);
    App._insT = setInterval(() => {
      const el = $("#insTimer");
      if (!el) return clearInterval(App._insT);
      const s = Math.floor((Date.now() - new Date(S.inspectStart)) / 1000);
      el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }, 1000);
  };
  App.insAuto = function (el) {
    const tr = el.closest("tr");
    const sel = tr.querySelector('[data-f="status"]');
    if (!sel.dataset.manual) {
      const q = Number(tr.querySelector('[data-f="actualQty"]').value || 0);
      const exp = tr.querySelector('[data-f="expiryDate"]').value;
      const d = daysUntil(exp);
      sel.value = q <= 0 ? "missing" : !exp ? "normal" : d < 0 ? "expired" : d <= nearDays() ? "near" : "normal";
    }
    App.insSummary();
  };
  App.insSummary = function () {
    const st = $$("#insTable [data-f='status']").map((s) => s.value);
    const c = (k) => st.filter((x) => x === k).length;
    const ok = c("expired") === 0 && c("missing") === 0;
    const el = $("#insSummary");
    if (el) el.innerHTML = `<span class="pill plain">ตรวจ ${st.length}</span>${c("expired") ? `<span class="pill danger">หมดอายุ ${c("expired")}</span>` : ""}${c("near") ? `<span class="pill warn">ใกล้หมด ${c("near")}</span>` : ""}${c("missing") ? `<span class="pill danger">ขาด ${c("missing")}</span>` : ""}<span class="pill ${ok ? "ok" : "danger"}">${ok ? "ผ่าน" : "ไม่ผ่าน"}</span>`;
  };
  App.saveInspection = withBusy("#insBtn", async (boxId) => {
    const b = boxById(boxId);
    const items = $$("#insTable [data-ins]").map((tr, i) => {
      const src = b.items[i] || {};
      const g = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
      return { drugName: tr.dataset.drug, strength: tr.dataset.strength, form: tr.dataset.form, unit: src.unit || "", requiredQty: Number(tr.dataset.req || 0), actualQty: g("actualQty"), lot: g("lot"), expiryDate: g("expiryDate"), status: g("status") };
    });
    const r = await api("apiSaveInspection", S.token, { boxId, items, sealNo: val("insSeal"), problemNote: val("insNote"), startedAt: S.inspectStart, finishedAt: new Date().toISOString(), applyToBox: $("#insApply").checked });
    S.data = r.data;
    S.inspections = null;
    clearInterval(App._insT);
    toast(`บันทึกผลตรวจแล้ว · ${r.inspection.isReady ? "ผ่าน" : "ไม่ผ่าน"}`);
    S.insTab = "hist";
    App.go("inspections");
  });

  // =================================================================
  // Kits
  // =================================================================
  App.pageKits = function () {
    setTitle("ชุดยามาตรฐาน", isStaff() ? `<button class="btn primary" onclick="App.editKit()">${ic("plus")} <span class="desktop-only">เพิ่มชุดยา</span></button>` : "");
    const kits = D().kits;
    $("#content").innerHTML = kits.length ? `<div class="grid grid-3">${kits.map((k) => {
      const used = D().boxes.filter((b) => b.kitId === k.id).length;
      return `<div class="card card-pad" style="cursor:pointer" onclick="App.editKit('${k.id}')"><div class="row between"><h3>${esc(k.name)}</h3><span class="pill plain">${k.items.length} รายการ</span></div>
        <div class="muted small mt-4">${esc(k.description || "")}</div><div class="xs faint mt-12">${k.items.slice(0, 4).map((i) => esc(i.drugName)).join(" · ")}${k.items.length > 4 ? " …" : ""}</div><div class="xs faint mt-8">ใช้กับ ${used} กล่อง</div></div>`;
    }).join("")}</div>` : `<div class="card">${empty("ยังไม่มีชุดยามาตรฐาน", "pill-off")}</div>`;
  };
  App.editKit = function (id) {
    const k = D().kits.find((x) => x.id === id) || { name: "", description: "", items: [] };
    const row = (i = {}) => `<tr data-kit><td><input class="input sm${drugKnown(i.drugName) ? "" : " warn-in"}" data-f="drugName" list="drugList" autocomplete="off" onchange="SEB.drugPicked(this)" value="${esc(i.drugName || "")}"></td><td><input class="input sm" data-f="strength" value="${esc(i.strength || "")}" style="width:100px"></td><td><input class="input sm" type="number" data-f="defaultQty" value="${esc(i.defaultQty ?? "")}" style="width:70px"></td><td><input class="input sm" data-f="unit" list="unitList" value="${esc(i.unit || "")}" style="width:80px"></td><td><button class="btn ghost sm icon" onclick="this.closest('tr').remove()">${ic("x")}</button></td></tr>`;
    App._kitRow = row;
    drawer(id ? "แก้ไขชุดยา" : "เพิ่มชุดยา", `<div class="form-grid">${field("ชื่อชุด", `<input class="input" id="kName" value="${esc(k.name)}">`)}${field("คำอธิบาย", `<input class="input" id="kDesc" value="${esc(k.description || "")}">`)}</div>
      <div class="card mt-16"><table class="t compact" id="kitTable"><thead><tr><th>ชื่อยา</th><th>ความแรง</th><th>จำนวน</th><th>หน่วย</th><th></th></tr></thead><tbody>${(k.items.length ? k.items : [{}]).map(row).join("")}</tbody></table></div>
      <button class="btn sm mt-12" onclick="SEB.$('#kitTable tbody').insertAdjacentHTML('beforeend',App._kitRow())">${ic("plus")} เพิ่มรายการ</button>`,
      `${id && isAdmin() ? `<button class="btn danger-ghost" onclick="App.deleteKit('${id}')">ลบ</button><span class="grow"></span>` : ""}<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button>${isStaff() ? `<button class="btn primary" id="kBtn" onclick="App.saveKit('${id || ""}')">บันทึก</button>` : ""}`, { wide: true });
  };
  App.saveKit = withBusy("#kBtn", async (id) => {
    const items = $$("#kitTable [data-kit]").map((tr) => { const o = {}; tr.querySelectorAll("[data-f]").forEach((el) => (o[el.dataset.f] = el.value.trim())); return o; }).filter((o) => o.drugName);
    if (!val("kName")) throw new Error("กรุณาระบุชื่อชุด");
    const r = await api("apiSaveKit", S.token, { id: id || undefined, name: val("kName"), description: val("kDesc"), items });
    S.data = r.data; closeDrawer(); toast("บันทึกชุดยาแล้ว"); App.render();
  });
  App.deleteKit = async (id) => {
    if (!(await dialog({ title: "ลบชุดยานี้?", body: "กล่องที่สร้างไปแล้วไม่ได้รับผลกระทบ", confirm: "ลบ", danger: true }))) return;
    try { const r = await api("apiDeleteKit", S.token, id); S.data = r.data; closeDrawer(); App.render(); } catch (e) { fail(e); }
  };

  // =================================================================
  // Locations
  // =================================================================
  App.pageLocations = function () {
    setTitle("จุดวางกล่อง", isAdmin() ? `<button class="btn primary" onclick="App.editLoc()">${ic("plus")} <span class="desktop-only">เพิ่มจุด</span></button>` : "");
    const locs = D().locations;
    const sect = (z, title) => {
      const L = locs.filter((l) => l.zone === z);
      return `<div class="card mb-16"><div class="card-head"><h3 class="grow">${title}</h3><span class="xs faint">${L.filter((l) => l.active !== false).length} จุด</span></div>
        ${L.length ? `<div class="table-wrap"><table class="t responsive"><thead><tr><th>ชื่อจุด</th><th>ประเภท</th><th>กล่อง</th>${isAdmin() ? "<th>ขอบเขตวิจัย</th>" : ""}<th>สถานะ</th></tr></thead><tbody>${L.map((l) => `<tr class="click" onclick="App.editLoc('${l.id}')"><td data-l="ชื่อ"><b>${esc(l.name)}</b> ${l.code ? `<span class="xs faint mono">${esc(l.code)}</span>` : ""}</td><td data-l="ประเภท">${UNIT_TYPES[l.unitType] || l.unitType}</td><td data-l="กล่อง" class="tabnum">${D().boxes.filter((b) => b.locationId === l.id).length}</td>${isAdmin() ? `<td data-l="วิจัย">${l.inStudy ? `<span class="pill violet">อยู่ในขอบเขต</span>` : `<span class="faint small">–</span>`}</td>` : ""}<td data-l="สถานะ">${l.active === false ? `<span class="pill">ปิดใช้</span>` : `<span class="pill ok">ใช้งาน</span>`}</td></tr>`).join("")}</tbody></table></div>` : empty("ยังไม่มีจุดในกลุ่มนี้", "map-pin-off")}</div>`;
    };
    $("#content").innerHTML = `${isAdmin() ? `<div class="alert info mb-16" style="padding:10px 14px"><div class="small">โครงร่างวิจัยครอบคลุม 4 หน่วย: ER, IPD ชาย, IPD หญิง และ LR · จุดอื่น (OPD, EMS, รพ.สต.) ใช้งานได้ตามปกติ แต่ไม่รวมในชุดข้อมูลวิจัยหลัก</div></div>` : ""}${sect("in", "ใน โรงพยาบาล")}${sect("out", "นอก โรงพยาบาล (รพ.สต. ฯลฯ)")}`;
  };
  App.editLoc = function (id) {
    if (!isAdmin()) return;
    const l = D().locations.find((x) => x.id === id) || { name: "", zone: "in", unitType: "other", inStudy: false, active: true };
    drawer(id ? "แก้ไขจุดวางกล่อง" : "เพิ่มจุดวางกล่อง", `<div class="form-grid">
      ${field("ชื่อจุด", `<input class="input" id="lName" value="${esc(l.name)}" placeholder="เช่น รพ.สต.บ้านป่าอ้อ">`, "", "full")}
      ${field("รหัส", `<input class="input" id="lCode" value="${esc(l.code || "")}" placeholder="เช่น PCU-01">`)}
      ${field("ประเภท", `<select class="input" id="lType">${opt(Object.entries(UNIT_TYPES), l.unitType)}</select>`)}
      ${field("ตำแหน่ง", `<div class="seg" id="lZone">${[["in", "ใน รพ."], ["out", "นอก รพ."]].map(([z, t]) => `<button type="button" data-z="${z}" class="${l.zone === z ? "on" : ""}" onclick="SEB.$$('#lZone button').forEach(b=>b.classList.toggle('on',b===this))">${t}</button>`).join("")}</div>`)}
      ${field("ลำดับแสดง", `<input class="input" type="number" id="lSort" value="${esc(l.sortOrder || 0)}">`)}
      <label class="row full" style="gap:12px"><span class="switch"><input type="checkbox" id="lStudy" ${l.inStudy ? "checked" : ""}><span></span></span><span><b>อยู่ในขอบเขตงานวิจัย</b><div class="xs faint">ข้อมูลของจุดนี้รวมในชุดข้อมูลวิจัยหลัก</div></span></label>
      <label class="row full" style="gap:12px"><span class="switch"><input type="checkbox" id="lActive" ${l.active !== false ? "checked" : ""}><span></span></span><span><b>ใช้งาน</b></span></label>
      ${field("หมายเหตุ", `<input class="input" id="lNote" value="${esc(l.note || "")}">`, "", "full")}</div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="lBtn" onclick="App.saveLoc('${id || ""}')">บันทึก</button>`);
  };
  App.saveLoc = withBusy("#lBtn", async (id) => {
    const r = await api("apiSaveLocation", S.token, { id: id || undefined, name: val("lName"), code: val("lCode"), unitType: val("lType"), zone: $("#lZone .on")?.dataset.z || "in", sortOrder: val("lSort"), inStudy: $("#lStudy").checked, active: $("#lActive").checked, note: val("lNote") });
    S.data = r.data; closeDrawer(); toast("บันทึกแล้ว"); App.render();
  });

  // =================================================================
  // Logs
  // =================================================================
  const ACTIONS = {
    open_box: "บันทึกการเปิดกล่อง", acknowledge_event: "รับทราบเคส", confirm_ready: "ยืนยันพร้อมใช้", cancel_event: "ยกเลิกเคส", edit_actual_opened_at: "แก้เวลาเปิดจริง",
    reveal_hn: "เปิดดู HN", save_box: "แก้ไขกล่อง", create_box: "สร้างกล่อง", delete_box: "ลบกล่อง", regenerate_qr: "สร้าง QR ใหม่", save_kit: "แก้ไขชุดยา", delete_kit: "ลบชุดยา",
    save_location: "แก้ไขจุดวางกล่อง", save_inspection: "บันทึกผลตรวจ", save_inspection_schedule: "นัดตรวจ", save_user: "แก้ไขผู้ใช้", deactivate_user: "ปิดบัญชีผู้ใช้",
    save_settings: "แก้ไขตั้งค่า", change_password: "เปลี่ยนรหัสผ่าน", register_push_device: "ลงทะเบียนรับแจ้งเตือน", remove_push_device: "ยกเลิกรับแจ้งเตือน",
    export_research_dataset: "ส่งออกชุดข้อมูลวิจัย", record_paper_event: "คีย์ baseline กระดาษ", send_expiry_report: "ส่งรายงานยาใกล้หมดอายุ", reset_pilot_data: "ลบข้อมูลนำร่อง", sheet_export: "ส่งออกไป Google Sheets",
    save_baseline_aggregate: "บันทึก baseline ย้อนหลัง", finish_report_timing: "จับเวลาทำรายงาน",
  };
  App.pageLogs = async function () {
    S.logTab = S.logTab || "login";
    S.logFrom = S.logFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    S.logTo = S.logTo || X.todayStr();
    setTitle("ประวัติการใช้งาน", `<button class="btn" onclick="App.exportLogs()">${ic("download")} <span class="desktop-only">ส่งออก CSV</span></button>`);
    $("#content").innerHTML = `<div class="subnav"><button class="${S.logTab === "login" ? "on" : ""}" onclick="App.logTab('login')">การเข้าสู่ระบบ</button><button class="${S.logTab === "audit" ? "on" : ""}" onclick="App.logTab('audit')">การบันทึก / แก้ไขข้อมูล</button></div>
      <div class="row wrap mb-16 gap-12"><input class="input" type="date" style="width:auto" id="lgFrom" value="${S.logFrom}"><span class="faint">ถึง</span><input class="input" type="date" style="width:auto" id="lgTo" value="${S.logTo}"><button class="btn" onclick="S_logRange()">ค้นหา</button><input class="input" style="max-width:240px" placeholder="กรองชื่อผู้ใช้ / การกระทำ" id="lgQ" oninput="App.renderLogs()">
        <span class="grow"></span><span class="xs faint">แสดง</span><div class="seg" id="lgLimit">${[["50", "50"], ["100", "100"], ["all", "ทั้งหมด"]].map(([k, t]) => `<button type="button" class="${String(S.logLimit || "50") === k ? "on" : ""}" onclick="App.logLimit('${k}')">${t}</button>`).join("")}</div></div>
      <div class="card" id="logBody">${empty("กำลังโหลด…", "loader-2")}</div>`;
    try {
      if (!S.logs) S.logs = await api("apiListLogs", S.token, { from: S.logFrom, to: S.logTo });
      App.renderLogs();
    } catch (e) { $("#logBody").innerHTML = empty(e.message, "alert-circle"); }
  };
  window.S_logRange = () => { S.logFrom = val("lgFrom"); S.logTo = val("lgTo"); S.logs = null; App.render(); };
  App.logTab = (t) => { S.logTab = t; App.renderLogs(); $$(".subnav button").forEach((b, i) => b.classList.toggle("on", (i === 0) === (t === "login"))); };
  App.renderLogs = function () {
    const q = (val("lgQ") || "").toLowerCase();
    const el = $("#logBody");
    if (!S.logs || !el) return;
    if (S.logTab === "login") {
      const rows = S.logs.logins.filter((r) => !q || `${r.username} ${r.reason}`.toLowerCase().includes(q));
      const shown = limitRows(rows);
      el.innerHTML = rows.length ? `<div class="table-wrap"><table class="t responsive"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>ผล</th><th>ออกจากระบบ</th><th>อุปกรณ์</th></tr></thead><tbody>${shown.map((r) => `<tr><td data-l="เวลา" class="tabnum nowrap">${fmtDT(r.at)}</td><td data-l="ผู้ใช้"><b>${esc(r.username)}</b></td><td data-l="ผล">${r.success ? `<span class="pill ok">สำเร็จ</span>` : `<span class="pill danger">${{ bad_password: "รหัสผ่านผิด", no_user: "ไม่พบผู้ใช้", inactive: "บัญชีถูกปิด" }[r.reason] || "ไม่สำเร็จ"}</span>`}</td><td data-l="ออก" class="tabnum">${r.logoutAt ? fmtT(r.logoutAt) : "–"}</td><td data-l="อุปกรณ์" class="xs faint">${esc(deviceOf(r.userAgent))}</td></tr>`).join("")}</tbody></table></div>${countBar(shown.length, rows.length)}` : empty("ไม่มีข้อมูลในช่วงนี้", "history-off");
    } else {
      const RES = new Set(["export_research_dataset", "record_paper_event", "reset_pilot_data", "save_baseline_aggregate", "finish_report_timing", "sheet_export"]);
      const rows = S.logs.audits.filter((r) => (isAdmin() || !RES.has(r.action)) && (!q || `${r.username} ${ACTIONS[r.action] || r.action}`.toLowerCase().includes(q)));
      const shown = limitRows(rows);
      el.innerHTML = rows.length ? `<div class="table-wrap"><table class="t responsive"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead><tbody>${shown.map((r) => `<tr><td data-l="เวลา" class="tabnum nowrap">${fmtDT(r.at)}</td><td data-l="ผู้ใช้"><b>${esc(r.username || "–")}</b></td><td data-l="การกระทำ">${esc(ACTIONS[r.action] || r.action)}</td><td data-l="รายละเอียด" class="xs faint" style="max-width:360px;word-break:break-all">${esc(detailText(r.detailJson))}</td></tr>`).join("")}</tbody></table></div>${countBar(shown.length, rows.length)}` : empty("ไม่มีข้อมูลในช่วงนี้", "history-off");
    }
  };
  function limitRows(rows) { const l = S.logLimit || "50"; return l === "all" ? rows : rows.slice(0, Number(l)); }
  function countBar(n, total) { return `<div class="card-body row between xs faint" style="border-top:1px solid var(--border)"><span>แสดง ${n.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} รายการ</span>${n < total ? `<button class="btn ghost sm" onclick="App.logLimit('all')">แสดงทั้งหมด</button>` : ""}</div>`; }
  App.logLimit = (k) => { S.logLimit = k; $$("#lgLimit button").forEach((b, i) => b.classList.toggle("on", ["50", "100", "all"][i] === k)); App.renderLogs(); };
  function detailText(d) { if (!d) return ""; if (Array.isArray(d)) return d.join(", "); return Object.entries(d).filter(([k]) => !/^(id|boxId|eventId|userId)$/.test(k)).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "); }
  function deviceOf(ua = "") { return /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : ua ? "อื่น ๆ" : ""; }
  App.exportLogs = () => {
    if (!S.logs) return;
    const rows = S.logTab === "login" ? S.logs.logins.map((r) => ({ เวลา: fmtDT(r.at), at: r.at, ผู้ใช้: r.username, ผล: r.success ? "สำเร็จ" : r.reason, ออกจากระบบ: r.logoutAt || "", อุปกรณ์: deviceOf(r.userAgent) }))
      : S.logs.audits.filter((r) => isAdmin() || !["export_research_dataset", "record_paper_event", "reset_pilot_data", "save_baseline_aggregate", "finish_report_timing", "sheet_export"].includes(r.action)).map((r) => ({ เวลา: fmtDT(r.at), at: r.at, ผู้ใช้: r.username, การกระทำ: ACTIONS[r.action] || r.action, action: r.action, รายละเอียด: detailText(r.detailJson) }));
    download(`seb-${S.logTab}-log-${S.logFrom}_${S.logTo}.csv`, toCsv(rows));
  };

  // =================================================================
  // Users
  // =================================================================
  App.pageUsers = async function () {
    if (!isAdmin()) return App.go("dashboard");
    setTitle("ผู้ใช้งาน", `<button class="btn primary" onclick="App.editUser()">${ic("user-plus")} <span class="desktop-only">เพิ่มผู้ใช้</span></button>`);
    $("#content").innerHTML = `<div id="reqBody"></div><div class="card" id="userBody">${empty("กำลังโหลด…", "loader-2")}</div>`;
    try {
      const rq = await api("apiListAccountRequests", S.token);
      const pend = rq.requests.filter((r) => r.status === "pending");
      if (pend.length) $("#reqBody").innerHTML = `<div class="card mb-16" style="border-color:color-mix(in srgb,var(--warn) 35%,var(--border))"><div class="card-head"><h3 class="grow">คำขอรออนุมัติ</h3><span class="pill warn">${pend.length}</span></div>
        ${pend.map((r) => `<div class="list-row"><div class="avatar">${ic(r.type === "signup" ? "user-plus" : "key")}</div><div class="grow" style="min-width:0"><div style="font-weight:600">${r.type === "signup" ? "สมัครสมาชิก" : "ขอรีเซ็ตรหัสผ่าน"} · ${esc(r.displayName || r.username)}</div>
          <div class="xs faint">${esc(r.username)}${r.role ? ` · ${esc(ROLE[r.role] || r.role)}` : ""}${r.position ? ` · ${esc(r.position)}` : ""}${r.phone ? ` · ${esc(r.phone)}` : ""} · ${fmtDT(r.createdAt)}</div></div>
          ${r.type === "signup" ? `<select class="input sm" style="width:auto" id="rqRole-${r.id}">${opt(ROLE_PICK, r.role)}</select>` : ""}
          <button class="btn ghost sm" onclick="App.handleReq('${r.id}', false)">ปฏิเสธ</button><button class="btn primary sm" onclick="App.handleReq('${r.id}', true)">${r.type === "signup" ? "อนุมัติ" : "รีเซ็ตเป็น 1234"}</button></div>`).join("")}</div>`;
      if (!S.users) S.users = (await api("apiListUsers", S.token)).users;
      $("#userBody").innerHTML = `<div class="table-wrap"><table class="t responsive"><thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>รหัสบุคลากร</th><th>ยินยอมวิจัย</th><th>เข้าใช้ล่าสุด</th><th>สถานะ</th></tr></thead><tbody>
        ${S.users.map((u) => `<tr class="click" onclick="App.editUser('${u.id}')"><td data-l="ชื่อ"><div class="row"><div class="avatar">${esc(initials(u.displayName))}</div><div><b>${esc(u.displayName)}</b><div class="xs faint">${esc(u.position)}</div></div></div></td><td data-l="ผู้ใช้" class="mono">${esc(u.username)}</td><td data-l="บทบาท">${esc(ROLE[u.role] || u.role)}</td><td data-l="รหัส" class="mono">${esc(u.staffCode || "–")}</td><td data-l="ยินยอม">${u.researchConsent ? `<span class="pill violet">ยินยอม</span>` : `<span class="faint">–</span>`}</td><td data-l="ล่าสุด" class="tabnum">${u.lastLoginAt ? fmtDT(u.lastLoginAt) : "–"}</td><td data-l="สถานะ">${u.active ? `<span class="pill ok">ใช้งาน</span>` : `<span class="pill">ปิดใช้</span>`}</td></tr>`).join("")}</tbody></table></div>`;
    } catch (e) { $("#userBody").innerHTML = empty(e.message, "alert-circle"); }
  };
  App.handleReq = async (id, ok) => {
    try {
      const role = $(`#rqRole-${id}`)?.value;
      const r = await api("apiHandleAccountRequest", S.token, id, ok, { role });
      S.users = r.users;
      if (S.data) S.data.pendingRequests = Math.max(0, (S.data.pendingRequests || 1) - 1);
      X.renderNav();
      toast(!ok ? "ปฏิเสธคำขอแล้ว" : r.tempPassword ? `รีเซ็ตแล้ว รหัสผ่านใหม่: ${r.tempPassword}` : "อนุมัติแล้ว ผู้ใช้เข้าสู่ระบบได้ทันที");
      App.render();
    } catch (e) { fail(e); }
  };
  App.editUser = function (id) {
    const u = (S.users || []).find((x) => x.id === id) || { username: "", displayName: "", role: "pharmacist", active: true, position: "", staffCode: "", phone: "" };
    drawer(id ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้", `<div class="form-grid">
      ${field("ชื่อที่แสดง", `<input class="input" id="uName" value="${esc(u.displayName)}" placeholder="ภก.สมชาย ใจดี">`)}
      ${field("ตำแหน่ง", `<input class="input" id="uPos" value="${esc(u.position)}" placeholder="เภสัชกรชำนาญการ">`)}
      ${field("ชื่อผู้ใช้", `<input class="input mono" id="uUser" value="${esc(u.username)}" autocapitalize="none">`)}
      ${field("บทบาท", `<select class="input" id="uRole">${opt(ROLE_PICK, u.role === "viewer" ? "nurse" : u.role)}</select>`)}
      ${field(id ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น", `<input class="input" id="uPass" type="password" placeholder="${id ? "เว้นว่างถ้าไม่เปลี่ยน" : "เว้นว่าง = 1234"}">`, id ? `<a style="cursor:pointer" onclick="SEB.$('#uPass').value='1234';SEB.toast('ตั้งเป็น 1234 แล้ว กดบันทึกเพื่อยืนยัน')">รีเซ็ตเป็น 1234</a>` : "ผู้ใช้เปลี่ยนเองภายหลังได้")}
      ${field("เบอร์ติดต่อ", `<input class="input" id="uPhone" value="${esc(u.phone || "")}">`)}
      ${field("รหัสบุคลากร (วิจัย)", `<input class="input mono" id="uCode" value="${esc(u.staffCode || "")}" placeholder="เช่น P01">`, "ใช้แทนชื่อในชุดข้อมูลวิจัย")}
      <label class="row full" style="gap:12px"><span class="switch"><input type="checkbox" id="uConsent" ${u.researchConsent ? "checked" : ""}><span></span></span><span><b>ลงนามยินยอมเข้าร่วมวิจัยแล้ว</b><div class="xs faint">ตามแบบยินยอม (ภาคผนวก ง)</div></span></label>
      <label class="row full" style="gap:12px"><span class="switch"><input type="checkbox" id="uOfficer" ${u.consentOfficer ? "checked" : ""}><span></span></span><span><b>เจ้าหน้าที่รับเอกสารยินยอม</b><div class="xs faint">ผู้ได้รับมอบหมายซึ่งไม่มีอำนาจประเมินผลการปฏิบัติงานของอาสาสมัคร</div></span></label>
      <label class="row full" style="gap:12px"><span class="switch"><input type="checkbox" id="uActive" ${u.active ? "checked" : ""}><span></span></span><b>เปิดใช้งานบัญชี</b></label></div>`,
      `${id ? `<button class="btn danger-ghost" onclick="App.deactivateUser('${id}')">ปิดบัญชี</button><span class="grow"></span>` : ""}<button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" id="uBtn" onclick="App.saveUser('${id || ""}')">บันทึก</button>`);
  };
  App.saveUser = withBusy("#uBtn", async (id) => {
    const r = await api("apiSaveUser", S.token, { id: id || undefined, displayName: val("uName"), position: val("uPos"), username: val("uUser"), role: val("uRole"), password: $("#uPass").value, phone: val("uPhone"), staffCode: val("uCode"), researchConsent: $("#uConsent").checked, consentOfficer: $("#uOfficer").checked, active: $("#uActive").checked });
    S.users = r.users; closeDrawer(); toast("บันทึกผู้ใช้แล้ว"); App.render();
  });
  App.deactivateUser = async (id) => {
    if (!(await dialog({ title: "ปิดบัญชีผู้ใช้นี้?", body: "ผู้ใช้จะออกจากระบบทันที ประวัติการใช้งานยังคงอยู่", confirm: "ปิดบัญชี", danger: true }))) return;
    try { const r = await api("apiDeleteUser", S.token, id); S.users = r.users; closeDrawer(); App.render(); } catch (e) { fail(e); }
  };

  App.insProblem = (i) => {
    const list = optList("OPT_INSPECT_PROBLEMS");
    const inp = $("#insNote");
    const parts = inp.value.split(",").map((x) => x.trim()).filter(Boolean);
    const k = parts.indexOf(list[i]);
    if (k >= 0) parts.splice(k, 1); else parts.push(list[i]);
    inp.value = parts.join(", ");
    $$("[data-ip]").forEach((b) => b.classList.toggle("on", parts.includes(list[+b.dataset.ip])));
  };

  // ---------- จัดการรายการตัวเลือก (admin) ----------
  function optionsTab() {
    const s = D().settings;
    return OPTION_LISTS.map((o) => {
      const items = o.key === "OPT_DRUG_NAMES" ? drugMaster().map((d) => d.label) : optList(o.key, s);
      const custom = s[o.key] != null && String(s[o.key]).trim() !== "";
      return `<div class="card mt-16 optcard" data-ok="${o.key}">
        <div class="card-head"><div class="grow"><h3>${esc(o.title)}</h3><div class="xs faint">${esc(o.hint)}</div></div>${custom ? "" : `<span class="pill">ค่าตั้งต้น</span>`}</div>
        <div class="card-body"><div class="optlist" id="ol_${o.key}">${items.map((v) => optRow(v)).join("")}</div>
        <div class="row wrap mt-12"><button class="btn sm" onclick="App.optAdd('${o.key}')">${ic("plus")} เพิ่มรายการ</button>${o.importable ? `<button class="btn sm" onclick="App.optImportDrugs()">${ic("download")} ดึงชื่อยาจากชุดยาและกล่องที่มีอยู่</button>` : ""}<span class="grow"></span>
        <button class="btn sm ghost" onclick="App.optReset('${o.key}')">${ic("refresh")} คืนค่าตั้งต้น</button><button class="btn sm primary" onclick="App.optSave('${o.key}')">${ic("check")} บันทึก</button></div></div></div>`;
    }).join("");
  }
  const optRow = (v = "") => `<div class="optrow"><span class="opt-grip">${ic("grip-vertical")}</span><input class="input sm" value="${esc(v)}" placeholder="ข้อความ">
    <button class="btn ghost sm icon" title="ขึ้น" onclick="App.optMove(this,-1)">${ic("arrow-up")}</button><button class="btn ghost sm icon" title="ลง" onclick="App.optMove(this,1)">${ic("arrow-down")}</button><button class="btn ghost sm icon danger-ghost" title="ลบ" onclick="this.closest('.optrow').remove()">${ic("trash")}</button></div>`;
  App.optAdd = (key) => { const box = $(`#ol_${key}`); box.insertAdjacentHTML("beforeend", optRow()); box.lastElementChild.querySelector("input").focus(); };
  App.optImportDrugs = () => {
    const box = $("#ol_OPT_DRUG_NAMES");
    const have = new Set($$("#ol_OPT_DRUG_NAMES input").map((i) => i.value.trim().toLowerCase()));
    let n = 0;
    drugsFromData().forEach((l) => { if (!have.has(l.toLowerCase())) { box.insertAdjacentHTML("beforeend", optRow(l)); n++; } });
    toast(n ? `เพิ่ม ${n} รายการ · ตรวจทานแล้วกดบันทึก` : "มีครบแล้ว");
  };
  App.optMove = (btn, d) => { const r = btn.closest(".optrow"); const t = d < 0 ? r.previousElementSibling : r.nextElementSibling; if (!t) return; d < 0 ? t.before(r) : t.after(r); };
  App.optSave = async (key) => {
    const vals = [...new Set($$(`#ol_${key} input`).map((i) => i.value.trim()).filter(Boolean))];
    if (!vals.length) return toast("ต้องมีอย่างน้อย 1 รายการ", true);
    try { const r = await api("apiSaveSettings", S.token, { [key]: vals.join("\n") }); S.data = r.data; toast("บันทึกแล้ว"); App.render(); } catch (e) { fail(e); }
  };
  App.optReset = async (key) => {
    if (!(await dialog({ title: "คืนค่าตั้งต้น?", body: "รายการที่แก้ไว้จะถูกแทนที่ด้วยค่าตั้งต้นของระบบ ข้อมูลเคสเดิมไม่เปลี่ยน", confirm: "คืนค่า" }))) return;
    try { const r = await api("apiSaveSettings", S.token, { [key]: "" }); S.data = r.data; toast("คืนค่าตั้งต้นแล้ว"); App.render(); } catch (e) { fail(e); }
  };

  // =================================================================
  // Settings
  // =================================================================
  App.pageSettings = async function () {
    S.setTab = S.param || S.setTab || "device";
    const t = S.setTab;
    const tabs = [["device", "เครื่องนี้"], ["account", "บัญชีของฉัน"], ...(isAdmin() ? [["general", "ทั่วไป"], ["options", "รายการตัวเลือก"], ["notify", "การแจ้งเตือน"], ["study", "ช่วงการศึกษา"], ["pdpa", "PDPA / ความยินยอม"]] : [])];
    setTitle("ตั้งค่า");
    const s = D().settings;
    const sf = (k, label, type = "text", hint = "") => field(label, `<input class="input" data-s="${k}" type="${type}" value="${esc(s[k] ?? "")}">`, hint);
    let body = "";
    if (t === "device") {
      const sup = App.pushSupport();
      let on = false;
      try { on = S.demo ? localStorage.getItem("seb_demo_push") === "1" : !!(await App.currentSubscription()); } catch (_) {}
      body = `<div class="card card-pad"><div class="row between wrap gap-12"><div><h3>การแจ้งเตือนบนเครื่องนี้</h3><div class="muted small mt-4">${on ? "เครื่องนี้จะได้รับแจ้งเตือนเมื่อมีการเปิดกล่องยา แม้ปิดหน้าจอ" : sup.needsInstall ? "iPhone ต้องติดตั้งแอปลงหน้าจอโฮมก่อน" : "ยังไม่ได้เปิดรับแจ้งเตือน"}</div></div>
          ${on ? `<span class="pill ok">เปิดอยู่</span>` : `<span class="pill">ปิดอยู่</span>`}</div>
          ${!on ? `<div class="form-grid mt-16">${field("ชื่อเครื่อง", `<input class="input" id="deviceLabel" placeholder="เช่น iPhone ภก.นที / คอมห้องยา">`)}</div>` : ""}
          <div class="row wrap mt-16">${on ? `<button class="btn" onclick="App.disablePush()">${ic("bell-off")} ปิดการแจ้งเตือน</button>` : `<button class="btn accent" onclick="App.enablePush()">${ic("bell-ringing")} ${sup.needsInstall ? "วิธีติดตั้งบน iPhone" : "เปิดรับแจ้งเตือน"}</button>`}
          <button class="btn" onclick="App.install()">${ic("download")} ติดตั้งแอป</button><button class="btn ghost" onclick="App.showInstallHelp()">${ic("help-circle")} วิธีติดตั้ง</button></div>
          <div class="xs faint mt-16">อุปกรณ์ที่ลงทะเบียนรับแจ้งเตือนทั้งหมด: ${D().pushDevices} เครื่อง${D().pushReady ? "" : " · ผู้ดูแลยังไม่ได้ตั้งค่า VAPID key"}</div></div>
        <div class="card card-pad mt-16"><div class="row between wrap gap-12"><div><h3>ธีมหน้าจอ</h3><div class="muted small mt-4">ตั้งเฉพาะเครื่องนี้</div></div>
          <div class="seg">${[["light", "สว่าง"], ["auto", "ตามเครื่อง"], ["dark", "มืด"]].map(([k, l]) => `<button class="${SEB.getTheme() === k ? "on" : ""}" onclick="SEB.setTheme('${k}');App.render()">${l}</button>`).join("")}</div></div></div>
        <div class="card card-pad mt-16"><div class="row between wrap gap-12"><h3>เวอร์ชันระบบ</h3><button class="btn sm ghost" onclick="App.checkVersion()">${ic("refresh")} ตรวจอีกครั้ง</button></div><div id="verBox" class="mt-12 small muted">กำลังตรวจ…</div></div>`;
      setTimeout(() => App.checkVersion(), 0);
    } else if (t === "account") {
      body = `<div class="card card-pad"><h3>เปลี่ยนรหัสผ่าน</h3><div class="form-grid mt-16">
        ${field("รหัสผ่านเดิม", `<input class="input" type="password" id="pwOld">`)}<div></div>${field("รหัสผ่านใหม่", `<input class="input" type="password" id="pwNew">`, "อย่างน้อย 8 ตัวอักษร")}${field("ยืนยันรหัสผ่านใหม่", `<input class="input" type="password" id="pwNew2">`)}</div>
        <div class="row mt-16" style="justify-content:flex-end"><button class="btn primary" id="pwBtn" onclick="App.changePw()">เปลี่ยนรหัสผ่าน</button></div></div>`;
    } else if (t === "general") {
      body = `<div class="card card-pad"><h3>ข้อมูลหน่วยงาน</h3><div class="form-grid mt-16">${sf("HOSPITAL_NAME", "ชื่อโรงพยาบาล")}${sf("DEPARTMENT_NAME", "ชื่อหน่วยงาน")}${sf("APP_CREDIT_TEXT", "ผู้พัฒนาระบบ")}${sf("PHARMACY_PHONE", "เบอร์โทรห้องยา", "tel", "แสดงในหน้าสแกน QR เมื่อส่งแจ้งเตือนไม่ได้ (เช่น ไม่มีอินเทอร์เน็ต)")}</div></div>
        <div class="card card-pad mt-16"><h3>เกณฑ์การทำงาน</h3><div class="form-grid mt-16">${sf("NEAR_EXPIRY_DAYS", "ใกล้หมดอายุ (วัน)", "number")}${sf("INSPECTION_INTERVAL_DAYS", "รอบตรวจกล่อง (วัน)", "number")}${sf("RESPONSE_TARGET_MIN", "เป้าหมายตอบสนอง (นาที)", "number")}${sf("ESCALATE_AFTER_MIN", "แจ้งซ้ำถ้าไม่มีผู้รับทราบ (นาที)", "number")}${sf("PUBLIC_OPEN_COOLDOWN_SEC", "กันสแกนซ้ำ (วินาที)", "number")}${sf("DEFAULT_PASSWORD", "รหัสผ่านเริ่มต้น")}${field("สมัครสมาชิกเอง", `<select class="input" data-s="ALLOW_SIGNUP">${opt([["1", "เปิด (รอผู้ดูแลอนุมัติ)"], ["0", "ปิด"]], s.ALLOW_SIGNUP ?? "1")}</select>`)}</div>
        <div class="row mt-16" style="justify-content:flex-end"><button class="btn primary" id="setBtn" onclick="App.saveSettings()">บันทึก</button></div></div>`;
    } else if (t === "options") {
      body = `<div class="card card-pad"><h3>รายการตัวเลือก</h3><div class="muted small mt-4">ข้อความที่ผู้ใช้เลือกแทนการพิมพ์ เพิ่ม ลบ แก้ หรือสลับลำดับได้เอง การแก้ไขไม่กระทบข้อมูลที่บันทึกไปแล้ว</div></div>${optionsTab()}`;
    } else if (t === "notify") {
      body = `<div class="card card-pad"><h3>LINE Messaging API</h3><div class="muted small mt-4">ช่องทางหลักที่ใช้นับ notification_sent_at ตามนิยาม 5.7.4 · ข้อความไม่แสดง HN</div><div class="form-grid mt-16">
        ${field("Channel access token", `<input class="input" data-s="LINE_CHANNEL_ACCESS_TOKEN" type="password" placeholder="${s.LINE_TOKEN_SET ? "ตั้งค่าแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "วาง token ที่นี่"}">`, s.LINE_TOKEN_SET ? "✓ ตั้งค่าแล้ว" : "")}
        ${field("โหมดการส่ง", `<select class="input" data-s="LINE_SEND_MODE">${opt([["broadcast", "Broadcast (ทุกคนที่เพิ่มเพื่อน)"], ["push", "Push (ระบุกลุ่ม/ผู้ใช้)"]], s.LINE_SEND_MODE || "broadcast")}</select>`)}
        ${field("แจ้งยาใกล้หมดอายุทาง LINE ตามรอบวัน", `<select class="input" data-s="LINE_EXPIRY_ALERTS">${opt([["1", "เปิด · ส่งเมื่อยาถึงรอบที่กำหนด (ครั้งเดียวต่อรอบ)"], ["0", "ปิด"]], s.LINE_EXPIRY_ALERTS ?? "1")}</select>`, "ส่งเวลา 08:00 น. เฉพาะวันที่มียาถึงรอบ ยาเดียวกันจะไม่ถูกแจ้งซ้ำในรอบเดิม")}
        ${field("แจ้งซ้ำเมื่อไม่มีผู้รับทราบ", `<select class="input" data-s="LINE_ESCALATE">${opt([["0", "Push อย่างเดียว (ประหยัดโควตา LINE)"], ["1", "ส่งทั้ง LINE และ Push"]], s.LINE_ESCALATE || "0")}</select>`, `ส่งซ้ำ 1 ครั้งหลัง ${esc(s.ESCALATE_AFTER_MIN || "15")} นาที ถ้ายังไม่มีใครกดรับทราบ`)}
        ${field("รอบวันก่อนหมดอายุ", `<input class="input" data-s="EXPIRY_ALERT_MILESTONES" value="${esc(s.EXPIRY_ALERT_MILESTONES || "30,15,7")}" placeholder="30,15,7">`, "คั่นด้วยจุลภาค · ใส่ 0 = แจ้งวันที่หมดอายุด้วย")}
        ${field("สรุปภาพรวมรายวัน 08:00 น.", `<select class="input" data-s="LINE_DAILY_DIGEST">${opt([["0", "ส่งผ่าน Push อย่างเดียว (ประหยัดโควตา LINE)"], ["1", "ส่งทั้ง LINE และ Push"], ["off", "ปิด ไม่ส่ง"]], s.LINE_DAILY_DIGEST || "0")}</select>`, "ไม่บังคับ · ช่วยเตือนยาที่หมดอายุแล้วแต่ยังไม่ได้เปลี่ยน และกล่องที่เลยวันตรวจ")}
        ${field("LINE To ID (โหมด push)", `<textarea class="input" data-s="LINE_TO_ID" placeholder="หนึ่งรายการต่อบรรทัด">${esc(s.LINE_TO_ID || "")}</textarea>`, "", "full")}</div>
        <div class="alert warn mt-16" style="padding:10px 14px"><div class="grow small">LINE OA แพ็กเกจฟรีมีโควตาจำกัดต่อเดือน และนับตาม<b>จำนวนผู้รับ</b> ถ้าโควตาหมด ข้อความเปิดกล่องจะส่งไม่สำเร็จ และเหตุการณ์นั้นจะไม่มี notification_sent_at</div><div id="lineQuota" class="small nowrap"><button class="btn sm" onclick="App.lineQuota()">ตรวจโควตา</button></div></div>
        <div class="row wrap mt-16" style="justify-content:flex-end"><button class="btn" onclick="App.testNotify()">${ic("send")} ทดสอบส่ง LINE + Push</button><button class="btn" onclick="App.sendExpiry()">${ic("calendar-exclamation")} ส่งสรุปยาใกล้หมดอายุตอนนี้</button><button class="btn primary" id="setBtn" onclick="App.saveSettings()">บันทึก</button></div></div>`;
    } else if (t === "pdpa") {
      const T = window.SEB_TEXT;
      body = `<div class="card card-pad"><h3>ประกาศความเป็นส่วนตัว (PDPA)</h3><div class="muted small mt-4">ผู้ใช้ทุกคนต้องอ่านและกดรับทราบก่อนเริ่มใช้งาน เมื่อเปลี่ยนเลขเวอร์ชัน ผู้ใช้ทุกคนจะต้องรับทราบใหม่อีกครั้ง</div>
        <div class="form-grid mt-16">${sf("PDPA_NOTICE_VERSION", "เวอร์ชัน")}<div></div>
        ${field("ข้อความประกาศ", `<textarea class="input" data-s="PDPA_NOTICE_TEXT" style="min-height:220px" placeholder="เว้นว่าง = ใช้ข้อความตั้งต้นของระบบ">${esc(s.PDPA_NOTICE_TEXT || "")}</textarea>`, "บรรทัดขึ้นต้น ## = หัวข้อ · - = รายการ", "full")}</div>
        <div class="row wrap mt-12"><button class="btn sm" onclick="SEB.$('[data-s=PDPA_NOTICE_TEXT]').value=window.SEB_TEXT.PDPA">${ic("copy")} ใส่ข้อความตั้งต้นเพื่อแก้ไข</button><button class="btn sm" onclick="App.showPdpa()">${ic("eye")} ดูตัวอย่าง</button></div></div>
        <div class="card card-pad mt-16"><h3>แบบยินยอมเข้าร่วมวิจัยแบบอิเล็กทรอนิกส์</h3>
        <div class="alert warn mt-12" style="padding:10px 14px"><div class="small">โครงร่างที่ EC รับรองกำหนดให้ลงนามบนกระดาษ ใส่ซองปิดผนึก และส่งให้เจ้าหน้าที่ที่ได้รับมอบหมาย <b>ต้องยื่นขอแก้ไขโครงร่าง (amendment) ต่อ EC และได้รับอนุมัติก่อนเปิดใช้</b> ระหว่างนี้ใช้กระดาษ แล้วติ๊ก "ลงนามยินยอมแล้ว" ในหน้าผู้ใช้งาน</div></div>
        <div class="form-grid mt-16">${field("สถานะ", `<select class="input" data-s="ECONSENT_ENABLED">${opt([["0", "ปิด (ใช้แบบฟอร์มกระดาษ)"], ["1", "เปิดใช้ (ได้รับอนุมัติจาก EC แล้ว)"]], s.ECONSENT_ENABLED || "0")}</select>`)}
        ${sf("CONSENT_WAIT_DAYS", "ระยะเวลาพิจารณาขั้นต่ำ (วัน)", "number", "ตามข้อ 6.5.3: ไม่น้อยกว่า 7 วัน")}
        ${field("เวอร์ชันเอกสาร", `<input class="input" data-s="CONSENT_DOC_VERSION" value="${esc(s.CONSENT_DOC_VERSION || "")}" placeholder="${esc(T.CONSENT_VERSION)}">`)}<div></div>
        ${field("เอกสารชี้แจง (ภาคผนวก ค)", `<textarea class="input" data-s="PIS_TEXT" style="min-height:200px" placeholder="เว้นว่าง = ใช้ข้อความที่ถอดจากเอกสารฉบับแก้ไขครั้งที่ 1">${esc(s.PIS_TEXT || "")}</textarea>`, "ตรวจทานให้ตรงฉบับที่ EC รับรอง", "full")}</div>
        <div class="row wrap mt-12"><button class="btn sm" onclick="SEB.$('[data-s=PIS_TEXT]').value=window.SEB_TEXT.PIS">${ic("copy")} ใส่ข้อความตั้งต้นเพื่อแก้ไข</button><span class="grow"></span><button class="btn primary" id="setBtn" onclick="App.saveSettings()">บันทึก</button></div></div>`;
    } else if (t === "study") {
      body = `<div class="card card-pad"><h3>ช่วงเวลาการศึกษา</h3><div class="muted small mt-4">ใช้กำหนด period ของเหตุการณ์อัตโนมัติ (pilot / post) ตามขั้นตอนในโครงร่าง 5.9.1</div><div class="form-grid mt-16">
        ${sf("STUDY_PILOT_START", "เริ่มทดสอบนำร่อง", "date")}${sf("STUDY_PILOT_END", "สิ้นสุดทดสอบนำร่อง", "date")}${sf("STUDY_POST_START", "เริ่มใช้งานจริง (เดือนที่ 4)", "date")}${sf("STUDY_POST_END", "สิ้นสุดใช้งานจริง (เดือนที่ 6)", "date")}</div>
        <div class="row mt-16" style="justify-content:flex-end"><button class="btn primary" id="setBtn" onclick="App.saveSettings()">บันทึก</button></div></div>`;
    }
    $("#content").innerHTML = `<div class="subnav">${tabs.map(([k, l]) => `<button class="${t === k ? "on" : ""}" onclick="App.go('settings','${k}')">${l}</button>`).join("")}</div>${body}
      <div class="xs faint center mt-24">พัฒนาระบบโดย ${esc(s.APP_CREDIT_TEXT || "ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลลานสัก")} · SEB v${SEB.APP_VERSION}</div>`;
  };
  App.checkVersion = async () => {
    const el = $("#verBox"); if (!el) return;
    const web = SEB.APP_VERSION;
    let h = null;
    try { h = await api("apiHealth"); } catch (e) { el.innerHTML = `<span class="pill danger">เชื่อมต่อ backend ไม่ได้</span> <span class="xs">${esc(e.message)}</span>`; return; }
    const sameBe = h.version === web;
    const row = (k, v, ok, tip) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span>${k}</span><span class="row" style="gap:8px"><b class="mono">${esc(v)}</b>${ok ? `<span class="pill ok">ตรงกัน</span>` : `<span class="pill warn" title="${esc(tip)}">ต้องอัปเดต</span>`}</span></div>`;
    el.innerHTML = row("หน้าเว็บ (เครื่องนี้)", "v" + web, true, "") +
      row("Backend (Edge Function)", h.version ? "v" + h.version : "รุ่นก่อน 2.12", sameBe, "deploy Edge Function ใหม่") +
      row("ฐานข้อมูล (migration)", `${h.schema || 0} / ต้องการ ${h.schemaRequired || "?"}`, h.schemaOk !== false, "รัน migration ที่ยังไม่ได้รัน") +
      (!sameBe && h.version ? `<div class="xs mt-8" style="color:var(--warn-text)">${h.version > web ? "เครื่องนี้ยังเป็นหน้าเว็บรุ่นเก่า ปิดแอปแล้วเปิดใหม่ หรือกด Ctrl+F5" : "Backend ยังเป็นรุ่นเก่า ต้อง deploy Edge Function ใหม่"}</div>` : "") +
      `<div class="xs faint mt-8">ใช้เลขรุ่นนี้อ้างอิงในบันทึกโครงการวิจัย · ดูรายการเปลี่ยนแปลงใน CHANGELOG.md</div>`;
  };
  App.saveSettings = withBusy("#setBtn", async () => {
    const p = {};
    $$("[data-s]").forEach((el) => (p[el.dataset.s] = el.value.trim()));
    const r = await api("apiSaveSettings", S.token, p);
    S.data = r.data; toast("บันทึกตั้งค่าแล้ว"); App.render();
  });
  App.testNotify = async () => {
    try {
      const r = await api("apiTestNotify", S.token);
      toast(`LINE: ${r.line.ok ? "สำเร็จ" : r.line.message} · Push: ${r.push.sent || 0} เครื่อง`, !r.line.ok && !r.push.sent);
    } catch (e) { fail(e); }
  };
  App.lineQuota = async () => {
    try {
      const r = S.demo ? { configured: true, limit: 300, used: 212 } : await api("apiLineQuota", S.token);
      $("#lineQuota").innerHTML = !r.configured ? "ยังไม่ได้ตั้ง token" : `ใช้ไป <b>${r.used ?? "?"}</b> / ${r.limit ?? "ไม่จำกัด"} ข้อความ`;
    } catch (e) { fail(e); }
  };
  App.sendExpiry = async () => { try { const r = await api("apiSendExpiryReport", S.token); toast(`ส่งสรุปแล้ว · ${r.items ?? 0} รายการ`); } catch (e) { fail(e); } };
  App.changePw = withBusy("#pwBtn", async () => {
    if ($("#pwNew").value !== $("#pwNew2").value) throw new Error("รหัสผ่านใหม่ไม่ตรงกัน");
    await api("apiChangePassword", S.token, $("#pwOld").value, $("#pwNew").value);
    toast("เปลี่ยนรหัสผ่านแล้ว");
    $$("#content input").forEach((i) => (i.value = ""));
  });

  // =================================================================
  // More (mobile menu)
  // =================================================================
  App.pageMore = function () {
    setTitle("เมนู");
    // ปุ่มทางลัดแบบตาราง (สิทธิ์ตามบทบาทเหมือนเดิม)
    const T = [
      ["dashboard", "ภาพรวม", "layout-dashboard", "#e11d48"],
      ["cases", "เคสเปิดกล่อง", "urgent", "#ea580c"],
      ["boxes", "กล่องยา", "first-aid-kit", "#0e9f6e"],
      ["inspections", "ตรวจประจำเดือน", "clipboard-check", "#2563eb"],
      ["stats", "สถิติ / รายงาน", "chart-bar", "#7c3aed"],
      ["kits", "ชุดยามาตรฐาน", "pill", "#9333ea"],
      ["locations", "จุดวางกล่อง", "map-pin", "#0891b2"],
      ...(isAdmin() ? [["research", "งานวิจัย", "microscope", "#c026d3"]] : []),
      ...(isStaff() ? [["logs", "ประวัติการใช้งาน", "history", "#64748b"]] : []),
      ...(D().settings?.ECONSENT_ENABLED === "1" && !isAdmin() ? [["consent", "เอกสารยินยอมวิจัย", "file-certificate", "#0e9f6e"]] : []),
      ...(D().settings?.ECONSENT_ENABLED === "1" && S.user?.consentOfficer && !isAdmin() ? [["consentAdmin", "รับเอกสารยินยอม", "file-certificate", "#0f766e"]] : []),
      ...(isAdmin() ? [["users", "ผู้ใช้งาน", "users", "#d97706"]] : []),
      ["settings", "ตั้งค่า", "settings", "#475569"],
    ];
    const badge = (id) => { const n = id === "cases" ? D().stats?.pendingCases || 0 : id === "users" ? D().pendingRequests || 0 : 0; return n ? `<span class="mt-badge">${n}</span>` : ""; };
    $("#content").innerHTML = `
      <div class="more-grid">${T.map(([id, l, i, c]) => `<button class="more-tile" style="--mc:${c}" onclick="App.go('${id}')"><span class="mt-ic">${ic(i)}${badge(id)}</span><span class="mt-l">${l}</span></button>`).join("")}</div>
      <div class="card card-pad mt-16 more-me">
        <div class="row gap-12"><div class="avatar" style="width:44px;height:44px;font-size:14px">${esc(initials(S.user.displayName))}</div>
          <div class="grow" style="min-width:0"><b>${esc(S.user.displayName)}</b><div class="xs faint">${esc(ROLE[S.user.role])}${S.user.position ? " · " + esc(S.user.position) : ""}</div></div></div>
        ${SEB.isRealAdmin() ? `<button class="btn block mt-16" onclick="App.pickSimRole()">${ic("eye")} ดูในมุมมองบทบาทอื่น</button>` : ""}
        <button class="btn block mt-8" onclick="App.go('settings','device')">${ic("bell")} การแจ้งเตือนเครื่องนี้ / ธีมหน้าจอ</button>
        <button class="btn block mt-8 danger-ghost" onclick="App.logout()">${ic("logout")} ออกจากระบบ</button>
      </div>`;
  };


  App.itemsEditor = itemsEditor;
  App.collectItems = collectItems;
  App.qrSvgFor = qrSvgFor;
  App.responseOf = responseOf;
  App.readinessOf = readinessOf;
})();
