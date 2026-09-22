// lib/pipeline/action.ts — NHÁNH HÀNH ĐỘNG của pipeline (Đ48, SPEC-P05).
//
// `lib/simbackend/` là BACKEND CƯ DÂN MÔ PHỎNG do chúng ta tự viết (Đ02). Mọi tên
// lệnh, trường, mã lỗi dùng ở đây là hợp đồng tự định nghĩa — KHÔNG phải API
// Vinhomes, KHÔNG có lời gọi mạng nào ra ngoài.
//
// Vai trò: cư dân CHAT MỤC ĐÍCH ("đặt giúp tôi sân bóng bàn 9h sáng mai"); file
// này lo phần dưới — đọc chính sách → kiểm điều kiện → ghi → biên nhận. KHÔNG có
// màn thao tác từng bước (Đ48 mục 2). Chỉ hỏi lại khi thiếu dữ kiện hoặc khi lệnh
// không hoàn tác được (B2).
//
// VÙNG CẤM của file này (đã cân nhắc, quyết định KHÔNG làm):
//   - CẤM thêm agent thứ 4 (VC-01). Nhánh này là TOOL của pipeline, không phải
//     một model mới: không một lời gọi model nào trong file.
//   - CẤM thử lệnh ghi để dò luật (VC-10, P05-C7). Thứ tự bất biến là
//     getBookingPolicy → checkEligibility → createBooking, không đảo, không bỏ.
//   - CẤM retry khi `WriteTimeout` (P05-C10). Lệnh đã gửi; gọi lại là đặt hai lần.
//   - CẤM dùng kết quả hành động làm evidence cho phát biểu nội quy (BB-01,
//     P05-C8). Lượt `action` trả `citations: []` và KHÔNG nói câu luật nào.
//   - CẤM gộp cửa NHẬN ĐĂNG KÝ với GIỜ HOẠT ĐỘNG (BB-02, P05-C6). Xem
//     `IntakeFacts` bên dưới: câu trả lời bị chặn được dựng từ một kiểu KHÔNG
//     CHỨA `operating_hours`, nên compiler là người canh luật này, không phải
//     người đọc review.

// Hai đường import CỐ Ý tách đôi: kiểu + hằng + lớp lỗi lấy thẳng từ
// `./contract.ts` (hợp đồng, ổn định), còn `./index.ts` chỉ dùng đúng một thứ
// là hàm lấy backend. `lib/simbackend/index.ts` là file gói H19 đang viết; gom
// cả hai vào đó thì mỗi lần H19 đổi danh sách re-export là nhánh này gãy theo.
import { getSimBackend } from "../simbackend/index.ts";
import {
  idempotencyKeyFor,
  SimBackendError,
  type BlockingReason,
  type BookingPolicy,
  type BookingRecord,
  type SimBackend,
} from "../simbackend/contract.ts";
import type {
  ActionBlockingReason,
  ActionBookingView,
  ActionCapability,
  ActionRequest,
  ActionResult,
  Decision,
  Principal,
  ReasonCode,
} from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────
// Nhật ký cảnh báo cho lượt ghi không rõ kết quả (B3)
// ─────────────────────────────────────────────────────────────────────────

export interface ActionAuditRecord {
  level: "warn";
  event: string;
  payload: Record<string, unknown>;
}

/**
 * SPEC-P05 §7 buộc `WriteTimeout` phải để lại một dòng `audit_log` mức `warn`.
 * Ở vòng này pipeline KHÔNG có đường ghi `audit_log` nào dùng lại được: mọi
 * `INSERT INTO audit_log` hiện nằm trong các CTE của `lib/adapters/bql-store.ts`,
 * và cả `bql-store.ts` lẫn `db.ts` đều NGOÀI phạm vi gói H20. Nên ở đây cảnh báo
 * được đẩy qua một sink đổi được: mặc định in ra stderr theo đúng hình dạng một
 * dòng audit, test tiêm sink giả để đếm. Việc nối sink này vào bảng `audit_log`
 * thật cần mở `DataStore` — đã ghi làm việc treo trong report R23.
 */
type ActionAuditSink = (record: ActionAuditRecord) => void;

