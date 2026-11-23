/* =====================================================================
   SEB v2 — กล่องแจ้งเตือนในระบบ (Inbox)
   - ทุกแจ้งเตือน Push มีสำเนาเก็บในระบบ กดจากมือถือแล้วเปิดมาที่รายการนั้น
   - คอมพิวเตอร์: กดกระดิ่ง → แผงแจ้งเตือนเลื่อนลง · มือถือ: กดกระดิ่ง → หน้าการแจ้งเตือน
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, api, esc, ic, $, fmtD, fmtDT, ago, kpi, empty, toast, fail, setTitle, renderNav } = X;
  const App = window.App;

  const KIND = {
    daily: { icon: "first-aid-kit", c: "#e11d48", label: "สรุปประจำวัน" },
    expiry: { icon: "hourglass", c: "#d97706", label: "ยาใกล้หมดอายุ" },
    case: { icon: "urgent", c: "#dc2626", label: "เปิดกล่องยา" },
    escalate: { icon: "alert-triangle", c: "#ea580c", label: "ยังไม่มีผู้รับทราบ" },
    account: { icon: "user-plus", c: "#7c3aed", label: "คำขอบัญชี" },
    test: { icon: "speakerphone", c: "#475569", label: "ทดสอบ" },
    system: { icon: "alert-triangle", c: "#b91c1c", label: "ระบบ" },
  };
  App.NOTICE_KIND = KIND;
  const kindOf = (n) => KIND[n.kind] || { icon: "bell", c: "#64748b", label: "แจ้งเตือน" };
  const items = () => S.notices?.items || [];
  const unread = () => S.data?.unreadNotices || 0;
  const popOpen = () => !!document.getElementById("inboxPop");

  // ---------------- data ----------------
  let loading = null;
  App.loadNotices = async function (focusId = "") {
    if (loading) return loading;
    loading = (async () => {
      try {
        const res = await api("apiListNotifications", S.token, { limit: 50, id: focusId || undefined });
        S.notices = res;
        if (S.data) S.data.unreadNotices = res.unread || 0;
        S.noticeUnreadSeen = res.unread || 0;
        renderNav();
      } finally { loading = null; }
    })();
    return loading;
  };
  // มี push ใหม่ / ตัวเลขยังไม่อ่านเปลี่ยน → โหลดใหม่เฉพาะตอนที่กำลังดูอยู่
  App.reloadNotices = async function () {
    if (!S.user) return;
    if (S.view !== "inbox" && !popOpen()) { S.notices = null; return; }
    try { await App.loadNotices(); } catch (_) { return; }
    if (popOpen()) renderPop();
    if (S.view === "inbox" && !S.param && !document.getElementById("drawer")) App.pageInbox();
  };

  App.markNoticeRead = async function (id) {
    const n = items().find((x) => x.id === id);
    if (n && n.readAt) return;
    if (n) { n.readAt = new Date().toISOString(); if (S.data) S.data.unreadNotices = Math.max(0, unread() - 1); renderNav(); }
    try {
      const res = await api("apiMarkNotificationsRead", S.token, [id]);
      if (S.data && res && typeof res.unread === "number") { S.data.unreadNotices = res.unread; renderNav(); }
    } catch (_) { /* โหมดจำลองบทบาท/ออฟไลน์: ไม่ต้องแจ้ง */ }
  };
  App.markAllNotices = async function () {
    try {
      const res = await api("apiMarkNotificationsRead", S.token, "all");
      const now = new Date().toISOString();
      items().forEach((n) => { if (!n.readAt) n.readAt = now; });
      if (S.data) S.data.unreadNotices = res?.unread || 0;
      renderNav();
      if (popOpen()) renderPop();
      if (S.view === "inbox") App.pageInbox();
      toast("ทำเครื่องหมายว่าอ่านแล้วทั้งหมด");
    } catch (e) { fail(e); }
  };

  // เปิดจากการกดแจ้งเตือน ขณะที่แอปเปิดค้างอยู่
  App.openFromPush = function (url, nid) {
    App.closeInboxPop();
    let u;
    try { u = new URL(url, location.href); } catch (_) { return App.go("inbox", nid || ""); }
    const caseId = u.searchParams.get("case");
    if (caseId) { if (nid) App.markNoticeRead(nid); return App.go("case", caseId); }
    const [v, p] = u.hash.replace(/^#\/?/, "").split("/");
    if (v === "inbox" && p) { S.notices = null; return App.go("inbox", p); }
    App.go(v || "inbox", p || "");
  };

  // ---------------- กระดิ่ง ----------------
  App.toggleInbox = function (ev) {
    ev?.stopPropagation?.();
    if (window.innerWidth <= 860) return App.go("inbox");
    if (popOpen()) return App.closeInboxPop();
    const pop = document.createElement("div");
    pop.id = "inboxPop";
    pop.className = "inbox-pop card";
    pop.addEventListener("click", (e) => e.stopPropagation());
    document.body.append(pop);
    placePop();
    renderPop();
    App.loadNotices().then(() => popOpen() && renderPop()).catch((e) => { if (popOpen()) pop.querySelector(".ip-list").innerHTML = empty(e.message || "โหลดไม่สำเร็จ", "wifi-off"); });
    setTimeout(() => {
      document.addEventListener("click", App.closeInboxPop, { once: true });
      document.addEventListener("keydown", escClose);
      window.addEventListener("resize", placePop);
    }, 0);
  };
  function escClose(e) { if (e.key === "Escape") App.closeInboxPop(); }
  function placePop() {
    const pop = document.getElementById("inboxPop"), b = document.getElementById("bellBtn");
    if (!pop || !b) return;
    const r = b.getBoundingClientRect();
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.right = `${Math.max(12, window.innerWidth - r.right - 4)}px`;
  }
  App.closeInboxPop = function () {
    document.getElementById("inboxPop")?.remove();
    document.removeEventListener("click", App.closeInboxPop);
    document.removeEventListener("keydown", escClose);
    window.removeEventListener("resize", placePop);
  };
  function renderPop() {
    const pop = document.getElementById("inboxPop");
    if (!pop) return;
    const list = items().slice(0, 8);
    pop.innerHTML = `
      <div class="ip-head"><b>การแจ้งเตือน</b>${unread() ? `<span class="pill danger plain">${unread()} ใหม่</span>` : ""}<span class="grow"></span>
        ${unread() ? `<button class="btn ghost sm" onclick="App.markAllNotices()">${ic("checks")} อ่านทั้งหมด</button>` : ""}<button class="btn ghost sm icon" title="เลือกเรื่องที่ต้องการรับแจ้ง" onclick="App.closeInboxPop();App.go('settings','device')">${ic("settings")}</button></div>
      <div class="ip-list">${!S.notices ? `<div class="empty">${ic("loader-2", "spin")}กำลังโหลด…</div>` : list.length ? list.map((n) => rowHtml(n, true)).join("") : empty("ยังไม่มีการแจ้งเตือน", "bell")}</div>
      <button class="ip-foot" onclick="App.closeInboxPop();App.go('inbox')">ดูการแจ้งเตือนทั้งหมด ${ic("chevron-right")}</button>`;
  }

  function rowHtml(n, compact = false) {
    const k = kindOf(n);
    return `<button class="nt-row${n.readAt ? "" : " unread"}${compact ? " compact" : ""}" style="--kc:${k.c}" onclick="App.openNotice('${n.id}')">
      <span class="nt-ic">${ic(k.icon)}</span>
      <span class="nt-main"><span class="nt-top"><b class="nt-title">${esc(n.title)}</b><span class="nt-time" title="${esc(fmtDT(n.createdAt))}">${esc(ago(n.createdAt))}</span></span>
        <span class="nt-body">${esc(n.body || "")}</span></span>
      ${n.readAt ? "" : `<span class="nt-dot" aria-label="ยังไม่อ่าน"></span>`}
    </button>`;
  }
  App.openNotice = function (id) {
    App.closeInboxPop();
    App.go("inbox", id);
  };

  // ---------------- หน้า "การแจ้งเตือน" ----------------
  App.pageInbox = async function () {
    const id = S.param || "";
    if (!S.notices || (id && !items().some((n) => n.id === id))) {
      setTitle("การแจ้งเตือน");
      $("#content").innerHTML = `<div class="card">${`<div class="empty">${ic("loader-2", "spin")}กำลังโหลดการแจ้งเตือน…</div>`}</div>`;
      try { await App.loadNotices(id); } catch (e) { $("#content").innerHTML = `<div class="card">${empty(e.message || "โหลดไม่สำเร็จ", "wifi-off")}</div>`; return; }
      if (S.view !== "inbox" || (S.param || "") !== id) return;
    }
    if (id) return detail(id);
    listPage();
  };

  function listPage() {
    const f = S.inboxFilter || "all";
    const all = items();
    const shown = f === "unread" ? all.filter((n) => !n.readAt) : all;
    setTitle("การแจ้งเตือน", unread() ? `<button class="btn sm" onclick="App.markAllNotices()">${ic("checks")} <span class="hide-sm">อ่านทั้งหมด</span></button>` : "");
    $("#content").innerHTML = `
      ${S.notices?.missing ? `<div class="alert warn mb-12"><div class="small">ผู้ดูแลระบบยังไม่ได้รันอัปเดตฐานข้อมูล (migration 0007) กล่องแจ้งเตือนจะเริ่มเก็บรายการหลังรันแล้ว</div></div>` : ""}
      <div class="row between mb-12 wrap">
        <div class="seg"><button class="${f === "all" ? "on" : ""}" onclick="S_inbox('all')">ทั้งหมด</button><button class="${f === "unread" ? "on" : ""}" onclick="S_inbox('unread')">ยังไม่อ่าน${unread() ? ` (${unread()})` : ""}</button></div>
        <button class="btn ghost sm" onclick="App.go('settings','device')">${ic("settings")} เลือกเรื่องที่ต้องการรับแจ้ง</button>
      </div>
      <div class="card nt-list">${shown.length ? groupByDay(shown) : empty(f === "unread" ? "อ่านครบทุกรายการแล้ว" : "ยังไม่มีการแจ้งเตือน", f === "unread" ? "checks" : "bell")}</div>
      ${S.notices?.more && f === "all" ? `<button class="btn block mt-12" id="ntMore" onclick="App.moreNotices()">โหลดเพิ่ม</button>` : ""}
      <div class="xs faint mt-12 center">เก็บย้อนหลัง ${esc(S.data?.settings?.NOTIFY_KEEP_DAYS || "90")} วัน · ตัวเลขในสรุปเป็นข้อมูล ณ เวลาที่แจ้ง</div>`;
  }
  window.S_inbox = (f) => { S.inboxFilter = f; listPage(); };
  function groupByDay(list) {
    const out = [];
    let cur = "";
    const today = new Date().toDateString(), yest = new Date(Date.now() - 86400000).toDateString();
    for (const n of list) {
      const d = new Date(n.createdAt).toDateString();
      if (d !== cur) { cur = d; out.push(`<div class="nt-day">${d === today ? "วันนี้" : d === yest ? "เมื่อวาน" : esc(fmtD(n.createdAt))}</div>`); }
      out.push(rowHtml(n));
    }
    return out.join("");
  }
  App.moreNotices = async function () {
    const last = items()[items().length - 1];
    if (!last) return;
    const b = $("#ntMore"); if (b) { b.disabled = true; b.textContent = "กำลังโหลด…"; }
    try {
      const res = await api("apiListNotifications", S.token, { limit: 50, before: last.createdAt });
      const seen = new Set(items().map((n) => n.id));
      S.notices.items.push(...res.items.filter((n) => !seen.has(n.id)));
      S.notices.more = res.more;
      listPage();
    } catch (e) { fail(e); if (b) { b.disabled = false; b.textContent = "โหลดเพิ่ม"; } }
  };

  function detail(id) {
    const n = items().find((x) => x.id === id);
    if (!n) {
      setTitle("การแจ้งเตือน");
      $("#content").innerHTML = `<div class="card">${empty("ไม่พบรายการนี้ (อาจถูกลบตามระยะเวลาเก็บ)", "bell-off")}</div><button class="btn mt-12" onclick="App.go('inbox')">${ic("arrow-left")} กลับไปรายการแจ้งเตือน</button>`;
      return;
    }
    if (!n.readAt) App.markNoticeRead(id);
    const k = kindOf(n);
    const d = n.detail || {};
    const link = n.link ? n.link.split("/") : null;
    setTitle(k.label);
    let body = "";
    if (n.kind === "daily") {
      body = `<div class="grid grid-3 nt-kpis">
          ${kpi("หมดอายุแล้ว", d.expired ?? 0, "alert-circle", "danger", "รายการ")}
          ${kpi("ใกล้หมดอายุ", d.near ?? 0, "hourglass", "warn", `ภายใน ${esc(d.nearDays || 30)} วัน`)}
          ${kpi("เลยวันตรวจ", d.overdueCount ?? 0, "calendar-exclamation", "violet", "กล่อง")}
        </div>
        ${itemsTable(d.items || [], d.total, "รายการยาที่หมด/ใกล้หมดอายุ")}
        ${(d.overdue || []).length ? `<div class="card mt-16"><div class="card-head"><h3>${ic("calendar-exclamation")} กล่องที่เลยวันตรวจ</h3></div>
          ${d.overdue.map((b) => `<div class="list-row click" onclick="App.go('inspect','${esc(b.boxId)}')"><div class="grow"><div style="font-weight:600">${esc(b.boxCode)}</div><div class="xs faint">${esc(b.location)}</div></div><span class="pill warn">ครบกำหนด ${esc(fmtD(b.inspectionDate))}</span>${ic("chevron-right", "faint")}</div>`).join("")}</div>` : ""}`;
    } else if (n.kind === "expiry") {
      body = itemsTable(d.items || [], d.total, "ยาที่ถึงรอบแจ้งเตือน");
    } else if (n.kind === "case" || n.kind === "escalate") {
      body = `<div class="card card-pad nt-facts">
          ${fact("เลขเคส", d.eventCode)}${fact("กล่องยา", d.boxCode)}${fact("จุดวางกล่อง", d.location)}${fact("เหตุผล", d.reason || "ไม่ระบุ")}${fact("เวลาเปิดใช้", d.openedAt ? fmtDT(d.openedAt) + " น." : "")}
        </div>`;
    }
    const goBtn = link ? ({
      boxes: `${ic("first-aid-kit")} ดูสถานะกล่องยาปัจจุบัน`, case: `${ic("urgent")} เปิดเคสนี้`, users: `${ic("users")} ไปหน้าผู้ใช้งาน (อนุมัติคำขอ)`,
      settings: `${ic("settings")} ตั้งค่าการแจ้งเตือนเครื่องนี้`,
    }[link[0]] || `${ic("arrow-right")} ไปที่หน้าที่เกี่ยวข้อง`) : "";
    $("#content").innerHTML = `
      <button class="btn ghost sm mb-12" onclick="App.go('inbox')">${ic("arrow-left")} การแจ้งเตือนทั้งหมด</button>
      <div class="card nt-hero" style="--kc:${k.c}">
        <span class="nt-ic lg">${ic(k.icon)}</span>
        <div class="grow" style="min-width:0"><div class="xs faint">${esc(k.label)} · ${esc(fmtDT(n.createdAt))} น.</div>
          <h2 class="mt-4">${esc(n.title)}</h2>${n.body ? `<div class="muted mt-4">${esc(n.body)}</div>` : ""}</div>
      </div>
      <div class="mt-16">${body}</div>
      ${goBtn ? `<button class="btn primary mt-16 nt-go" onclick="App.go('${esc(link[0])}','${esc(link[1] || "")}')">${goBtn}</button>` : ""}
      ${n.kind === "daily" || n.kind === "expiry" ? `<div class="xs faint mt-12">ข้อมูล ณ เวลาที่แจ้ง ถ้าเติม/เปลี่ยนยาแล้ว สถานะล่าสุดดูได้ที่หน้ากล่องยา</div>` : ""}`;
  }
  const fact = (l, v) => `<div class="nt-fact"><span class="faint small">${l}</span><b>${esc(v || "–")}</b></div>`;
  function itemsTable(list, total, title) {
    if (!list.length) return `<div class="card mt-16">${empty("ไม่มียาหมดอายุหรือใกล้หมดอายุ", "mood-smile")}</div>`;
    const pill = (dd) => dd < 0 ? `<span class="pill danger">หมดแล้ว ${-dd} วัน</span>` : dd === 0 ? `<span class="pill danger">หมดวันนี้</span>` : `<span class="pill ${dd <= 7 ? "danger" : dd <= 15 ? "warn" : "accent"}">อีก ${dd} วัน</span>`;
    return `<div class="card mt-16"><div class="card-head"><h3>${ic("pill")} ${esc(title)}</h3><span class="grow"></span><span class="xs faint">${total ?? list.length} รายการ</span></div>
      <div class="table-wrap"><table class="t compact nt-table"><thead><tr><th>ยา</th><th>กล่อง / จุดวาง</th><th>Lot</th><th>หมดอายุ</th><th></th></tr></thead><tbody>
      ${list.map((it) => `<tr class="click" onclick="${it.boxId ? `App.go('box','${esc(it.boxId)}')` : ""}">
        <td><b>${esc(it.drugName)}</b>${it.strength ? ` <span class="faint">${esc(it.strength)}</span>` : ""}</td>
        <td>${esc(it.boxCode)}<div class="xs faint">${esc(it.location)}</div></td><td class="mono xs">${esc(it.lot || "–")}</td>
        <td>${esc(fmtD(it.expiryDate))}</td><td>${pill(Number(it.days))}<div class="xs faint nt-exp-sm">หมด ${esc(fmtD(it.expiryDate))}</div></td></tr>`).join("")}
      </tbody></table></div>${total > list.length ? `<div class="list-row xs faint">และอีก ${total - list.length} รายการ · ดูทั้งหมดที่หน้ากล่องยา</div>` : ""}</div>`;
  }
})();
