#!/usr/bin/env node
// scripts/validate_policy.mjs — P05-M2 (SPEC-P05-Action-Layer.md §10, BB-02):
// đọc `db/seed/facilities.json` (nguồn seed dùng chung cho MemorySimBackend
// và migration 006) và chứng minh:
//   1. `intake_windows` hợp lệ ("HH:MM" tăng dần, days_of_week ⊆ 0..6).
//   2. `operating_hours` hợp lệ (cùng luật).
//   3. `separated: true` — TIÊU CHÍ TÁCH RỜI của gói này (không có trong
//      SPEC theo nghĩa "chứng minh cả 14 KHÁC nhau": hai tiện ích KHÔNG
//      bookable (`FAC-PLAYGROUND`, `FAC-OUTDOOR-GYM`) không có quy trình
//      NHẬN ĐĂNG KÝ, `intake_windows` của chúng cố ý để rỗng — kiểm chỉ áp
//      cho 12 tiện ích `is_bookable=true`): với MỌI tiện ích bookable,
//      không tiện ích nào có `intake_windows` trùng khít (từng cặp
//      days_of_week/start/end) với `operating_hours` — nếu trùng thì BB-02
//      coi như đã bị GỘP nhầm hai trục t_submit/t_slot.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const SEED_FILE = path.join(ROOT, "db", "seed", "facilities.json");
const facilities = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));

const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const errors = [];

function hmToMinutes(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function validateWindows(facilityId, label, windows) {
  for (const w of windows) {
    if (!Array.isArray(w.days_of_week) || w.days_of_week.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      errors.push(`${facilityId}.${label}: days_of_week không hợp lệ: ${JSON.stringify(w.days_of_week)}`);
    }
    const startKey = label === "intake_windows" ? "start_time" : "open_time";
    const endKey = label === "intake_windows" ? "end_time" : "close_time";
    if (!HM_RE.test(w[startKey]) || !HM_RE.test(w[endKey])) {
      errors.push(`${facilityId}.${label}: giờ không đúng dạng HH:MM: ${w[startKey]}..${w[endKey]}`);
      continue;
    }
    if (hmToMinutes(w[startKey]) >= hmToMinutes(w[endKey])) {
      errors.push(`${facilityId}.${label}: start >= end (${w[startKey]}..${w[endKey]})`);
    }
  }
}

function windowsEqual(a, b) {
  if (a.length !== b.length) return false;
  const norm = (list, startKey, endKey) =>
    list
      .map((w) => `${[...w.days_of_week].sort().join(",")}|${w[startKey]}|${w[endKey]}`)
      .sort()
      .join(";");
  return norm(a, "start_time", "end_time") === norm(b, "open_time", "close_time");
}

for (const f of facilities) {
  validateWindows(f.facility_id, "intake_windows", f.intake_windows);
  validateWindows(f.facility_id, "operating_hours", f.operating_hours);
}

const bookable = facilities.filter((f) => f.is_bookable);
let separated = true;
for (const f of bookable) {
  if (windowsEqual(f.intake_windows, f.operating_hours)) {
    separated = false;
    errors.push(`${f.facility_id}: intake_windows TRÙNG KHÍT operating_hours — nghi ngờ gộp hai trục (BB-02)`);
  }
}

const intakeOk = errors.filter((e) => e.includes("intake_windows")).length === 0;
const operatingOk = errors.filter((e) => e.includes("operating_hours") && !e.includes("TRÙNG KHÍT")).length === 0;

console.log(`intake_windows: ${intakeOk ? "ok" : "FAIL"} · operating_hours: ${operatingOk ? "ok" : "FAIL"} · separated: ${separated}`);

if (errors.length > 0) {
  for (const e of errors) console.error(`VALIDATE_ERROR: ${e}`);
  process.exit(1);
}
process.exit(0);
