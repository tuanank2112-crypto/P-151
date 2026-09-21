// app/(resident)/chat/page.tsx — URL /chat. Màn hỏi–đáp thật: gọi
// `POST /api/chat`, hiện câu trả lời kèm trích dẫn, hoặc hiện LÝ DO khi hệ
// thống từ chối.
//
// BẮT BUỘC (BB-05 / P02-C5): màn này KHÔNG hiện bất kỳ số nội bộ nào của cổng
// escalate. Nó chỉ hiện câu đã dịch sẵn do máy chủ gửi xuống (`message_vi`) —
// bảng câu nằm ở `lib/reason-messages.ts`, không lặp lại ở đây.
// CẤM streaming token (P02-C9): một lượt hỏi = một lời đáp trọn vẹn.
"use client";

import { useRef, useState } from "react";
import type { PublicTurnResult } from "../../../lib/types";

interface ChatResponseBody {
  ok: boolean;
  result: PublicTurnResult;
  message_vi: string;
  can_retry: boolean;
}

interface Turn {
  id: string;
  question_vi: string;
  body: ChatResponseBody | null;
  failed_network: boolean;
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
  const conversationId = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "conv-local"
  );

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
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="btn btn--ghost">
            Đăng xuất
          </button>
        </form>
      </header>

      {turns.length === 0 && (
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
              <TurnView body={t.body} onRetry={() => ask(t.question_vi)} />
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

function TurnView({ body, onRetry }: { body: ChatResponseBody; onRetry: () => void }) {
  const { result } = body;
  const isAnswer = result.decision === "answer" && result.answer_vi;

  return (
    <div className="bubble bubble--bot">
      {isAnswer ? (
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
