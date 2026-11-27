/* =====================================================================
   SEB v2 — ส่งออกเอกสารวิจัยเป็น PDF / Word
   แบบสอบถาม · แบบสังเกต · เอกสารยินยอม — ทั้งแบบเปล่า และฉบับที่กรอก/ลงนามแล้ว
   - PDF: เปิดหน้าพิมพ์ของเบราว์เซอร์ → เลือก "บันทึกเป็น PDF" (รองรับภาษาไทยและลายมือชื่อครบ)
   - Word: ดาวน์โหลดไฟล์ .doc (เปิด/แก้ใน Word ได้ทันที · "บันทึกเป็น" .docx ได้)
   ===================================================================== */
(function () {
  const X = window.SEB;
  const { S, esc, ic, $, fmtDT, toast, drawer } = X;
  const App = window.App;

  const BASE_CSS = `
    h1{font-size:16pt;text-align:center;margin:0 0 4mm}
    h2{font-size:13pt;margin:6mm 0 2mm}
    h3{font-size:12pt;margin:3mm 0 1mm}
    p,li{line-height:1.55;margin:0 0 2mm}
    ol{padding-left:0;list-style:none}
    ul{margin:0 0 2mm 5mm;padding:0}
    .sub{text-align:center;margin:-2mm 0 5mm;color:#333}
    .meta{margin-top:6mm;font-size:9pt;color:#666;border-top:1px solid #ccc;padding-top:2mm}
    .cp{text-align:right;font-size:9pt;color:#666}
    table.grid{width:100%;border-collapse:collapse;margin:2mm 0 4mm}
    table.grid th,table.grid td{border:1px solid #444;padding:3px 6px;vertical-align:top}
    table.grid th{background:#eee;font-weight:bold;text-align:center}
    table.grid td.c{text-align:center;width:9%}
    table.grid td.n{text-align:center;white-space:nowrap}
    table.grid sup{font-size:70%}
    table.grid tr.sec td{background:#f5f5f5;font-weight:bold}
    table.sigs{width:100%;border-collapse:collapse;margin-top:8mm}
    table.sigs td{width:33%;text-align:center;vertical-align:bottom;padding:0 3mm;font-size:10pt}
    .line{height:16mm;border-bottom:1px solid #333;margin-bottom:1mm}
    .ans{border-bottom:1px dotted #555;min-height:7mm;margin:1mm 0 3mm;padding:0 1mm}
    .fill{border-bottom:1px solid #333;padding:0 2mm}
    .opt{margin-right:5mm;white-space:nowrap}`;
  const PRINT_CSS = `*{box-sizing:border-box}body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:11pt;color:#111;margin:0}@page{size:A4;margin:16mm}
    .pg{page-break-after:always}.pg:last-child{page-break-after:auto}@media screen{body{padding:16mm}.pg+.pg{margin-top:16mm;border-top:1px dashed #bbb;padding-top:16mm}}` + BASE_CSS;
  const WORD_CSS = `@page WordSection1{size:21cm 29.7cm;margin:2cm 2cm 2cm 2.5cm}div.WordSection1{page:WordSection1}
    body{font-family:"TH Sarabun New","TH SarabunPSK",sans-serif;font-size:16pt}` + BASE_CSS.replace(/(\d+(?:\.\d+)?)pt/g, (m, n) => `${Math.round(+n * 1.4)}pt`);

  const page = (html) => `<section class="pg">${html}</section>`;
  const fullHtml = (title, body) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${new URL("./vendor/fonts.css", location.href).href}"><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
  // Word: HTML ที่ Word เปิดได้ · ตัวแบ่งหน้าเป็นแบบที่ Word เข้าใจ
  const wordHtml = (title, body) => {
    const b = body.replace(/<\/section>\s*<section class="pg">/g, `<br clear="all" style="page-break-before:always">`).replace(/<\/?section[^>]*>/g, "")
      // Word/LibreOffice อ่านเส้นตารางจาก class ไม่ครบ → ใส่เป็น attribute/inline ให้ด้วย
      .replace(/<table class="grid">/g, `<table class="grid" border="1" cellspacing="0" cellpadding="5" width="100%" style="border-collapse:collapse;width:100%">`)
      .replace(/<th>([1-5]|ข้อ)<\/th>/g, `<th width="7%" style="border:1px solid #444;background:#eeeeee;width:7%">$1</th>`)
      .replace(/<th>/g, `<th style="border:1px solid #444;background:#eeeeee">`)
      .replace(/<td class="c">/g, `<td class="c" align="center" style="border:1px solid #444;text-align:center">`)
      .replace(/<tr class="sec"><td colspan="7">/g, `<tr class="sec"><td colspan="7" style="border:1px solid #444;background:#f5f5f5;font-weight:bold">`)
      .replace(/<td class="l">/g, `<td style="border:1px solid #444">`)
      .replace(/<td class="n"/g, `<td align="center" style="border:1px solid #444;text-align:center;white-space:nowrap"`)
      .replace(/<table class="sigs">/g, `<table class="sigs" width="100%" style="width:100%">`);
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${WORD_CSS}</style></head><body><div class="WordSection1">${b}</div></body></html>`;
  };

  // หน้าตัวอย่าง + ปุ่ม PDF / Word
  App.docPreview = ({ title, file, body, note = "" }) => {
    App._doc = { title, file: file || title, body };
    drawer(title, `<div class="xs faint mb-12">${ic("printer")} PDF: กด "PDF" แล้วเลือกเครื่องพิมพ์ <b>บันทึกเป็น PDF</b> · Word: ได้ไฟล์ .doc เปิดแก้ไขใน Word ได้ (บันทึกเป็น .docx ได้)${note ? ` · ${esc(note)}` : ""}</div>
      <div class="print-preview" style="min-height:70vh"><iframe id="docFrame" title="ตัวอย่างเอกสาร" style="width:794px;height:1123px;border:0;background:#fff"></iframe></div>`,
      `<button class="btn ghost" onclick="App.closeDrawer()">ปิด</button><button class="btn" onclick="App.docWord()">${ic("file-text")} Word (.doc)</button><button class="btn primary" onclick="App.docPdf()">${ic("printer")} PDF</button>`, { wide: true });
    const fr = $("#docFrame");
    fr.srcdoc = fullHtml(file || title, body);
    fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + "px"; } catch (_) {} const sc = Math.min(1, ($(".print-preview").clientWidth - 32) / 794); fr.style.transform = `scale(${sc})`; fr.style.transformOrigin = "top center"; };
  };
  App.docPdf = () => { try { $("#docFrame").contentWindow.print(); } catch (e) { toast("พิมพ์จากหน้านี้ไม่ได้", true); } };
  App.docWord = () => {
    const d = App._doc; if (!d) return;
    const blob = new Blob(["﻿", wordHtml(d.title, d.body)], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${d.file}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("ดาวน์โหลดไฟล์ Word แล้ว");
  };

  const box = (on) => (on ? "☑" : "☐");
  const head = (t, sub) => `<h1>${esc(t)}</h1><div class="sub">${sub}</div>`;
  const PROJECT = "โครงการวิจัย การพัฒนาและประเมินผลระบบจัดการกล่องยาฉุกเฉินด้วยเทคโนโลยีดิจิทัลในโรงพยาบาลชุมชนแห่งหนึ่ง จังหวัดอุทัยธานี";

  // ---------------- แบบสอบถาม (ภาคผนวก ข) ----------------
  function surveyPage(r, no) {
    const F = App.SURVEY_FORM;
    if (!F) return page("<p>ไม่พบแบบฟอร์มแบบสอบถาม</p>");
    r = r || null;
    const L = r?.likert || {}, C = r?.comparisons || {}, O = r?.openAnswers || {};
    let qn = 0;
    const p1 = F.PART1.map(([k, l, opts]) => `<p><b>${esc(l)}</b><br>${opts.map((o) => `<span class="opt">${box(r && r[k] === o)} ${esc(o)}${o === "อื่น ๆ" ? ` ${r?.professionOther ? `<span class="fill">${esc(r.professionOther)}</span>` : "(ระบุ) ........................"}` : ""}</span>`).join(" ")}</p>`).join("");
    const p2 = F.PART2.map(([title, items]) => `<tr class="sec"><td colspan="7">${esc(title)}</td></tr>${items.map((t) => { qn++; const v = +L[`q${qn}`]; return `<tr><td class="c">${qn}</td><td>${esc(t)}</td>${[5, 4, 3, 2, 1].map((x) => `<td class="c">${r ? (v === x ? "✓" : "") : ""}</td>`).join("")}</tr>`; }).join("")}`).join("");
    const p3 = F.PART3.map((t, i) => { const v = +C[`c${i + 1}`]; return `<tr><td class="c">${i + 1}</td><td>${esc(t)}</td>${F.CMP.map(([x]) => `<td class="c">${r ? (v === x ? "✓" : "") : ""}</td>`).join("")}</tr>`; }).join("");
    const p4 = F.PART4.map((t, i) => `<p><b>${i + 1}. ${esc(t)}</b></p><div class="ans">${r ? esc(O[`o${i + 1}`] || "-") : "&nbsp;"}</div>${r ? "" : `<div class="ans">&nbsp;</div>`}`).join("");
    return page(`${head("แบบสอบถามความพึงพอใจและประสบการณ์ผู้ใช้งานระบบ SEB", esc(PROJECT))}
      <p>รหัสผู้ตอบ ${r ? `<span class="fill">${no ? `ผู้ตอบลำดับที่ ${no}` : "-"}</span> (รหัสจริงปกปิดในระบบ) · ส่งเมื่อ ${esc(fmtDT(r.submittedAt))}` : "........................"}</p>
      <p>${box(r ? r.consent : false)} ข้าพเจ้ายินยอมตอบแบบสอบถามโดยสมัครใจ</p>
      <h2>ตอนที่ 1: ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม</h2>${p1}
      <h2>ตอนที่ 2: ความพึงพอใจต่อระบบ SEB</h2><p>5 = เห็นด้วยอย่างยิ่ง · 4 = เห็นด้วย · 3 = ไม่แน่ใจ · 2 = ไม่เห็นด้วย · 1 = ไม่เห็นด้วยอย่างยิ่ง</p>
      <table class="grid"><tr><th>ข้อ</th><th>ข้อความ</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th></tr>${p2}</table>
      <h2>ตอนที่ 3: เปรียบเทียบก่อนและหลังใช้ระบบ SEB</h2>
      <table class="grid"><tr><th>ข้อ</th><th>ประเด็น</th>${F.CMP.map(([, l]) => `<th>${esc(l)}</th>`).join("")}</tr>${p3}</table>
      <h2>ตอนที่ 4: ความคิดเห็นและข้อเสนอแนะ</h2>${p4}
      <p style="text-align:center;margin-top:6mm">ขอขอบคุณที่สละเวลาตอบแบบสอบถาม</p>`);
  }
  App.docSurvey = (which) => {
    const sv = (S.research?.survey || []).slice().sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
    if (which === "blank") return App.docPreview({ title: "แบบสอบถาม (แบบเปล่า)", file: "SEB_แบบสอบถาม_แบบเปล่า", body: surveyPage(null) });
    if (which === "all") { if (!sv.length) return toast("ยังไม่มีผู้ตอบแบบสอบถาม", true); return App.docPreview({ title: `แบบสอบถามที่ตอบแล้ว (${sv.length} ฉบับ)`, file: `SEB_แบบสอบถาม_ทั้งหมด_${sv.length}ฉบับ`, body: sv.map((r, i) => surveyPage(r, i + 1)).join("") }); }
    const i = sv.findIndex((x) => x.id === which); if (i < 0) return;
    App.docPreview({ title: `แบบสอบถาม · ผู้ตอบลำดับที่ ${i + 1}`, file: `SEB_แบบสอบถาม_ผู้ตอบ${i + 1}`, body: surveyPage(sv[i], i + 1) });
  };
  App.surveyDocsCard = () => {
    const sv = (S.research?.survey || []).slice().sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
    return `<div class="card"><div class="card-head"><h3 class="grow">เอกสารแบบสอบถาม (PDF / Word)</h3><span class="xs faint">${sv.length} ฉบับ</span></div>
      <div class="card-body"><div class="row wrap gap-8"><button class="btn sm" onclick="App.docSurvey('blank')">${ic("file-text")} แบบเปล่า</button>${sv.length ? `<button class="btn sm" onclick="App.docSurvey('all')">${ic("copy")} ที่ตอบแล้วทั้งหมด</button>` : ""}</div>
      ${sv.length ? `<div class="mt-12">${sv.map((r, i) => `<div class="list-row"><div class="grow"><b>ผู้ตอบลำดับที่ ${i + 1}</b> · ${esc(fmtDT(r.submittedAt))}<div class="xs faint">${esc(r.profession || "")}${r.overallScore != null ? ` · คะแนนรวม ${(+r.overallScore).toFixed(2)}` : ""}</div></div><button class="btn sm ghost" onclick="App.docSurvey('${r.id}')">${ic("download")}</button></div>`).join("")}</div>` : ""}</div></div>`;
  };

  // ---------------- แบบสังเกต ----------------
  const LEVELS = ["ดี", "ปานกลาง", "ควรปรับปรุง"];
  function obsPage(o) {
    const items = App.OBS_ITEMS || [];
    const it = o?.items || {};
    return page(`${head("แบบสังเกตการใช้งานระบบ SEB", `${esc(PROJECT)}<br>สำหรับผู้วิจัย · ใช้รหัสแทนชื่อผู้ถูกสังเกต`)}
      <table class="grid"><tr><td style="width:25%"><b>วันเวลาที่สังเกต</b></td><td>${o ? esc(fmtDT(o.observedAt)) : ""}</td></tr>
        <tr><td><b>สถานที่</b></td><td>${o ? esc(o.place || "-") : ""}</td></tr>
        <tr><td><b>ผู้ถูกสังเกต (รหัส)</b></td><td>${o ? esc(o.observedCode || "-") : ""}</td></tr>
        <tr><td><b>ผู้สังเกต</b></td><td>${o ? esc(o.byUser || "-") : ""}</td></tr></table>
      <table class="grid"><tr><th>ข้อ</th><th>ประเด็นการสังเกต</th>${LEVELS.map((l) => `<th style="width:12%">${l}</th>`).join("")}<th style="width:32%">รายละเอียด</th></tr>
        ${items.map((t, i) => { const v = it[t] || {}; return `<tr><td class="c">${i + 1}</td><td>${esc(t)}</td>${LEVELS.map((l) => `<td class="c">${o && v.level === l ? "✓" : ""}</td>`).join("")}<td>${o ? esc(v.detail || "") : "<br><br>"}</td></tr>`; }).join("")}</table>
      <p><b>บันทึกเพิ่มเติม</b></p><div class="ans">${o ? esc(o.note || "-") : "&nbsp;"}</div>${o ? "" : `<div class="ans">&nbsp;</div><div class="ans">&nbsp;</div>`}
      <table class="sigs"><tr><td></td><td></td><td><div class="line"></div><div>ลงชื่อ ผู้สังเกต</div><div>(${o?.byUser ? esc(o.byUser) : ".".repeat(30)})</div></td></tr></table>`);
  }
  App.docObs = (which) => {
    const ob = (S.research?.observations || []).slice().sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));
    if (which === "blank") return App.docPreview({ title: "แบบสังเกต (แบบเปล่า)", file: "SEB_แบบสังเกต_แบบเปล่า", body: obsPage(null) });
    if (which === "all") { if (!ob.length) return toast("ยังไม่มีบันทึกการสังเกต", true); return App.docPreview({ title: `แบบสังเกตที่บันทึกแล้ว (${ob.length} ฉบับ)`, file: `SEB_แบบสังเกต_ทั้งหมด_${ob.length}ฉบับ`, body: ob.map(obsPage).join("") }); }
    const o = ob.find((x) => x.id === which); if (!o) return;
    App.docPreview({ title: `แบบสังเกต · ${o.observedCode || ""} ${fmtDT(o.observedAt)}`, file: `SEB_แบบสังเกต_${(o.observedCode || "").replace(/\W+/g, "") || "บันทึก"}`, body: obsPage(o) });
  };
})();
