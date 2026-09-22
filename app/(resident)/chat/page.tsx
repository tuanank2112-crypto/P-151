// app/(resident)/chat/page.tsx — URL /chat. Màn hỏi–đáp thật: gọi
// `POST /api/chat`, hiện câu trả lời kèm trích dẫn, hoặc hiện LÝ DO khi hệ
// thống từ chối.
//
// BẮT BUỘC (BB-05 / P02-C5): màn này KHÔNG hiện bất kỳ số nội bộ nào của cổng
// escalate. Nó chỉ hiện câu đã dịch sẵn do máy chủ gửi xuống (`message_vi`) —
// bảng câu nằm ở `lib/reason-messages.ts`, không lặp lại ở đây.
// CẤM streaming token (P02-C9): một lượt hỏi = một lời đáp trọn vẹn.
"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicTurnResult } from "../../../lib/types";
import { toActionView, formatViDateTime, type ActionView } from "./action-view";

interface ChatResponseBody {
  ok: boolean;
  result: PublicTurnResult;
  message_vi: string;
  can_retry: boolean;
  /** `id` hội thoại đã dùng — máy chủ luôn trả kèm ở nhánh 200 (G33). */
  conversation_id?: string;
}

interface Turn {
  id: string;
  question_vi: string;
  body: ChatResponseBody | null;
  failed_network: boolean;
}

/** Một dòng `messages` đọc lại từ `GET /api/conversations` (R4). Chỉ có
 *  `role`/`content_vi` — không có citations/steps (bảng `messages` không
 *  giữ, xem `app/api/conversations/route.ts`). */
interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content_vi: string;
}

// Khoá lưu `conversation_id` ở trình duyệt (G33/R4). KHÔNG khoá theo user:
// JS phía client không đọc được cookie phiên (`httpOnly`, `lib/auth/session.ts`)
// nên không có id user để làm khoá riêng mà không thêm một lời gọi mạng nữa.
// Phương án đơn giản nhất trong phạm vi cho phép (không đụng `lib/adapters/**`):
// dùng một khoá chung; nếu trình duyệt dùng chung cho user khác, id cũ không
// thuộc user mới ⇒ `GET /api/conversations` trả 403 ⇒ xử lý im lặng, bắt đầu
// hội thoại mới (đúng hành vi handoff H15 W2 yêu cầu, không hiện lỗi đỏ).
const STORAGE_KEY = "resident_agent_conversation_id";

function loadStoredConversationId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveStoredConversationId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage có thể chặn (chế độ riêng tư) — mất tiện lợi nạp lại lịch
    // sử, không phải lỗi chặn UI (NFR-02).
  }
}

