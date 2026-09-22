#!/usr/bin/env node
// scripts/demo_2339.mjs — P05-M8 (SPEC-P05-Action-Layer.md §9 "Kịch bản demo P05",
// §10 "Số đo nghiệm thu"): kịch bản giờ máy chủ 23:39 — chặn đúng luật (BB-02) →
// 09:00 hôm sau đặt được → Hoàn tác, biên nhận gốc vẫn còn với `undone_by`.
//
// TRẠNG THÁI 2026-09-23 (handoff H21): backend thật (gói H19) và tầng hành động
// trong pipeline (gói H20, chặng `action` của `runTurn`) đang thi công SONG SONG,
// CHƯA xong. `lib/simbackend/index.ts::getSimBackend()` hiện là KHUNG — ném lỗi rõ
// ràng khi gọi THẬT (không qua `__setSimBackendForTesting`). Script này BẮT BUỘC
// phát hiện đúng trạng thái đó ở bước TIỀN KIỂM và thoát mã 3 (CHƯA KẾT LUẬN),
// KHÔNG được chạy tiếp `runTurn()` với một backend nửa vời rồi báo "SAI HÀNH VI"
// (mã 1) — nuốt lỗi hạ tầng thành lỗi logic là kết luận GIẢ (AGENTS.md §5.E,
// Đ26/G12). Khi H19+H20 xong, tiền kiểm qua và 6 bước bên dưới chạy thật, đếm lời
// gọi backend qua một PROXY bọc quanh backend thật rồi tiêm lại bằng
// `__setSimBackendForTesting` — không sửa gì thêm ở đây.
//
// Mã thoát: 0 = đủ 6 bước đúng hành vi kỳ vọng (P05-M8); 1 = sai hành vi; 3 = CHƯA
// KẾT LUẬN — backend P05 chưa cài đặt (H19), hoặc lỗi Tầng 1 (429/503, Đ26).

import { loadLocalEnv, requireEnv, classifyError } from "./_batch.mjs";
import { makeSql } from "./_pg.mjs";
import { runTurn } from "../lib/pipeline/index.ts";
import { conversationIdFromLabel } from "../lib/adapters/db.ts";
import { DEMO_RESIDENT_PRINCIPAL } from "./_fixtures.mjs";
import { getSimBackend, __setSimBackendForTesting } from "../lib/simbackend/index.ts";

loadLocalEnv();
requireEnv(["DATABASE_URL"]);
process.env.DATA_BACKEND = "postgres";

/** "YYYY-MM-DD" hôm nay theo giờ Việt Nam (locale `en-CA` cho thứ tự ISO). */
function todayVN(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "YYYY-MM-DD" của ngày kế tiếp một chuỗi "YYYY-MM-DD" (tính theo UTC lịch,
 *  đủ dùng vì chỉ cần cộng đúng một ngày dương lịch — không phụ thuộc giờ). */
function nextDayYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Bọc một `SimBackend` thật để đếm lời gọi từng phương thức (P05-M8: bước 2 phải
 *  đúng 1 lần `getBookingPolicy`, 0 lệnh ghi). */
function makeCountingProxy(realBackend, callCounts) {
  return new Proxy(realBackend, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args) => {
        callCounts.set(String(prop), (callCounts.get(String(prop)) ?? 0) + 1);
        return value.apply(target, args);
      };
    },
  });
}

const WRITE_METHODS = ["createBooking", "cancelBooking", "savePendingAction"];

const sql = makeSql(process.env.DATABASE_URL);
const createdConversationIds = [];
const createdBookingIds = []; // dọn receipts → bookings ở finally (receipts KHÔNG cascade theo bookings)
let exitCode = 0;
let backendReady = true;

