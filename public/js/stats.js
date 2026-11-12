/* =====================================================================
   SEB v2 — หน้าสถิติ / แดชบอร์ดการปฏิบัติงาน (ทุกบทบาทดูได้)
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, api, esc, ic, $, fmtD, minutes, daysUntil, nearDays, kpi, empty, setTitle } = X;
  const App = window.App;
  const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const C = { brand: "var(--brand)", ok: "var(--ok)", warn: "var(--warn)", blue: "#5b74c2", violet: "#7c6bc4", teal: "#2b8a8a", gray: "var(--border-strong)" };
  const PALETTE = [C.brand, C.blue, C.ok, C.warn, C.violet, C.teal, "#c2649a", "#8a8f99"];
  const r1 = (x) => (x === null || x === undefined || isNaN(x) ? "–" : String(Math.round(x * 10) / 10));
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mlabel = (k) => `${TH_M[+k.slice(5) - 1]} ${String(+k.slice(0, 4) + 543).slice(2)}`;
  const lastMonths = (n) => { const out = [], d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(mkey(x)); } return out; };
  const resp = (e) => minutes(e.notificationSentAt, e.acknowledgedAt);
  const ready = (e) => minutes(e.actualOpenedAt, e.readyAt);
  const ok24 = (x) => x !== null && x >= 0 && x <= 1440;

  // ---------------- chart primitives (SVG) ----------------
  function barChart(labels, series, { h = 190, stacked = true, unit = "" } = {}) {
    const W = 560, pad = { l: 30, r: 8, t: 14, b: 26 };
    const totals = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0))));
    const max = Math.max(1, ...totals);
    const nice = Math.ceil(max / (max > 20 ? 5 : 1)) * (max > 20 ? 5 : 1);
    const iw = W - pad.l - pad.r, ih = h - pad.t - pad.b, bw = iw / labels.length;
    const y = (v) => pad.t + ih - (v / nice) * ih;
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = (nice / 4) * k; g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad.l - 6}" y="${y(v) + 3}" class="ax" text-anchor="end">${Math.round(v)}</text>`; }
    labels.forEach((lb, i) => {
      let acc = 0;
      const x = pad.l + i * bw + bw * 0.18, w = bw * 0.64;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        if (!v) return;
        const sx = stacked ? x : x + (w / series.length) * si, sw = stacked ? w : w / series.length;
        const y0 = stacked ? y(acc + v) : y(v), hh = stacked ? y(acc) - y(acc + v) : y(0) - y(v);
        g += `<rect x="${sx}" y="${y0}" width="${sw}" height="${Math.max(0, hh)}" rx="3" style="fill:${s.color}"><title>${esc(lb)} · ${esc(s.name)}: ${v}${unit}</title></rect>`;
        if (stacked) acc += v;
      });
      if (totals[i]) g += `<text x="${x + w / 2}" y="${y(totals[i]) - 4}" class="vl" text-anchor="middle">${r1(totals[i])}</text>`;
      g += `<text x="${x + w / 2}" y="${h - 8}" class="ax" text-anchor="middle">${esc(lb)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${h}" class="chart">${g}</svg>${legend(series)}`;
  }
  function lineChart(labels, series, { h = 190, target = null, unit = "" } = {}) {
    const W = 560, pad = { l: 34, r: 12, t: 14, b: 26 };
    const vals = series.flatMap((s) => s.values.filter((v) => v !== null));
    const max = Math.max(1, target || 0, ...vals) * 1.15;
    const iw = W - pad.l - pad.r, ih = h - pad.t - pad.b, step = labels.length > 1 ? iw / (labels.length - 1) : iw;
    const x = (i) => pad.l + i * step, y = (v) => pad.t + ih - (v / max) * ih;
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = (max / 4) * k; g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad.l - 6}" y="${y(v) + 3}" class="ax" text-anchor="end">${Math.round(v)}</text>`; }
    if (target) g += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}" class="tg"/><text x="${W - pad.r}" y="${y(target) - 4}" class="ax" text-anchor="end" style="fill:var(--ok-text)">เป้า ${target}${unit}</text>`;
    labels.forEach((lb, i) => (g += `<text x="${x(i)}" y="${h - 8}" class="ax" text-anchor="middle">${esc(lb)}</text>`));
    series.forEach((s) => {
      const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v), v]));
      let d = "", pen = false;
      pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? "L" : "M"}${p[0]},${p[1]} `; pen = true; });
      g += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((p) => p && (g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:var(--surface);stroke:${s.color}" stroke-width="2"><title>${esc(s.name)}: ${r1(p[2])}${unit}</title></circle>`));
    });
    return `<svg viewBox="0 0 ${W} ${h}" class="chart">${g}</svg>${legend(series)}`;
  }
  function donut(items) {
    const total = items.reduce((a, b) => a + b.value, 0);
    if (!total) return empty("ไม่มีข้อมูล", "chart-donut");
    let a0 = -Math.PI / 2, g = "";
    const R = 62, r = 40, cx = 75, cy = 75;
    items.forEach((it) => {
      const a1 = a0 + (it.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
      g += it.value === total ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" style="stroke:${it.color}" stroke-width="${R - r}"/>` : `<path d="M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z" style="fill:${it.color}"><title>${esc(it.label)}: ${it.value}</title></path>`;
      a0 = a1;
    });
    return `<div class="donut-wrap"><svg viewBox="0 0 150 150" width="150" height="150"><g>${g}</g><text x="75" y="72" text-anchor="middle" class="dn">${total}</text><text x="75" y="90" text-anchor="middle" class="ax">ครั้ง</text></svg>
      <div class="col gap-4 grow">${items.map((it) => `<div class="row small"><span class="sw" style="background:${it.color}"></span><span class="grow">${esc(it.label)}</span><b class="tabnum">${it.value}</b><span class="xs faint" style="width:40px;text-align:right">${Math.round((it.value / total) * 100)}%</span></div>`).join("")}</div></div>`;
  }
  function hbars(rows, color = C.blue, unit = "") {
    if (!rows.length) return empty("ไม่มีข้อมูล", "chart-bar-off");
    const max = Math.max(...rows.map((r) => r[1]), 1);
    return rows.map(([k, v, sub]) => `<div class="hbar hbar2"><span style="min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(k)}">${esc(k)}</span>${sub ? `<span class="xs faint">${esc(sub)}</span>` : ""}</span><div class="track"><span style="width:${Math.max(2, (v / max) * 100)}%;background:${color}"></span></div><span class="tabnum right"><b>${r1(v)}</b>${unit}</span></div>`).join("");
  }
  function heatmap(events) {
    const m = Array.from({ length: 7 }, () => Array(6).fill(0));
    events.forEach((e) => { const d = new Date(e.actualOpenedAt); m[d.getDay()][Math.floor(d.getHours() / 4)]++; });
    const max = Math.max(1, ...m.flat());
    const blocks = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];
    return `<div class="heat"><div></div>${blocks.map((b) => `<div class="hx">${b}</div>`).join("")}
      ${m.map((row, d) => `<div class="hy">${DOW[d]}</div>${row.map((v) => `<div class="hc" style="background:color-mix(in srgb, var(--brand) ${Math.round((v / max) * 85)}%, var(--surface-3))" title="${DOW[d]}: ${v} ครั้ง">${v || ""}</div>`).join("")}`).join("")}</div>`;
  }
  const legend = (series) => (series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>` : "");
  const chartCard = (title, sub, body, cls = "") => `<div class="card ${cls}"><div class="card-head"><div class="grow"><h3>${title}</h3>${sub ? `<div class="xs faint">${sub}</div>` : ""}</div></div><div class="card-body">${body}</div></div>`;

  // ---------------- page ----------------
  App.pageStats = async function () {
    S.statRange = S.statRange || 6;
    setTitle("สถิติ", `<button class="btn primary sm" onclick="App.monthlyReportDialog()">${ic("file-report")} รายงาน</button><div class="seg">${[[3, "3 เดือน"], [6, "6 เดือน"], [12, "12 เดือน"]].map(([n, t]) => `<button class="${S.statRange === n ? "on" : ""}" onclick="S_statRange(${n})">${t}</button>`).join("")}</div>`);
    const months = lastMonths(S.statRange);
    const from = months[0] + "-01";
    const d = S.data;
    const evAll = d.events.filter((e) => e.source !== "paper" && e.caseStatus !== "cancelled" && e.period !== "pilot");
    const ev = evAll.filter((e) => String(e.actualOpenedAt).slice(0, 10) >= from);
    const target = Number(d.settings.RESPONSE_TARGET_MIN || 5);
    const rs = ev.map(resp).filter(ok24), rd = ev.map(ready).filter(ok24);
    const within = rs.filter((x) => x <= target).length;

    // monthly
    const byM = (fn) => months.map((m) => ev.filter((e) => String(e.actualOpenedAt).slice(0, 7) === m).filter(fn).length);
    const inIds = new Set(d.locations.filter((l) => l.zone !== "out").map((l) => l.id));
    const opensIn = byM((e) => inIds.has(e.locationId) || !e.locationId), opensOut = byM((e) => e.locationId && !inIds.has(e.locationId));
    const medBy = (fn) => months.map((m) => { const a = ev.filter((e) => String(e.actualOpenedAt).slice(0, 7) === m).map(fn).filter(ok24); return a.length ? Math.round(med(a) * 10) / 10 : null; });
    // locations
    const locCount = {};
    ev.forEach((e) => { const k = e.locationName || e.boxCode || "ไม่ระบุ"; locCount[k] = (locCount[k] || 0) + 1; });
    const locRows = Object.entries(locCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => { const r = ev.filter((e) => (e.locationName || e.boxCode) === k).map(resp).filter(ok24); return [k, v, r.length ? `ตอบสนอง ${r1(med(r))} น.` : ""]; });
    // reasons
    const rc = {};
    ev.forEach((e) => { const k = e.reasonCategory || "ไม่ระบุ"; rc[k] = (rc[k] || 0) + 1; });
    const reasons = Object.entries(rc).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
    // drugs used
    const du = {};
    ev.forEach((e) => (e.itemsUsedJson || []).forEach((it) => { const k = `${it.drugName} ${it.strength || ""}`.trim(); du[k] = (du[k] || 0) + Number(it.qty || 0); }));
    const drugRows = Object.entries(du).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, v, ""]);
    // expiry forecast
    const nd = nearDays();
    const items = d.boxes.flatMap((b) => b.items.map((it) => ({ ...it, box: b })));
    const expired = items.filter((it) => it.expiryDate && daysUntil(it.expiryDate) < 0).length;
    const fut = lastMonths(1).concat(Array.from({ length: 5 }, (_, i) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() + i + 1); return mkey(x); }));
    const expBy = fut.map((m) => items.filter((it) => it.expiryDate && String(it.expiryDate).slice(0, 7) === m && daysUntil(it.expiryDate) >= 0).length);
    // inspections
    const overdue = d.boxes.filter((b) => b.inspectionOverdue).length;
    const thisMonth = mkey(new Date());
    const inspectedThisMonth = d.boxes.filter((b) => b.lastInspectedAt && String(b.lastInspectedAt).slice(0, 7) === thisMonth).length;
    const readyBoxes = d.boxes.filter((b) => b.state === "ready").length;

    $("#content").innerHTML = `
      <div class="grid grid-4">
        ${kpi("เปิดกล่องยา", ev.length, "urgent", "danger", `${S.statRange} เดือนล่าสุด · เฉลี่ย ${r1(ev.length / S.statRange)} ครั้ง/เดือน`, " ครั้ง")}
        ${kpi("ตอบสนองมัธยฐาน", r1(med(rs)), "clock-bolt", "violet", `ภายใน ${target} นาที ${rs.length ? Math.round((within / rs.length) * 100) : 0}% ของเคส`, rs.length ? " นาที" : "")}
        ${kpi("เติมยาจนพร้อมใช้", rd.length ? r1(med(rd) / 60) : "–", "package-import", "accent", "มัธยฐาน เปิดใช้จริง → พร้อมใช้", rd.length ? " ชม." : "")}
        ${kpi("กล่องพร้อมใช้ตอนนี้", `${Math.round((readyBoxes / Math.max(1, d.boxes.length)) * 100)}`, "circle-check", "ok", `${readyBoxes} จาก ${d.boxes.length} กล่อง`, "%")}
      </div>
      <div class="grid grid-2 section">
        ${chartCard("การเปิดกล่องยารายเดือน", "แยกใน / นอก รพ.", barChart(months.map(mlabel), [{ name: "ใน รพ.", values: opensIn, color: C.brand }, { name: "นอก รพ.", values: opensOut, color: C.warn }]))}
        ${chartCard("เวลาตอบสนองรายเดือน (มัธยฐาน)", "นาที · ส่งแจ้งเตือน → เภสัชกรรับทราบ", lineChart(months.map(mlabel), [{ name: "ตอบสนอง (นาที)", values: medBy(resp), color: C.violet }], { target, unit: " น." }))}
        ${chartCard("จุดที่เปิดใช้บ่อย", "จำนวนครั้ง · เวลาตอบสนองมัธยฐาน", hbars(locRows, C.brand, ""))}
        ${chartCard("เหตุผลการเปิดใช้", "", donut(reasons))}
        ${chartCard("ช่วงเวลาที่เปิดใช้", "วันในสัปดาห์ × ช่วงเวลา", heatmap(ev))}
        ${chartCard("ยาที่ใช้บ่อย", "รวมจำนวนที่ระบุตอนเปิดกล่อง/เติมยา", hbars(drugRows, C.blue, ""))}
        ${chartCard("ยาที่จะหมดอายุ 6 เดือนข้างหน้า", `หมดอายุแล้ว ${expired} รายการ · ใกล้หมด (≤${nd} วัน) แสดงในหน้าภาพรวม`, barChart(fut.map(mlabel), [{ name: "รายการยา", values: expBy, color: C.warn }], { h: 170 }))}
        ${chartCard("การตรวจกล่องประจำเดือน", "เดือนนี้", `<div class="grid grid-3" style="gap:10px">
            <div class="mini"><div class="xs faint">ตรวจแล้วเดือนนี้</div><div class="mv">${inspectedThisMonth}<small>/${d.boxes.length}</small></div><div class="bar mt-8"><span style="width:${(inspectedThisMonth / Math.max(1, d.boxes.length)) * 100}%"></span></div></div>
            <div class="mini"><div class="xs faint">เลยกำหนดตรวจ</div><div class="mv" style="color:${overdue ? "var(--warn-text)" : "var(--ok-text)"}">${overdue}<small> กล่อง</small></div></div>
            <div class="mini"><div class="xs faint">ยาหมดอายุในกล่อง</div><div class="mv" style="color:${expired ? "var(--danger-text)" : "var(--ok-text)"}">${expired}<small> รายการ</small></div></div></div>
            <div class="mt-16">${d.boxes.filter((b) => b.inspectionOverdue).slice(0, 5).map((b) => `<div class="row between small" style="padding:4px 0"><span>${esc(b.boxCode)} <span class="faint">${esc(b.location)}</span></span><span class="pill warn">ครบกำหนด ${fmtD(b.inspectionDate)}</span></div>`).join("") || `<div class="small faint">ตรวจตามรอบครบทุกกล่อง</div>`}</div>`)}
      </div>
      <div class="xs faint mt-12">ไม่นับเคสที่ยกเลิก ข้อมูลช่วงนำร่อง และค่าที่เกิน 24 ชั่วโมง · คำนวณจากเคสล่าสุด 400 รายการ</div>`;
  };
  window.S_statRange = (n) => { S.statRange = n; App.render(); };

  // =================================================================
  // รายงานผลการดำเนินงาน (A4 ทางการ · ไม่มี HN)
  // ช่วงรายงาน: รายเดือน / รายไตรมาส / ปีงบประมาณ (1 ต.ค. – 30 ก.ย.) / กำหนดวันที่เอง
  // =================================================================
  const TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const thDateFull = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return `${d} ${TH_FULL[m - 1]} ${y + 543}`; };
  const thMonthFull = (k) => `${TH_FULL[+k.slice(5) - 1]} ${+k.slice(0, 4) + 543}`;
  const curFY = () => { const d = new Date(); return d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0); }; // ปีงบ พ.ศ.
  const fyRange = (fy) => { const ce = fy - 543; return { from: `${ce - 1}-10-01`, to: `${ce}-09-30` }; };
  const qRange = (fy, q) => { const ce = fy - 543; const m0 = [[ce - 1, 10], [ce, 1], [ce, 4], [ce, 7]][q - 1]; const end = new Date(m0[0], m0[1] + 2, 0); return { from: `${m0[0]}-${pad2(m0[1])}-01`, to: ymd(end) }; };
  const monthsBetween = (from, to) => { const out = []; let y = +from.slice(0, 4), m = +from.slice(5, 7); const ty = +to.slice(0, 4), tm = +to.slice(5, 7); while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${pad2(m)}`); m++; if (m > 12) { m = 1; y++; } } return out; };
  const localKey = (iso) => (iso ? ymd(new Date(iso)) : "");

  App.monthlyReportDialog = async function () {
    S.rp = S.rp || { type: "month", appendix: true };
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthOpts = Array.from({ length: 24 }, (_, i) => mkey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const defMonth = now.getDate() <= 10 ? mkey(prev) : mkey(now);
    const fy = curFY();
    const fyOpts = Array.from({ length: 5 }, (_, i) => fy - i);
    const curQ = [2, 2, 2, 3, 3, 3, 4, 4, 4, 1, 1, 1][now.getMonth()];
    const sel = (id, opts, v) => `<select class="input" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(k) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    const body = `<div class="seg rp-seg" style="margin-top:4px">${[["month", "รายเดือน"], ["quarter", "รายไตรมาส"], ["fy", "ปีงบประมาณ"], ["custom", "กำหนดเอง"]].map(([k, l]) => `<button type="button" data-t="${k}" class="${S.rp.type === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="rp-f mt-12" data-f="month"><div class="field"><span>เดือน</span>${sel("rpMonth", monthOpts.map((m) => [m, thMonthFull(m)]), defMonth)}</div></div>
      <div class="rp-f mt-12" data-f="quarter"><div class="form-grid"><div class="field"><span>ปีงบประมาณ</span>${sel("rpQFy", fyOpts.map((y) => [y, `พ.ศ. ${y}`]), fy)}</div><div class="field"><span>ไตรมาส</span>${sel("rpQ", [[1, "ไตรมาส 1 (ต.ค.–ธ.ค.)"], [2, "ไตรมาส 2 (ม.ค.–มี.ค.)"], [3, "ไตรมาส 3 (เม.ย.–มิ.ย.)"], [4, "ไตรมาส 4 (ก.ค.–ก.ย.)"]], curQ)}</div></div></div>
      <div class="rp-f mt-12" data-f="fy"><div class="field"><span>ปีงบประมาณ</span>${sel("rpFy", fyOpts.map((y) => [y, `พ.ศ. ${y} (1 ต.ค. ${y - 1} – 30 ก.ย. ${y})`]), fy)}</div></div>
      <div class="rp-f mt-12" data-f="custom"><div class="form-grid"><div class="field"><span>ตั้งแต่วันที่</span><input class="input" type="date" id="rpFrom" value="${ymd(new Date(now.getFullYear(), now.getMonth(), 1))}"></div><div class="field"><span>ถึงวันที่</span><input class="input" type="date" id="rpTo" value="${ymd(now)}"></div></div></div>
      <label class="check mt-12"><input type="checkbox" id="rpApp" ${S.rp.appendix ? "checked" : ""}> แนบภาคผนวก: รายการเคสเปิดกล่องทั้งหมด</label>
      <div class="xs faint mt-8">รายงานรูปแบบ A4 พร้อมลงนาม · ไม่มี HN ผู้ป่วย · พิมพ์หรือบันทึกเป็น PDF ได้จากหน้ารายงาน</div>`;
    const pr = X.dialog({ title: "รายงานผลการดำเนินงาน", body, confirm: "สร้างรายงาน" });
    const sync = () => document.querySelectorAll(".rp-f").forEach((el) => (el.style.display = el.dataset.f === S.rp.type ? "" : "none"));
    setTimeout(() => {
      sync();
      document.querySelectorAll(".rp-seg button").forEach((b) => (b.onclick = () => { S.rp.type = b.dataset.t; document.querySelectorAll(".rp-seg button").forEach((x) => x.classList.toggle("on", x === b)); sync(); }));
    }, 20);
    // อ่านค่าก่อน dialog ปิด (dialog ลบ DOM ทิ้งเมื่อกดยืนยัน)
    let picked = null;
    const grab = () => {
      const v = (id) => document.getElementById(id)?.value;
      S.rp.appendix = !!document.getElementById("rpApp")?.checked;
      if (S.rp.type === "month") { const m = v("rpMonth"); const last = new Date(+m.slice(0, 4), +m.slice(5, 7), 0); picked = { from: `${m}-01`, to: ymd(last), label: `ประจำเดือน${thMonthFull(m)}`, short: thMonthFull(m) }; }
      else if (S.rp.type === "quarter") { const y = +v("rpQFy"), q = +v("rpQ"); picked = { ...qRange(y, q), label: `ไตรมาสที่ ${q} ปีงบประมาณ ${y}`, short: `ไตรมาส ${q}/${y}` }; }
      else if (S.rp.type === "fy") { const y = +v("rpFy"); picked = { ...fyRange(y), label: `ประจำปีงบประมาณ ${y}`, short: `ปีงบ ${y}` }; }
      else { const a = v("rpFrom"), b = v("rpTo"); picked = a && b ? { from: a <= b ? a : b, to: a <= b ? b : a, label: `ระหว่างวันที่ ${thDateFull(a <= b ? a : b)} ถึง ${thDateFull(a <= b ? b : a)}`, short: `${a}_${b}` } : null; }
    };
    setTimeout(() => { const ok = document.querySelector('.dialog [data-r="1"]'); if (ok) ok.addEventListener("click", grab, { capture: true }); }, 20);
    if (!(await pr) || !picked) return;
    App.printReport(picked, S.rp.appendix);
  };
  App.printMonthlyReport = (month) => { const last = new Date(+month.slice(0, 4), +month.slice(5, 7), 0); return App.printReport({ from: `${month}-01`, to: ymd(last), label: `ประจำเดือน${thMonthFull(month)}`, short: thMonthFull(month) }, true); };

  App.printReport = async function (P, appendix = true) {
    const w = window.open("", "_blank");
    if (!w) return X.fail(new Error("เบราว์เซอร์บล็อกหน้าต่างรายงาน กรุณาอนุญาต pop-up"));
    w.document.write(`<!doctype html><meta charset="utf-8"><title>กำลังสร้างรายงาน…</title><body style="font-family:sans-serif;padding:40px;color:#555">กำลังสร้างรายงาน…</body>`);
    let r;
    try { r = await api("apiReport", S.token, P.from, P.to); } catch (e) { w.close(); return X.fail(e); }
    const d = S.data, s = d.settings;
    const target = Number(s.RESPONSE_TARGET_MIN || 5);
    const months = monthsBetween(P.from, P.to);
    const multi = months.length > 1;
    const all = r.events;
    const cancelled = all.filter((e) => e.caseStatus === "cancelled");
    const ev = all.filter((e) => e.caseStatus !== "cancelled");
    const inIds = new Set(d.locations.filter((l) => l.zone !== "out").map((l) => l.id));
    const isIn = (e) => inIds.has(e.locationId) || !e.locationId;
    const nIn = ev.filter(isIn).length, nOut = ev.length - nIn;
    const q = (a, p) => { if (!a.length) return null; const x = [...a].sort((m, n) => m - n), i = (x.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return x[lo] + (x[hi] - x[lo]) * (i - lo); };
    const rs = ev.map(resp).filter(ok24), rd = ev.map(ready).filter(ok24).map((x) => x / 60);
    const within = rs.filter((x) => x <= target).length;
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const fmtPct = (v) => (v === null ? "–" : `${r1(v)}%`);
    const notifEligible = ev.filter((e) => e.notificationStatus !== "legacy_unknown" && e.source !== "paper");
    const notifOk = notifEligible.filter((e) => e.notificationSentAt).length;
    const pending = ev.filter((e) => e.caseStatus === "open" || e.caseStatus === "acknowledged").length;
    const offline = ev.filter((e) => e.offlineQueued).length;
    const nBoxes = d.boxes.length;
    // การตรวจตามรอบ: รายเดือน (กล่องที่ได้รับการตรวจ / กล่องทั้งหมด) ของเดือนที่ผ่านมาแล้ว
    const ins = r.inspections;
    const thisM = mkey(new Date());
    const insBy = {}; ins.forEach((i) => { const k = localKey(i.inspectedAt).slice(0, 7); (insBy[k] = insBy[k] || new Set()).add(i.boxId); });
    const covMonths = months.filter((m) => m <= thisM);
    const covDone = covMonths.reduce((a, m) => a + Math.min(nBoxes, (insBy[m] || new Set()).size), 0);
    const covPct = pct(covDone, nBoxes * covMonths.length);
    // ณ วันที่พิมพ์
    const nd = Math.max(60, nearDays());
    const exp = d.boxes.flatMap((b) => b.items.map((it) => ({ ...it, boxCode: b.boxCode, loc: b.location, days: it.expiryDate ? daysUntil(it.expiryDate) : null }))).filter((x) => x.days !== null && x.days <= nd).sort((a, b) => a.days - b.days);
    const expiredNow = exp.filter((x) => x.days < 0).length;
    const readyNow = d.boxes.filter((b) => b.state === "ready").length;
    // KPI table
    const verdict = (ok) => (ok === null ? `<span class="v na">–</span>` : ok ? `<span class="v ok">บรรลุ</span>` : `<span class="v no">ไม่บรรลุ</span>`);
    const kpis = [
      ["เวลาตอบสนองของเภสัชกร (มัธยฐาน) นับจากส่งแจ้งเตือนถึงกดรับทราบ", `≤ ${target} นาที`, rs.length ? `${r1(med(rs))} นาที (IQR ${r1(q(rs, 0.25))}–${r1(q(rs, 0.75))}, n=${rs.length})` : "ไม่มีข้อมูล", rs.length ? med(rs) <= target : null],
      [`ร้อยละของเคสที่ตอบสนองภายใน ${target} นาที`, "ติดตามแนวโน้ม", rs.length ? `${fmtPct(pct(within, rs.length))} (${within}/${rs.length})` : "ไม่มีข้อมูล", null],
      ["ระยะเวลาตั้งแต่เปิดใช้จนกล่องพร้อมใช้ (มัธยฐาน)", "ติดตามแนวโน้ม", rd.length ? `${r1(med(rd))} ชั่วโมง (IQR ${r1(q(rd, 0.25))}–${r1(q(rd, 0.75))}, n=${rd.length})` : "ไม่มีข้อมูล", null],
      ["ร้อยละของการเปิดกล่องที่ส่งแจ้งเตือน LINE สำเร็จ", "100%", notifEligible.length ? `${fmtPct(pct(notifOk, notifEligible.length))} (${notifOk}/${notifEligible.length})` : "ไม่มีข้อมูล", notifEligible.length ? notifOk === notifEligible.length : null],
      ["ร้อยละของกล่องยาที่ได้รับการตรวจสอบประจำเดือนตามรอบ", "100%", covMonths.length ? `${fmtPct(covPct)} (${covDone}/${nBoxes * covMonths.length} กล่อง-เดือน)` : "ยังไม่ถึงรอบ", covMonths.length ? covPct >= 100 : null],
      ["จำนวนรายการยาหมดอายุที่ค้างอยู่ในกล่อง (ณ วันที่จัดทำรายงาน)", "0 รายการ", `${expiredNow} รายการ`, expiredNow === 0],
      ["ร้อยละของกล่องยาที่พร้อมใช้ (ณ วันที่จัดทำรายงาน)", "100%", `${fmtPct(pct(readyNow, nBoxes))} (${readyNow}/${nBoxes} กล่อง)`, nBoxes ? readyNow === nBoxes : null],
    ];
    // รายเดือน
    const monthRows = months.map((m) => {
      const a = ev.filter((e) => localKey(e.actualOpenedAt).slice(0, 7) === m);
      const r_ = a.map(resp).filter(ok24), d_ = a.map(ready).filter(ok24).map((x) => x / 60);
      const done = Math.min(nBoxes, (insBy[m] || new Set()).size);
      return { m, n: a.length, nin: a.filter(isIn).length, r: r_.length ? med(r_) : null, w: r_.length ? pct(r_.filter((x) => x <= target).length, r_.length) : null, d: d_.length ? med(d_) : null, ins: m <= thisM ? `${done}/${nBoxes}` : "–" };
    });
    // จุด / เหตุผล / ยา
    const group = (arr, key) => { const g = {}; arr.forEach((e) => { const k = key(e); (g[k] = g[k] || []).push(e); }); return Object.entries(g).sort((a, b) => b[1].length - a[1].length); };
    const locRows = group(ev, (e) => e.locationName || e.boxCode || "ไม่ระบุ").map(([k, a]) => { const r_ = a.map(resp).filter(ok24), d_ = a.map(ready).filter(ok24).map((x) => x / 60); return [k, isIn(a[0]) ? "ใน รพ." : "นอก รพ.", a.length, pct(a.length, ev.length), r_.length ? med(r_) : null, d_.length ? med(d_) : null]; });
    const reasonRows = group(ev, (e) => e.reasonCategory || "ไม่ระบุ").map(([k, a]) => [k, a.length, pct(a.length, ev.length)]);
    const du = {}; ev.forEach((e) => (e.itemsUsedJson || []).forEach((it) => { const k = `${it.drugName} ${it.strength || ""}`.trim(); du[k] = du[k] || { q: 0, c: 0 }; du[k].q += Number(it.qty || 0); du[k].c++; }));
    const drugRows = Object.entries(du).sort((a, b) => b[1].q - a[1].q).slice(0, 15);
    // การตรวจ: เดือนเดียว = รายครั้ง · หลายเดือน = สรุปรายกล่อง
    const insSummary = d.boxes.map((b) => { const a = ins.filter((i) => i.boxId === b.id); const last = a[a.length - 1]; return { b, n: a.length, last, exp: a.reduce((x, i) => x + (i.itemsExpired || 0), 0), miss: a.reduce((x, i) => x + (i.itemsMissing || 0), 0), notReady: a.filter((i) => !i.isReady).length }; });
    // ข้อสังเกตอัตโนมัติ
    const obs = [];
    if (rs.length && med(rs) > target) obs.push(`เวลาตอบสนองมัธยฐาน ${r1(med(rs))} นาที สูงกว่าเป้าหมาย ${target} นาที ควรทบทวนการรับแจ้งเตือนในแต่ละเวร`);
    if (notifEligible.length && notifOk < notifEligible.length) obs.push(`มีเคสที่ส่งแจ้งเตือน LINE ไม่สำเร็จ ${notifEligible.length - notifOk} เคส ควรตรวจสอบโควตาและการตั้งค่า LINE OA`);
    if (covMonths.length && covPct < 100) obs.push(`การตรวจสอบกล่องยาตามรอบยังไม่ครบ (${fmtPct(covPct)}) กล่องที่ยังไม่ได้ตรวจในเดือนล่าสุด: ${d.boxes.filter((b) => !(insBy[covMonths[covMonths.length - 1]] || new Set()).has(b.id)).map((b) => b.boxCode).slice(0, 8).join(", ") || "-"}`);
    if (expiredNow) obs.push(`พบยาหมดอายุค้างอยู่ในกล่อง ${expiredNow} รายการ ควรเปลี่ยนโดยเร็ว`);
    if (pending) obs.push(`มีเคสที่ยังไม่ปิด (รอรับทราบ/รอเติมยา) ${pending} เคส ณ วันที่จัดทำรายงาน`);
    if (offline) obs.push(`มีการบันทึกขณะไม่มีอินเทอร์เน็ต ${offline} เคส ควรตรวจสอบสัญญาณอินเทอร์เน็ตในจุดดังกล่าว`);
    if (!obs.length) obs.push("ไม่พบประเด็นที่ต้องติดตามจากข้อมูลในระบบ");
    // บทสรุปผู้บริหาร
    const topLoc = locRows[0], topReason = reasonRows[0];
    const summary = ev.length
      ? `ในช่วง${P.label.replace(/^ประจำ/, "")} มีการเปิดใช้กล่องยาฉุกเฉินทั้งสิ้น <b>${ev.length} ครั้ง</b> (ภายในโรงพยาบาล ${nIn} ครั้ง ภายนอกโรงพยาบาล ${nOut} ครั้ง)${cancelled.length ? ` และมีเคสที่ยกเลิก ${cancelled.length} ครั้ง` : ""} จุดที่เปิดใช้มากที่สุดคือ ${esc(topLoc[0])} (${topLoc[2]} ครั้ง) เหตุผลที่พบมากที่สุดคือ ${esc(topReason[0])} (${topReason[1]} ครั้ง) ` +
        (rs.length ? `เภสัชกรรับทราบการแจ้งเตือนในเวลามัธยฐาน <b>${r1(med(rs))} นาที</b> ซึ่ง${med(rs) <= target ? "อยู่ภายใน" : "เกิน"}เป้าหมาย ${target} นาที โดยร้อยละ ${r1(pct(within, rs.length))} ของเคสตอบสนองภายในเป้าหมาย ` : "") +
        (rd.length ? `และกล่องยากลับมาพร้อมใช้ในเวลามัธยฐาน ${r1(med(rd))} ชั่วโมงหลังเปิดใช้ ` : "") +
        `${covMonths.length ? `การตรวจสอบกล่องยาประจำเดือนดำเนินการได้ร้อยละ ${r1(covPct)} ` : ""}ณ วันที่จัดทำรายงาน มีกล่องยาพร้อมใช้ ${readyNow} จาก ${nBoxes} กล่อง${expiredNow ? ` และมียาหมดอายุค้างในกล่อง ${expiredNow} รายการ` : " และไม่มียาหมดอายุค้างในกล่อง"}`
      : `ในช่วง${P.label.replace(/^ประจำ/, "")} ไม่มีการเปิดใช้กล่องยาฉุกเฉิน ${covMonths.length ? `การตรวจสอบกล่องยาประจำเดือนดำเนินการได้ร้อยละ ${r1(covPct)} ` : ""}ณ วันที่จัดทำรายงาน มีกล่องยาพร้อมใช้ ${readyNow} จาก ${nBoxes} กล่อง`;

    // ---------- HTML ----------
    let tn = 0;
    const cap = (t) => `<div class="cap">ตารางที่ ${++tn} ${t}</div>`;
    const emptyRow = (n, t = "ไม่มีข้อมูล") => `<tr><td colspan="${n}" class="em">${t}</td></tr>`;
    const num = (v, digits = 1) => (v === null || v === undefined ? "–" : digits ? r1(v) : String(v));
    const nowIso = new Date().toISOString();
    const me = S.user || {};
    const dept = s.DEPARTMENT_NAME || "กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค";
    const hosp = s.HOSPITAL_NAME || "";
    let sec = 0;
    const H2 = (t) => `<h2>${++sec}. ${t}</h2>`;
    const html = `
<div class="doc">
  <header class="hd">
    <img class="hlogo" src="${X.hospLogoAbs()}" alt="" onerror="this.style.display='none'">
    <div class="org">${esc(dept)}<br>${esc(hosp)}</div>
  </header>
  <div class="title">รายงานผลการดำเนินงานระบบบริหารจัดการกล่องยาฉุกเฉิน<br><span>(Smart Emergency Box: SEB)</span></div>
  <div class="period">${esc(P.label)}</div>
  <div class="range">ข้อมูลระหว่างวันที่ ${thDateFull(P.from)} ถึงวันที่ ${thDateFull(P.to)} · จัดทำเมื่อ ${thDateFull(localKey(nowIso))} เวลา ${X.fmtT(nowIso)} น.</div>

  ${H2("บทสรุปสำหรับผู้บริหาร")}
  <p class="para">${summary}</p>

  ${H2("ผลการดำเนินงานตามตัวชี้วัด")}
  ${cap("ผลการดำเนินงานเทียบกับเป้าหมาย")}
  <table><thead><tr><th class="c" style="width:7%">ลำดับ</th><th>ตัวชี้วัด</th><th class="c" style="width:14%">เป้าหมาย</th><th style="width:30%">ผลการดำเนินงาน</th><th class="c" style="width:11%">ผลการประเมิน</th></tr></thead>
  <tbody>${kpis.map(([a, b, c, ok], i) => `<tr><td class="c">${i + 1}</td><td>${a}</td><td class="c">${b}</td><td>${c}</td><td class="c">${verdict(ok)}</td></tr>`).join("")}</tbody></table>

  ${multi ? `${H2("ผลการดำเนินงานรายเดือน")}
  ${cap("ผลการดำเนินงานจำแนกรายเดือน")}
  <table><thead><tr><th>เดือน</th><th class="n">เปิดกล่อง (ครั้ง)</th><th class="n">ใน / นอก รพ.</th><th class="n">ตอบสนอง มัธยฐาน (นาที)</th><th class="n">ภายในเป้า (%)</th><th class="n">พร้อมใช้ มัธยฐาน (ชม.)</th><th class="n">ตรวจกล่อง (กล่อง)</th></tr></thead>
  <tbody>${monthRows.map((x) => x.m > thisM ? `<tr class="fut"><td class="nw">${thMonthFull(x.m)}</td><td colspan="6" class="em">ยังไม่ถึงช่วงเวลา</td></tr>` : `<tr><td class="nw">${thMonthFull(x.m)}</td><td class="n">${x.n}</td><td class="n">${x.nin} / ${x.n - x.nin}</td><td class="n">${num(x.r)}</td><td class="n">${num(x.w)}</td><td class="n">${num(x.d)}</td><td class="n">${x.ins}</td></tr>`).join("")}
  <tr class="tot"><td>รวม / ภาพรวม</td><td class="n">${ev.length}</td><td class="n">${nIn} / ${nOut}</td><td class="n">${rs.length ? r1(med(rs)) : "–"}</td><td class="n">${rs.length ? r1(pct(within, rs.length)) : "–"}</td><td class="n">${rd.length ? r1(med(rd)) : "–"}</td><td class="n">${covMonths.length ? `${covDone}/${nBoxes * covMonths.length}` : "–"}</td></tr></tbody></table>` : ""}

  ${H2("การเปิดใช้กล่องยาฉุกเฉิน")}
  ${cap("การเปิดใช้กล่องยาจำแนกตามจุดวางกล่อง")}
  <table><thead><tr><th class="c" style="width:7%">ลำดับ</th><th>จุดวางกล่อง</th><th class="c">พื้นที่</th><th class="n">จำนวน (ครั้ง)</th><th class="n">ร้อยละ</th><th class="n">ตอบสนอง มัธยฐาน (นาที)</th><th class="n">พร้อมใช้ มัธยฐาน (ชม.)</th></tr></thead>
  <tbody>${locRows.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td class="n">${x[2]}</td><td class="n">${num(x[3])}</td><td class="n">${num(x[4])}</td><td class="n">${num(x[5])}</td></tr>`).join("") || emptyRow(7, "ไม่มีการเปิดใช้กล่องยาในช่วงนี้")}
  ${locRows.length ? `<tr class="tot"><td></td><td>รวม</td><td></td><td class="n">${ev.length}</td><td class="n">100</td><td class="n">${rs.length ? r1(med(rs)) : "–"}</td><td class="n">${rd.length ? r1(med(rd)) : "–"}</td></tr>` : ""}</tbody></table>

  <div class="two">
    <div>${cap("การเปิดใช้จำแนกตามเหตุผล")}
    <table><thead><tr><th>เหตุผล</th><th class="n">ครั้ง</th><th class="n">ร้อยละ</th></tr></thead><tbody>${reasonRows.map((x) => `<tr><td>${esc(x[0])}</td><td class="n">${x[1]}</td><td class="n">${num(x[2])}</td></tr>`).join("") || emptyRow(3)}</tbody></table></div>
    <div>${cap("รายการยาที่ใช้จากกล่อง")}
    <table><thead><tr><th>รายการยา</th><th class="n">จำนวนที่ใช้</th><th class="n">เคส</th></tr></thead><tbody>${drugRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${v.q}</td><td class="n">${v.c}</td></tr>`).join("") || emptyRow(3, "ไม่มีการระบุยาที่ใช้")}</tbody></table></div>
  </div>

  ${H2("การตรวจสอบกล่องยาประจำเดือน")}
  ${multi
    ? `${cap("สรุปผลการตรวจสอบรายกล่อง")}
  <table><thead><tr><th>กล่อง</th><th>จุดวางกล่อง</th><th class="n">ตรวจ (ครั้ง)</th><th>ตรวจล่าสุด</th><th class="n">พบหมดอายุ (รายการ)</th><th class="n">พบขาด (รายการ)</th><th class="n">ไม่พร้อมใช้ (ครั้ง)</th></tr></thead>
  <tbody>${insSummary.map((x) => `<tr><td>${esc(x.b.boxCode)}</td><td>${esc(x.b.location || "")}</td><td class="n">${x.n}</td><td>${x.last ? thDateFull(localKey(x.last.inspectedAt)) : `<span class="bad">ไม่ได้ตรวจ</span>`}</td><td class="n">${x.exp}</td><td class="n">${x.miss}</td><td class="n">${x.notReady}</td></tr>`).join("") || emptyRow(7)}</tbody></table>`
    : `${cap("ผลการตรวจสอบกล่องยา")}
  <table><thead><tr><th>กล่อง</th><th>วันที่ตรวจ</th><th>ผู้ตรวจ</th><th class="n">รายการ</th><th class="n">หมดอายุ</th><th class="n">ใกล้หมด</th><th class="n">ขาด</th><th class="c">ผล</th><th>ปัญหาที่พบ</th></tr></thead>
  <tbody>${ins.map((i) => `<tr><td>${esc(i.boxCode || "")}</td><td>${fmtD(i.inspectedAt)}</td><td>${esc(i.inspectorName || "")}</td><td class="n">${i.itemsChecked ?? "–"}</td><td class="n">${i.itemsExpired || 0}</td><td class="n">${i.itemsNearExpiry || 0}</td><td class="n">${i.itemsMissing || 0}</td><td class="c">${i.isReady ? "พร้อมใช้" : `<span class="bad">ไม่พร้อม</span>`}</td><td>${esc(i.problemNote || "")}</td></tr>`).join("") || emptyRow(9, "ไม่มีการตรวจสอบในช่วงนี้")}
  ${d.boxes.filter((b) => !ins.some((i) => i.boxId === b.id)).map((b) => `<tr class="miss"><td>${esc(b.boxCode)}</td><td colspan="8">ยังไม่ได้ตรวจในเดือนนี้ · ${esc(b.location || "")}</td></tr>`).join("")}</tbody></table>`}

  ${H2(`ยาหมดอายุและใกล้หมดอายุภายใน ${nd} วัน (ณ วันที่จัดทำรายงาน)`)}
  ${cap("รายการยาที่ต้องติดตามวันหมดอายุ")}
  <table><thead><tr><th class="c" style="width:7%">ลำดับ</th><th>รายการยา</th><th>กล่อง</th><th>Lot</th><th>วันหมดอายุ</th><th class="n">คงเหลือ</th></tr></thead>
  <tbody>${exp.map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.drugName)} ${esc(x.strength || "")}</td><td>${esc(x.boxCode)}</td><td>${esc(x.lot || "-")}</td><td>${thDateFull(x.expiryDate)}</td><td class="n ${x.days < 0 ? "bad" : x.days <= 15 ? "warn" : ""}">${x.days < 0 ? "หมดอายุแล้ว" : `${x.days} วัน`}</td></tr>`).join("") || emptyRow(6, "ไม่มีรายการยาหมดอายุหรือใกล้หมดอายุ")}</tbody></table>

  ${H2("ปัญหา อุปสรรค และข้อเสนอแนะ")}
  <ol class="obs">${obs.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>
  <div class="lines"><div></div><div></div><div></div></div>

  <div class="sigs">
    <div class="sig">ลงชื่อ ......................................................... ผู้รายงาน<br>(${esc(me.displayName || ".........................................................")})<br>${esc(me.position || "ตำแหน่ง .........................................................")}<br>วันที่ ........./................./.............</div>
    <div class="sig">ลงชื่อ ......................................................... <br>(.........................................................)<br>หัวหน้า${esc(dept)}<br>วันที่ ........./................./.............</div>
  </div>
  <div class="sigs one"><div class="sig">☐ ทราบ &nbsp;&nbsp; ☐ อนุมัติ &nbsp;&nbsp; ☐ อื่น ๆ ..............................<br><br>ลงชื่อ .........................................................<br>(.........................................................)<br>ผู้อำนวยการ${esc(hosp)}<br>วันที่ ........./................./.............</div></div>

  <div class="foot-note">หมายเหตุ: เวลาตอบสนอง = เวลาที่ระบบส่งแจ้งเตือน LINE สำเร็จ ถึงเวลาที่เภสัชกรกดรับทราบ · ระยะเวลาพร้อมใช้ = เวลาเปิดใช้จริง ถึงเวลายืนยันเติมยาครบ · ไม่นับเคสที่ยกเลิกและค่าที่เกิน 24 ชั่วโมง · รายงานนี้ไม่มีข้อมูลระบุตัวผู้ป่วย · จัดทำจากระบบ SEB v${X.APP_VERSION}</div>

  ${appendix ? `<section class="appx">
  <h2>ภาคผนวก รายการเคสเปิดกล่องยาฉุกเฉิน</h2>
  <table class="sm"><thead><tr><th class="c">ลำดับ</th><th>รหัสเหตุการณ์</th><th>วันที่/เวลาเปิดใช้</th><th>กล่อง</th><th>จุดวางกล่อง</th><th>เหตุผล</th><th class="n">ตอบสนอง (นาที)</th><th class="n">พร้อมใช้ (ชม.)</th><th>สถานะ</th></tr></thead>
  <tbody>${all.map((e, i) => { const rr = resp(e), dd = ready(e); return `<tr${e.caseStatus === "cancelled" ? ' class="cx"' : ""}><td class="c">${i + 1}</td><td class="mono nw">${esc(e.eventCode || "")}</td><td class="nw">${fmtD(e.actualOpenedAt)} ${X.fmtT(e.actualOpenedAt)}</td><td>${esc(e.boxCode || "")}</td><td>${esc(e.locationName || "")}</td><td>${esc(e.reasonCategory || "")}</td><td class="n">${ok24(rr) ? r1(rr) : "–"}</td><td class="n">${ok24(dd) ? r1(dd / 60) : "–"}</td><td>${e.caseStatus === "cancelled" ? "ยกเลิก" : e.readyAt ? "พร้อมใช้" : e.acknowledgedAt ? "รอเติมยา" : "รอรับทราบ"}${e.offlineQueued ? " · ออฟไลน์" : ""}</td></tr>`; }).join("") || emptyRow(9, "ไม่มีการเปิดใช้กล่องยาในช่วงนี้")}</tbody></table></section>` : ""}
</div>`;
    // CSV (สรุป + รายเคส)
    const csvRows = all.map((e) => ({ event_code: e.eventCode, opened_at: e.actualOpenedAt, box: e.boxCode, location: e.locationName, zone: isIn(e) ? "in" : "out", reason: e.reasonCategory, response_min: ok24(resp(e)) ? r1(resp(e)) : "", ready_hr: ok24(ready(e)) ? r1(ready(e) / 60) : "", status: e.caseStatus, offline: e.offlineQueued ? 1 : 0 }));
    const csv = "﻿" + X.toCsv(csvRows.length ? csvRows : [{ event_code: "" }]);
    const fname = `SEB-report-${P.from}_${P.to}`;
    const css = `
      @page { size: A4; margin: 16mm 15mm 16mm 18mm; @bottom-right { content: "หน้า " counter(page) " / " counter(pages); font: 10pt Sarabun, "IBM Plex Sans Thai", sans-serif; color: #666; } @bottom-left { content: "รายงานผลการดำเนินงาน SEB · ${P.label.replace(/"/g, "")}"; font: 9pt Sarabun, "IBM Plex Sans Thai", sans-serif; color: #888; } }
      *{box-sizing:border-box} html{background:#e9e9ec} body{margin:0;font-family:Sarabun,"IBM Plex Sans Thai",sans-serif;color:#111;font-size:15px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;justify-content:center;padding:10px;background:#1f2430;color:#fff;font-family:"IBM Plex Sans Thai",sans-serif;font-size:13px}
      .bar button{font:inherit;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;background:#fff;color:#111;font-weight:600}.bar button.p{background:#d62839;color:#fff}.bar span{opacity:.75;margin-right:auto}
      .doc{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:16mm 15mm 18mm 18mm;box-shadow:0 6px 24px rgba(0,0,0,.18)}
      .hd{display:flex;align-items:center;gap:10px;border-bottom:2px solid #a11a2a;padding-bottom:8px}.hlogo{width:52px;height:52px;flex:none;object-fit:contain}
      .org{font-size:14px;font-weight:600;line-height:1.35}
      .title{text-align:center;font-size:21px;font-weight:700;margin-top:14px;line-height:1.35}.title span{font-size:16px;font-weight:600;color:#444}
      .period{text-align:center;font-size:18px;font-weight:700;margin-top:2px}.range{text-align:center;font-size:13px;color:#555;margin-top:2px}
      h2{font-size:16.5px;margin:16px 0 6px;font-weight:700;color:#111;border-left:4px solid #d62839;padding-left:8px;break-after:avoid}
      .para{text-indent:2.5em;text-align:justify;margin:0}
      .cap{font-size:13.5px;font-weight:700;margin:8px 0 3px;break-after:avoid}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px}th,td{border:1px solid #9a9a9a;padding:3px 6px;vertical-align:top;text-align:left}th{background:#f2e7e9;font-weight:700;text-align:center;vertical-align:middle}
      td.n,th.n{text-align:right;white-space:nowrap}td.c,th.c{text-align:center}tr{break-inside:avoid}thead{display:table-header-group}
      tr.tot td{font-weight:700;background:#faf6f7}tr.miss td{color:#a11a2a;font-style:italic}tr.cx td{color:#999;text-decoration:line-through}
      .em{text-align:center;color:#888}.bad{color:#b71c1c;font-weight:700}.warn{color:#a15c00;font-weight:600}.mono{font-family:"IBM Plex Mono",monospace;font-size:11px}.nw{white-space:nowrap}tr.fut td{color:#999}
      .v{display:inline-block;padding:0 8px;border-radius:4px;font-weight:700;font-size:12.5px}.v.ok{color:#1b5e20;background:#e6f4ea}.v.no{color:#b71c1c;background:#fdecea}.v.na{color:#888}
      .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      table.sm{font-size:11.5px}
      .obs{margin:0 0 4px;padding-left:22px}.obs li{margin-bottom:2px}
      .lines div{border-bottom:1px dotted #777;height:24px}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:30px;break-inside:avoid}.sigs.one{grid-template-columns:1fr;justify-items:center;margin-top:24px}
      .sig{text-align:center;line-height:2;font-size:14.5px}
      .foot-note{font-size:11.5px;color:#555;margin-top:22px;border-top:1px solid #ccc;padding-top:6px}
      .appx{break-before:page;margin-top:20px}
      @media print{html{background:#fff}.bar{display:none}.doc{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.appx{margin-top:0}}`;
    w.document.open();
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(fname)}</title>
      <link rel="stylesheet" href="${new URL("./vendor/fonts.css", location.href).href}">
      <link rel="preconnect" href="https://fonts.gstatic.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap">
      <style>${css}</style></head><body>
      <div class="bar"><span>รายงาน ${esc(P.label)} · ขนาด A4</span><button class="p" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><button onclick="dl()">ดาวน์โหลดข้อมูล (CSV)</button><button onclick="window.close()">ปิด</button></div>
      ${html}
      <script>const CSV=${JSON.stringify(csv)};function dl(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([CSV],{type:"text/csv;charset=utf-8"}));a.download=${JSON.stringify(fname + ".csv")};document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),500)}<\/script>
      </body></html>`);
    w.document.close();
  };

  // ---------------- mini trend on dashboard ----------------
  App.dashTrendHtml = function () {
    const d = S.data;
    const weeks = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const start = new Date(now); start.setDate(start.getDate() - start.getDay() - 7 * 7);
    for (let i = 0; i < 8; i++) { const a = new Date(start); a.setDate(a.getDate() + i * 7); const b = new Date(a); b.setDate(b.getDate() + 7); weeks.push([a, b]); }
    const ev = d.events.filter((e) => e.source !== "paper" && e.caseStatus !== "cancelled");
    const counts = weeks.map(([a, b]) => ev.filter((e) => { const t = new Date(e.actualOpenedAt); return t >= a && t < b; }).length);
    const meds = weeks.map(([a, b]) => { const r = ev.filter((e) => { const t = new Date(e.actualOpenedAt); return t >= a && t < b; }).map(resp).filter(ok24); return r.length ? Math.round(med(r) * 10) / 10 : null; });
    const labels = weeks.map(([a]) => `${a.getDate()}/${a.getMonth() + 1}`);
    return `<div class="grid grid-2 section">
      ${chartCard("การเปิดกล่อง 8 สัปดาห์ล่าสุด", "ครั้ง/สัปดาห์", barChart(labels, [{ name: "เปิดกล่อง", values: counts, color: C.brand }], { h: 150 }))}
      ${chartCard("เวลาตอบสนองรายสัปดาห์", `มัธยฐาน (นาที) · <a style="cursor:pointer" onclick="App.go('stats')">ดูสถิติทั้งหมด →</a>`, lineChart(labels, [{ name: "ตอบสนอง", values: meds, color: C.violet }], { h: 150, target: Number(d.settings.RESPONSE_TARGET_MIN || 5), unit: " น." }))}
    </div>`;
  };
})();
