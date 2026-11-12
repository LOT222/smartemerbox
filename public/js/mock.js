/* =====================================================================
   SEB v2 — demo backend (ข้อมูลจำลองในเบราว์เซอร์ ใช้แสดงตัวอย่างเท่านั้น)
   ===================================================================== */
(function () {
  const FLEX_SAMPLE = {"open":{"type":"flex","altText":"[SEB] เปิดกล่องยา ER-01 · ห้องอุบัติเหตุ-ฉุกเฉิน (ER)","contents":{"type":"bubble","header":{"type":"box","layout":"vertical","paddingAll":"18px","paddingBottom":"16px","backgroundColor":"#C8363B","contents":[{"type":"text","text":"เปิดกล่องยาฉุกเฉิน!","size":"xl","color":"#FFFFFF","weight":"bold","wrap":true},{"type":"text","text":"Smart Emergency Box (SEB)","size":"xs","color":"#FFFFFFCC","weight":"regular","wrap":true,"margin":"xs"}]},"body":{"type":"box","layout":"vertical","paddingAll":"18px","contents":[{"type":"box","layout":"horizontal","spacing":"md","margin":"none","contents":[{"type":"text","text":"📦 กล่องยา","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"ER-01","size":"lg","color":"#C8363B","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"📍 สถานที่","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"ห้องอุบัติเหตุ-ฉุกเฉิน (ER)","size":"md","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"separator","margin":"lg","color":"#E7E7EA"},{"type":"box","layout":"horizontal","spacing":"md","margin":"lg","contents":[{"type":"text","text":"📅 วันที่","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"12/11/2569","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"⏰ เวลาเปิดใช้","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"22:47 น.","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"🩺 เหตุผล","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"CPR","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"👤 ผู้เปิด","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"พว.ตัวอย่าง","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"🔖 รหัสเหตุการณ์","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"EV-2611-AB12C","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]}]},"footer":{"type":"box","layout":"vertical","paddingAll":"14px","backgroundColor":"#F7F7F8","contents":[{"type":"button","style":"primary","color":"#111113","height":"sm","action":{"type":"uri","label":"เปิดระบบ SEB","uri":"https://smartemerbox.pages.dev/"}},{"type":"text","text":"โรงพยาบาลลานสัก · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"margin":"md","align":"center"}]},"styles":{"footer":{"separator":true,"separatorColor":"#E7E7EA"}}}},"escalate":{"type":"flex","altText":"[SEB] ยังไม่มีผู้รับทราบ ER-01 · ห้องอุบัติเหตุ-ฉุกเฉิน (ER)","contents":{"type":"bubble","header":{"type":"box","layout":"vertical","paddingAll":"18px","paddingBottom":"16px","backgroundColor":"#D97706","contents":[{"type":"text","text":"ยังไม่มีผู้รับทราบ!","size":"xl","color":"#FFFFFF","weight":"bold","wrap":true},{"type":"text","text":"เปิดกล่องมาแล้ว 12 นาที · กรุณารับทราบในระบบ","size":"xs","color":"#FFFFFFCC","weight":"regular","wrap":true,"margin":"xs"}]},"body":{"type":"box","layout":"vertical","paddingAll":"18px","contents":[{"type":"box","layout":"horizontal","spacing":"md","margin":"none","contents":[{"type":"text","text":"📦 กล่องยา","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"ER-01","size":"lg","color":"#D97706","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"📍 สถานที่","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"ห้องอุบัติเหตุ-ฉุกเฉิน (ER)","size":"md","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"separator","margin":"lg","color":"#E7E7EA"},{"type":"box","layout":"horizontal","spacing":"md","margin":"lg","contents":[{"type":"text","text":"📅 วันที่","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"12/11/2569","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"⏰ เวลาเปิดใช้","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"22:47 น.","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"🩺 เหตุผล","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"CPR","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"👤 ผู้เปิด","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"พว.ตัวอย่าง","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]},{"type":"box","layout":"horizontal","spacing":"md","margin":"md","contents":[{"type":"text","text":"🔖 รหัสเหตุการณ์","size":"sm","color":"#6B6B76","weight":"regular","wrap":true,"flex":4},{"type":"text","text":"EV-2611-AB12C","size":"sm","color":"#111113","weight":"bold","wrap":true,"flex":6}]}]},"footer":{"type":"box","layout":"vertical","paddingAll":"14px","backgroundColor":"#F7F7F8","contents":[{"type":"button","style":"primary","color":"#111113","height":"sm","action":{"type":"uri","label":"เปิดระบบ SEB","uri":"https://smartemerbox.pages.dev/"}},{"type":"text","text":"โรงพยาบาลลานสัก · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"margin":"md","align":"center"}]},"styles":{"footer":{"separator":true,"separatorColor":"#E7E7EA"}}}},"expiry":{"type":"flex","altText":"[SEB] ยาใกล้หมดอายุ 2 รายการ","contents":{"type":"bubble","header":{"type":"box","layout":"vertical","paddingAll":"18px","paddingBottom":"16px","backgroundColor":"#D97706","contents":[{"type":"text","text":"ยาใกล้หมดอายุ","size":"xl","color":"#FFFFFF","weight":"bold","wrap":true},{"type":"text","text":"2 รายการ · 12/11/2569","size":"xs","color":"#FFFFFFCC","weight":"regular","wrap":true,"margin":"xs"}]},"body":{"type":"box","layout":"vertical","paddingAll":"18px","contents":[{"type":"text","text":"ภายใน 7 วัน","size":"xs","color":"#E5484D","weight":"bold","wrap":true,"margin":"none"},{"type":"box","layout":"horizontal","margin":"md","contents":[{"type":"box","layout":"vertical","flex":5,"contents":[{"type":"text","text":"Adrenaline inj. 1 mg/ml","size":"sm","color":"#111113","weight":"bold","wrap":true},{"type":"text","text":"ER-01 · ห้องอุบัติเหตุ-ฉุกเฉิน (ER) · lot J690045","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true}]},{"type":"box","layout":"vertical","flex":2,"contents":[{"type":"text","text":"6 วัน","size":"sm","color":"#E5484D","weight":"bold","wrap":true,"align":"end"},{"type":"text","text":"หมด 18/11/2569","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"align":"end"}]}]},{"type":"text","text":"ภายใน 30 วัน","size":"xs","color":"#4F46E5","weight":"bold","wrap":true,"margin":"lg"},{"type":"box","layout":"horizontal","margin":"md","contents":[{"type":"box","layout":"vertical","flex":5,"contents":[{"type":"text","text":"Atropine inj. 0.6 mg/ml","size":"sm","color":"#111113","weight":"bold","wrap":true},{"type":"text","text":"WARD-1 · หอผู้ป่วยใน · lot J670368","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true}]},{"type":"box","layout":"vertical","flex":2,"contents":[{"type":"text","text":"28 วัน","size":"sm","color":"#111113","weight":"bold","wrap":true,"align":"end"},{"type":"text","text":"หมด 10/12/2569","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"align":"end"}]}]}]},"footer":{"type":"box","layout":"vertical","paddingAll":"14px","backgroundColor":"#F7F7F8","contents":[{"type":"button","style":"primary","color":"#111113","height":"sm","action":{"type":"uri","label":"เปิดระบบ SEB","uri":"https://smartemerbox.pages.dev/"}},{"type":"text","text":"โรงพยาบาลลานสัก · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"margin":"md","align":"center"}]}}},"test":{"type":"flex","altText":"[SEB] ทดสอบการแจ้งเตือน","contents":{"type":"bubble","header":{"type":"box","layout":"vertical","paddingAll":"18px","paddingBottom":"16px","backgroundColor":"#C8363B","contents":[{"type":"text","text":"ทดสอบการแจ้งเตือน","size":"xl","color":"#FFFFFF","weight":"bold","wrap":true},{"type":"text","text":"Smart Emergency Box (SEB)","size":"xs","color":"#FFFFFFCC","weight":"regular","wrap":true,"margin":"xs"}]},"body":{"type":"box","layout":"vertical","paddingAll":"18px","contents":[{"type":"text","text":"12/11/2569 22:59 น. · ระบบทำงานปกติ","size":"sm","color":"#111113","weight":"bold","wrap":true}]},"footer":{"type":"box","layout":"vertical","paddingAll":"14px","backgroundColor":"#F7F7F8","contents":[{"type":"button","style":"primary","color":"#111113","height":"sm","action":{"type":"uri","label":"เปิดระบบ SEB","uri":"https://smartemerbox.pages.dev/"}},{"type":"text","text":"โรงพยาบาลลานสัก · กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค","size":"xxs","color":"#6B6B76","weight":"regular","wrap":true,"margin":"md","align":"center"}]}}},"at":"2026-11-12T15:59:18.132Z"};
  const DAY = 86400000, MIN = 60000;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const id = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
  const iso = (t) => new Date(t).toISOString();
  const now = () => Date.now();
  const dstr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const code = (t) => { const d = new Date(t); return `EV-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.random().toString(16).slice(2, 7).toUpperCase()}`; };
  const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));

  const settings = {
    PHARMACY_PHONE: "1234", LINE_EXPIRY_ALERTS: "1", EXPIRY_ALERT_MILESTONES: "30,15,7",
    APP_DISPLAY_NAME: "Smart Emergency Box", HOSPITAL_NAME: "โรงพยาบาลลานสัก", DEPARTMENT_NAME: "กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค",
    APP_CREDIT_TEXT: "ภก.นที อิ่มใจจิตร์ เภสัชกรชำนาญการ กลุ่มงานเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลลานสัก", DEFAULT_PASSWORD: "1234", ALLOW_SIGNUP: "1", NEAR_EXPIRY_DAYS: "30", RESPONSE_TARGET_MIN: "5", ESCALATE_AFTER_MIN: "15",
    PUBLIC_OPEN_COOLDOWN_SEC: "120", INSPECTION_INTERVAL_DAYS: "30", LINE_SEND_MODE: "broadcast", LINE_TO_ID: "", LINE_TOKEN_SET: true,
    PDPA_NOTICE_VERSION: "1.0", ECONSENT_ENABLED: "1", CONSENT_WAIT_DAYS: "7",
    STUDY_PILOT_START: "2026-09-14", STUDY_PILOT_END: "2026-09-27", STUDY_POST_START: "2026-10-01", STUDY_POST_END: "2026-12-31",
  };
  const L = (name, zone, unitType, inStudy, code) => ({ id: id("loc"), name, zone, unitType, inStudy, active: true, code, sortOrder: 0 });
  const locations = [
    L("ห้องอุบัติเหตุ-ฉุกเฉิน (ER)", "in", "ER", true, "ER"), L("หอผู้ป่วยในชาย", "in", "IPD", true, "IPD-M"), L("หอผู้ป่วยในหญิง", "in", "IPD", true, "IPD-F"),
    L("ห้องคลอด (LR)", "in", "LR", true, "LR"), L("ผู้ป่วยนอก (OPD)", "in", "OPD", false, "OPD"), L("รถ EMS (ALS)", "in", "EMS", false, "EMS"),
    L("รพ.สต.บ้านป่าอ้อ", "out", "PCU", false, "PCU-01"), L("รพ.สต.ทุ่งนางาม", "out", "PCU", false, "PCU-02"),
  ];
  const K = (name, description, items) => ({ id: id("kit"), name, description, active: true, items: items.map(([drugName, strength, defaultQty, unit], i) => ({ id: id("ki"), drugName, strength, defaultQty, unit, sortOrder: i + 1 })) });
  const kits = [
    K("ชุดยาช่วยชีวิต (CPR)", "ACLS สำหรับหอผู้ป่วยและ ER", [["Adrenaline", "1 mg/mL", 10, "amp"], ["Atropine", "0.6 mg/mL", 5, "amp"], ["Amiodarone", "150 mg/3 mL", 4, "amp"], ["Sodium bicarbonate", "7.5% 50 mL", 2, "vial"], ["Calcium gluconate", "10% 10 mL", 2, "amp"], ["50% Glucose", "50 mL", 2, "vial"], ["Dopamine", "250 mg/10 mL", 2, "amp"], ["Naloxone", "0.4 mg/mL", 2, "amp"]]),
    K("ชุด Anaphylaxis", "ภาวะแพ้รุนแรง", [["Adrenaline", "1 mg/mL", 3, "amp"], ["Chlorpheniramine", "10 mg/mL", 2, "amp"], ["Hydrocortisone", "100 mg", 2, "vial"], ["Dexamethasone", "4 mg/mL", 2, "amp"]]),
    K("ชุดห้องคลอด", "PPH / Eclampsia", [["Oxytocin", "10 IU/mL", 4, "amp"], ["Methylergometrine", "0.2 mg/mL", 2, "amp"], ["Magnesium sulfate", "50% 2 mL", 4, "amp"], ["Calcium gluconate", "10% 10 mL", 2, "amp"], ["Adrenaline", "1 mg/mL", 3, "amp"], ["Hydralazine", "20 mg/mL", 2, "amp"]]),
  ];
  const boxDefs = [["ER-01", 0, 0], ["ER-02", 0, 1], ["IPD-M-01", 1, 0], ["IPD-F-01", 2, 0], ["LR-01", 3, 2], ["OPD-01", 4, 1], ["EMS-01", 5, 0], ["PCU-PA-01", 6, 1], ["PCU-TN-01", 7, 1]];
  const boxes = boxDefs.map(([boxCode, li, ki], n) => {
    const kit = kits[ki], loc = locations[li];
    const items = kit.items.map((it, i) => {
      let exp = now() + (120 + Math.floor(rnd() * 500)) * DAY;
      if (boxCode === "IPD-M-01" && i === 2) exp = now() - 6 * DAY;
      if (boxCode === "ER-01" && i === 1) exp = now() + 19 * DAY;
      if (boxCode === "PCU-TN-01" && i === 0) exp = now() + 9 * DAY;
      if (boxCode === "OPD-01" && i === 3) exp = now() + 27 * DAY;
      return { id: id("bi"), drugName: it.drugName, strength: it.strength, form: "inj", lot: `${pick(["A", "B", "K", "M", "T"])}${Math.floor(1000 + rnd() * 8999)}`, expiryDate: dstr(exp), qty: it.defaultQty, requiredQty: it.defaultQty, unit: it.unit, sortOrder: i + 1 };
    });
    const nextIns = boxCode === "PCU-PA-01" || boxCode === "EMS-01" ? now() - 3 * DAY : now() + (5 + n * 2) * DAY;
    return { id: boxCode === "LR-01" ? "box-lr1" : id("box"), boxCode, kitId: kit.id, kitName: kit.name, locationId: loc.id, location: loc.name, qrToken: "demo", sealNo: String(4500 + n * 7).padStart(6, "0"), note: "", items, inspectionDate: dstr(nextIns), lastInspectedAt: iso(nextIns - 30 * DAY), lastReadyAt: iso(now() - (3 + n) * DAY), createdAt: iso(now() - 200 * DAY) };
  });
  const users = [
    { id: "u-admin", username: "admin", displayName: "ภก.นที อิ่มใจจิตร์", role: "admin", position: "เภสัชกรชำนาญการ", staffCode: "P01", researchConsent: true, active: true, lastLoginAt: iso(now() - 2 * 3600000) },
    { id: "u-ph", username: "pharm", displayName: "ภญ.สุดารัตน์ ใจงาม", role: "pharmacist", position: "เภสัชกรปฏิบัติการ", staffCode: "P02", researchConsent: true, active: true, lastLoginAt: iso(now() - 5 * 3600000) },
    { id: "u-ph2", username: "jpp01", displayName: "จพ.วิทยา มั่นคง", role: "technician", position: "เจ้าพนักงานเภสัชกรรม", staffCode: "T01", researchConsent: true, active: true, lastLoginAt: iso(now() - 26 * 3600000) },
    { id: "u-v", username: "nurse.er", displayName: "พว.อรทัย สุขใจ", role: "nurse", position: "พยาบาลวิชาชีพ ER", staffCode: "N01", researchConsent: false, active: true, lastLoginAt: null },
  ];
  const REASONS = ["CPR", "CPR", "Anaphylaxis", "Shock", "ภาวะฉุกเฉินอื่น"];
  const pharmNames = ["ภก.นที อิ่มใจจิตร์", "ภญ.สุดารัตน์ ใจงาม", "จพ.วิทยา มั่นคง"];
  const events = [];
  const studyBoxes = boxes.filter((b) => locations.find((l) => l.id === b.locationId).inStudy);
  // baseline (paper) — ส.ค.–ก.ย. 2569
  for (let i = 0; i < 22; i++) {
    const b = pick(studyBoxes), t = new Date("2026-08-03T00:00:00").getTime() + rnd() * 40 * DAY + 7 * 3600000;
    const notify = t + (5 + rnd() * 40) * MIN, ack = notify + (6 + rnd() * 70) * MIN, ready = ack + (40 + rnd() * 600) * MIN;
    events.push({ id: id("ev"), eventCode: code(t), boxId: b.id, boxCode: b.boxCode, locationId: b.locationId, locationName: b.location, actualOpenedAt: iso(t), recordedAt: iso(t + 3 * DAY), unitNotifiedAt: iso(notify), acknowledgedAt: iso(ack), readyAt: iso(ready), source: "paper", period: "baseline_prosp", notificationStatus: "paper", caseStatus: "ready", reasonCategory: pick(REASONS), requiredFields: 6, filledFields: rnd() < 0.62 ? 6 : 4 + Math.floor(rnd() * 2), itemsUsedJson: [] });
  }
  // post — ต.ค.–พ.ย. 2569
  for (let i = 0; i < 30; i++) {
    const b = pick(studyBoxes.concat(boxes.slice(5, 7))), t = new Date("2026-10-01T00:00:00").getTime() + rnd() * (now() - new Date("2026-10-01").getTime() - 2 * DAY);
    const rec = t + rnd() * 12 * MIN, sent = rec + 2000, ack = sent + (0.6 + rnd() * rnd() * 11) * MIN, ready = ack + (25 + rnd() * 160) * MIN;
    const failed = i === 7;
    const kit = kits.find((k) => k.id === b.kitId);
    events.push({ id: id("ev"), eventCode: code(t), boxId: b.id, boxCode: b.boxCode, locationId: b.locationId, locationName: b.location, actualOpenedAt: iso(t), recordedAt: iso(rec), notificationSentAt: failed ? null : iso(sent), notificationStatus: failed ? "failed" : "sent", notificationError: failed ? "LINE 429: monthly limit" : null, pushSent: 3, pushSentAt: iso(sent), acknowledgedAt: iso(ack), acknowledgedBy: pick(pharmNames), readyAt: iso(ready), readyBy: pick(pharmNames), source: rnd() < 0.85 ? "qr" : "staff", openedBy: "QR", openerName: pick(["พว.สมใจ", "พว.กนกพร", "พว.ศิริพร", "พว.อรทัย"]), period: "post", caseStatus: "ready", reasonCategory: pick(REASONS), requiredFields: 6, filledFields: rnd() < 0.93 ? 6 : 5, itemsUsedJson: [{ drugName: kit.items[0].drugName, strength: kit.items[0].strength, qty: 1 + Math.floor(rnd() * 3) }] });
  }
  // current open cases
  const lr = boxes.find((b) => b.boxCode === "LR-01"), ipdf = boxes.find((b) => b.boxCode === "IPD-F-01");
  const t1 = now() - 8 * MIN, t2 = now() - 52 * MIN;
  events.push({ id: "ev-open", eventCode: code(t1), boxId: lr.id, boxCode: lr.boxCode, locationId: lr.locationId, locationName: lr.location, actualOpenedAt: iso(t1), recordedAt: iso(t1 + 40000), notificationSentAt: iso(t1 + 42000), notificationStatus: "sent", pushSent: 3, pushSentAt: iso(t1 + 42000), source: "qr", openedBy: "QR", openerName: "พว.กนกพร", period: "post", caseStatus: "open", reasonCategory: "CPR", requiredFields: 6, filledFields: 5, itemsUsedJson: [] });
  events.push({ id: "ev-ack", eventCode: code(t2), boxId: ipdf.id, boxCode: ipdf.boxCode, locationId: ipdf.locationId, locationName: ipdf.location, actualOpenedAt: iso(t2), recordedAt: iso(t2 + 4 * MIN), notificationSentAt: iso(t2 + 4 * MIN + 2000), notificationStatus: "sent", pushSent: 3, pushSentAt: iso(t2 + 4 * MIN), acknowledgedAt: iso(t2 + 7 * MIN), acknowledgedBy: "ภญ.สุดารัตน์ ใจงาม", source: "qr", openedBy: "QR", openerName: "พว.ศิริพร", period: "post", caseStatus: "acknowledged", reasonCategory: "Shock", requiredFields: 6, filledFields: 6, itemsUsedJson: [{ drugName: "Adrenaline", strength: "1 mg/mL", qty: 2 }, { drugName: "Dopamine", strength: "250 mg/10 mL", qty: 1 }] });
  events.sort((a, b) => b.actualOpenedAt.localeCompare(a.actualOpenedAt));
  const hnStore = Object.fromEntries(events.map((e) => [e.id, String(Math.floor(100000000 + rnd() * 899999999)).slice(0, 9)]));

  const inspections = [];
  boxes.forEach((b) => {
    [new Date("2026-10-08").getTime(), new Date("2026-11-05").getTime()].forEach((t, k) => {
      const exp = b.boxCode === "IPD-M-01" && k === 1 ? 1 : 0;
      inspections.push({ id: id("ins"), boxId: b.id, boxCode: b.boxCode, locationId: b.locationId, locationName: b.location, inspectedAt: iso(t + rnd() * 6 * 3600000), durationMin: Math.round((4 + rnd() * 7) * 10) / 10, inspectorName: pick(pharmNames), itemsChecked: b.items.length, itemsExpired: exp, itemsNearExpiry: Math.floor(rnd() * 2), itemsMissing: 0, isReady: !exp, sealNo: b.sealNo, requiredFields: 5 + b.items.length * 4, filledFields: 5 + b.items.length * 4 - (rnd() < 0.08 ? 1 : 0), source: "app", period: "post" });
    });
  });
  inspections.sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
  const baseline = [];
  ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"].forEach((m) => locations.filter((l) => l.inStudy).forEach((l) => {
    const checked = l.unitType === "LR" ? 6 : 8, ins = 1;
    const ex = rnd() < 0.36 ? 1 + Math.floor(rnd() * 2) : 0;
    baseline.push({ id: id("bl"), periodMonth: m, locationId: l.id, locationName: l.name, inspections: ins, inspectionsReady: ex ? 0 : 1, itemsChecked: checked, itemsExpired: ex, recordsTotal: 5 + Math.floor(rnd() * 5), recordsComplete: 0 });
  }));
  baseline.forEach((b) => (b.recordsComplete = Math.round(b.recordsTotal * (0.55 + rnd() * 0.3))));
  const reportTimings = [
    { id: id("rt"), reportMonth: "2026-08", minutes: 142, byUser: "ภก.นที อิ่มใจจิตร์", source: "paper", period: "baseline_prosp" },
    { id: id("rt"), reportMonth: "2026-09", minutes: 118, byUser: "ภก.นที อิ่มใจจิตร์", source: "paper", period: "baseline_prosp" },
    { id: id("rt"), reportMonth: "2026-10", startedAt: "2026-11-01T09:10:00+07:00", finishedAt: "2026-11-01T09:31:00+07:00", minutes: 21, byUser: "ภก.นที อิ่มใจจิตร์", source: "app", period: "post" },
  ];
  const survey = Array.from({ length: 14 }, (_, i) => {
    const base = 3.6 + rnd() * 1.2;
    const likert = Object.fromEntries(Array.from({ length: 22 }, (_, k) => [`q${k + 1}`, Math.max(2, Math.min(5, Math.round(base + (rnd() - 0.5) * 1.6)))]));
    const avg = (ks) => Math.round((ks.reduce((a, k) => a + likert[`q${k}`], 0) / ks.length) * 100) / 100;
    return { id: id("sv"), submittedAt: iso(now() - rnd() * 5 * DAY), likert, comparisons: Object.fromEntries(Array.from({ length: 6 }, (_, k) => [`c${k + 1}`, Math.max(3, Math.min(5, Math.round(3.8 + rnd() * 1.4)))])), usabilityScore: avg([1, 2, 3, 4, 5]), performanceScore: avg([6, 7, 8, 9, 10]), usefulnessScore: avg([11, 12, 13, 14, 15]), trustScore: avg([16, 17, 18, 19]), acceptanceScore: avg([20, 21, 22]), overallScore: avg(Array.from({ length: 22 }, (_, k) => k + 1)), accepted: likert.q21 >= 4 && likert.q22 >= 4, profession: pick(["เภสัชกร", "พยาบาลวิชาชีพ", "พยาบาลวิชาชีพ", "เจ้าพนักงานเภสัชกรรม"]) };
  });
  const observations = [];
  const loginLogs = Array.from({ length: 24 }, (_, i) => { const u = pick(users.slice(0, 3)); const ok = rnd() > 0.1; const t = now() - i * 9 * 3600000 - rnd() * 3600000; return { id: id("lg"), at: iso(t), userId: u.id, username: u.username, success: ok, reason: ok ? "ok" : "bad_password", userAgent: pick(["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1)", "Mozilla/5.0 (Windows NT 10.0)", "Mozilla/5.0 (Linux; Android 14)"]), logoutAt: ok ? iso(t + (10 + rnd() * 80) * MIN) : null }; });
  const auditLogs = events.slice(0, 20).flatMap((e) => [
    { id: id("au"), at: e.recordedAt, username: "QR", action: "open_box", detailJson: { eventCode: e.eventCode, source: e.source } },
    ...(e.acknowledgedAt ? [{ id: id("au"), at: e.acknowledgedAt, username: "pharm", action: "acknowledge_event", detailJson: { eventCode: e.eventCode } }] : []),
    ...(e.readyAt ? [{ id: id("au"), at: e.readyAt, username: "pharm", action: "confirm_ready", detailJson: { eventCode: e.eventCode } }] : []),
  ]).sort((a, b) => b.at.localeCompare(a.at));
  const moves = [];
  const requests = [
    { id: "rq-1", type: "signup", status: "pending", username: "nurse.ipd", displayName: "พว.กนกพร ศรีสุข", role: "nurse", position: "พยาบาลวิชาชีพปฏิบัติการ", phone: "IPD หญิง · 081-234-5678", pw: "1234", createdAt: iso(now() - 3 * 3600000) },
    { id: "rq-2", type: "reset", status: "pending", username: "jpp01", displayName: "จพ.วิทยา มั่นคง", userId: "u-ph2", phone: "", createdAt: iso(now() - 40 * 60000) },
  ];
  let session = null;
  users[2].consentOfficer = true;
  const SIG = (() => { try { const c = document.createElement("canvas"); c.width = 360; c.height = 120; const x = c.getContext("2d"); x.lineWidth = 2.4; x.strokeStyle = "#111"; x.beginPath(); x.moveTo(20, 80); x.bezierCurveTo(70, 10, 110, 120, 150, 60); x.bezierCurveTo(190, 10, 230, 100, 280, 50); x.lineTo(330, 70); x.stroke(); return c.toDataURL("image/png"); } catch (_) { return ""; } })();
  const consents = [
    { id: "cs-1", userId: "u-ph", username: "pharm", kind: "research", status: "viewed", docVersion: "แก้ไขครั้งที่ 1", pisFirstViewedAt: iso(now() - 8 * DAY) },
    { id: "cs-2", userId: "u-ph2", username: "jpp01", kind: "research", status: "signed", docVersion: "แก้ไขครั้งที่ 1", fullName: "วิทยา มั่นคง", position: "เจ้าพนักงานเภสัชกรรม", unit: "กลุ่มงานเภสัชกรรม", age: 34, agreedItems: [true, true, true, true, true, true, true], signatureData: SIG, pisFirstViewedAt: iso(now() - 20 * DAY), signedAt: iso(now() - 11 * DAY) },
  ];
  users[1].pdpaAcceptedAt = iso(now() - 9 * DAY); users[2].pdpaAcceptedAt = iso(now() - 21 * DAY);
  const myC = (uid) => consents.filter((c) => c.userId === uid).slice(-1)[0] || null;
  const noSig = (c) => (c ? { ...c, signatureData: undefined, hasSignature: !!c.signatureData } : null);

  // ---------------- derived ----------------
  const near = () => Number(settings.NEAR_EXPIRY_DAYS || 30);
  const daysUntil = (d) => (d ? Math.round((new Date(d + "T00:00:00") - new Date(dstr(now()) + "T00:00:00")) / DAY) : NaN);
  function decorate(b) {
    const loc = locations.find((l) => l.id === b.locationId);
    const open = events.find((e) => e.boxId === b.id && ["open", "acknowledged"].includes(e.caseStatus));
    let ex = 0, nr = 0, miss = 0;
    b.items.forEach((it) => { const d = daysUntil(it.expiryDate); if (!it.expiryDate || it.qty <= 0) miss++; else if (d < 0) ex++; else if (d <= near()) nr++; });
    let state = "ready";
    if (open) state = open.caseStatus === "acknowledged" ? "refilling" : "opened";
    else if (!b.items.length || miss) state = "not_ready";
    else if (ex) state = "expired";
    const label = { ready: "พร้อมใช้", opened: "ถูกเปิดใช้", refilling: "รอเติมยา", not_ready: "ไม่พร้อมใช้", expired: "มียาหมดอายุ" };
    return { ...b, location: loc?.name || "", locationZone: loc?.zone || "in", locationType: loc?.unitType || "", inStudy: !!loc?.inStudy, state, status: label[state], expiredCount: ex, nearCount: nr, missingCount: miss, inspectionOverdue: !!b.inspectionDate && b.inspectionDate < dstr(now()), openCaseId: open?.id || null, qrUrl: `${location.origin}${location.pathname}?demo=1&page=open&boxId=${b.id}&t=${b.qrToken}` };
  }
  function appData() {
    const full = boxes.map(decorate);
    const resp = events.filter((e) => e.notificationSentAt && e.acknowledgedAt && e.period === "post").map((e) => (new Date(e.acknowledgedAt) - new Date(e.notificationSentAt)) / MIN).sort((a, b) => a - b);
    const med = resp.length ? Math.round((resp.length % 2 ? resp[(resp.length - 1) / 2] : (resp[resp.length / 2 - 1] + resp[resp.length / 2]) / 2) * 10) / 10 : null;
    const by = (s) => full.filter((b) => b.state === s).length;
    return {
      settings: { ...settings }, locations: locations.map((l) => ({ ...l })), kits: kits.map((k) => ({ ...k, items: k.items.map((i) => ({ ...i })) })), boxes: full,
      events: events.slice(0, 400).map((e) => ({ ...e })), pushDevices: 4, pushReady: true, me: session, pendingRequests: session?.role === "admin" ? requests.filter((r) => r.status === "pending").length : 0,
      stats: { totalBoxes: full.length, ready: by("ready"), opened: by("opened") + by("refilling"), notReady: by("not_ready") + by("expired"), expiredItems: full.reduce((a, b) => a + b.expiredCount, 0), nearItems: full.reduce((a, b) => a + b.nearCount, 0), overdueInspections: full.filter((b) => b.inspectionOverdue).length, openCases: events.filter((e) => e.caseStatus === "open").length, pendingCases: events.filter((e) => ["open", "acknowledged"].includes(e.caseStatus)).length, medianResponseMin: med, responseTargetMin: 5 },
    };
  }
  const audit = (action, detailJson = {}) => auditLogs.unshift({ id: id("au"), at: iso(now()), username: session?.username || "QR", action, detailJson });
  const need = (tok) => { if (!session || tok !== "demo-token") throw new Error("SESSION_EXPIRED:กรุณาเข้าสู่ระบบใหม่"); return session; };
  const err = (m) => { throw new Error(m); };

  const A = {
    apiPublicConfig: () => ({ hospitalName: settings.HOSPITAL_NAME, departmentName: settings.DEPARTMENT_NAME, vapidPublicKey: "", credit: settings.APP_CREDIT_TEXT, allowSignup: true, defaultPassword: "1234" }),
    apiRegister: (p) => { if (!p.displayName || !p.username || String(p.password || "").length < 4) err("กรุณากรอกข้อมูลให้ครบ (รหัสผ่านอย่างน้อย 4 ตัว)"); if (users.find((u) => u.username === p.username)) err("ชื่อผู้ใช้นี้ถูกใช้แล้ว"); requests.unshift({ id: id("rq"), type: "signup", status: "pending", ...p, password: undefined, pw: p.password, createdAt: iso(now()) }); return { ok: true }; },
    apiRequestReset: (p) => { const u = users.find((x) => x.username === p.username); if (u) requests.unshift({ id: id("rq"), type: "reset", status: "pending", username: u.username, displayName: u.displayName, userId: u.id, phone: p.phone, createdAt: iso(now()) }); return { ok: true }; },
    apiListAccountRequests: (t) => { need(t); return { requests: requests.map((r) => ({ ...r, pw: undefined })) }; },
    apiHandleAccountRequest: (t, rid, ok, p = {}) => { need(t); const r = requests.find((x) => x.id === rid); r.status = ok ? "approved" : "rejected"; let tempPassword = ""; if (ok && r.type === "signup") { users.push({ id: id("u"), username: r.username, displayName: r.displayName, role: p.role || r.role, position: r.position, active: true, pw: r.pw }); } if (ok && r.type === "reset") { users.find((u) => u.id === r.userId).pw = "1234"; tempPassword = "1234"; } return { ok: true, tempPassword, users }; },
    apiLogin: (u, p) => {
      const user = users.find((x) => x.username === u && x.active);
      const good = !!user && p === (user.pw || (user.role === "nurse" ? "1234" : "demo1234"));
      loginLogs.unshift({ id: id("lg"), at: iso(now()), username: u, success: good, reason: good ? "ok" : "bad_password", userAgent: navigator.userAgent });
      if (!good) err("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      session = { ...user };
      return { token: "demo-token", user: session, data: appData(), mustChangePassword: p === "1234" };
    },
    apiLogout: () => { session = null; return { ok: true }; },
    apiHealth: () => ({ ok: true, at: new Date().toISOString(), push: true, version: "2.12.0", schema: 5, schemaRequired: 5, schemaOk: true }),
    apiBootstrap: (t) => { need(t); return { user: session, data: appData() }; },
    apiRefresh: (t) => { need(t); return { user: session, data: appData() }; },
    apiChangePassword: (t) => { need(t); return { ok: true }; },
    apiPublicGetBox: (bid) => {
      const b = boxes.find((x) => x.id === bid) || err("QR ไม่ถูกต้อง กรุณาติดต่อห้องยา");
      const d = decorate(b);
      const recentOpeners = [...new Set(events.filter((e) => e.locationId === b.locationId && e.openerName).sort((a, c) => (a.recordedAt < c.recordedAt ? 1 : -1)).map((e) => e.openerName))].slice(0, 12);
      if (!recentOpeners.length) recentOpeners.push("พว.สมใจ ใจดี", "พว.วรรณา ศรีสุข", "พว.กมล ทองดี");
      const openReasons = settings.OPT_OPEN_REASONS ? String(settings.OPT_OPEN_REASONS).split("\n").map((x) => x.trim()).filter(Boolean) : null;
      return { hospitalName: settings.HOSPITAL_NAME, pharmacyPhone: settings.PHARMACY_PHONE || "", recentOpeners, openReasons, box: { ...d, items: b.items.map((it) => { const dd = daysUntil(it.expiryDate); return { ...it, expiryState: dd < 0 ? "expired" : dd <= near() ? "near" : "ok" }; }) } };
    },
    apiOpenBoxPublic: (p) => {
      const b = boxes.find((x) => x.id === p.boxId) || err("QR ไม่ถูกต้อง");
      const dup = p.clientRequestId && events.find((e) => e.clientRequestId === p.clientRequestId);
      if (dup) return { eventCode: dup.eventCode, notified: true, duplicate: true };
      const recent = events.find((e) => e.boxId === b.id && now() - new Date(e.recordedAt) < 120000);
      if (recent && !(p.offlineQueued && p.clientRequestId)) err(`กล่องนี้เพิ่งบันทึกการเปิดไปแล้ว (${recent.eventCode}) ห้องยาได้รับแจ้งแล้ว`);
      const ev = newEvent(b, p, "qr");
      Object.assign(ev, { clientRequestId: p.clientRequestId || null, offlineQueued: !!p.offlineQueued, clientSubmittedAt: p.clientSubmittedAt || null });
      return { eventCode: ev.eventCode, notified: true };
    },
    apiRecordOpenStaff: (t, p) => { need(t); const b = boxes.find((x) => x.id === p.boxId); const ev = newEvent(b, p, "staff"); return { event: ev, data: appData() }; },
    apiGetEvent: (t, eid) => { need(t); const e = events.find((x) => x.id === eid); return { event: e, moves: moves.filter((m) => m.eventId === eid).concat((e.itemsUsedJson || []).map((u) => ({ type: "use", drugName: u.drugName, strength: u.strength, qtyChange: -u.qty, byUser: e.openerName || "QR", at: e.recordedAt }))), hasHn: !!hnStore[eid] }; },
    apiRevealHn: (t, eid) => { need(t); audit("reveal_hn", { eventId: eid }); return { hn: hnStore[eid] || "" }; },
    apiAcknowledgeEvent: (t, eid) => { need(t); const e = events.find((x) => x.id === eid); if (!e.acknowledgedAt) Object.assign(e, { acknowledgedAt: iso(now()), acknowledgedBy: session.displayName, caseStatus: "acknowledged" }); audit("acknowledge_event", { eventCode: e.eventCode }); return { event: e, data: appData() }; },
    apiConfirmReady: (t, p) => {
      need(t);
      const e = events.find((x) => x.id === p.eventId), b = boxes.find((x) => x.id === e.boxId);
      if (p.items) b.items = p.items.map((i, k) => ({ ...i, id: id("bi"), sortOrder: k + 1 }));
      if (p.itemsUsed?.length && !(e.itemsUsedJson || []).length) e.itemsUsedJson = p.itemsUsed;
      Object.assign(e, { readyAt: iso(now()), readyBy: session.displayName, caseStatus: "ready" });
      if (!e.acknowledgedAt) Object.assign(e, { acknowledgedAt: e.readyAt, acknowledgedBy: session.displayName });
      Object.assign(b, { sealNo: p.sealNo || b.sealNo, lastReadyAt: e.readyAt });
      moves.push({ eventId: e.id, type: "refill", drugName: "เติมยาตามรายการ", strength: "", qtyChange: 0, byUser: session.displayName, at: e.readyAt });
      audit("confirm_ready", { eventCode: e.eventCode });
      return { event: e, data: appData() };
    },
    apiCancelEvent: (t, eid, r) => { need(t); const e = events.find((x) => x.id === eid); Object.assign(e, { caseStatus: "cancelled", dataNote: `ยกเลิก: ${r}` }); return { data: appData() }; },
    apiUpdateEventTimes: (t, eid, v) => { need(t); const e = events.find((x) => x.id === eid); e.actualOpenedAt = v; audit("edit_actual_opened_at", { eventCode: e.eventCode }); return { event: e, data: appData() }; },
    apiRecordPaperEvent: (t, p) => { need(t); const loc = locations.find((l) => l.id === p.locationId); events.push({ id: id("ev"), eventCode: code(p.actualOpenedAt), boxCode: p.boxCode, locationId: loc?.id, locationName: loc?.name, actualOpenedAt: p.actualOpenedAt, unitNotifiedAt: p.unitNotifiedAt, acknowledgedAt: p.acknowledgedAt, readyAt: p.readyAt, source: "paper", period: "baseline_prosp", notificationStatus: "paper", caseStatus: "ready", reasonCategory: p.reasonCategory, requiredFields: +p.requiredFields || null, filledFields: +p.filledFields || null, recordedAt: iso(now()) }); return { data: appData() }; },
    apiSaveBox: (t, p) => { need(t); const b = boxes.find((x) => x.id === p.id); const loc = locations.find((l) => l.id === p.locationId); Object.assign(b, { boxCode: p.boxCode, kitId: p.kitId, kitName: p.kitName, locationId: loc?.id || null, sealNo: p.sealNo, note: p.note }); if (p.items) b.items = p.items.map((i, k) => ({ ...i, id: id("bi"), sortOrder: k + 1 })); audit("save_box", { boxCode: b.boxCode, reason: p.changeReason }); return { box: b, data: appData() }; },
    apiCreateBoxFromKit: (t, p) => { need(t); if (!p.boxCode) err("กรุณาระบุรหัสกล่อง"); const kit = kits.find((k) => k.id === p.kitId); const b = { id: id("box"), boxCode: p.boxCode, kitId: kit?.id, kitName: kit?.name || "", locationId: p.locationId || null, qrToken: "demo", items: (kit?.items || []).map((i, k) => ({ id: id("bi"), drugName: i.drugName, strength: i.strength, lot: "", expiryDate: "", qty: 0, requiredQty: i.defaultQty, unit: i.unit, sortOrder: k + 1 })), note: p.note }; boxes.push(b); audit("create_box", { boxCode: b.boxCode }); return { box: b, data: appData() }; },
    apiDeleteBox: (t, bid) => { need(t); boxes.splice(boxes.findIndex((b) => b.id === bid), 1); return { data: appData() }; },
    apiRegenerateQr: (t) => { need(t); return { data: appData() }; },
    apiSaveKit: (t, p) => { need(t); let k = kits.find((x) => x.id === p.id); if (!k) { k = { id: id("kit"), active: true }; kits.push(k); } Object.assign(k, { name: p.name, description: p.description, items: p.items.map((i, n) => ({ ...i, id: id("ki"), defaultQty: +i.defaultQty || 0, sortOrder: n + 1 })) }); return { kit: k, data: appData() }; },
    apiDeleteKit: (t, kid) => { need(t); kits.splice(kits.findIndex((k) => k.id === kid), 1); return { data: appData() }; },
    apiSaveLocation: (t, p) => { need(t); let l = locations.find((x) => x.id === p.id); if (!l) { l = { id: id("loc") }; locations.push(l); } Object.assign(l, { name: p.name, code: p.code, unitType: p.unitType, zone: p.zone, sortOrder: +p.sortOrder || 0, inStudy: p.inStudy, active: p.active, note: p.note }); return { data: appData() }; },
    apiListInspections: (t) => { need(t); return { inspections }; },
    apiReport: (t, from, to) => { need(t); const day = (x) => x && new Date(new Date(x).getTime() + 7 * 3600000).toISOString().slice(0, 10); const inR = (x) => { const d = day(x); return d && d >= from && d <= to; }; return { from, to, events: events.filter((e) => inR(e.actualOpenedAt)).map(({ hn, ...r }) => r), inspections: inspections.filter((i) => inR(i.inspectedAt)) }; },
    apiMonthlyReport: (t, month) => { need(t); const inM = (x) => x && String(new Date(new Date(x).getTime() + 7 * 3600000).toISOString()).slice(0, 7) === month; return { month, events: events.filter((e) => inM(e.actualOpenedAt)).map(({ hn, ...r }) => r), inspections: inspections.filter((i) => inM(i.inspectedAt)) }; },
    apiGetInspection: (t, iid) => { need(t); const i = inspections.find((x) => x.id === iid); const b = boxes.find((x) => x.id === i.boxId); return { inspection: i, items: i.items || (b?.items || []).map((it) => ({ ...it, actualQty: it.qty, status: daysUntil(it.expiryDate) < 0 ? "expired" : "normal" })) }; },
    apiSaveInspection: (t, p) => {
      need(t);
      const b = boxes.find((x) => x.id === p.boxId), c = (s) => p.items.filter((i) => i.status === s).length;
      const ins = { id: id("ins"), boxId: b.id, boxCode: b.boxCode, locationId: b.locationId, inspectedAt: p.finishedAt, startedAt: p.startedAt, durationMin: Math.round(((new Date(p.finishedAt) - new Date(p.startedAt)) / MIN) * 10) / 10, inspectorName: session.displayName, itemsChecked: p.items.length, itemsExpired: c("expired"), itemsNearExpiry: c("near"), itemsMissing: c("missing"), isReady: !c("expired") && !c("missing"), sealNo: p.sealNo, problemNote: p.problemNote, requiredFields: 5 + p.items.length * 4, filledFields: 5 + p.items.length * 4, source: "app", period: "post", items: p.items };
      inspections.unshift(ins);
      Object.assign(b, { lastInspectedAt: p.finishedAt, inspectionDate: dstr(now() + 30 * DAY), sealNo: p.sealNo || b.sealNo });
      if (p.applyToBox) b.items = p.items.filter((i) => i.status !== "missing").map((i, k) => ({ ...i, id: id("bi"), qty: +i.actualQty, sortOrder: k + 1 }));
      audit("save_inspection", { boxCode: b.boxCode, isReady: ins.isReady });
      return { inspection: ins, data: appData() };
    },
    apiSaveInspectionSchedule: (t, p) => { need(t); p.boxIds.forEach((bid) => { const b = boxes.find((x) => x.id === bid); if (b) b.inspectionDate = p.inspectionDate; }); return { data: appData() }; },
    apiResearchData: (t) => { need(t); return { events: events.map((e) => ({ ...e })), inspections, reportTimings, baseline, survey, observations, locations, settings }; },
    apiStartReportTiming: (t, m) => { need(t); const r = { id: id("rt"), reportMonth: m, startedAt: iso(now()), byUser: session.displayName, source: "app", period: "post" }; reportTimings.push(r); return { timing: r }; },
    apiFinishReportTiming: (t, rid) => { need(t); const r = reportTimings.find((x) => x.id === rid); r.finishedAt = iso(now()); r.minutes = Math.round(((now() - new Date(r.startedAt)) / MIN) * 10) / 10; return { timing: r }; },
    apiSaveReportTimingPaper: (t, p) => { need(t); reportTimings.push({ id: id("rt"), reportMonth: p.reportMonth, minutes: +p.minutes, byUser: p.byUser, source: "paper", period: "baseline_prosp" }); return {}; },
    apiSaveBaselineAggregate: (t, p) => { need(t); const l = locations.find((x) => x.id === p.locationId); baseline.push({ id: id("bl"), ...p, locationName: l?.name || "", inspections: +p.inspections, inspectionsReady: +p.inspectionsReady, itemsChecked: +p.itemsChecked, itemsExpired: +p.itemsExpired, recordsTotal: +p.recordsTotal, recordsComplete: +p.recordsComplete }); return {}; },
    apiDeleteBaselineAggregate: (t, bid) => { need(t); baseline.splice(baseline.findIndex((b) => b.id === bid), 1); return {}; },
    apiSaveObservation: (t, p) => { need(t); observations.push({ id: id("ob"), ...p }); return {}; },
    apiResetPilotData: (t, c) => { need(t); if (c !== "ลบข้อมูลนำร่อง") err("ข้อความยืนยันไม่ถูกต้อง"); return { deletedEvents: 0, deletedInspections: 0 }; },
    apiListLogs: (t) => { need(t); return { logins: loginLogs, audits: auditLogs }; },
    apiListUsers: (t) => { need(t); return { users }; },
    apiSaveUser: (t, p) => { need(t); let u = users.find((x) => x.id === p.id); if (!u) { if (!p.password) err("กรุณากำหนดรหัสผ่านเริ่มต้น"); u = { id: id("u") }; users.push(u); } Object.assign(u, { username: p.username, displayName: p.displayName, role: p.role, position: p.position, staffCode: p.staffCode, researchConsent: p.researchConsent, active: p.active }); return { users }; },
    apiDeleteUser: (t, uid) => { need(t); users.find((u) => u.id === uid).active = false; return { users }; },
    apiSaveSettings: (t, p) => { need(t); Object.entries(p).forEach(([k, v]) => { if (k !== "LINE_CHANNEL_ACCESS_TOKEN") settings[k] = v; }); return { data: appData() }; },
    apiFlexPreview: (t) => { need(t); return JSON.parse(JSON.stringify(FLEX_SAMPLE)); },
    apiTestNotify: (t) => { need(t); return { line: { ok: true, message: "ส่ง LINE สำเร็จ" }, push: { sent: 4, failed: 0 } }; },
    apiSendExpiryReport: (t) => { need(t); return { items: appData().stats.expiredItems + appData().stats.nearItems }; },
    apiSavePushSubscription: () => ({ ok: true }),
    apiRemovePushSubscription: () => ({ ok: true }),
    apiExportResearch: (t) => {
      need(t);
      const m = (a, b) => (a && b ? Math.round(((new Date(b) - new Date(a)) / MIN) * 10) / 10 : "");
      return {
        events: events.filter((e) => e.caseStatus !== "cancelled").map((e) => { const l = locations.find((x) => x.id === e.locationId) || {}; return { event_id: e.eventCode, period: e.period, source: e.source, unit: l.name, in_study: l.inStudy ? 1 : 0, box_code: e.boxCode, reason: e.reasonCategory, actual_opened_at: e.actualOpenedAt, unit_notified_at: e.unitNotifiedAt || "", notification_sent_at: e.notificationSentAt || "", notification_status: e.notificationStatus, acknowledged_at: e.acknowledgedAt || "", ready_at: e.readyAt || "", response_min: e.source === "paper" ? m(e.unitNotifiedAt, e.acknowledgedAt) : m(e.notificationSentAt, e.acknowledgedAt), readiness_min: m(e.actualOpenedAt, e.readyAt), required_fields: e.requiredFields, filled_fields: e.filledFields }; }),
        inspections: inspections.map((i) => ({ inspection_id: i.id.slice(-8), period: i.period, box_code: i.boxCode, inspected_at: i.inspectedAt, duration_min: i.durationMin, items_checked: i.itemsChecked, items_expired: i.itemsExpired, is_ready: i.isReady ? 1 : 0 })),
        inspectionItems: [], baseline: baseline.map((b) => ({ month: b.periodMonth, unit: b.locationName, inspections: b.inspections, inspections_ready: b.inspectionsReady, items_checked: b.itemsChecked, items_expired: b.itemsExpired, records_total: b.recordsTotal, records_complete: b.recordsComplete })),
        reportTimings: reportTimings.map((r) => ({ month: r.reportMonth, minutes: r.minutes, source: r.source })), survey: survey.map((s, i) => ({ respondent: `R${i + 1}`, ...s.likert, overall: s.overallScore, accepted: s.accepted ? 1 : 0 })), surveyOpen: [],
      };
    },
    apiAcceptPdpa: (t, v) => { need(t); const u = users.find((x) => x.id === session.id); u.pdpaVersion = v; u.pdpaAcceptedAt = iso(now()); session.pdpaVersion = v; audit("accept_pdpa", { version: v }); return { pdpaVersion: v }; },
    apiConsentStatus: (t) => { need(t); return { enabled: true, waitDays: 7, record: noSig(myC(session.id)) }; },
    apiConsentView: (t) => { need(t); let r = myC(session.id); if (!r || ["declined", "withdrawn"].includes(r.status)) { r = { id: id("cs"), userId: session.id, username: session.username, kind: "research", status: "viewed", docVersion: "แก้ไขครั้งที่ 1", pisFirstViewedAt: iso(now()) }; consents.push(r); } return { record: noSig(r), waitDays: 7 }; },
    apiConsentSign: (t, p) => { need(t); const r = myC(session.id); if (!r || r.status !== "viewed") err("กรุณาอ่านเอกสารชี้แจงก่อนลงนาม"); if (now() < new Date(r.pisFirstViewedAt).getTime() + 7 * DAY) err("ยังไม่ครบระยะเวลาพิจารณา 7 วัน"); Object.assign(r, p, { status: "signed", signedAt: iso(now()) }); users.find((u) => u.id === session.id).researchConsent = true; return { record: noSig(r) }; },
    apiConsentDecline: (t) => { need(t); let r = myC(session.id); if (!r) { r = { id: id("cs"), userId: session.id, kind: "research" }; consents.push(r); } Object.assign(r, { status: "declined", declinedAt: iso(now()) }); return { record: noSig(r) }; },
    apiConsentWithdraw: (t, reason) => { need(t); const r = myC(session.id); Object.assign(r, { status: "withdrawn", withdrawnAt: iso(now()), withdrawReason: reason }); users.find((u) => u.id === session.id).researchConsent = false; return { record: noSig(r) }; },
    apiListConsents: (t) => { need(t); return { users: users.filter((u) => u.active).map((u) => ({ ...u, consent: noSig(myC(u.id)) })) }; },
    apiGetConsent: (t, cid) => { need(t); const r = cid === "mine" ? myC(session.id) : consents.find((c) => c.id === cid); if (!r) err("ไม่พบเอกสาร"); return { record: r }; },
    apiConsentReceive: (t, cid) => { need(t); const r = consents.find((c) => c.id === cid); Object.assign(r, { receivedBy: session.displayName, receivedAt: iso(now()) }); return { record: noSig(r) }; },
    apiSubmitSurveyV2: (p) => { if (!p.consent) err("กรุณายืนยันความยินยอม"); survey.push({ id: id("sv"), ...p, overallScore: 4 }); return { ok: true }; },
  };
  function newEvent(b, p, source) {
    const t = p.actualOpenedAt || iso(now());
    const ev = { id: id("ev"), eventCode: code(t), boxId: b.id, boxCode: b.boxCode, locationId: b.locationId, locationName: locations.find((l) => l.id === b.locationId)?.name || "", actualOpenedAt: t, recordedAt: iso(now()), notificationSentAt: iso(now() + 1500), notificationStatus: "sent", pushSent: 4, pushSentAt: iso(now()), source, openedBy: source === "qr" ? "QR" : session?.displayName, openerName: p.openerName || "", reasonCategory: p.reasonCategory, period: "post", caseStatus: "open", requiredFields: 6, filledFields: 4 + (p.openerName ? 1 : 0) + ((p.itemsUsed || []).length ? 1 : 0), itemsUsedJson: p.itemsUsed || [], note: p.note || "" };
    events.unshift(ev);
    if (p.hn) hnStore[ev.id] = p.hn;
    audit("open_box", { eventCode: ev.eventCode, source });
    return ev;
  }

  window.SEBMock = {
    async call(name, args) {
      await wait(name === "apiLogin" ? 350 : 160);
      const fn = A[name];
      if (!fn) throw new Error(`Demo: ${name} ยังไม่รองรับ`);
      return JSON.parse(JSON.stringify(fn(...args) ?? {}));
    },
  };
})();