try {
  // ── Tiền kiểm: backend P05 (H19) đã cài đặt thật chưa? ──────────────────
  let realBackend;
  try {
    realBackend = await getSimBackend();
  } catch (err) {
    backendReady = false;
    console.log("CHƯA KẾT LUẬN: lib/simbackend chưa được gói H19 cài đặt thật.");
    console.log(`Chi tiết lỗi: ${err?.message ?? err}`);
    console.log(
      "Đây KHÔNG phải lỗi sản phẩm — script không được chạy tiếp với backend nửa vời " +
        "rồi kết luận SAI HÀNH VI (Đ26). Chạy lại script này sau khi H19+H20 xong."
    );
  }

  if (backendReady && realBackend) {
    const callCounts = new Map();
    const proxy = makeCountingProxy(realBackend, callCounts);
    __setSimBackendForTesting(proxy);

    const today = todayVN();
    const tomorrow = nextDayYMD(today);

    // ── Bước 1–5: 23:39, cửa nhận đăng ký đã đóng (BB-02, SPEC-P05 §9) ──────
    process.env.SIM_NOW = `${today}T23:39:00+07:00`;
    callCounts.clear();

    const question = "Đặt giúp tôi sân bóng bàn 9 giờ sáng mai.";
    console.log(`[1] Cư dân (SIM_NOW=${process.env.SIM_NOW}): "${question}"`);

    const label1 = `demo-2339-blocked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conversationId1 = conversationIdFromLabel(label1);
    createdConversationIds.push(conversationId1);

    const step1 = await runTurn({
      conversation_id: conversationId1,
      question_vi: question,
      principal: DEMO_RESIDENT_PRINCIPAL,
    });

    const policyCalls = callCounts.get("getBookingPolicy") ?? 0;
    const writeCalls = WRITE_METHODS.reduce((sum, m) => sum + (callCounts.get(m) ?? 0), 0);
    console.log(`[2] Lời gọi backend trong lượt: getBookingPolicy=${policyCalls} lệnh_ghi=${writeCalls}`);
    if (policyCalls !== 1 || writeCalls !== 0) {
      console.error(
        `SAI HÀNH VI: bước 2 kỳ vọng đúng 1 getBookingPolicy và 0 lệnh ghi, được ` +
          `policyCalls=${policyCalls} writeCalls=${writeCalls} (P05-M8).`
      );
      exitCode = 1;
    }

    const ar1 = step1.action_result ?? null;
    const blockingCodes = ar1?.blocking_reasons?.map((r) => r.code) ?? [];
    console.log(
      `[3] decision=${step1.decision} status=${ar1?.status ?? "—"} ` +
        `blocking_reasons=${JSON.stringify(blockingCodes)} next_intake_open_at=${ar1?.next_intake_open_at ?? "—"}`
    );
    if (step1.decision !== "action" || ar1?.status !== "blocked" || !blockingCodes.includes("intake_closed")) {
      console.error(
        "SAI HÀNH VI: bước 3 kỳ vọng decision=action, status=blocked, blocking_reasons chứa 'intake_closed' (§9)."
      );
      exitCode = 1;
    }

    const answerVi = step1.answer_vi ?? step1.clarify_question_vi ?? "(không có câu trả lời)";
    console.log(`[4] Agent trả lời: ${answerVi}`);

    const mentionsOperatingHours = /mở cửa|giờ hoạt động|giờ mở/i.test(answerVi);
    console.log(
      `[5] Agent KHÔNG được nói giờ HOẠT ĐỘNG của sân (BB-02) — kiểm bằng regex thô: ` +
        `nhắc "giờ mở cửa/hoạt động"=${mentionsOperatingHours}`
    );
    if (mentionsOperatingHours) {
      console.error(
        "SAI HÀNH VI: bước 5 — câu trả lời có vẻ nhắc giờ HOẠT ĐỘNG, đọc lại thủ công để chắc " +
          "không gộp intake_window với operating_hours (BB-02, SPEC-P05 §2.2)."
      );
      exitCode = 1;
    }

    // ── Bước 6: chuyển đồng hồ sang 09:00 hôm sau → đặt lại → Hoàn tác ──────
    process.env.SIM_NOW = `${tomorrow}T09:00:00+07:00`;
    callCounts.clear();

    const label2 = `demo-2339-done-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conversationId2 = conversationIdFromLabel(label2);
    createdConversationIds.push(conversationId2);

    const step2 = await runTurn({
      conversation_id: conversationId2,
      question_vi: question,
      principal: DEMO_RESIDENT_PRINCIPAL,
    });
    const ar2 = step2.action_result ?? null;
    console.log(
      `[6a] Sau 08:30 (SIM_NOW=${process.env.SIM_NOW}): decision=${step2.decision} ` +
        `status=${ar2?.status ?? "—"} receipt_code=${ar2?.receipt_code ?? "—"} slot_start=${ar2?.slot_start ?? "—"} blocking=${JSON.stringify((ar2?.blocking_reasons ?? []).map((r) => r.code))} reason_code=${step2.reason_code ?? "—"} clarify=${step2.clarify_question_vi ?? "—"}`
    );
    if (step2.decision !== "action" || ar2?.status !== "done" || !ar2?.receipt_code || !ar2?.booking_id) {
      console.error(
        "SAI HÀNH VI: bước 6a kỳ vọng decision=action, status=done, kèm receipt_code + booking_id."
      );
      exitCode = 1;
    } else {
      createdBookingIds.push(ar2.booking_id);
      // BB-03: cancel_booking có precheck_capability_id = get_booking_detail — phải gọi
      // TRƯỚC với CÙNG session_id, backend mới nhận lệnh huỷ (SPEC-P05 §5.2, §2.1).
      const undoSession = `demo-2339-undo-${Date.now()}`;
      await proxy.getBookingDetail({
        session_id: undoSession,
        booking_id: ar2.booking_id,
        resident_id: DEMO_RESIDENT_PRINCIPAL.resident_id,
      });
      const cancelResult = await proxy.cancelBooking({
        session_id: undoSession,
        booking_id: ar2.booking_id,
        resident_id: DEMO_RESIDENT_PRINCIPAL.resident_id,
        reason_vi: "Demo P05-M8 — tự dọn sau khi minh hoạ Hoàn tác",
        confirmed: true,
      });
      console.log(
        `[6b] Hoàn tác: ok=${cancelResult.ok} ` +
          `receipt_code=${cancelResult.ok ? cancelResult.receipt_code : "—"}`
      );
      if (!cancelResult.ok) {
        console.error(`SAI HÀNH VI: bước 6b — hoàn tác thất bại: ${JSON.stringify(cancelResult)}.`);
        exitCode = 1;
      } else {
        const receipts = await proxy.listMyReceipts(DEMO_RESIDENT_PRINCIPAL.resident_id);
        const original = receipts.find((r) => r.receipt_code === ar2.receipt_code);
        console.log(
          `[6c] Biên nhận gốc vẫn còn: receipt_code=${original?.receipt_code ?? "—"} ` +
            `undone_by=${original?.undone_by ?? "—"}`
        );
        if (!original || original.undone_by !== cancelResult.receipt_code) {
          console.error(
            "SAI HÀNH VI: bước 6c kỳ vọng biên nhận gốc còn nguyên, undone_by trỏ đúng biên nhận huỷ (§5.2, §6)."
          );
          exitCode = 1;
        }
      }
    }
  }
} catch (err) {
  const classified = classifyError(err);
  if (classified.tier === "tier1") {
    console.log(`BLOCKED: ${classified.kind}`);
    exitCode = 3;
  } else {
    console.error(`LỖI: ${err?.stack ?? err}`);
    exitCode = 1;
  }
} finally {
  __setSimBackendForTesting(null);
  delete process.env.SIM_NOW;
  try {
    if (createdBookingIds.length > 0) {
      await sql("DELETE FROM receipts WHERE booking_id = ANY($1::uuid[])", [createdBookingIds]);
      await sql("DELETE FROM bookings WHERE id = ANY($1::uuid[])", [createdBookingIds]);
    }
    if (createdConversationIds.length > 0) {
      await sql("DELETE FROM conversations WHERE id = ANY($1)", [createdConversationIds]);
    }
  } catch (err) {
    console.error(`CẢNH BÁO: dọn hội thoại demo thất bại: ${err?.message ?? err}`);
  } finally {
    await sql.end();
  }
}

if (!backendReady) exitCode = 3;
process.exit(exitCode);
