// tests/batch.test.ts — Đ26. Kiểm hạ tầng chạy-theo-lô của `scripts/_batch.mjs`
// mà KHÔNG gọi model thật (chính cái hạn mức mà module này sinh ra để tiết kiệm).
//
// Điều đang được canh, nói bằng lời: một ca dính 429 KHÔNG ĐƯỢC biến thành một
// ca trượt. Bản trước của `eval_golden.mjs` có `catch {}` nên hai thứ này lẫn
// vào nhau, và một lượt chạy lúc cạn hạn mức sẽ in ra `M1` thấp trông y như
// chất lượng kém. Đó là số GIẢ — nguy hiểm hơn không có số.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Checkpoint, classifyError, runBatch, sliceCases } from "../scripts/_batch.mjs";

function tmpCkpt(name: string): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "batch-test-")),
    `${name}.jsonl`
  );
}

/** Dựng một lỗi giống lớp lỗi thật của `lib/adapters/model.ts` (so bằng `name`). */
function upstreamError(name: string): Error {
  const e = new Error(`${name}: giả lập`);
  e.name = name;
  return e;
}

test("classifyError tách lỗi hạ tầng (tầng 1) khỏi lỗi logic — §5.E", () => {
  assert.equal(classifyError(upstreamError("UpstreamRateLimited")).tier, "tier1");
  assert.equal(classifyError(upstreamError("UpstreamRateLimited")).quota, true);
  assert.equal(classifyError(upstreamError("UpstreamOverloaded")).tier, "tier1");
  assert.equal(classifyError(upstreamError("UpstreamAuthError")).tier, "tier1");
  // 503 quá tải KHÔNG phải cạn hạn mức — không được tính vào chuỗi dừng sớm.
  assert.equal(classifyError(upstreamError("UpstreamOverloaded")).quota, false);
  // Lỗi bất biến pipeline là lỗi THẬT của sản phẩm, phải được kết luận.
  assert.equal(classifyError(upstreamError("PipelineInvariantError")).tier, "logic");
  assert.equal(classifyError(new Error("vỡ bất kỳ")).tier, "logic");
  // ContractDriftError = model trả sai schema. Đó là CHẤT LƯỢNG model, đúng thứ
  // Golden đang đo — KHÔNG được xếp vào hạ tầng rồi bỏ qua.
  assert.equal(classifyError(upstreamError("ContractDriftError")).tier, "logic");
});

test("ĐỎ #3 — đứt mạng giữa đường là tầng 1, nhưng TypeError của code thì KHÔNG", () => {
  // Đo thật 2026-09-20: DEF-04 trượt với đúng lỗi này. Bản đầu xếp nó vào
  // `logic` nên một lần đứt cáp bị ghi thành "khuyết tật không kích hoạt đúng".
  const terminated = new TypeError("terminated");
  assert.equal(classifyError(terminated).tier, "tier1");
  assert.equal(classifyError(terminated).quota, false, "đứt mạng KHÔNG phải cạn hạn mức");
  assert.equal(classifyError(new TypeError("fetch failed")).tier, "tier1");

  const reset = new Error("read ECONNRESET");
  // @ts-expect-error — gắn `code` như lỗi socket thật của Node.
  reset.code = "ECONNRESET";
  assert.equal(classifyError(reset).tier, "tier1");

  const wrapped = new Error("gọi model thất bại");
  wrapped.cause = { code: "UND_ERR_SOCKET" };
  assert.equal(classifyError(wrapped).tier, "tier1");

  // VÙNG CẤM của `classifyError`: KHÔNG được gộp cả họ TypeError vào tầng 1.
  // Gộp là biến mọi lỗi lập trình thành "hạ tầng, chạy lại sau" — XANH GIẢ.
  assert.equal(
    classifyError(new TypeError("Cannot read properties of undefined (reading 'x')")).tier,
    "logic",
    "TypeError của lỗi code PHẢI là logic, nếu không thì bug bị che thành lỗi mạng"
  );
  assert.equal(classifyError(new TypeError("x is not a function")).tier, "logic");
});

test("ĐỎ #1 — ca dính hạn mức KHÔNG vào checkpoint và KHÔNG bị tính là trượt", async () => {
  const file = tmpCkpt("quota");
  const ckpt = new Checkpoint(file);
  const items = [
    { __case_id: "C-01" },
    { __case_id: "C-02" },
    { __case_id: "C-03" },
  ];

  const res = await runBatch(
    items,
    1,
    async (item: { __case_id: string }) => {
      if (item.__case_id === "C-02") throw upstreamError("UpstreamRateLimited");
      return { ok: true, rec: { case_id: item.__case_id, ok: true } };
    },
    ckpt
  );

  assert.equal(res.blocked, 1, "ca 429 phải được đếm vào blocked");
  assert.equal(ckpt.has("C-02"), false, "ca 429 KHÔNG được ghi checkpoint");
  assert.equal(ckpt.has("C-01"), true);
  assert.equal(ckpt.has("C-03"), true);
  // Không có ca nào bị ghi là trượt — đây chính là chỗ bản cũ sai.
  assert.equal(
    ckpt.records().filter((r: { ok: boolean }) => !r.ok).length,
    0,
    "hạn mức KHÔNG được biến thành ca trượt"
  );
});

