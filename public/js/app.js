/* =====================================================================
   SEB v2 — App controller: boot, auth, routing, refresh, push, install
   ===================================================================== */
(function () {
  const { S, api, esc, ic, $, toast, fail, renderShell, renderNav, setTitle, TITLES, LOGO, DEMO, IDLE_MS, Q } = window.SEB;
  const App = (window.App = window.App || {});
  let refreshTimer = null;

  App.boot = async function () {
    registerSW();
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); S.installPrompt = e; });
    const page = Q.get("page");
    if (page === "open" && Q.get("boxId")) return App.renderPublicOpen(Q.get("boxId"), Q.get("t") || "");
    if (page === "survey") return App.renderSurvey();
    if (!S.token) return App.renderLogin();
    try {
      const res = await api("apiBootstrap", S.token);
      S.user = SEB.withSim(res.user);
      S.data = res.data;
      try { document.activeElement && document.activeElement.blur(); } catch (_) {}
      enterApp();
    } catch (e) {
      sessionStorage.removeItem("seb_token");
      S.token = "";
      App.renderLogin();
    }
  };

  // ---------------- auth ----------------
  const DEFAULT_CREDIT = "ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลลานสัก";
  App.renderLogin = function (msg = "", view = "login") {
    stopRefresh();
    document.title = "เข้าสู่ระบบ · SEB";
    const pc = S.publicCfg || {};
    const card = {
      login: `<h1 style="font-size:22px">เข้าสู่ระบบ</h1>
        <div class="muted mt-4">Smart Emergency Box · ระบบจัดการกล่องยาฉุกเฉิน</div>
        ${msg ? `<div class="alert warn mt-16" style="padding:10px 12px"><div class="small">${esc(msg)}</div></div>` : ""}
        <form class="col gap-12 mt-24" onsubmit="event.preventDefault();App.login()">
          <label class="field"><span>ชื่อผู้ใช้</span><input class="input" id="lgUser" autocomplete="username" autocapitalize="none" required></label>
          <label class="field"><span class="row between">รหัสผ่าน <a class="xs" style="cursor:pointer;font-weight:500" onclick="App.renderLogin('', 'forgot')">ลืมรหัสผ่าน?</a></span><input class="input" id="lgPass" type="password" autocomplete="current-password" required></label>
          <button class="btn primary lg block mt-8" id="lgBtn" type="submit">เข้าสู่ระบบ</button>
        </form>
        ${pc.allowSignup !== false ? `<div class="center small mt-16">ยังไม่มีบัญชี? <a style="cursor:pointer;font-weight:600" onclick="App.renderLogin('', 'register')">สมัครสมาชิก</a></div>` : ""}
        <div class="xs faint mt-16 center">${ic("lock")} ต้องเข้าสู่ระบบทุกครั้งที่เปิดแอป · ทุกการเข้าใช้ถูกบันทึกไว้ · <a style="cursor:pointer" onclick="App.drawer('ประกาศความเป็นส่วนตัว (PDPA)', '<div class=doc>' + App.md(window.SEB_TEXT.PDPA) + '</div>')">ประกาศความเป็นส่วนตัว</a></div>`,
      register: `<button class="btn ghost sm" onclick="App.renderLogin()">${ic("arrow-left")} กลับ</button>
        <h1 style="font-size:22px" class="mt-12">สมัครสมาชิก</h1>
        <div class="muted mt-4 small">บัญชีจะใช้งานได้หลังผู้ดูแลระบบอนุมัติ</div>
        <form class="col gap-12 mt-16" onsubmit="event.preventDefault();App.register()">
          <label class="field"><span>ชื่อ-นามสกุล</span><input class="input" id="rgName" placeholder="เช่น ภญ.สุดารัตน์ ใจงาม" required></label>
          <div class="grid grid-2" style="gap:12px"><label class="field"><span>บทบาท</span><select class="input" id="rgRole">${[["pharmacist", "เภสัชกร"], ["technician", "จพ.เภสัชกรรม"], ["nurse", "พยาบาลวิชาชีพ"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
          <label class="field"><span>ตำแหน่ง</span><input class="input" id="rgPos" placeholder="เช่น ปฏิบัติการ"></label></div>
          <label class="field"><span>หน่วยงาน / เบอร์ติดต่อ</span><input class="input" id="rgPhone" placeholder="เช่น ER · 08x-xxx-xxxx"></label>
          <label class="field"><span>ชื่อผู้ใช้</span><input class="input" id="rgUser" autocapitalize="none" placeholder="a-z 0-9 อย่างน้อย 3 ตัว" required></label>
          <div class="grid grid-2" style="gap:12px"><label class="field"><span>รหัสผ่าน</span><input class="input" id="rgPass" type="password" required></label><label class="field"><span>ยืนยันรหัสผ่าน</span><input class="input" id="rgPass2" type="password" required></label></div>
          <button class="btn primary lg block mt-8" id="rgBtn" type="submit">ส่งคำขอสมัคร</button>
        </form>`,
      forgot: `<button class="btn ghost sm" onclick="App.renderLogin()">${ic("arrow-left")} กลับ</button>
        <h1 style="font-size:22px" class="mt-12">ลืมรหัสผ่าน</h1>
        <div class="muted mt-4 small">ส่งคำขอให้ผู้ดูแลระบบรีเซ็ต เมื่ออนุมัติแล้วรหัสผ่านจะเป็นรหัสเริ่มต้น (${esc(pc.defaultPassword || "1234")}) แล้วเปลี่ยนเองได้ที่ ตั้งค่า → บัญชีของฉัน</div>
        <form class="col gap-12 mt-16" onsubmit="event.preventDefault();App.forgot()">
          <label class="field"><span>ชื่อผู้ใช้</span><input class="input" id="fgUser" autocapitalize="none" required></label>
          <label class="field"><span>เบอร์ติดต่อกลับ (ไม่บังคับ)</span><input class="input" id="fgPhone"></label>
          <button class="btn primary lg block mt-8" id="fgBtn" type="submit">ส่งคำขอรีเซ็ตรหัสผ่าน</button>
        </form>`,
      done: `<div class="center"><div class="success-mark">${ic("check")}</div><h2>${esc(msg)}</h2><div class="muted small mt-8">ผู้ดูแลระบบจะได้รับแจ้งเตือนและดำเนินการให้ กรุณาติดต่อห้องยาหากเร่งด่วน</div>
        <button class="btn primary block mt-24" onclick="App.renderLogin()">กลับหน้าเข้าสู่ระบบ</button></div>`,
    }[view];
    $("#app").innerHTML = `
    <div class="auth auth-red"><div class="auth-card">
      <div class="auth-brand"><div class="auth-logo">${window.SEB.LOGO_B}</div><div><div class="ab-name">Smart Emergency Box</div><div class="ab-sub">${esc(pc.hospitalName || "โรงพยาบาลลานสัก")}</div></div></div>
      <div class="card">${card}</div>
      ${DEMO && view === "login" ? `<div class="card card-pad mt-12 small"><b>โหมดตัวอย่าง</b><div class="muted mt-4">ผู้ดูแลระบบ: <span class="mono">admin</span> / <span class="mono">demo1234</span> · เภสัชกร: <span class="mono">pharm</span> / <span class="mono">demo1234</span><br>พยาบาลวิชาชีพ: <span class="mono">nurse.er</span> / <span class="mono">1234</span></div>
        <div class="row wrap mt-12"><button class="btn sm" onclick="App.renderPublicOpen('box-lr1','demo')">${ic("qrcode")} ลองสแกน QR หน้างาน</button><button class="btn sm" onclick="App.renderSurvey()">${ic("forms")} แบบสอบถาม</button></div></div>` : ""}
      <div class="auth-credit">พัฒนาระบบโดย ${esc(pc.credit || DEFAULT_CREDIT)}<br><span style="opacity:.7">SEB v${SEB.APP_VERSION}</span></div>
    </div></div>`;
    setTimeout(() => $("#lgUser, #rgName, #fgUser")?.focus(), 50);
    if (!S.publicCfg) api("apiPublicConfig").then((c) => { S.publicCfg = c; if ($(".auth-credit")) App.renderLogin(msg, view); }).catch(() => { S.publicCfg = {}; });
  };
  App.register = async function () {
    if ($("#rgPass").value !== $("#rgPass2").value) return toast("รหัสผ่านไม่ตรงกัน", true);
    const b = $("#rgBtn"); b.disabled = true;
    try {
      await api("apiRegister", { displayName: $("#rgName").value.trim(), role: $("#rgRole").value, position: $("#rgPos").value.trim(), phone: $("#rgPhone").value.trim(), username: $("#rgUser").value.trim(), password: $("#rgPass").value });
      App.renderLogin("ส่งคำขอสมัครสมาชิกแล้ว", "done");
    } catch (e) { fail(e); b.disabled = false; }
  };
  App.forgot = async function () {
    const b = $("#fgBtn"); b.disabled = true;
    try { await api("apiRequestReset", { username: $("#fgUser").value.trim(), phone: $("#fgPhone").value.trim() }); App.renderLogin("ส่งคำขอรีเซ็ตรหัสผ่านแล้ว", "done"); }
    catch (e) { fail(e); b.disabled = false; }
  };

  App.login = async function () {
    const btn = $("#lgBtn");
    btn.disabled = true;
    btn.textContent = "กำลังตรวจสอบ…";
    try {
      const res = await api("apiLogin", $("#lgUser").value.trim(), $("#lgPass").value);
      S.token = res.token;
      sessionStorage.setItem("seb_token", res.token);
      S.user = SEB.withSim(res.user);
      S.data = res.data;
      enterApp();
      if (res.mustChangePassword) {
        setTimeout(() => toast("คุณใช้รหัสผ่านเริ่มต้นอยู่ เปลี่ยนได้ที่ ตั้งค่า → บัญชีของฉัน"), 900);
      }
    } catch (e) {
      fail(e);
      btn.disabled = false;
      btn.textContent = "เข้าสู่ระบบ";
    }
  };

  App.logout = async function () {
    try { await api("apiLogout", S.token); } catch (_) {}
    App.forceLogout();
  };
  App.forceLogout = function (msg = "") {
    sessionStorage.removeItem("seb_token");
    S.sim = null; S.realUser = null; S.token = ""; S.user = null; S.data = null; S.research = null; S.logs = null; S.inspections = null;
    App.closeDrawer?.();
    App.renderLogin(msg);
  };

  function enterApp() {
    renderShell();
    const hash = location.hash.replace(/^#\/?/, "");
    if (S.pendingCase) { App.go("case", S.pendingCase); S.pendingCase = ""; try { history.replaceState(null, "", location.pathname + (DEMO ? "?demo=1" : "")); } catch (_) {} }
    else if (hash) { const [v, p] = hash.split("/"); App.go(v || "dashboard", p || "", true); }
    else App.go("dashboard");
    startRefresh();
    startIdleWatch();
    App.checkPdpa();
    App.loadConsentStatus().then(() => { if (S.view === "dashboard") App.render(); });
    if (!S.demo) navigator.serviceWorker?.addEventListener("message", (ev) => { if (ev.data?.type === "push") App.refresh(true); });
  }

  // ---------------- routing ----------------
  App.go = function (view, param = "", fromHash = false) {
    if (!S.user) return;
    App.closeDrawer?.();
    App.closeDrugSheet?.();
    S.view = view;
    S.param = param;
    if (!fromHash) { try { history.replaceState(null, "", `${location.pathname}${location.search}#/${view}${param ? "/" + param : ""}`); } catch (_) {} }
    renderNav();
    App.render();
    window.scrollTo({ top: 0 });
  };
  window.addEventListener("hashchange", () => {
    if (!S.user) return;
    const [v, p] = location.hash.replace(/^#\/?/, "").split("/");
    if (v && (v !== S.view || (p || "") !== S.param)) App.go(v, p || "", true);
  });

  // ---------------- จำลองบทบาท (ผู้ดูแลระบบเท่านั้น) ----------------
  App.pickSimRole = async function () {
    if (!SEB.isRealAdmin()) return;
    const roles = [["pharmacist", "เภสัชกร", "รับทราบเคส เติมยา ตรวจกล่อง ดู HN · ไม่เห็นงานวิจัย/ผู้ใช้งาน"], ["technician", "จพ.เภสัชกรรม", "สิทธิ์เหมือนเภสัชกร"], ["nurse", "พยาบาลวิชาชีพ", "บันทึกการเปิดกล่อง ดูสถานะกล่อง · รับทราบ/เติมยา/ตรวจไม่ได้"]];
    const body = `<div class="sim-pick">${roles.map(([k, l, d]) => `<button type="button" class="sim-opt${S.sim === k ? " on" : ""}" data-role="${k}"><b>${l}</b><span>${d}</span></button>`).join("")}
      <button type="button" class="sim-opt" data-role="__qr"><b>หน้าสแกน QR (หน้างาน)</b><span>หน้าที่พยาบาลเห็นตอนสแกน QR กล่องยา ไม่ต้องเข้าสู่ระบบ</span></button></div>
      <div class="xs faint mt-12">โหมดนี้ใช้ดูหน้าตาและเมนูของแต่ละบทบาท ปุ่มบันทึก/แก้ไขทุกอย่างจะถูกปิด ข้อมูลจริงไม่เปลี่ยน</div>`;
    let pick = null;
    const pr = SEB.dialog({ title: "ดูในมุมมองบทบาทอื่น", body, confirm: "ปิด", cancel: "ยกเลิก" });
    setTimeout(() => document.querySelectorAll(".sim-opt").forEach((b) => (b.onclick = () => { pick = b.dataset.role; document.querySelector('.dialog [data-r="0"]').click(); })), 30);
    await pr;
    if (!pick) return;
    if (pick === "__qr") {
      const b = S.data.boxes[0];
      if (!b) return toast("ยังไม่มีกล่องยา", true);
      return window.open(b.qrUrl || `?page=open&boxId=${b.id}&t=${b.qrToken}`, "_blank");
    }
    if (!S.realUser) S.realUser = S.user;
    S.sim = pick;
    S.user = { ...S.realUser, role: pick };
    S.research = null;
    renderShell();
    App.go("dashboard");
    toast(`กำลังดูในบทบาท ${SEB.ROLE[pick]}`);
  };
  App.endSim = function () {
    if (S.realUser) S.user = S.realUser;
    S.sim = null; S.realUser = null;
    renderShell();
    App.go("dashboard");
    toast("กลับเป็นผู้ดูแลระบบแล้ว");
  };

  App.render = function () {
    const v = S.view;
    setTitle(TITLES[v] || "SEB");
    const map = {
      dashboard: App.pageDashboard, cases: App.pageCases, case: App.pageCase, boxes: App.pageBoxes, box: App.pageBox,
      inspections: App.pageInspections, inspect: App.pageInspect, kits: App.pageKits, locations: App.pageLocations,
      research: App.pageResearch, stats: App.pageStats, consent: App.pageConsent, consentAdmin: App.pageConsentAdmin, logs: App.pageLogs, users: App.pageUsers, settings: App.pageSettings, more: App.pageMore,
    };
    try { window.SEB.syncLists(); } catch (e) {}
    (map[v] || App.pageDashboard)();
  };

  // ---------------- refresh ----------------
  App.refresh = async function (silent = false) {
    try {
      const res = await api("apiRefresh", S.token);
      const prevPending = S.data?.stats?.openCases || 0;
      S.user = SEB.withSim(res.user);
      S.data = res.data;
      renderNav();
      if (["dashboard", "cases", "boxes"].includes(S.view) && !document.getElementById("drawer")) App.render();
      if ((res.data.stats.openCases || 0) > prevPending && silent) toast("มีการเปิดกล่องยาใหม่");
    } catch (e) { if (!silent) fail(e); }
  };
  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(() => { if (document.visibilityState === "visible" && S.user) App.refresh(true); }, 30000);
    document.addEventListener("visibilitychange", onVisible);
  }
  function stopRefresh() { if (refreshTimer) clearInterval(refreshTimer); refreshTimer = null; document.removeEventListener("visibilitychange", onVisible); }
  function onVisible() { if (document.visibilityState === "visible" && S.user) { checkIdle(); if (S.user) App.refresh(true); } }

  // ---------------- idle timeout (30 นาที) ----------------
  function startIdleWatch() {
    S.lastActivity = Date.now();
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, () => (S.lastActivity = Date.now()), { passive: true }));
    setInterval(checkIdle, 60000);
  }
  function checkIdle() { if (S.user && Date.now() - S.lastActivity > IDLE_MS) App.logout().then(() => App.renderLogin("ไม่มีการใช้งานเกิน 30 นาที ระบบออกจากระบบอัตโนมัติ")); }

  // ---------------- service worker / push ----------------
  async function registerSW() {
    if (!("serviceWorker" in navigator) || DEMO && location.protocol === "file:") return;
    try { await navigator.serviceWorker.register("./sw.js", { scope: "./" }); } catch (e) { console.warn("SW", e); }
  }
  App.pushSupport = function () {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    return { ios, standalone, supported, needsInstall: ios && !standalone, permission: window.Notification ? Notification.permission : "unsupported" };
  };
  App.currentSubscription = async function () {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  };
  App.updateBell = async function () {
    const b = $("#bellBtn");
    if (!b) return;
    let on = false;
    try { on = DEMO ? localStorage.getItem("seb_demo_push") === "1" : !!(await App.currentSubscription()); } catch (_) {}
    b.innerHTML = ic(on ? "bell-ringing" : "bell-off");
    b.title = on ? "เครื่องนี้รับแจ้งเตือนอยู่" : "เครื่องนี้ยังไม่รับแจ้งเตือน";
    b.style.color = on ? "var(--ok-text)" : "var(--text-3)";
  };
  App.enablePush = async function () {
    const sup = App.pushSupport();
    if (DEMO) { localStorage.setItem("seb_demo_push", "1"); toast("เปิดรับแจ้งเตือนแล้ว (โหมดตัวอย่าง)"); App.updateBell(); return App.render(); }
    if (sup.needsInstall) return App.showInstallHelp();
    if (!sup.supported) return fail(new Error("อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน"));
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("ยังไม่ได้อนุญาตการแจ้งเตือน เปิดได้ที่การตั้งค่าของเครื่อง");
      const cfg = await api("apiPublicConfig");
      const key = window.SEB_VAPID_PUBLIC_KEY || cfg.vapidPublicKey;
      if (!key) throw new Error("ผู้ดูแลระบบยังไม่ได้ตั้งค่า VAPID key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
      const label = $("#deviceLabel")?.value.trim() || guessDevice();
      await api("apiSavePushSubscription", S.token, sub.toJSON(), label);
      toast("เปิดรับแจ้งเตือนบนเครื่องนี้แล้ว");
      App.updateBell();
      App.render();
    } catch (e) { fail(e); }
  };
  App.disablePush = async function () {
    if (DEMO) { localStorage.removeItem("seb_demo_push"); App.updateBell(); return App.render(); }
    try {
      const sub = await App.currentSubscription();
      if (sub) { await api("apiRemovePushSubscription", S.token, sub.endpoint); await sub.unsubscribe(); }
      toast("ปิดการแจ้งเตือนบนเครื่องนี้แล้ว");
      App.updateBell();
      App.render();
    } catch (e) { fail(e); }
  };
  App.install = async function () {
    if (S.installPrompt) { S.installPrompt.prompt(); await S.installPrompt.userChoice; S.installPrompt = null; return App.render(); }
    App.showInstallHelp();
  };
  App.showInstallHelp = function () {
    App.drawer("ติดตั้งแอปบนเครื่อง", `
      <div class="col gap-16">
        <div class="card card-pad"><h3>${ic("brand-apple")} iPhone / iPad</h3><ol class="muted small" style="padding-left:18px;margin:8px 0 0">
          <li>เปิดลิงก์นี้ด้วย <b>Safari</b> (iOS 16.4 ขึ้นไป)</li><li>แตะปุ่มแชร์ ${ic("share")} แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b></li>
          <li>เปิดแอป SEB จากไอคอนบนหน้าจอโฮม</li><li>เข้าสู่ระบบ → ตั้งค่า → <b>เปิดรับแจ้งเตือน</b> แล้วกดอนุญาต</li></ol></div>
        <div class="card card-pad"><h3>${ic("brand-android")} Android</h3><ol class="muted small" style="padding-left:18px;margin:8px 0 0">
          <li>เปิดด้วย <b>Chrome</b> → เมนู ⋮ → <b>ติดตั้งแอป</b> / เพิ่มลงในหน้าจอหลัก</li><li>เปิดแอป → ตั้งค่า → เปิดรับแจ้งเตือน → อนุญาต</li>
          <li>แนะนำ: ตั้งค่าแบตเตอรี่ของ Chrome เป็น "ไม่จำกัด" เพื่อให้แจ้งเตือนตรงเวลาเมื่อปิดหน้าจอ</li></ol></div>
        <div class="card card-pad"><h3>${ic("device-desktop")} คอมพิวเตอร์</h3><ol class="muted small" style="padding-left:18px;margin:8px 0 0">
          <li>Chrome / Edge → ไอคอนติดตั้ง ${ic("download")} ที่แถบที่อยู่</li><li>เปิดรับแจ้งเตือนในหน้าตั้งค่า (คอมต้องเปิดเบราว์เซอร์ค้างไว้)</li></ol></div>
      </div>`);
  };
  function guessDevice() {
    const ua = navigator.userAgent;
    if (/iphone/i.test(ua)) return "iPhone";
    if (/ipad/i.test(ua)) return "iPad";
    if (/android/i.test(ua)) return "Android";
    if (/windows/i.test(ua)) return "Windows PC";
    if (/mac/i.test(ua)) return "Mac";
    return "อุปกรณ์";
  }
  function b64ToU8(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  App.closeDrawer = window.SEB.closeDrawer;
  App.drawer = window.SEB.drawer;
  document.addEventListener("DOMContentLoaded", App.boot);
})();