const defaultAuditSink: ActionAuditSink = (record) => {
  process.stderr.write(`audit_log ${JSON.stringify(record)}\n`);
};
let auditSink: ActionAuditSink = defaultAuditSink;

/** CHỈ dùng trong `tests/`. Gọi lại với `null` để trả về sink mặc định. */
export function __setActionAuditSinkForTesting(sink: ActionAuditSink | null): void {
  auditSink = sink ?? defaultAuditSink;
}

function auditWarn(event: string, payload: Record<string, unknown>): void {
  auditSink({ level: "warn", event, payload });
}

// ─────────────────────────────────────────────────────────────────────────
// Thời gian — chuỗi ISO CÓ offset là nguồn chân lý, không quy về UTC
// ─────────────────────────────────────────────────────────────────────────

const VN_OFFSET_MINUTES = 7 * 60;

/**
 * `Date` → ISO-8601 có offset `+07:00` (Đ48 mục 6). Dùng cho `server_time` gửi
 * A1 và cho mốc `created_at`/`expires_at` của hành động chờ.
 *
 * CẤM thay bằng `toISOString()` trần: nó trả hậu tố `Z`, và A1 đọc "23:39Z" sẽ
 * quy "9 giờ sáng mai" lệch đúng 7 tiếng — chính là cảnh 23:39 của §9 bị hỏng.
 */
export function toVnIso(d: Date): string {
  const shifted = new Date(d.getTime() + VN_OFFSET_MINUTES * 60_000);
  return `${shifted.toISOString().slice(0, 19)}+07:00`;
}

/** "2026-09-20T23:39:00+07:00" → "23:39". Đọc thẳng phần giờ ĐÃ ở múi của
 *  chuỗi, không dựng `Date` — dựng `Date` là quy về UTC rồi phải có bảng múi
 *  giờ mới quay lại được, thừa và dễ lệch. */
/** Chuỗi kết thúc bằng `Z` (UTC) ⇒ quy về +07:00 TRƯỚC khi đọc giờ — phòng thủ
 *  cho backend nào trả UTC trần; chuỗi đã có offset thì giữ nguyên. */
function ensureVn(iso: string): string {
  if (/Z$/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return toVnIso(d);
  }
  return iso;
}

export function clockVi(isoRaw: string): string {
  const iso = ensureVn(isoRaw);
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : iso;
}

/** "2026-09-21T09:00:00+07:00" → "21/09". */
export function dateVi(isoRaw: string): string {
  const iso = ensureVn(isoRaw);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}

function addMinutesIso(iso: string, minutes: number): string {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return iso;
  return toVnIso(new Date(base.getTime() + minutes * 60_000));
}

// ─────────────────────────────────────────────────────────────────────────
// Câu trả lời khi bị chặn — BB-02 do compiler canh
// ─────────────────────────────────────────────────────────────────────────

/**
 * Đúng những dữ kiện được phép xuất hiện trong câu "chưa đặt được vì …".
 *
 * `operating_hours`, `operating_now`, `closure_dates` CỐ Ý không có mặt: câu
 * chính sách NHẬN ĐĂNG KÝ không cho biết tiện ích mở cửa lúc nào, và suy ra là
 * hallucination (BB-02, SPEC-P05 §2.2, §9 bước 5). Thu hẹp kiểu ở đây khiến lỗi
 * đó thành lỗi biên dịch chứ không còn là lỗi rà soát bằng mắt.
 */
export type IntakeFacts = Pick<
  BookingPolicy,
  "server_time" | "facility_name_vi" | "intake_windows" | "next_intake_open_at" | "slot_calendar"
>;