const GOI_Y = [
  "Bể bơi mở cửa từ mấy giờ đến mấy giờ?",
  "Vườn BBQ cho tối đa bao nhiêu người một lượt?",
  "Sân pickleball mở cửa mấy giờ?",
  "Trẻ em dưới 12 tuổi xuống bể bơi cần điều kiện gì?",
];

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  // "" ở lượt đầu ⇒ route tự tạo hội thoại và trả `conversation_id` (G33).
  const conversationId = useRef<string>("");

  useEffect(() => {
    const stored = loadStoredConversationId();
    if (!stored) return;
    conversationId.current = stored;
    (async () => {
      try {
        const res = await fetch(`/api/conversations?conversation_id=${encodeURIComponent(stored)}`);
        if (!res.ok) {
          // Id không hợp lệ/không thuộc user hiện tại (403) hoặc lỗi khác:
          // bỏ qua, bắt đầu hội thoại mới, KHÔNG hiện lỗi đỏ (handoff H15 W2).
          conversationId.current = "";
          saveStoredConversationId("");
          return;
        }
        const data = (await res.json()) as { messages: HistoryMessage[] };
        setHistory(data.messages ?? []);
      } catch {
        // Tầng 1 (mạng) — im lặng, coi như chưa nạp được lịch sử cũ.
      }
    })();
  }, []);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    const id = `${Date.now()}`;
    setTurns((prev) => [...prev, { id, question_vi: q, body: null, failed_network: false }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question_vi: q, conversation_id: conversationId.current }),
      });
      const body = (await res.json()) as ChatResponseBody;
      if (body.conversation_id) {
        conversationId.current = body.conversation_id;
        saveStoredConversationId(body.conversation_id);
      }
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, body } : t)));
    } catch {
      // Tầng 1 (mạng/hạ tầng) — không để màn hình trắng (NFR-02).
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, failed_network: true } : t)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="chat">
      <header className="chat__head">
        <div>
          <h1>Trợ lý cư dân</h1>
          <p className="chat__sub">
            Mọi câu trả lời đều kèm trích dẫn tới điều khoản trong bộ tài liệu của Ban quản lý.
            Không đủ căn cứ thì trợ lý nói rõ lý do và chuyển sang Ban quản lý.
          </p>
        </div>
        <div className="chat__head-actions">
          <a href="/chat/receipts" className="btn btn--ghost">
            Biên nhận
          </a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn--ghost">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      {turns.length === 0 && history.length === 0 && (
        <section className="suggest">
          <p className="suggest__label">Thử một câu:</p>
          <ul>
            {GOI_Y.map((g) => (
              <li key={g}>
                <button type="button" className="chip" onClick={() => ask(g)} disabled={busy}>
                  {g}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <ol className="thread thread--history">
          {history.map((m) => (
            <li key={m.id} className={m.role === "user" ? "turn" : "turn turn--history-bot"}>
              <p className={m.role === "user" ? "bubble bubble--me" : "bubble bubble--bot"}>
                {m.content_vi}
              </p>
            </li>
          ))}
        </ol>
      )}

      <ol className="thread">
        {turns.map((t) => (
          <li key={t.id} className="turn">
            <p className="bubble bubble--me">{t.question_vi}</p>
            {t.failed_network ? (
              <div className="bubble bubble--bot">
                <p>Không gửi được yêu cầu. Anh/chị kiểm tra kết nối rồi thử lại giúp.</p>
                <button type="button" className="btn" onClick={() => ask(t.question_vi)}>
                  Thử lại
                </button>
              </div>
            ) : t.body === null ? (
              <p className="bubble bubble--bot bubble--wait">Đang tra tài liệu…</p>
            ) : (
              <TurnView
                body={t.body}
                onRetry={() => ask(t.question_vi)}
                onConfirm={() => ask("Xác nhận")}
              />
            )}
          </li>
        ))}
      </ol>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <input
          type="text"
          value={question}
          placeholder="Hỏi về nội quy, tiện ích, phí dịch vụ…"
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
          aria-label="Câu hỏi"
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !question.trim()}>
          {busy ? "Đang xử lý…" : "Gửi"}
        </button>
      </form>
    </main>
  );
}

