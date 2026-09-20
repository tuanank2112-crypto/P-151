#!/usr/bin/env node
// scripts/report_facility_rules.mjs — tính has_authoritative_rules theo facility_id
// (SPEC-P00 §4), đọc trực tiếp knowledge/ thay vì SQL vì DB chưa được seed.
//
// Danh sách facility_id: 12 tiện ích có mục đặt chỗ (SPEC-P00 §3.4) + 2 tiện ích
// có nội quy nhưng KHÔNG có mục đặt chỗ (FAC-PLAYGROUND, FAC-OUTDOOR-GYM) = 14.
// Kỳ vọng sau khi seed đúng: 13 true, 1 false (FAC-PICKLEBALL — mồ côi có chủ ý).
//
// LƯU Ý SPEC: bảng §3.2 ghi facility_ids của OCP1-FISHING-DECK-RULES-001 là
// `FAC-FISHING-DECK`, nhưng danh mục 12 facility_id chuẩn ở §3.4 lại dùng
// `FAC-FISHING-LAKE` (không có FAC-FISHING-DECK trong 12 mã đó). Đây là một chỗ
// SPEC-P00 tự mâu thuẫn — đã ghi vào report R02. Script này và dữ liệu
// knowledge/ dùng `FAC-FISHING-LAKE` vì đó là mã được §4 dùng để tính
// has_authoritative_rules (nguồn chân lý của K-M4).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const KDIR = path.join(ROOT, "knowledge");

const FACILITY_IDS = [
  "FAC-PINGPONG", "FAC-BASKETBALL", "FAC-VOLLEYBALL", "FAC-FISHING-LAKE",
  "FAC-PICKLEBALL", "FAC-BBQ", "FAC-SALT-LAKE", "FAC-KAYAK", "FAC-BADMINTON",
  "FAC-POOL-KTP", "FAC-POOL-TP", "FAC-TENNIS",
  "FAC-PLAYGROUND", "FAC-OUTDOOR-GYM",
];

const manifest = JSON.parse(fs.readFileSync(path.join(KDIR, "manifest.json"), "utf8"));
const docById = new Map(manifest.documents.map(d => [d.document_id, d]));

const allSections = [];
for (const d of manifest.documents) {
  const p = path.join(KDIR, "sections", `${d.document_id}.json`);
  const secs = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const s of secs) allSections.push({ ...s, document_id: d.document_id });
}

function hasAuthoritativeRules(facilityId) {
  return allSections.some(s => {
    if (!(s.facility_ids ?? []).includes(facilityId)) return false;
    if (s.is_excluded) return false;
    const d = docById.get(s.document_id);
    if (!d) return false;
    return d.status === "Approved" && d.effective_status === "Current" && d.allowed_for_rag === true;
  });
}

const results = FACILITY_IDS.map(f => ({ facility_id: f, has_authoritative_rules: hasAuthoritativeRules(f) }));
const trueList = results.filter(r => r.has_authoritative_rules);
const falseList = results.filter(r => !r.has_authoritative_rules);

for (const r of results) console.log(`${r.facility_id}\t${r.has_authoritative_rules}`);
console.log(
  `has_authoritative_rules true: ${trueList.length} · false: ${falseList.length} (${falseList.map(r => r.facility_id).join(", ") || "-"})`
);
process.exit(0);