export function blockedMessageVi(
  facts: IntakeFacts,
  reasons: BlockingReason[],
  slotStart: string | null
): string {
  const parts: string[] = [`Bây giờ ${clockVi(facts.server_time)}.`];
  const intakeClosed = reasons.find((r) => r.code === "intake_closed");

  if (intakeClosed) {
    const w = facts.intake_windows[0];
    if (w) {
      parts.push(`Ban quản lý chỉ nhận đăng ký ${facts.facility_name_vi} từ ${w.start_time} đến ${w.end_time}.`);
    } else {
      parts.push(intakeClosed.human_message_vi);
    }
    const slot = slotStart
      ? facts.slot_calendar.find((s) => s.slot_start === slotStart && s.capacity_remaining > 0)
      : undefined;
    if (slot) {
      parts.push(`Slot ${clockVi(slot.slot_start)} ngày ${dateVi(slot.slot_start)} còn chỗ.`);
    }
    const reopen = facts.next_intake_open_at ?? intakeClosed.next_valid_at;
    if (reopen) {
      parts.push(`Anh/chị gửi lại sau ${clockVi(reopen)} ngày ${dateVi(reopen)} là đặt được.`);
    }
  } else {
    for (const r of reasons) {
      parts.push(r.human_message_vi);
      if (r.remediation_hint_vi) parts.push(r.remediation_hint_vi);
    }
  }
  return parts.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────
// Kết quả nhánh — index.ts dựng `TurnResult` từ đây
// ─────────────────────────────────────────────────────────────────────────

export interface ActionBranchOutcome {
  decision: Decision;
  reason_code: ReasonCode | null;
  answer_vi: string | null;
  clarify_question_vi: string | null;
  /** 1 khi hành động đi trọn (done/listed), 0 khi không. CẤM lộ ra UI (BB-05). */
  confidence: number;
  action_result: ActionResult | null;
  step_ok: boolean;
  step_note: string;
}

export interface ActionBranchArgs {
  conversation_id: string;
  principal: Principal;
  action: ActionRequest;
  now: Date;
}

function toActionBlocking(reasons: BlockingReason[]): ActionBlockingReason[] {
  return reasons.map((r) => ({
    code: r.code,
    human_message_vi: r.human_message_vi,
    is_permanent: r.is_permanent,
    next_valid_at: r.next_valid_at,
    remediation_hint_vi: r.remediation_hint_vi,
  }));
}

function emptyResult(capability: ActionCapability): ActionResult {
  return {
    capability,
    status: "blocked",
    facility_id: null,
    facility_name_vi: null,
    slot_start: null,
    slot_end: null,
    booking_id: null,
    receipt_code: null,
    undo_capability_id: null,
    blocking_reasons: [],
    next_intake_open_at: null,
    policy_source: null,
    bookings: [],
    write_calls: 0,
  };
}

function clarify(question_vi: string, note: string, result: ActionResult | null = null): ActionBranchOutcome {
  return {
    decision: "clarify",
    reason_code: null,
    answer_vi: null,
    clarify_question_vi: question_vi,
    confidence: 0,
    action_result: result,
    step_ok: true,
    step_note: note,
  };
}

function actioned(
  result: ActionResult,
  answer_vi: string,
  reason_code: ReasonCode | null,
  note: string
): ActionBranchOutcome {
  const ok = result.status === "done" || result.status === "listed";
  return {
    decision: "action",
    reason_code,
    answer_vi,
    clarify_question_vi: null,
    confidence: ok ? 1 : 0,
    action_result: result,
    step_ok: ok,
    step_note: note,
  };
}

function escalate(reason_code: ReasonCode, note: string): ActionBranchOutcome {
  return {
    decision: "escalate",
    reason_code,
    answer_vi: null,
    clarify_question_vi: null,
    confidence: 0,
    action_result: null,
    step_ok: false,
    step_note: note,
  };
}

function toBookingView(b: BookingRecord): ActionBookingView {
  return {
    booking_id: b.booking_id,
    facility_id: b.facility_id,
    facility_name_vi: b.facility_name_vi,
    slot_start: b.slot_start,
    slot_end: b.slot_end,
    party_size: b.party_size,
    state: b.state,
    receipt_code: b.receipt_code,
  };
}

/** TTL của hành động chờ xác nhận — Đ48 mục 5. */
export const PENDING_ACTION_TTL_MINUTES = 10;

// ─────────────────────────────────────────────────────────────────────────
// Điểm vào
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chạy nhánh hành động. Gọi SAU chặng 5 (`risk`) và THAY cho retrieval→verify —
 * một lượt hành động không đi tra tài liệu, vì biên nhận không phải phát biểu
 * quy định (BB-01).
 *
 * `SimBackendError` được ánh xạ theo SPEC-P05 §7. Mọi lỗi KHÁC được ném tiếp
 * lên: `runTurn` đã có `try/finally` ghi đúng một dòng `answer_turns` (BB-11) và
 * 01-CONTRACTS §… cấm nuốt `PipelineInvariantError`.
 */
export async function runActionBranch(a: ActionBranchArgs): Promise<ActionBranchOutcome> {
  const backend = await getSimBackend();
  try {
    return await dispatch(backend, a);
  } catch (err) {
    if (err instanceof SimBackendError) return mapBackendError(err, a.action.capability);
    throw err;
  }
}

async function dispatch(backend: SimBackend, a: ActionBranchArgs): Promise<ActionBranchOutcome> {
  // Lượt xác nhận: hành động đang chờ được ưu tiên trước mọi capability mới.
  if (a.action.confirmed) {
    const pending = await backend.takePendingAction(a.conversation_id);
    if (pending) return await executePending(backend, a, pending.capability, pending.payload);
    if (!a.action.capability) {
      return clarify(
        "Hiện không có thao tác nào đang chờ xác nhận. Anh/chị cho tôi biết cần làm gì giúp nhé.",
        "confirmed nhưng không có pending"
      );
    }
  }

  const capability = a.action.capability;
  if (!capability) {
    return clarify(
      "Anh/chị cho tôi biết cần đặt, huỷ hay xem lại chỗ nào giúp nhé.",
      "không có capability"
    );
  }

  const residentId = a.principal.resident_id;
  if (!residentId) {
    return actioned(
      { ...emptyResult(capability), status: "blocked" },
      "Tài khoản đang đăng nhập không phải tài khoản cư dân nên tôi không thực hiện được thao tác này.",
      "action_authorization_missing",
      "thiếu resident_id"
    );
  }

  if (capability === "amenity.list_my_bookings") {
    const bookings = await backend.listMyBookings(residentId);
    const result: ActionResult = {
      ...emptyResult(capability),
      status: "listed",
      bookings: bookings.map(toBookingView),
    };
    const active = result.bookings.filter((b) => b.state === "confirmed");
    const answer =
      active.length === 0
        ? "Hiện anh/chị chưa có chỗ nào đang giữ."
        : `Anh/chị đang giữ ${active.length} chỗ: ${active
            .map(
              (b) =>
                `${b.facility_name_vi} lúc ${clockVi(b.slot_start)} ngày ${dateVi(b.slot_start)} (biên nhận ${b.receipt_code})`
            )
            .join("; ")}.`;
    return actioned(result, answer, null, `listed:${active.length}`);
  }

  const propertyId = a.principal.owned_property_ids[0];
  if (!propertyId) {
    return actioned(
      { ...emptyResult(capability), status: "blocked" },
      "Tôi chưa thấy căn hộ nào gắn với tài khoản của anh/chị nên chưa đặt chỗ được. Anh/chị liên hệ Ban quản lý để cập nhật giúp.",
      "action_authorization_missing",
      "thiếu owned_property_ids"
    );
  }

  if (capability === "amenity.cancel_booking") {
    return await startCancel(backend, a, residentId);
  }
  return await createBooking(backend, a, residentId, propertyId);
}

// ── create_booking ──────────────────────────────────────────────────────

async function createBooking(
  backend: SimBackend,
  a: ActionBranchArgs,
  residentId: string,
  propertyId: string
): Promise<ActionBranchOutcome> {
  const capability: ActionCapability = "amenity.create_booking";
  const hint = a.action.facility_hint_vi;
  const facility = hint ? await backend.resolveFacility(hint) : null;
  if (!facility) {
    return clarify(
      "Anh/chị muốn đặt tiện ích nào giúp tôi rõ hơn được không (ví dụ sân bóng bàn, phòng BBQ)?",
      "resolveFacility null"
    );
  }
  if (!facility.is_bookable) {
    return actioned(
      {
        ...emptyResult(capability),
        status: "blocked",
        facility_id: facility.facility_id,
        facility_name_vi: facility.facility_name_vi,
        blocking_reasons: [
          {
            code: "not_bookable",
            human_message_vi: `${facility.facility_name_vi} không có mục đặt chỗ nên tôi không giữ chỗ được.`,
            is_permanent: true,
            next_valid_at: null,
            remediation_hint_vi: "Anh/chị dùng trực tiếp theo nội quy của tiện ích này.",
          },
        ],
      },
      `${facility.facility_name_vi} không có mục đặt chỗ nên tôi không giữ chỗ được.`,
      "unsupported_intent",
      "not_bookable"
    );
  }

  // Thiếu dữ kiện thì HỎI, không đoán (Đ48 mục 2). `party_size` do A1 điền mặc
  // định 1 khi cư dân không nói số người — xem prompt A1; null ở đây nghĩa là
  // A1 cũ không có trường `action`, khi đó hỏi lại là đúng.
  const slotStart = a.action.slot_start;
  if (!slotStart) {
    return clarify(
      `Anh/chị muốn đặt ${facility.facility_name_vi} vào lúc nào (ngày và giờ bắt đầu)?`,
      "thiếu slot_start"
    );
  }
  const partySize = a.action.party_size;
  if (partySize === null) {
    return clarify(`Anh/chị đặt ${facility.facility_name_vi} cho mấy người?`, "thiếu party_size");
  }

  // ĐỌC CHÍNH SÁCH TRƯỚC KHI GHI — đúng MỘT lần (BB-03, Đ48 mục 4).
  const policy = await backend.getBookingPolicy({
    facility_id: facility.facility_id,
    resident_id: residentId,
    property_id: propertyId,
    slot_start: slotStart,
    slot_end: a.action.slot_end,
    party_size: partySize,
  });
  const slotEnd =
    a.action.slot_end ?? addMinutesIso(slotStart, policy.slot_granularity_minutes || 60);
  const policySource =
    policy.source_document_id && policy.source_section_id
      ? { document_id: policy.source_document_id, section_id: policy.source_section_id }
      : null;

  const base: ActionResult = {
    ...emptyResult(capability),
    facility_id: facility.facility_id,
    facility_name_vi: policy.facility_name_vi,
    slot_start: slotStart,
    slot_end: slotEnd,
    next_intake_open_at: policy.next_intake_open_at,
    policy_source: policySource,
  };

  if (policy.blocking_reasons.length > 0) {
    // KHÔNG gọi lệnh ghi nào — `write_calls` giữ 0. Đây là điểm khác biệt của
    // P05: không có lệnh ghi nào bị lãng phí (SPEC-P05 §9).
    return actioned(
      { ...base, status: "blocked", blocking_reasons: toActionBlocking(policy.blocking_reasons) },
      blockedMessageVi(policy, policy.blocking_reasons, slotStart),
      null,
      `blocked:${policy.blocking_reasons.map((r) => r.code).join(",")}`
    );
  }

  const elig = await backend.checkEligibility({
    session_id: a.conversation_id,
    facility_id: facility.facility_id,
    resident_id: residentId,
    property_id: propertyId,
    slot_start: slotStart,
    slot_end: slotEnd,
    party_size: partySize,
  });
  if (!elig.eligible) {
    return actioned(
      { ...base, status: "blocked", blocking_reasons: toActionBlocking(elig.blocking_reasons) },
      blockedMessageVi(policy, elig.blocking_reasons, slotStart),
      null,
      `ineligible:${elig.blocking_reasons.map((r) => r.code).join(",")}`
    );
  }

  let written: Awaited<ReturnType<SimBackend["createBooking"]>>;
  try {
    written = await backend.createBooking({
      session_id: a.conversation_id,
      facility_id: facility.facility_id,
      resident_id: residentId,
      property_id: propertyId,
      slot_start: slotStart,
      slot_end: slotEnd,
      party_size: partySize,
      idempotency_key: idempotencyKeyFor({
        conversation_id: a.conversation_id,
        facility_id: facility.facility_id,
        slot_start: slotStart,
        property_id: propertyId,
      }),
    });
  } catch (err) {
    // Backend NÉM SlotTaken/DuplicateKey (race hoặc gọi lặp) — SPEC-P05 §7: trả biên
    // nhận ĐÃ CÓ nếu chỗ đó là của chính cư dân; không thì để mapBackendError xử.
    if (err instanceof SimBackendError && (err.kind === "SlotTaken" || err.kind === "DuplicateKey")) {
      const mine = (await backend.listMyBookings(residentId)).find(
        (b) =>
          b.facility_id === facility.facility_id &&
          b.state === "confirmed" &&
          new Date(b.slot_start).getTime() === new Date(slotStart).getTime()
      );
      if (mine) {
        return actioned(
          {
            ...base,
            status: "done",
            write_calls: 1,
            booking_id: mine.booking_id,
            receipt_code: mine.receipt_code,
            undo_capability_id: "amenity.cancel_booking",
          },
          `Anh/chị đã đặt ${policy.facility_name_vi} lúc ${clockVi(slotStart)} ngày ${dateVi(slotStart)} rồi — ` +
            `mã biên nhận ${mine.receipt_code}. Tôi không tạo thêm chỗ mới. ` +
            `Cần bỏ chỗ này thì nhắn "huỷ ${mine.receipt_code}".`,
          "action_duplicate_suspected",
          "create_duplicate_existing"
        );
      }
    }
    throw err;
  }

  // Lệnh ghi ĐÃ được phát đi — `write_calls` = 1 dù backend nhận hay từ chối.
  // Trường này đếm lời gọi ghi, không đếm số bản ghi (P05-M8).
  if (!written.ok) {
    // SPEC-P05 §7 (DuplicateKey/SlotTaken ⇒ action_duplicate_suspected): "Trả về
    // biên nhận ĐÃ CÓ, không tạo mới". Cư dân đã giữ đúng chỗ này rồi (cùng tiện
    // ích, cùng slot, cùng căn) ⇒ báo lại mã biên nhận cũ như một lượt done, không
    // phải lỗi. Không tìm thấy chỗ của chính mình ⇒ slot do người khác giữ ⇒ blocked.
    if (written.reason_code === "action_duplicate_suspected") {
      const mine = (await backend.listMyBookings(residentId)).find(
        (b) =>
          b.facility_id === facility.facility_id &&
          b.state === "confirmed" &&
          new Date(b.slot_start).getTime() === new Date(slotStart).getTime()
      );
      if (mine) {
        return actioned(
          {
            ...base,
            status: "done",
            write_calls: 1,
            booking_id: mine.booking_id,
            receipt_code: mine.receipt_code,
            undo_capability_id: "amenity.cancel_booking",
          },
          `Anh/chị đã đặt ${policy.facility_name_vi} lúc ${clockVi(slotStart)} ngày ${dateVi(slotStart)} rồi — ` +
            `mã biên nhận ${mine.receipt_code}. Tôi không tạo thêm chỗ mới. ` +
            `Cần bỏ chỗ này thì nhắn "huỷ ${mine.receipt_code}".`,
          "action_duplicate_suspected",
          "create_duplicate_existing"
        );
      }
    }
    return actioned(
      {
        ...base,
        status: "blocked",
        write_calls: 1,
        blocking_reasons: toActionBlocking(written.blocking_reasons),
      },
      blockedMessageVi(policy, written.blocking_reasons, slotStart),
      written.reason_code,
      `create_rejected:${written.reason_code}`
    );
  }

  const done: ActionResult = {
    ...base,
    status: "done",
    write_calls: 1,
    booking_id: written.booking_id,
    receipt_code: written.receipt_code,
    undo_capability_id: written.undo_capability_id,
  };
  const answer =
    `Đã đặt ${policy.facility_name_vi} lúc ${clockVi(slotStart)} ngày ${dateVi(slotStart)} cho ${partySize} người. ` +
    `Mã biên nhận ${written.receipt_code}. ` +
    `Cần bỏ chỗ này thì anh/chị nhắn "huỷ ${written.receipt_code}", tôi sẽ hỏi xác nhận trước khi huỷ.`;
  return actioned(
    done,
    answer,
    written.duplicate ? "action_duplicate_suspected" : null,
    written.duplicate ? "create_duplicate" : "create_done"
  );
}

// ── cancel_booking ──────────────────────────────────────────────────────

async function startCancel(
  backend: SimBackend,
  a: ActionBranchArgs,
  residentId: string
): Promise<ActionBranchOutcome> {
  const capability: ActionCapability = "amenity.cancel_booking";
  const ref = a.action.booking_ref;
  if (!ref) {
    return clarify("Anh/chị muốn huỷ chỗ nào (mã biên nhận RC-… giúp tôi)?", "thiếu booking_ref");
  }

  // Precheck của cancel_booking (BB-03). Gọi TRƯỚC khi hỏi xác nhận để câu hỏi
  // nêu đúng chỗ nào đang bị huỷ — hỏi suông rồi mới tra là mời cư dân xác nhận
  // một thứ chưa ai kiểm.
  const detail = await backend.getBookingDetail({
    session_id: a.conversation_id,
    booking_id: ref,
    resident_id: residentId,
  });

  const reasonVi = "Cư dân yêu cầu huỷ qua trợ lý.";
  await backend.savePendingAction({
    conversation_id: a.conversation_id,
    capability,
    payload: { booking_id: detail.booking_id, reason_vi: reasonVi },
    created_at: toVnIso(a.now),
    expires_at: toVnIso(new Date(a.now.getTime() + PENDING_ACTION_TTL_MINUTES * 60_000)),
  });

  const result: ActionResult = {
    ...emptyResult(capability),
    status: "needs_confirmation",
    facility_id: detail.facility_id,
    facility_name_vi: detail.facility_name_vi,
    slot_start: detail.slot_start,
    slot_end: detail.slot_end,
    booking_id: detail.booking_id,
  };
  const question =
    `Thao tác này không hoàn tác được — slot có thể bị người khác lấy ngay. ` +
    `Anh/chị xác nhận huỷ ${detail.facility_name_vi} lúc ${clockVi(detail.slot_start)} ngày ${dateVi(detail.slot_start)} chứ?`;
  return {
    ...clarify(question, "cancel chờ xác nhận", result),
    reason_code: "action_irreversible_requires_confirmation",
  };
}

async function executePending(
  backend: SimBackend,
  a: ActionBranchArgs,
  capability: ActionCapability,
  payload: Record<string, unknown>
): Promise<ActionBranchOutcome> {
  if (capability !== "amenity.cancel_booking") {
    return clarify(
      "Hiện không có thao tác nào đang chờ xác nhận. Anh/chị cho tôi biết cần làm gì giúp nhé.",
      `pending lạ: ${capability}`
    );
  }
  const bookingId = typeof payload.booking_id === "string" ? payload.booking_id : null;
  const residentId = a.principal.resident_id;
  if (!bookingId || !residentId) {
    return clarify(
      "Yêu cầu huỷ trước đó đã hết hạn. Anh/chị nhắn lại mã biên nhận giúp tôi nhé.",
      "pending thiếu dữ liệu"
    );
  }

  // Precheck lại trước lệnh ghi: dấu precheck gắn theo phiên và bản ghi, lượt
  // xác nhận là một lời gọi mới (BB-03).
  const detail = await backend.getBookingDetail({
    session_id: a.conversation_id,
    booking_id: bookingId,
    resident_id: residentId,
  });
  const reasonVi = typeof payload.reason_vi === "string" ? payload.reason_vi : "Cư dân yêu cầu huỷ.";

  const cancelled = await backend.cancelBooking({
    session_id: a.conversation_id,
    booking_id: bookingId,
    resident_id: residentId,
    reason_vi: reasonVi,
    confirmed: true,
  });

  const base: ActionResult = {
    ...emptyResult(capability),
    facility_id: detail.facility_id,
    facility_name_vi: detail.facility_name_vi,
    slot_start: detail.slot_start,
    slot_end: detail.slot_end,
    booking_id: detail.booking_id,
    write_calls: 1,
  };
  if (!cancelled.ok) {
    return actioned(
      { ...base, status: "blocked", blocking_reasons: toActionBlocking(cancelled.blocking_reasons) },
      cancelled.blocking_reasons.map((r) => r.human_message_vi).join(" ") ||
        "Tôi chưa huỷ được chỗ này.",
      cancelled.reason_code,
      `cancel_rejected:${cancelled.reason_code}`
    );
  }
  return actioned(
    {
      ...base,
      status: "done",
      receipt_code: cancelled.receipt_code,
      // §5.2 — huỷ KHÔNG hoàn tác được. Đặt lại là một hành động mới.
      undo_capability_id: null,
    },
    `Đã huỷ ${detail.facility_name_vi} lúc ${clockVi(detail.slot_start)} ngày ${dateVi(detail.slot_start)}. ` +
      `Mã biên nhận huỷ ${cancelled.receipt_code}. Biên nhận đặt ban đầu vẫn được giữ trong sổ. ` +
      `Lưu ý: huỷ rồi thì slot có thể đã có người khác lấy, đặt lại là một yêu cầu mới.`,
    null,
    "cancel_done"
  );
}

// ── Ánh xạ lỗi backend — SPEC-P05 §7 ────────────────────────────────────

function mapBackendError(
  err: SimBackendError,
  capability: ActionCapability | null
): ActionBranchOutcome {
  const cap: ActionCapability = capability ?? "amenity.create_booking";
  const blocking = toActionBlocking(err.blocking_reasons);

  if (err.kind === "Forbidden") {
    // Dữ liệu của cư dân/căn hộ khác — cổng Đ06, không phải lỗi hành động.
    return escalate("pii_or_account_specific", "SimBackendError:Forbidden");
  }

  if (err.kind === "IrreversibleUnconfirmed") {
    return {
      ...clarify(
        "Thao tác này không hoàn tác được. Anh/chị xác nhận huỷ chứ?",
        "SimBackendError:IrreversibleUnconfirmed"
      ),
      reason_code: "action_irreversible_requires_confirmation",
    };
  }

  if (err.kind === "WriteTimeout") {
    // CẤM RETRY (P05-C10). Lệnh đã gửi đi; gọi lại là đặt hai lần. Chỉ ghi
    // cảnh báo và nói thật với cư dân là chưa rõ kết quả.
    auditWarn("action.write_timeout", { capability: cap, message: err.message });
    return actioned(
      { ...emptyResult(cap), status: "unknown", write_calls: 1, blocking_reasons: blocking },
      "Tôi đã gửi yêu cầu nhưng hệ thống chưa phản hồi kịp nên chưa rõ chỗ đã được ghi nhận chưa. " +
        "Tôi KHÔNG gửi lại để tránh đặt trùng. Anh/chị xem lại mục chỗ đã đặt sau ít phút giúp, " +
        "tôi đã báo Ban quản lý kiểm tra.",
      "action_partial_execution_unknown",
      "SimBackendError:WriteTimeout"
    );
  }

  const human =
    blocking.map((r) => r.human_message_vi).join(" ") ||
    MESSAGE_FOR_ERROR_KIND[err.kind] ||
    "Tôi chưa thực hiện được thao tác này.";
  // QuotaExceeded / PrecheckMissing / DuplicateKey / SlotTaken / NotBookable /
  // NotFound — tất cả DỪNG tại đây, KHÔNG thử lại (SPEC-P05 §7).
  return actioned(
    { ...emptyResult(cap), status: "blocked", blocking_reasons: blocking },
    human,
    err.reason_code,
    `SimBackendError:${err.kind}`
  );
}

const MESSAGE_FOR_ERROR_KIND: Partial<Record<SimBackendError["kind"], string>> = {
  QuotaExceeded: "Anh/chị đã dùng hết hạn mức đặt chỗ của kỳ này nên tôi không đặt thêm được.",
  PrecheckMissing: "Tôi chưa đọc được điều kiện đặt chỗ nên không thực hiện lệnh ghi nào.",
  DuplicateKey: "Yêu cầu này trùng với một yêu cầu đã được ghi nhận trước đó, tôi giữ nguyên chỗ cũ.",
  SlotTaken: "Khung giờ này vừa có người lấy mất nên tôi không giữ được chỗ.",
  NotBookable: "Tiện ích này không có mục đặt chỗ nên tôi không giữ chỗ được.",
  NotFound: "Tôi không tìm thấy tiện ích hoặc chỗ đặt nào khớp với yêu cầu này.",
};