function TurnView({
  body,
  onRetry,
  onConfirm,
}: {
  body: ChatResponseBody;
  onRetry: () => void;
  onConfirm: () => void;
}) {
  const { result } = body;
  const actionView = toActionView(result);
  const isAnswer = result.decision === "answer" && result.answer_vi;

  return (
    <div className="bubble bubble--bot">
      {actionView ? (
        <ActionCard view={actionView} onConfirm={onConfirm} />
      ) : isAnswer ? (
        <p className="answer">{result.answer_vi}</p>
      ) : (
        <p className="refuse">{body.message_vi}</p>
      )}

      {result.citations.length > 0 && (
        <details className="cites" open>
          <summary>Nguồn ({result.citations.length})</summary>
          <ul>
            {result.citations.map((c, i) => (
              <li key={`${c.section_id}-${i}`}>
                <p className="cites__title">
                  {c.document_title_vi} — {c.heading_vi}
                </p>
                <p className="cites__id">
                  <code>{c.document_id}</code> › <code>{c.section_id}</code>
                </p>
                {c.snippet_vi ? <blockquote>{c.snippet_vi}</blockquote> : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.steps.length > 0 && (
        <details className="steps">
          <summary>Các chặng xử lý ({result.steps.length})</summary>
          <ol>
            {result.steps.map((s, i) => (
              <li key={`${s.step}-${i}`}>
                {s.step}
                {s.model ? ` · ${s.model}` : ""} · {s.ms}ms
                {s.input_tokens != null || s.output_tokens != null
                  ? ` · ${s.input_tokens ?? 0}/${s.output_tokens ?? 0} tokens`
                  : ""}
              </li>
            ))}
          </ol>
        </details>
      )}

      {body.can_retry && (
        <div className="actions">
          <button type="button" className="btn" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      )}
    </div>
  );
}

/** W1 (H21, Đ48) — card kết quả hành động, một nhánh render riêng cho mỗi
 *  `ActionStatus` (`app/(resident)/chat/action-view.ts::toActionView`). Nút
 *  *Hoàn tác* gọi thẳng `POST /api/actions/undo` (W2) — đây là lệnh ghi DUY
 *  NHẤT UI được tự gọi, và chỉ khi cư dân bấm (xác nhận tường minh, luật §4). */
function ActionCard({ view, onConfirm }: { view: ActionView; onConfirm: () => void }) {
  const [undoState, setUndoState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [undoError, setUndoError] = useState("");

  async function handleUndo(receiptCode: string) {
    setUndoState("busy");
    setUndoError("");
    try {
      const res = await fetch("/api/actions/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt_code: receiptCode }),
      });
      const data = (await res.json()) as { ok: boolean; message_vi?: string };
      if (res.ok && data.ok) {
        setUndoState("done");
      } else {
        setUndoState("error");
        setUndoError(data.message_vi ?? "Không hoàn tác được. Anh/chị thử lại giúp.");
      }
    } catch {
      setUndoState("error");
      setUndoError("Không gửi được yêu cầu hoàn tác. Anh/chị kiểm tra kết nối rồi thử lại.");
    }
  }

  if (view.kind === "done") {
    return (
      <div className="action-card action-card--done">
        <p className="action-card__title">Đã thực hiện xong.</p>
        <dl className="action-card__facts">
          <div>
            <dt>Tiện ích</dt>
            <dd>{view.facility_name_vi || "—"}</dd>
          </div>
          <div>
            <dt>Khung giờ</dt>
            <dd>
              {view.slot_start_vi ?? "—"}
              {view.slot_end_vi ? ` – ${view.slot_end_vi}` : ""}
            </dd>
          </div>
          <div>
            <dt>Mã biên nhận</dt>
            <dd>
              <code>{view.receipt_code}</code>
            </dd>
          </div>
        </dl>
        {view.can_undo && undoState !== "done" && (
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={undoState === "busy"}
              onClick={() => handleUndo(view.receipt_code)}
            >
              {undoState === "busy" ? "Đang hoàn tác…" : "Hoàn tác"}
            </button>
            {undoState === "error" && <p className="bql-cell-error">{undoError}</p>}
          </div>
        )}
        {undoState === "done" && <p className="action-card__undone">Đã hoàn tác.</p>}
      </div>
    );
  }

  if (view.kind === "blocked") {
    return (
      <div className="action-card action-card--blocked">
        <p className="action-card__title">Không thực hiện được.</p>
        <ul className="action-card__reasons">
          {view.reasons.map((r, i) => (
            <li key={i}>
              <p>{r.message_vi}</p>
              {r.remediation_vi && <p className="action-card__remediation">{r.remediation_vi}</p>}
            </li>
          ))}
        </ul>
        {view.next_intake_open_at_vi && (
          <p className="action-card__next">
            Mở lại nhận đăng ký lúc: <strong>{view.next_intake_open_at_vi}</strong>
          </p>
        )}
      </div>
    );
  }

  if (view.kind === "needs_confirmation") {
    return (
      <div className="action-card action-card--confirm">
        <p className="action-card__title">{view.question_vi}</p>
        <div className="actions">
          <button type="button" className="chip" onClick={onConfirm}>
            Xác nhận
          </button>
        </div>
      </div>
    );
  }

  if (view.kind === "listed") {
    return (
      <div className="action-card action-card--listed">
        {view.bookings.length === 0 ? (
          <p>Anh/chị chưa có chỗ nào đã đặt.</p>
        ) : (
          <table className="bql-table">
            <thead>
              <tr>
                <th>Tiện ích</th>
                <th>Khung giờ</th>
                <th>Trạng thái</th>
                <th>Mã biên nhận</th>
              </tr>
            </thead>
            <tbody>
              {view.bookings.map((b) => (
                <tr key={b.booking_id}>
                  <td>{b.facility_name_vi}</td>
                  <td>
                    {formatViDateTime(b.slot_start) ?? "—"}
                    {b.slot_end ? ` – ${formatViDateTime(b.slot_end)}` : ""}
                  </td>
                  <td>{b.state === "confirmed" ? "Đã xác nhận" : "Đã huỷ"}</td>
                  <td>
                    <code>{b.receipt_code}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // view.kind === "unknown"
  return (
    <div className="action-card action-card--unknown">
      <p className="refuse">{view.message_vi}</p>
    </div>
  );
}
