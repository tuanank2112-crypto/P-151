#!/usr/bin/env node
// scripts/validate_knowledge.mjs — kiểm Knowledge Pack TRƯỚC khi seed vào DB.
// Exit 0 = PASS. Exit 1 = có lỗi (in mã lỗi + chi tiết). Exit 2 = sai cách dùng.
//
// Đường dẫn theo SPEC-P00 §2: evals/golden/expected_defects.json.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const KDIR = path.join(ROOT, "knowledge");
const DEFECTS_FILE = path.join(ROOT, "evals", "golden", "expected_defects.json");
const EXPECT_DOCS = 19, MIN_SECTIONS = 97, BODY_MIN = 60, BODY_MAX = 900;
const errors = [];
const fail = (code, msg) => errors.push(`${code}: ${msg}`);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { fail("ManifestSchemaError", `${p} — ${e.message}`); return null; }
}

const manifest = readJson(path.join(KDIR, "manifest.json"));
const defectSpec = readJson(DEFECTS_FILE);
if (!manifest || !defectSpec) { report(); process.exit(1); }

// ── 1. manifest ────────────────────────────────────────────────────────────
const docs = manifest.documents ?? [];
if (docs.length !== EXPECT_DOCS) fail("ManifestSchemaError", `documents = ${docs.length}, expected ${EXPECT_DOCS}`);
const docIds = new Set();
for (const d of docs) {
  if (docIds.has(d.document_id)) fail("DuplicateIdError", `document_id ${d.document_id}`);
  docIds.add(d.document_id);
  for (const f of ["title_vi", "doc_kind", "version", "status", "effective_status", "effective_from", "source_note_vi"])
    if (d[f] === undefined || d[f] === null || d[f] === "") fail("ManifestSchemaError", `${d.document_id} thiếu ${f}`);
  if (typeof d.allowed_for_rag !== "boolean") fail("ManifestSchemaError", `${d.document_id} allowed_for_rag không phải boolean`);
  if (d.effective_to && d.effective_to < d.effective_from)
    fail("ManifestSchemaError", `${d.document_id} effective_to < effective_from`);
}

// ── 2. sections ────────────────────────────────────────────────────────────
const sectionIds = new Set();
const sectionsByDoc = new Map();
let totalSections = 0;
for (const d of docs) {
  const p = path.join(KDIR, "sections", `${d.document_id}.json`);
  if (!fs.existsSync(p)) { fail("ManifestSchemaError", `thiếu file section: ${p}`); continue; }
  const secs = readJson(p); if (!secs) continue;
  sectionsByDoc.set(d.document_id, secs);
  totalSections += secs.length;
  for (const s of secs) {
    if (sectionIds.has(s.section_id)) fail("DuplicateIdError", `section_id ${s.section_id}`);
    sectionIds.add(s.section_id);
    const len = (s.body_vi ?? "").length;
    if (len < BODY_MIN || len > BODY_MAX)
      fail("BodyLengthError", `${s.section_id} body_vi = ${len} ký tự (cho phép ${BODY_MIN}-${BODY_MAX})`);
    if (s.is_excluded === true && !s.exclusion_note_vi)
      fail("ManifestSchemaError", `${s.section_id} is_excluded=true nhưng thiếu exclusion_note_vi`);
  }
}
if (totalSections < MIN_SECTIONS) fail("ManifestSchemaError", `sections = ${totalSections}, tối thiểu ${MIN_SECTIONS}`);

// ── 3. bốn khuyết tật cài sẵn ──────────────────────────────────────────────
const findSection = (id) => {
  for (const [doc, secs] of sectionsByDoc) { const s = secs.find(x => x.section_id === id); if (s) return { doc, s }; }
  return null;
};
let defectsOk = 0;
for (const def of defectSpec.defects) {
  const before = errors.length;
  if (def.kind === "gap" && def.forbidden_term) {
    const term = def.forbidden_term.toLowerCase();
    for (const [doc, secs] of sectionsByDoc)
      for (const s of secs)
        if (`${s.heading_vi} ${s.body_vi}`.toLowerCase().includes(term))
          fail("DefectMissingError", `${def.id}: từ khoá cấm "${def.forbidden_term}" xuất hiện ở ${s.section_id} (${doc})`);
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section neo ${def.anchor_section_id}`);
  }
  if (def.kind === "gap" && def.forbidden_section_topic) {
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section neo ${def.anchor_section_id}`);
  }
  if (def.kind === "conflict") {
    const members = [];
    for (const [, secs] of sectionsByDoc)
      for (const s of secs) if (s.conflict_group === def.conflict_group) members.push(s.section_id);
    if (members.length < 2)
      fail("DefectMissingError", `${def.id}: conflict_group ${def.conflict_group} chỉ có ${members.length} thành viên, cần >= 2`);
    for (const need of def.member_section_ids)
      if (!members.includes(need))
        fail("DefectMissingError", `${def.id}: thiếu ${need} trong conflict_group ${def.conflict_group}`);
  }
  if (def.kind === "expired") {
    const d = docs.find(x => x.document_id === def.anchor_document_id);
    if (!d) fail("DefectMissingError", `${def.id}: thiếu tài liệu ${def.anchor_document_id}`);
    else for (const [k, v] of Object.entries(def.required_metadata))
      if (d[k] !== v) fail("DefectMissingError", `${def.id}: ${def.anchor_document_id}.${k} = ${JSON.stringify(d[k])}, cần ${JSON.stringify(v)}`);
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section ${def.anchor_section_id}`);
  }
  if (errors.length === before) defectsOk++;
}

function report() {
  const docsN = (manifest?.documents ?? []).length;
  console.log(`documents: ${docsN} · sections: ${totalSections} · defects_ok: ${defectsOk}/${defectSpec?.defects?.length ?? 0}`);
  if (errors.length) { console.log(`errors: ${errors.length}`); errors.forEach(e => console.log(`  ${e}`)); }
}
report();
process.exit(errors.length ? 1 : 0);
