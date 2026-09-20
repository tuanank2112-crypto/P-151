import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

async function readAllMigrations(): Promise<string> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const contents = await Promise.all(
    files.map((f) => readFile(path.join(MIGRATIONS_DIR, f), "utf8"))
  );
  return contents.join("\n");
}

const REQUIRED_TABLES = [
  "documents",
  "sections",
  "chunks",
  "users",
  "conversations",
  "messages",
  "answer_turns",
  "review_queue",
];

test("db/migrations chứa đủ 8 bảng bắt buộc của 01-CONTRACTS.md §3, §6", async () => {
  const sql = await readAllMigrations();
  for (const table of REQUIRED_TABLES) {
    assert.match(
      sql,
      new RegExp(`CREATE TABLE ${table}\\b`),
      `thiếu CREATE TABLE ${table}`
    );
  }
});

test("db/migrations không chứa bảng của P05 (bookings, receipts) — Đ03/VC-09", async () => {
  const sql = await readAllMigrations();
  assert.doesNotMatch(sql, /CREATE TABLE bookings\b/);
  assert.doesNotMatch(sql, /CREATE TABLE receipts\b/);
});

test("db/migrations định nghĩa đủ enum reason_code (15 giá trị) và lifecycle_state (4 giá trị)", async () => {
  const sql = await readAllMigrations();
  const reasonCodeMatch = sql.match(/CREATE TYPE reason_code AS ENUM \(([^)]*)\)/s);
  assert.ok(reasonCodeMatch, "thiếu CREATE TYPE reason_code");
  const reasonCodeValues = reasonCodeMatch![1].split(",").filter((s) => s.trim().length > 0);
  assert.equal(reasonCodeValues.length, 15);

  const lifecycleMatch = sql.match(/CREATE TYPE lifecycle_state AS ENUM \(([^)]*)\)/s);
  assert.ok(lifecycleMatch, "thiếu CREATE TYPE lifecycle_state");
  const lifecycleValues = lifecycleMatch![1].split(",").filter((s) => s.trim().length > 0);
  assert.equal(lifecycleValues.length, 4);
});
