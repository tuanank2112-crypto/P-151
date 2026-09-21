#!/usr/bin/env node
// scripts/embed_cache.mjs — đệm embedding ra file cho 98 chunk của
// `knowledge/` (Đ18, luật §4 handoff H04: "đệm ra file, chạy lại chỉ bù phần
// thiếu — trần đo được 15 song song, đừng bắn ồ ạt"). Giới hạn song song đã
// nằm SẴN trong `lib/adapters/model.ts` (MAX_CONCURRENCY=4, Đ19) — script
// này chỉ cần gọi `embedText()` cho từng chunk còn thiếu, không tự làm
// semaphore riêng.
//
// `--probe`: đo MỘT câu, in `norm_before_l2` (trước chuẩn hoá — kỳ vọng
// ≈0.4345 ở 384 chiều, Đ20) và `norm_after_l2` (sau chuẩn hoá — BẮT BUỘC
// 1.0000). Không đụng file cache.
//
// Không cờ: nạp `knowledge/`, embed CHUNK CÒN THIẾU trong cache, ghi lại
// `lib/adapters/embedding-cache.json`. CHỈ ĐỌC `knowledge/` (CẤM chạm
// knowledge/**).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embedText, EMBEDDING_DIMS } from "../lib/adapters/model.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge");
const CACHE_FILE = path.join(ROOT, "lib", "adapters", "embedding-cache.json");

async function probe() {
  const sample = "Bể bơi mở cửa từ mấy giờ đến mấy giờ?";
  const { raw_norm, normalized } = await embedText(sample);
  const normAfter = Math.sqrt(normalized.reduce((s, x) => s + x * x, 0));
  console.log(`dims: ${normalized.length}`);
  console.log(`norm_before_l2: ${raw_norm.toFixed(4)}`);
  console.log(`norm_after_l2: ${normAfter.toFixed(4)}`);
  process.exitCode = 0;
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 0));
}

async function loadAllChunks() {
  const manifest = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, "manifest.json"), "utf8"));
  const chunks = [];
  for (const d of manifest.documents) {
    const secs = JSON.parse(
      fs.readFileSync(path.join(KNOWLEDGE_DIR, "sections", `${d.document_id}.json`), "utf8")
    );
    for (const s of secs) {
      chunks.push({ chunk_id: s.section_id, content_vi: s.body_vi });
    }
  }
  return chunks;
}

async function fillCache() {
  const cache = loadCache();
  const chunks = await loadAllChunks();
  const missing = chunks.filter((c) => !cache[c.chunk_id]);
  console.log(`chunks: ${chunks.length} · cached: ${chunks.length - missing.length} · missing: ${missing.length}`);

  let done = 0;
  await Promise.all(
    missing.map(async (c) => {
      const { normalized } = await embedText(c.content_vi);
      cache[c.chunk_id] = { dims: EMBEDDING_DIMS, vector: normalized };
      done++;
      if (done % 10 === 0) console.log(`... ${done}/${missing.length}`);
    })
  );
  saveCache(cache);
  console.log(`embedded_now: ${missing.length} · cache_total: ${Object.keys(cache).length}`);
  process.exitCode = 0;
}

if (process.argv.includes("--probe")) {
  await probe();
} else {
  await fillCache();
}
