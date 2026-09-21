#!/usr/bin/env node
// scripts/run_tests.mjs — wrapper cho `npm test`, cho phép lọc theo TÊN FILE
// khi gọi `npm test -- <chuỗi con>` (ví dụ `npm test -- confidence` chỉ chạy
// `tests/confidence.test.ts`). `node --test <chuỗi>` gốc coi tham số là
// đường dẫn, không phải bộ lọc — TESTING-ACCEPTANCE.md dùng cú pháp
// `npm run test -- <tên>` xuyên suốt (T-CONF, T-STEP, T-CITE, …), nên cần
// wrapper này để cú pháp đó chạy đúng như tài liệu. Không tham số ⇒ chạy hết.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "..", "tests");

const filter = process.argv[2];
const allFiles = readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.ts"));
const matched = filter ? allFiles.filter((f) => f.includes(filter)) : allFiles;

if (filter && matched.length === 0) {
  console.error(`Không tìm thấy test nào khớp "${filter}" trong tests/`);
  process.exit(1);
}

const files = matched.map((f) => path.join("tests", f));
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});
process.exitCode = result.status ?? 1;