test("ĐỎ #2 — lỗi logic thật thì PHẢI vào checkpoint, đánh dấu trượt", async () => {
  const file = tmpCkpt("logic");
  const ckpt = new Checkpoint(file);
  const res = await runBatch(
    [{ __case_id: "C-09" }],
    1,
    async () => {
      throw upstreamError("PipelineInvariantError");
    },
    ckpt
  );

  assert.equal(res.blocked, 0, "lỗi logic KHÔNG phải blocked");
  assert.equal(ckpt.has("C-09"), true, "lỗi logic là một KẾT LUẬN, phải ghi lại");
  assert.equal(ckpt.records()[0].ok, false);
  assert.equal(ckpt.records()[0].error_class, "PipelineInvariantError");
});

test("dừng sớm sau 3 lần dính hạn mức LIÊN TIẾP, giữ nguyên checkpoint", async () => {
  const file = tmpCkpt("streak");
  const ckpt = new Checkpoint(file);
  const items = Array.from({ length: 20 }, (_, i) => ({ __case_id: `C-${i}` }));
  let attempts = 0;

  const res = await runBatch(
    items,
    1,
    async () => {
      attempts++;
      throw upstreamError("UpstreamRateLimited");
    },
    ckpt
  );

  assert.equal(res.stoppedEarly, true);
  assert.equal(attempts, 3, "phải dừng đúng sau 3 lần, không đốt hết 20 ca");
  assert.equal(ckpt.records().length, 0);
});

test("một ca đi trọn thì reset chuỗi hạn mức — 429 rải rác không làm dừng oan", async () => {
  const file = tmpCkpt("interleave");
  const ckpt = new Checkpoint(file);
  // Xen kẽ: hỏng, tốt, hỏng, tốt, hỏng, tốt — không bao giờ đủ 3 lần liên tiếp.
  const items = Array.from({ length: 6 }, (_, i) => ({ __case_id: `C-${i}` }));

  const res = await runBatch(
    items,
    1,
    async (item: { __case_id: string }) => {
      const n = Number(item.__case_id.split("-")[1]);
      if (n % 2 === 0) throw upstreamError("UpstreamRateLimited");
      return { ok: true, rec: { case_id: item.__case_id, ok: true } };
    },
    ckpt
  );

  assert.equal(res.stoppedEarly, false, "429 xen kẽ KHÔNG được làm dừng sớm");
  assert.equal(res.blocked, 3);
  assert.equal(ckpt.records().length, 3);
});

test("Checkpoint nạp lại được từ đĩa — nền tảng của --resume", () => {
  const file = tmpCkpt("resume");
  const first = new Checkpoint(file);
  first.append({ case_id: "C-01", ok: true });
  first.append({ case_id: "C-02", ok: false });

  const reopened = new Checkpoint(file);
  assert.equal(reopened.has("C-01"), true);
  assert.equal(reopened.has("C-02"), true);
  assert.equal(reopened.has("C-03"), false);
  assert.equal(reopened.records().length, 2);
});

test("Checkpoint bỏ qua dòng hỏng do bị ngắt giữa chừng, không ném", () => {
  const file = tmpCkpt("corrupt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"case_id":"C-01","ok":true}\n{"case_id":"C-0\n', "utf8");
  const ckpt = new Checkpoint(file);
  assert.equal(ckpt.has("C-01"), true);
  assert.equal(ckpt.records().length, 1, "dòng ghi dở bị bỏ, ca đó sẽ chạy lại");
});

test("sliceCases cắt lô theo --limit/--offset và lọc theo --only", () => {
  const cases = Array.from({ length: 10 }, (_, i) => ({ case_id: `C-${i}` }));
  const argv = process.argv;
  try {
    process.argv = ["node", "x", "--limit=3"];
    assert.deepEqual(
      sliceCases(cases, (c: { case_id: string }) => c.case_id).map((c: { case_id: string }) => c.case_id),
      ["C-0", "C-1", "C-2"]
    );

    process.argv = ["node", "x", "--offset=7", "--limit=5"];
    assert.deepEqual(
      sliceCases(cases, (c: { case_id: string }) => c.case_id).map((c: { case_id: string }) => c.case_id),
      ["C-7", "C-8", "C-9"],
      "lô cuối ngắn hơn limit là hợp lệ, không được lặp vòng"
    );

    process.argv = ["node", "x", "--only=C-4,C-9", "--limit=1"];
    assert.deepEqual(
      sliceCases(cases, (c: { case_id: string }) => c.case_id).map((c: { case_id: string }) => c.case_id),
      ["C-4", "C-9"],
      "--only phải thắng --limit"
    );
  } finally {
    process.argv = argv;
  }
});
