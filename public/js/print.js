/* =====================================================================
   SEB v2 — ระบบพิมพ์ (ผู้ใช้กำหนดขนาดเอง เนื้อหาปรับตามขนาด)
   1) ฉลาก QR (ติดกล่องถาวร)         kind = "qr"
   2) ฉลากนัดตรวจ (ไม่มี QR)          kind = "appt"
   3) ใบบันทึกรายการยา (แถบกล่องยา)   kind = "record"
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, esc, ic, $, $$, fmtD, daysUntil, nearDays, toast, fail, drawer } = X;
  const App = window.App;
  const D = () => S.data;

  const SHEETS = { A4: [210, 297], A5: [148, 210], Letter: [216, 279], "สติกเกอร์ 100×75": [100, 75], "สติกเกอร์ 100×50": [100, 50], "สติกเกอร์ 60×40": [60, 40] };
  const LABELS = { "50×30": [50, 30], "60×40": [60, 40], "70×40": [70, 40], "90×50": [90, 50], "100×60": [100, 60], "50×50": [50, 50] };
  const RECORD_SIZES = { band: ["แถบกล่องยา", 130, 50, "13×5 ซม."], a4: ["A4 เต็ม", 210, 297, "21×29.7 ซม."] };
  const DEF = {
    qr: { paper: "A4", w: 210, h: 297, orient: "portrait", margin: 8, lw: 70, lh: 40, gap: 4, title: "กล่องยาฉุกเฉิน", showLoc: true, showHint: true, showHosp: true },
    appt: { paper: "A4", w: 210, h: 297, orient: "portrait", margin: 8, lw: 70, lh: 40, gap: 4, title: "นัดตรวจกล่องยา", showLoc: true, showLast: true, showSeal: true, showHosp: true, overrideDate: "" },
    record: { size: "band", cw: 130, ch: 50, out: "sheet", margin: 8, gap: 4, scale: 1 },
  };
  const load = (k) => { try { return { ...DEF[k], ...JSON.parse(localStorage.getItem("seb_print_" + k) || "{}") }; } catch (_) { return { ...DEF[k] }; } };
  const save = (k, c) => { try { const { fields, ...rest } = c; localStorage.setItem("seb_print_" + k, JSON.stringify(rest)); } catch (_) {} };
  const sheetSize = (c) => (c.orient === "landscape" ? [Math.max(c.w, c.h), Math.min(c.w, c.h)] : [Math.min(c.w, c.h), Math.max(c.w, c.h)]);
  const fontsHref = () => { try { return new URL("./vendor/fonts.css", location.href).href; } catch (_) { return ""; } };
  const BASE = `*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:"IBM Plex Sans Thai","Inter",system-ui,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}`;
  const d2 = (n) => String(n).padStart(2, "0");
  const thDate = (v) => { if (!v) return ""; const d = new Date(String(v).length === 10 ? v + "T00:00:00" : v); return isNaN(d) ? "" : `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear() + 543}`; };
  const nowTime = () => { const d = new Date(); return `${d2(d.getHours())}:${d2(d.getMinutes())}`; };
  const doc = (css, body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="${fontsHref()}"><style>${BASE}${css}</style></head><body>${body}</body></html>`;

  let ST = { kind: "qr", cfg: null, ids: [], boxId: "" };

  // =================================================================
  // 1) ฉลาก QR  /  2) ฉลากนัดตรวจ  — ตารางฉลากบนแผ่น
  // =================================================================
  function labelSheet(c, boxes, inner) {
    const [W, H] = sheetSize(c);
    const lw = +c.lw, lh = +c.lh;
    const css = `@page{size:${W}mm ${H}mm;margin:${c.margin}mm}
      .sheet{display:grid;grid-template-columns:repeat(auto-fill,${lw}mm);grid-auto-rows:${lh}mm;gap:${c.gap}mm;justify-content:start}
      .lbl{width:${lw}mm;height:${lh}mm;border:0.3mm solid #222;border-radius:${Math.min(3, lh * 0.08).toFixed(1)}mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid}`;
    const r = inner(lw, lh);
    return doc(css + r.css, `<div class="sheet">${boxes.map((b) => `<div class="lbl">${r.html(b)}</div>`).join("")}</div>`);
  }

  function qrInner(c) {
    const hosp = D().settings.HOSPITAL_NAME || "";
    return (lw, lh) => {
      const pad = Math.max(1.5, Math.min(lw, lh) * 0.07);
      const vertical = lw / lh < 1.25;
      const q = vertical ? Math.min(lw - 2 * pad, lh * 0.6) : Math.min(lh - 2 * pad, lw * 0.48);
      const unit = vertical ? lw : lh;
      const f = (r) => `${(unit * r).toFixed(2)}mm`;
      const textW = vertical ? lw - 2 * pad : lw - q - 3 * pad;
      const code = (t) => Math.min(unit * (vertical ? 0.13 : 0.2), textW / (Math.max(4, String(t).length) * 0.62)).toFixed(2);
      return {
        css: `.in{height:100%;padding:${pad.toFixed(1)}mm;display:flex;${vertical ? "flex-direction:column;align-items:center;text-align:center" : "align-items:center"};gap:${(pad * 0.9).toFixed(1)}mm}
          .qr{width:${q.toFixed(1)}mm;height:${q.toFixed(1)}mm;flex:none}.qr svg{width:100%;height:100%;display:block}
          .tx{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;line-height:1.15}
          .t{font-size:${f(0.075)};font-weight:700;color:#b3122a;display:flex;align-items:center;gap:.8mm${vertical ? ";justify-content:center" : ""}}.hl{height:${f(0.11)};width:auto;flex:none}.c{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .l{font-size:${f(0.075)};color:#333}.h{font-size:${f(0.058)};color:#444;margin-top:.8mm}.o{font-size:${f(0.05)};color:#888;margin-top:.6mm}`,
        html: (b) => `<div class="in"><div class="qr">${App.qrSvgFor(b.qrUrl, 4)}</div><div class="tx">
          ${c.title ? `<div class="t"><img class="hl" src="${SEB.hospLogoAbs()}" alt="">${esc(c.title)}</div>` : ""}<div class="c" style="font-size:${code(b.boxCode)}mm">${esc(b.boxCode)}</div>
          ${c.showLoc ? `<div class="l">${esc(b.location || "")}</div>` : ""}
          ${c.showHint ? `<div class="h">เปิดใช้ → สแกน QR → กรอก HN<br>รักษาผู้ป่วยก่อน บันทึกทีหลังได้</div>` : ""}
          ${c.showHosp ? `<div class="o">${esc(hosp)}</div>` : ""}</div></div>`,
      };
    };
  }

  function apptInner(c) {
    const hosp = D().settings.HOSPITAL_NAME || "";
    return (lw, lh) => {
      const pad = Math.max(1.5, Math.min(lw, lh) * 0.07);
      const u = Math.min(lh, lw * 0.62);
      const f = (r) => `${(u * r).toFixed(2)}mm`;
      return {
        css: `.in{height:100%;padding:${pad.toFixed(1)}mm;display:flex;flex-direction:column;justify-content:space-between;line-height:1.2}
          .top{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;border-bottom:0.25mm solid #999;padding-bottom:${(pad * 0.5).toFixed(1)}mm}
          .t{font-size:${f(0.075)};font-weight:700;color:#b3122a;white-space:nowrap}.c{font-size:${f(0.11)};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .l{font-size:${f(0.07)};color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .k{font-size:${f(0.062)};color:#555}.d{font-size:${f(0.17)};font-weight:700;letter-spacing:-.01em;line-height:1.05}
          .m{display:flex;justify-content:space-between;gap:2mm;font-size:${f(0.058)};color:#333}.o{font-size:${f(0.05)};color:#888}`,
        html: (b) => {
          const date = c.overrideDate || b.inspectionDate;
          return `<div class="in"><div class="top"><span class="c">${esc(b.boxCode)}</span><span class="t">${esc(c.title || "")}</span></div>
            ${c.showLoc ? `<div class="l">${esc(b.location || "")}</div>` : ""}
            <div><div class="k">ตรวจครั้งถัดไป</div><div class="d">${date ? thDate(date) : "____/____/______"}</div></div>
            <div class="m">${c.showLast ? `<span>ตรวจล่าสุด ${b.lastInspectedAt ? thDate(b.lastInspectedAt) : "-"}</span>` : "<span></span>"}${c.showSeal && SEB.sealOn() ? `<span>ซีล ${esc(b.sealNo || "-")}</span>` : ""}</div>
            ${c.showHosp ? `<div class="o">${esc(hosp)} · ห้องยา</div>` : ""}</div>`;
        },
      };
    };
  }

  // =================================================================
  // 3) ใบบันทึกรายการยา — แถบกล่องยา (ตามรูปแบบเดิมของระบบ)
  // =================================================================
  function groupItems(items) {
    const nd = nearDays();
    const m = new Map();
    items.forEach((it) => {
      const name = [it.drugName, it.strength].filter(Boolean).join(" ");
      if (!m.has(name)) m.set(name, { name, qty: 0, lots: [], exp: null });
      const g = m.get(name);
      g.qty += Number(it.qty || 0);
      if (it.lot) g.lots.push(`${it.lot} (${Number(it.qty || 0)})`);
      if (it.expiryDate && (!g.exp || it.expiryDate < g.exp)) g.exp = it.expiryDate;
    });
    return [...m.values()].map((g) => ({ ...g, near: g.exp && daysUntil(g.exp) <= nd }));
  }

  // วัดความกว้างข้อความ (มม.) ด้วย canvas — ใช้ตัดบรรทัดชื่อยา/lot ให้ตรงกับที่พิมพ์จริง
  let _mctx = null;
  function textMm(t, fsMm, bold) {
    if (!_mctx) { try { _mctx = document.createElement("canvas").getContext("2d"); } catch (_) { _mctx = null; } }
    if (!_mctx) return String(t).length * fsMm * 0.55;
    _mctx.font = `${bold ? 700 : 400} 100px "IBM Plex Sans Thai","Inter",system-ui,sans-serif`;
    return (_mctx.measureText(String(t)).width / 100) * fsMm * 1.1;    // เผื่อ 10% (ฟอนต์ตอนพิมพ์อาจกว้างกว่าที่วัด)
  }
  // ตัดคำเป็นบรรทัดตามความกว้างคอลัมน์ (คำที่ยาวเกินบรรทัดจะถูกตัดกลางคำ)
  function wrapWords(text, wMm, fsMm) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = []; let cur = "";
    const push = (w) => {
      if (textMm(w, fsMm) <= wMm) return w;
      let part = "";
      for (const ch of w) { if (textMm(part + ch, fsMm) > wMm && part) { lines.push(part); part = ch; } else part += ch; }
      return part;
    };
    words.forEach((w) => {
      const t = cur ? cur + " " + w : w;
      if (textMm(t, fsMm) <= wMm) cur = t;
      else { if (cur) lines.push(cur); cur = push(w); }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }
  // จัด lot ลงบรรทัด: หลาย lot ต่อบรรทัดถ้าพอ ไม่ตัด lot กลางคำ
  function packLots(lots, wMm, fsMm) {
    if (!lots.length) return ["-"];
    const lines = []; let cur = "";
    lots.forEach((l) => {
      const t = cur ? cur + ", " + l : l;
      if (!cur || textMm(t, fsMm) <= wMm) cur = t; else { lines.push(cur + ","); cur = l; }
    });
    lines.push(cur);
    return lines;
  }

  function recordDoc(c, b, fields) {
    const cw = +c.cw, ch = +c.ch;
    const pad = Math.max(2, Math.min(cw, ch) * 0.045);
    const rowH = Math.min(7.5, Math.max(3.4, ch * 0.072)) * (+c.scale || 1);
    const fs = rowH * 0.56;                       // ตัวอักษรในตาราง (มม.)
    const lineH = fs * 1.18;                      // ความสูงบรรทัดที่ 2 เป็นต้นไป
    const headH = rowH * 2.5, theadH = rowH, footH = rowH * 2.1;
    const tblW = cw - 2 * pad, cellPad = fs * 0.45 * 2 + 0.4;
    // สัดส่วนคอลัมน์: ยา 37% · จำนวน 9% · Lot 36% · Exp 18%
    const COLS = [37, 9, 36, 18];
    const nameW = tblW * COLS[0] / 100 - cellPad, lotW = tblW * COLS[2] / 100 - cellPad;
    const lotFs = fs * 0.92;
    const rows = groupItems(b.items).map((r) => {
      const nl = wrapWords(r.name, nameW, fs);
      const ll = packLots(r.lots, lotW, lotFs);
      const n = Math.max(nl.length, ll.length);
      return { ...r, nl, ll, h: rowH + (n - 1) * lineH };
    });
    const bodyCap = ch - 2 * pad - headH - theadH - 1;
    const bodyCapLast = bodyCap - footH;
    const sum = (a) => a.reduce((x, r) => x + r.h, 0);
    // แบ่งแถบตามความสูงจริงของแต่ละแถว — แถวที่ไม่พอในแถบนี้จะยกไปแถบถัดไปทั้งแถว
    const pages = [];
    let i = 0;
    while (i < rows.length || !pages.length) {
      const rest = rows.slice(i);
      if (sum(rest) <= bodyCapLast + 0.01) { pages.push({ rows: rest, last: true }); break; }
      let take = 0, h = 0;
      while (take < rest.length && h + rest[take].h <= bodyCap + 0.01) { h += rest[take].h; take++; }
      if (take === 0) take = 1;                                   // แถวเดียวสูงเกินแถบ: ใส่ไปก่อน (จะถูกตัดท้าย)
      if (take === rest.length) take = Math.max(1, take - 1);     // ให้แถบสุดท้ายมีรายการยาอย่างน้อย 1 แถว คู่กับส่วนลงชื่อ
      pages.push({ rows: rest.slice(0, take), last: false });
      i += take;
    }
    const hasNear = rows.some((r) => r.near);
    const br = (a) => a.map(esc).join("<br>");
    const card = (p, idx) => {
      const left = (p.last ? bodyCapLast : bodyCap) - sum(p.rows);
      const fill = Math.max(0, Math.floor(left / rowH + 0.001));
      const tr = p.rows.map((r) => `<tr style="height:${r.h.toFixed(2)}mm"><td class="nm">${br(r.nl)}</td><td class="c">${r.qty}</td><td class="c lot">${br(r.ll)}</td><td class="c">${r.exp ? thDate(r.exp) + (r.near ? "*" : "") : "-"}</td></tr>`).join("")
        + Array.from({ length: fill }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join("");
      return `<section class="card">
        <header><div class="hrow"><img class="hl" src="${SEB.hospLogoAbs()}" alt=""><div><div class="code">${esc(fields.name)}</div><div class="loc">${esc(fields.location)}</div></div></div>
          <div class="meta"><div><b>วันที่: ${esc(fields.date)}</b></div><div>ผู้ตรวจ: ${esc(fields.inspector)}</div>${pages.length > 1 ? `<div class="pg">แผ่น ${idx + 1}/${pages.length}</div>` : ""}</div></header>
        <table><colgroup>${COLS.map((w) => `<col style="width:${w}%">`).join("")}</colgroup>
          <thead><tr><th>ยา</th><th class="c">จำนวน</th><th class="c">Lot</th><th class="c">Exp</th></tr></thead><tbody>${tr}</tbody></table>
        ${p.last ? `<footer><div>${hasNear ? `* ยาใกล้หมดอายุ (&lt;${nearDays()} วัน)` : "&nbsp;"}</div><div class="sig"><span>เวลา: ${nowTime()}</span><span>ผู้ตรวจ: ____________________</span></div></footer>` : ""}
      </section>`;
    };
    const band = c.out === "band";
    const sheetW = band ? cw : 210, sheetH = band ? ch : 297;
    const css = `@page{size:${sheetW}mm ${sheetH}mm;margin:${band ? 0 : c.margin}mm}
      .wrap{display:flex;flex-direction:column;gap:${band ? 0 : c.gap}mm;align-items:flex-start}
      .card{width:${cw}mm;height:${ch}mm;border:0.35mm solid #222;padding:${pad.toFixed(1)}mm;display:flex;flex-direction:column;overflow:hidden;break-inside:avoid;page-break-inside:avoid;${band ? "page-break-after:always;break-after:page;border-color:transparent" : ""}}
      .card:last-child{page-break-after:auto;break-after:auto}
      header{display:flex;justify-content:space-between;align-items:flex-start;height:${headH.toFixed(2)}mm;flex:none;border-bottom:0.3mm solid #222;margin-bottom:${(rowH * 0.25).toFixed(2)}mm}
      .hrow{display:flex;align-items:center;gap:${(rowH * 0.35).toFixed(2)}mm;min-width:0}.hrow .hl{height:${(headH * 0.78).toFixed(2)}mm;width:auto;flex:none}
      .code{font-size:${(rowH * 0.95).toFixed(2)}mm;font-weight:700;line-height:1.1}.loc{font-size:${(fs * 0.95).toFixed(2)}mm;color:#333}
      .meta{text-align:right;font-size:${(fs * 0.9).toFixed(2)}mm;line-height:1.3}.pg{color:#777}
      table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:${fs.toFixed(2)}mm;flex:none}
      th,td{border:0.2mm solid #777;padding:0 ${(fs * 0.45).toFixed(2)}mm;height:${rowH.toFixed(2)}mm;line-height:${(lineH / fs).toFixed(3)};white-space:nowrap;overflow:hidden;vertical-align:middle}
      th{height:${theadH.toFixed(2)}mm;text-align:left;font-weight:700;background:#f1f1f3}
      .c{text-align:center}.lot{font-size:${(lotFs).toFixed(2)}mm}
      footer{margin-top:auto;font-size:${(fs * 0.9).toFixed(2)}mm;color:#444;line-height:1.5}
      .sig{display:flex;justify-content:space-between;color:#111}`;
    const maxRows = Math.max(1, Math.floor(bodyCap / rowH));
    return { html: doc(css, `<div class="wrap">${pages.map(card).join("")}</div>`), pages: pages.length, cap: maxRows, sheet: [sheetW, sheetH] };
  }

  // =================================================================
  // UI
  // =================================================================
  App.printQr = (ids) => openPrint("qr", { ids: ids || D().boxes.map((b) => b.id) });
  App.printAppt = (ids) => openPrint("appt", { ids: ids || D().boxes.map((b) => b.id) });
  App.printDrugRecord = (boxId) => openPrint("record", { boxId });

  function openPrint(kind, o) {
    ST = { kind, cfg: load(kind), ids: o.ids || [], boxId: o.boxId || "" };
    if (kind === "record") {
      const b = D().boxes.find((x) => x.id === ST.boxId);
      ST.cfg.fields = { name: b.boxCode, date: thDate(new Date().toISOString()), location: b.location || "", inspector: S.user.displayText || S.user.displayName };
    }
    const title = { qr: "พิมพ์ฉลาก QR (ติดกล่องถาวร)", appt: "พิมพ์ฉลากนัดตรวจ", record: "พิมพ์ใบบันทึกรายการยา" }[kind];
    drawer(title, `<div class="print-layout"><div id="prCtl"></div><div class="print-preview" id="prPrev"><iframe id="prFrame" title="ตัวอย่างก่อนพิมพ์"></iframe></div></div>`,
      `<span class="xs faint grow" id="prInfo"></span><button class="btn ghost" onclick="App.printReset()">ค่าเริ่มต้น</button><button class="btn ghost" onclick="App.closeDrawer()">ยกเลิก</button><button class="btn primary" onclick="App.printGo()">${ic("printer")} พิมพ์เอกสาร</button>`, { wide: true });
    $("#drawer").style.width = "min(1180px, 100vw)";
    renderCtl();
    refresh();
  }

  const num = (id, label, v, min, max, step = 1, unit = "มม.") => `<label class="field"><span>${label}</span><div class="row"><input class="input sm" type="number" data-c="${id}" value="${v}" min="${min}" max="${max}" step="${step}" style="width:96px" oninput="App.printSet(this)"><span class="xs faint">${unit}</span></div></label>`;
  const tog = (id, label, v) => `<label class="check small"><input type="checkbox" data-c="${id}" ${v ? "checked" : ""} onchange="App.printSet(this)"> ${label}</label>`;
  const txt = (id, label, v, f = "data-c") => `<label class="field"><span>${label}</span><input class="input sm" ${f}="${id}" value="${esc(v || "")}" oninput="App.printSet(this)"></label>`;

  function renderCtl() {
    const c = ST.cfg;
    let h = `<div class="col gap-12">`;
    if (ST.kind === "record") {
      const opts = Object.entries(RECORD_SIZES).map(([k, [n, w, hh, s]]) => `<button type="button" class="${c.size === k ? "on" : ""}" onclick="App.recSize('${k}')">${n}<small>${s}</small></button>`).join("")
        + `<button type="button" class="${c.size === "custom" ? "on" : ""}" onclick="App.recSize('custom')">กำหนดเอง<small>${c.cw}×${c.ch} มม.</small></button>`;
      h += `<div><div class="label mb-8">ขนาดกระดาษ</div><div class="size-grid">${opts}</div></div>
        ${c.size === "custom" ? `<div class="row gap-12">${num("cw", "กว้าง", c.cw, 40, 297)}${num("ch", "สูง", c.ch, 25, 420)}</div>` : ""}
        ${c.size !== "a4" ? `<div><div class="label mb-8">พิมพ์ลงบน</div><div class="seg">${[["sheet", "กระดาษ A4 (ตัดแบ่ง)"], ["band", "เครื่องพิมพ์สติกเกอร์"]].map(([k, t]) => `<button type="button" class="${c.out === k ? "on" : ""}" onclick="App.recOut('${k}')">${t}</button>`).join("")}</div></div>` : ""}
        <label class="field"><span>ขนาดตัวอักษร <span class="hint">${Math.round(c.scale * 100)}%</span></span><input type="range" min="0.7" max="1.4" step="0.05" data-c="scale" value="${c.scale}" oninput="App.printSet(this)"></label>
        <div style="border-top:1px solid var(--border);padding-top:12px"><div class="label mb-8">ปรับข้อมูลก่อนพิมพ์</div><div class="grid grid-2" style="gap:10px">
          ${txt("name", "ชื่อกล่องยา", c.fields.name, "data-f")}${txt("date", "วันที่ตรวจ", c.fields.date, "data-f")}${txt("location", "สถานที่", c.fields.location, "data-f")}${txt("inspector", "ผู้ตรวจ", c.fields.inspector, "data-f")}</div></div>`;
    } else {
      const sheets = Object.entries(SHEETS).map(([k, [w, hh]]) => `<button type="button" class="${c.paper === k ? "on" : ""}" onclick="App.printPaper('${k}')">${k.replace("สติกเกอร์ ", "สติกเกอร์<br>")}<small>${w}×${hh}</small></button>`).join("")
        + `<button type="button" class="${c.paper === "custom" ? "on" : ""}" onclick="App.printPaper('custom')">กำหนดเอง<small>${c.w}×${c.h}</small></button>`;
      h += `<div><div class="label mb-8">กระดาษ</div><div class="size-grid">${sheets}</div></div>
        ${c.paper === "custom" ? `<div class="row gap-12">${num("w", "กว้าง", c.w, 30, 600)}${num("h", "สูง", c.h, 20, 900)}</div>` : ""}
        <div class="row gap-12 wrap"><div class="seg">${[["portrait", "แนวตั้ง"], ["landscape", "แนวนอน"]].map(([k, t]) => `<button type="button" class="${c.orient === k ? "on" : ""}" onclick="App.printOrient('${k}')">${t}</button>`).join("")}</div>${num("margin", "ขอบ", c.margin, 0, 40)}</div>
        <div><div class="label mb-8">ขนาดฉลาก</div><div class="size-grid">${Object.entries(LABELS).map(([k, [w, hh]]) => `<button type="button" class="${+c.lw === w && +c.lh === hh ? "on" : ""}" onclick="App.printLabel(${w},${hh})">${k}<small>มม.</small></button>`).join("")}</div></div>
        <div class="row gap-12">${num("lw", "กว้าง", c.lw, 20, 300)}${num("lh", "สูง", c.lh, 15, 300)}${num("gap", "ช่องไฟ", c.gap, 0, 30)}</div>
        ${txt("title", "หัวฉลาก", c.title)}`;
      h += ST.kind === "qr"
        ? `<div class="col gap-4">${tog("showLoc", "แสดงจุดวางกล่อง", c.showLoc)}${tog("showHint", "แสดงคำแนะนำการสแกน", c.showHint)}${tog("showHosp", "แสดงชื่อโรงพยาบาล", c.showHosp)}</div>`
        : `<label class="field"><span>วันนัดตรวจ <span class="hint">เว้นว่าง = ใช้วันนัดของแต่ละกล่อง</span></span><input class="input sm" type="date" data-c="overrideDate" value="${esc(c.overrideDate || "")}" oninput="App.printSet(this)"></label>
          <div class="col gap-4">${tog("showLoc", "แสดงจุดวางกล่อง", c.showLoc)}${tog("showLast", "แสดงวันตรวจล่าสุด", c.showLast)}${SEB.sealOn() ? tog("showSeal", "แสดงเลขซีล", c.showSeal) : ""}${tog("showHosp", "แสดงชื่อโรงพยาบาล", c.showHosp)}</div>`;
      h += `<div><div class="row between mb-8"><span class="label">กล่องที่จะพิมพ์</span><span class="row gap-4"><button class="btn ghost sm" onclick="App.printPick(true)">ทั้งหมด</button><button class="btn ghost sm" onclick="App.printPick(false)">ล้าง</button></span></div>
          <div class="card" style="max-height:220px;overflow:auto">${D().boxes.map((b) => `<label class="list-row check small" style="padding:7px 12px"><input type="checkbox" data-pick="${b.id}" ${ST.ids.includes(b.id) ? "checked" : ""} onchange="App.printPickOne()"> <span class="grow">${esc(b.boxCode)} <span class="faint">${esc(b.location)}</span></span>${ST.kind === "appt" ? `<span class="xs faint">${b.inspectionDate ? fmtD(b.inspectionDate) : "ยังไม่นัด"}</span>` : ""}</label>`).join("")}</div></div>`;
    }
    $("#prCtl").innerHTML = h + `</div>`;
  }

  let timer;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const c = ST.cfg, fr = $("#prFrame");
      if (!fr) return;
      let html, W, H, m;
      if (ST.kind === "record") {
        const b = D().boxes.find((x) => x.id === ST.boxId);
        const r = recordDoc(c, b, c.fields);
        html = r.html;
        [W, H] = r.sheet;
        m = c.out === "band" ? 0 : +c.margin;
        $("#prInfo").textContent = `${c.cw}×${c.ch} มม. · ${r.pages} แถบ · สูงสุด ${r.cap} รายการ/แถบ`;
      } else {
        const boxes = D().boxes.filter((b) => ST.ids.includes(b.id));
        html = labelSheet(c, boxes, ST.kind === "qr" ? qrInner(c) : apptInner(c));
        [W, H] = sheetSize(c);
        m = +c.margin;
        const cols = Math.max(1, Math.floor((W - 2 * m + +c.gap) / (+c.lw + +c.gap)));
        const rows = Math.max(1, Math.floor((H - 2 * m + +c.gap) / (+c.lh + +c.gap)));
        $("#prInfo").textContent = `${boxes.length} ฉลาก · ${cols * rows} ฉลาก/แผ่น · ประมาณ ${Math.max(1, Math.ceil(boxes.length / (cols * rows)))} แผ่น`;
      }
      const px = (mm) => (mm * 96) / 25.4;
      fr.style.width = px(W) + "px";
      fr.style.padding = px(m) + "px";
      fr.style.boxSizing = "border-box";
      fr.style.height = px(H) + "px";
      fr.srcdoc = html;
      fr.onload = () => {
        try { fr.style.height = Math.max(px(H), fr.contentDocument.documentElement.scrollHeight + 2 * px(m)) + "px"; } catch (_) {}
        const sc = Math.min(1, ($("#prPrev").clientWidth - 32) / px(W));
        fr.style.transform = `scale(${sc})`;
        fr.style.marginBottom = `${-(1 - sc) * parseFloat(fr.style.height)}px`;
      };
      save(ST.kind, c);
    }, 120);
  }

  App.printSet = (el) => {
    if (el.dataset.f) { ST.cfg.fields[el.dataset.f] = el.value; return refresh(); }
    const k = el.dataset.c;
    ST.cfg[k] = el.type === "checkbox" ? el.checked : el.type === "number" || el.type === "range" ? Number(el.value) : el.value;
    if (k === "scale") { const hint = el.closest(".field").querySelector(".hint"); if (hint) hint.textContent = `${Math.round(el.value * 100)}%`; }
    if (k === "lw" || k === "lh") $$(".size-grid button").forEach((b) => b.classList.remove("on"));
    refresh();
  };
  App.recSize = (k) => { ST.cfg.size = k; if (RECORD_SIZES[k]) { ST.cfg.cw = RECORD_SIZES[k][1]; ST.cfg.ch = RECORD_SIZES[k][2]; } if (k === "a4") { ST.cfg.out = "band"; } else if (ST.cfg.out === "band" && ST.cfg.size !== "custom") ST.cfg.out = "sheet"; renderCtl(); refresh(); };
  App.recOut = (o) => { ST.cfg.out = o; renderCtl(); refresh(); };
  App.printPaper = (k) => { ST.cfg.paper = k; if (SHEETS[k]) [ST.cfg.w, ST.cfg.h] = SHEETS[k]; ST.cfg.orient = SHEETS[k] && SHEETS[k][0] > SHEETS[k][1] ? "landscape" : ST.cfg.orient; renderCtl(); refresh(); };
  App.printOrient = (o) => { ST.cfg.orient = o; renderCtl(); refresh(); };
  App.printLabel = (w, h) => { ST.cfg.lw = w; ST.cfg.lh = h; renderCtl(); refresh(); };
  App.printPick = (all) => { ST.ids = all ? D().boxes.map((b) => b.id) : []; renderCtl(); refresh(); };
  App.printPickOne = () => { ST.ids = $$("[data-pick]").filter((c) => c.checked).map((c) => c.dataset.pick); refresh(); };
  App.printReset = () => { const f = ST.cfg.fields; ST.cfg = { ...DEF[ST.kind], fields: f }; save(ST.kind, ST.cfg); renderCtl(); refresh(); };
  App.printGo = () => {
    if (ST.kind !== "record" && !ST.ids.length) return toast("กรุณาเลือกกล่องอย่างน้อย 1 กล่อง", true);
    const fr = $("#prFrame");
    try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { fail(new Error("พิมพ์จากหน้านี้ไม่ได้ ลองเปิดแอปในเบราว์เซอร์โดยตรง")); }
  };
})();
