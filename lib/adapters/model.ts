// lib/adapters/model.ts — FILE DUY NHẤT trong app/ và lib/ được gọi ra nhà
// cung cấp model (Gemini), và nơi DUY NHẤT đọc GEMINI_API_KEY (BB-07,
// 00-ARCHITECTURE.md §9, 01-CONTRACTS.md §8). Kiểm bằng
// `scripts/check_adapter_boundary.sh`.
//
// Đổi tên từ `anthropic.ts` (BB-07.a, Đ17): nhà cung cấp nay là Gemini.
// REST thuần + `fetch`, KHÔNG SDK (00-ARCHITECTURE.md §10.1) — lượt probe đo
// bằng đúng đường HTTP này.

import { z } from "zod";
import type { ActionRequest, Citation, ClaimVerdict, IntentId } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────
// §8.0 — Khung gọi chung
// ─────────────────────────────────────────────────────────────────────────

/** Ba ID đã chốt ở 00-ARCHITECTURE.md §10.1, có bằng chứng đo
 *  (evidence/p02-provider/gemini-probe.txt). CẤM thêm ID không có bằng
 *  chứng. CẤM thêm hậu tố ngày. */
export type SupportedModel =
  | "gemini-3.5-flash-lite" // A1 classifier
  | "gemini-3.5-flash" // A2 retriever
  | "gemini-3.6-flash" // A2 dự phòng (G34, đo 2026-09-23: 3.5-flash 429/503 liên tục, 3.6-flash 200)
  | "gemini-2.5-flash"; // A3 verifier

/**
 * Đ53 (2026-09-23, chủ tịch chốt "lấy key Vyce làm fallback"): model Vyce
 * CHỈ được gọi khi CẢ chuỗi Gemini của agent đó đều 429/503. Đ22 từng bác
 * Vyce vì `response_format.json_schema` bị bỏ qua âm thầm — nên ở đây KHÔNG
 * dựa vào tham số đó: schema ghi thẳng vào prompt (vai `user` — đo
 * 2026-09-23: chỉ dẫn ở vai `system` bị bỏ qua, ở vai `user` 6/6 lần ra JSON
 * đúng), và output vẫn đi qua đúng Zod của từng agent ⇒ lệch schema là
 * `ContractDriftError`, không bao giờ xanh giả. Bằng chứng đo:
 * `evidence/so-vyce/probe.txt`.
 */
export type VyceModel = "vyce:claude-sonnet-4-6" | "vyce:deepseek-v4.1" | "vyce:deepseek-v4-flash";
export const ALLOWED_VYCE_MODELS: readonly VyceModel[] = [
  "vyce:claude-sonnet-4-6",
  "vyce:deepseek-v4.1",
  "vyce:deepseek-v4-flash",
];
export const VYCE_BASE = "https://vyceai.com/v1" as const;
/** Trần song song gói free của Vyce (Đ22: thông điệp lỗi nói thẳng 4). */
export const VYCE_MAX_CONCURRENCY = 4;
export type AnyModel = SupportedModel | VyceModel;

/**
 * Chuỗi fallback Vyce từ `MODEL_FALLBACK_VYCE` (phẩy, id KHÔNG có tiền tố,
 * vd `claude-sonnet-4-6,deepseek-v4.1`). Rỗng khi biến trống HOẶC thiếu
 * `VYCE_API_KEY` — fallback là tuỳ chọn, thiếu key thì hành vi y như cũ.
 */
export function vyceFallbackChain(agent?: "A1" | "A2" | "A3"): VyceModel[] {
  // Chủ tịch chốt 2026-09-23: DeepSeek SOẠN (A2), Sonnet CHẤM (A3) — cấu hình
  // bằng `MODEL_FALLBACK_VYCE_A2` / `_A3`; thiếu thì dùng chuỗi chung.
  const perAgent = agent ? process.env[`MODEL_FALLBACK_VYCE_${agent}`]?.trim() : "";
  const raw = perAgent || process.env.MODEL_FALLBACK_VYCE?.trim();
  if (!raw || !process.env.VYCE_API_KEY) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((id) => {
    const m = `vyce:${id}` as VyceModel;
    if (!(ALLOWED_VYCE_MODELS as readonly string[]).includes(m)) {
      throw new Error(
        `MODEL_FALLBACK_VYCE chứa "${id}" không nằm trong ALLOWED_VYCE_MODELS ` +
          `(${ALLOWED_VYCE_MODELS.join(", ")}). CẤM dùng model chưa có bằng chứng đo.`
      );
    }
    return m;
  });
}

/** Vùng cấm model — CẤM dùng cho đường găng (P02-C13, C-09). Chỉ liệt kê để
 *  các script probe/kiểm tra được đối chiếu; KHÔNG có ở trong SupportedModel. */
export const FORBIDDEN_MODELS = ["gemini-3.7-flash", "gemini-3.8-flash"] as const;

/** Ba model được phép. Dùng để kiểm giá trị ghi đè từ biến môi trường. */
export const ALLOWED_MODELS: readonly SupportedModel[] = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
];

/**
 * Model của từng agent, cho phép ghi đè bằng `MODEL_A1` / `MODEL_A2` / `MODEL_A3`.
 *
 * VÌ SAO CẦN: hạn mức free của Gemini tính THEO TỪNG MODEL. Đo 2026-09-20 thấy
 * `gemini-3.5-flash` (A2) trả 429 "exceeded your current quota" trong khi
 * `gemini-3.5-flash-lite` và `gemini-2.5-flash` vẫn trả 200. Gắn cứng ID nghĩa là
 * một model cạn thì cả pipeline chết, không còn đường nào ngoài kill switch —
 * mà kill switch tắt hẳn agent, tức mất luôn R6.
 *
 * KIỂM CHẶT: chỉ nhận giá trị nằm trong `ALLOWED_MODELS`. Model trong
 * `FORBIDDEN_MODELS` (P02-C13, C-09) bị ném lỗi ngay, KHÔNG âm thầm rơi về mặc định —
 * rơi âm thầm thì người vận hành tưởng đã đổi mà thực ra chưa.
 *
 * CẤM dùng cờ này để "chữa" điểm Golden thấp: đổi model là đổi số đo, phải ghi rõ
 * model thật trong report (SPEC-P02 §6.5, Đ24).
 */
export function agentModel(agent: "A1" | "A2" | "A3"): SupportedModel {
  return agentModelChain(agent)[0]!;
}

/**
 * G34/Đ47 (2026-09-23): `MODEL_<agent>` nhận DANH SÁCH phẩy — phần tử đầu là
 * model chính, các phần tử sau là dự phòng khi model trước trả 429/503.
 * VÌ SAO: hạn mức free tính theo TỪNG model và cạn không báo trước; buổi demo
 * không thể chờ. Model không phải cuối chỉ thử MỘT lần rồi nhảy tiếp; model
 * cuối giữ nguyên backoff đầy đủ (§8, SPEC-P02 §9). Mỗi phần tử vẫn phải
 * thuộc ALLOWED_MODELS và không thuộc FORBIDDEN_MODELS — không có đường tắt.
 */
export function agentModelChain(agent: "A1" | "A2" | "A3"): SupportedModel[] {
  const fallback: Record<typeof agent, SupportedModel> = {
    A1: "gemini-3.5-flash-lite",
    A2: "gemini-3.5-flash",
    A3: "gemini-2.5-flash",
  };
  const rawList = process.env[`MODEL_${agent}`]?.trim();
  if (!rawList) return [fallback[agent]];
  const items = rawList.split(",").map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return [fallback[agent]];
  return items.map((raw) => validateModelId(agent, raw));
}

function validateModelId(agent: "A1" | "A2" | "A3", raw: string): SupportedModel {
  if ((FORBIDDEN_MODELS as readonly string[]).includes(raw)) {
    throw new Error(
      `MODEL_${agent}="${raw}" nằm trong FORBIDDEN_MODELS (503 ngay lần gọi đơn). ` +
        `Xem plan.md Đ17.`
    );
  }
  if (!(ALLOWED_MODELS as readonly string[]).includes(raw)) {
    throw new Error(
      `MODEL_${agent}="${raw}" không nằm trong ALLOWED_MODELS ` +
        `(${ALLOWED_MODELS.join(", ")}). CẤM dùng model chưa có bằng chứng đo.`
    );
  }
  return raw as SupportedModel;
}

export const EMBEDDING_MODEL = "gemini-embedding-001" as const;
export const EMBEDDING_DIMS = 384 as const; // khớp vector(384) — 01-CONTRACTS §3.3
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta" as const;

/** Giới hạn song song ra Gemini API cho MỌI lời gọi qua adapter này
 *  (Đ19: trần đo được nằm giữa 15 và 40/phút; 4 là mức an toàn mặc định). */
export const MAX_CONCURRENCY = 4;

// ─────────────────────────────────────────────────────────────────────────
// L2 normalize — BẮT BUỘC (Đ20, 01-CONTRACTS.md §4.3)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chuẩn hoá L2. Gemini CHỈ tự chuẩn hoá ở số chiều đầy đủ (3072) — ép chiều
 * bằng `outputDimensionality` trả về một lát cắt, `|v|` không còn bằng 1
 * (đo được 0.4345 ở 384 chiều, evidence/p02-provider/so-cm9-cm11.txt).
 * CẤM viết `Math.hypot(...v)` — trải mảng vào tham số hàm vỡ khi số chiều lớn.
 */
export function l2normalize(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const n = Math.sqrt(sumSq);
  return n === 0 ? v : v.map((x) => x / n);
}

/** Độ dài L2 của vector — dùng để đo/probe (`embed_cache.mjs --probe`). */
export function l2norm(v: number[]): number {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  return Math.sqrt(sumSq);
}

// ─────────────────────────────────────────────────────────────────────────
// Lớp lỗi — 00-ARCHITECTURE.md §8, SPEC-P02 §9
// ─────────────────────────────────────────────────────────────────────────

export class UpstreamRateLimited extends Error {
  constructor(detail: string) {
    super(`UpstreamRateLimited: ${detail}`);
    this.name = "UpstreamRateLimited";
  }
}
export class UpstreamOverloaded extends Error {
  constructor(detail: string) {
    super(`UpstreamOverloaded: ${detail}`);
    this.name = "UpstreamOverloaded";
  }
}
export class UpstreamModelError extends Error {
  constructor(detail: string) {
    super(`UpstreamModelError: ${detail}`);
    this.name = "UpstreamModelError";
  }
}
export class UpstreamAuthError extends Error {
  constructor() {
    // CẤM in khoá vào thông báo lỗi (01-CONTRACTS §8.0 BẮT BUỘC 3).
    super("UpstreamAuthError: xác thực Gemini API thất bại (401/403)");
    this.name = "UpstreamAuthError";
  }
}
export class UpstreamContentBlocked extends Error {
  constructor(detail: string) {
    super(`UpstreamContentBlocked: ${detail}`);
    this.name = "UpstreamContentBlocked";
  }
}
export class ContractDriftError extends Error {
  constructor(detail: string) {
    super(`ContractDriftError: ${detail}`);
    this.name = "ContractDriftError";
  }
}

export type ForceUpstreamError = "429" | "503" | "blocked";

// ─────────────────────────────────────────────────────────────────────────
// Transport — injectable cho test (tests/ nằm NGOÀI phạm vi kiểm BB-07,
// scripts/check_adapter_boundary.sh chỉ quét app/ và lib/).
// ─────────────────────────────────────────────────────────────────────────

type FetchImpl = typeof fetch;
type SleepImpl = (ms: number) => Promise<void>;

const realSleep: SleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let fetchImpl: FetchImpl = fetch;
let sleepImpl: SleepImpl = realSleep;

/**
 * CHỈ dùng trong `tests/`: tiêm transport giả để kiểm backoff/retry mà không
 * gọi mạng thật và không phải chờ backoff thật. Gọi lại với `null` để trả về
 * transport thật. Không export ra khỏi adapter cho mục đích khác.
 */
export function __setTransportForTesting(
  overrides: { fetch?: FetchImpl; sleep?: SleepImpl } | null
): void {
  fetchImpl = overrides?.fetch ?? fetch;
  sleepImpl = overrides?.sleep ?? realSleep;
}

/** Semaphore đơn giản, giới hạn song song MAX_CONCURRENCY (Đ19). */
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  private readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
const semaphore = new Semaphore(MAX_CONCURRENCY);
const vyceSemaphore = new Semaphore(VYCE_MAX_CONCURRENCY);

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình. Xem specs/OPERATIONS.md §3.");
  }
  return key;
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.25);
}

/** Backoff cho E2/E2b (429/503): 2s → 8s + jitter, tối đa 2 lần retry. */
const RATE_LIMIT_BACKOFF_MS = [2000, 8000] as const;
/** Backoff cho E2c (5xx khác 503 / timeout): 1s → 3s, tối đa 2 lần retry. */
const MODEL_ERROR_BACKOFF_MS = [1000, 3000] as const;

/**
 * Gọi một hàm upstream (thật hoặc mô phỏng qua `forceError`) với backoff đúng
 * theo lớp lỗi (01-CONTRACTS §8, SPEC-P02 §9). `attempt()` phải ném đúng một
 * trong các lớp lỗi Upstream... hoặc ContractDriftError khi hỏng.
 */
async function withUpstreamRetry<T>(
  attempt: (attemptNo: number) => Promise<T>,
  opts?: { rateLimitRetries?: number }
): Promise<T> {
  // Số lần retry cho 429/503: mặc định 2 (2s → 8s). Chuỗi dự phòng (G34)
  // truyền 0 cho các model KHÔNG phải cuối để nhảy sang model kế ngay.
  const rateLimitRetries = Math.min(
    opts?.rateLimitRetries ?? RATE_LIMIT_BACKOFF_MS.length,
    RATE_LIMIT_BACKOFF_MS.length
  );
  let lastErr: unknown;
  for (let i = 0; i <= 2; i++) {
    try {
      return await attempt(i);
    } catch (err) {
      lastErr = err;
      if (err instanceof UpstreamAuthError || err instanceof UpstreamContentBlocked) {
        throw err; // CẤM retry (E2d, E2e)
      }
      if (err instanceof UpstreamRateLimited || err instanceof UpstreamOverloaded) {
        if (i >= rateLimitRetries) throw err;
        await sleepImpl(jitter(RATE_LIMIT_BACKOFF_MS[i]));
        continue;
      }
      if (err instanceof UpstreamModelError) {
        if (i >= MODEL_ERROR_BACKOFF_MS.length) throw err;
        await sleepImpl(jitter(MODEL_ERROR_BACKOFF_MS[i]));
        continue;
      }
      if (err instanceof ContractDriftError) {
        if (i >= 1) throw err; // CẤM quá 1 lần retry (E7)
        continue; // retry ngay, không backoff — cùng input, đổi tại phía model
      }
      throw err; // lỗi không thuộc bốn lớp trên — ném thẳng
    }
  }
  throw lastErr;
}

function classifyHttpError(status: number, bodyText: string): Error {
  if (status === 429) return new UpstreamRateLimited(`HTTP 429 — ${bodyText.slice(0, 200)}`);
  if (status === 503) return new UpstreamOverloaded(`HTTP 503 — ${bodyText.slice(0, 200)}`);
  if (status === 401 || status === 403) return new UpstreamAuthError();
  return new UpstreamModelError(`HTTP ${status} — ${bodyText.slice(0, 200)}`);
}

function simulateForcedError(kind: ForceUpstreamError): Error {
  if (kind === "429") return new UpstreamRateLimited("bơm lỗi giả lập (test)");
  if (kind === "503") return new UpstreamOverloaded("bơm lỗi giả lập (test)");
  return new UpstreamContentBlocked("bơm lỗi giả lập (test)");
}

// ─────────────────────────────────────────────────────────────────────────
// §8.0.2 — Đọc phản hồi, đúng thứ tự bắt buộc
// ─────────────────────────────────────────────────────────────────────────

interface GeminiCallResult {
  raw: string;
  input_tokens: number;
  output_tokens: number;
  ms: number;
}

async function callGeminiOnce(
  model: SupportedModel,
  systemPromptVi: string,
  userPayload: unknown,
  responseSchema: unknown,
  maxOutputTokens: number,
  forceUpstreamError?: ForceUpstreamError
): Promise<GeminiCallResult> {
  const started = Date.now();

  if (forceUpstreamError) {
    throw simulateForcedError(forceUpstreamError);
  }

  const apiKey = getApiKey();
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPromptVi }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(userPayload) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      maxOutputTokens,
    },
  };

  let res: Response;
  try {
    res = await semaphore.run(() =>
      fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  } catch (e) {
    throw new UpstreamModelError(`fetch thất bại: ${(e as Error).message}`);
  }

  const ms = Date.now() - started;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw classifyHttpError(res.status, text);
  }

  const json = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  // 1. Bị chặn ở tầng an toàn của nhà cung cấp.
  if (json.promptFeedback?.blockReason) {
    throw new UpstreamContentBlocked(`blockReason=${json.promptFeedback.blockReason}`);
  }
  const cand = json.candidates?.[0];
  if (!cand) throw new UpstreamContentBlocked("no candidate");

  // 2. Cắt giữa chừng ⇒ JSON vỡ. Bắt Ở ĐÂY.
  if (cand.finishReason && cand.finishReason !== "STOP") {
    throw new ContractDriftError(`finishReason=${cand.finishReason}`);
  }

  // 3. JSON nằm trong TEXT — không có 'parsed_output' (CẤM đọc trường đó).
  const raw = cand.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  // 4. Token — tên trường usageMetadata.*, KHÁC nhà cung cấp cũ.
  const input_tokens = json.usageMetadata?.promptTokenCount ?? 0;
  const output_tokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  return { raw, input_tokens, output_tokens, ms };
}

// ─────────────────────────────────────────────────────────────────────────
// Đ53 — Vyce (OpenAI-compatible), CHỈ làm fallback
// ─────────────────────────────────────────────────────────────────────────

/** Bóc JSON khỏi rào \`\`\`json … \`\`\` hoặc văn bản bao quanh; KHÔNG sửa nội dung. */
function extractJsonText(content: string): string {
  const t = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

async function callVyceOnce(
  model: VyceModel,
  systemPromptVi: string,
  userPayload: unknown,
  responseSchema: unknown,
  maxOutputTokens: number
): Promise<GeminiCallResult> {
  const started = Date.now();
  const key = process.env.VYCE_API_KEY;
  if (!key) throw new UpstreamAuthError();
  const prompt =
    `${systemPromptVi}\n\n## ĐỊNH DẠNG TRẢ LỜI — BẮT BUỘC\n` +
    `Trả về DUY NHẤT một object JSON hợp lệ (không văn xuôi, không markdown, không rào code), ` +
    `đúng schema OpenAPI sau (kiểu viết HOA = kiểu JSON tương ứng; mọi trường trong "required" phải có; ` +
    `giá trị enum phải lấy ĐÚNG một trong danh sách):\n${JSON.stringify(responseSchema)}\n\n` +
    `## DỮ LIỆU VÀO\n${JSON.stringify(userPayload)}`;
  const body = {
    model: model.slice("vyce:".length),
    temperature: 0,
    max_tokens: maxOutputTokens,
    messages: [{ role: "user", content: prompt }],
  };
  let res: Response;
  try {
    res = await vyceSemaphore.run(() =>
      fetchImpl(`${VYCE_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      })
    );
  } catch (e) {
    throw new UpstreamModelError(`fetch Vyce thất bại: ${(e as Error).message}`);
  }
  const ms = Date.now() - started;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw classifyHttpError(res.status, text);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = json.choices?.[0];
  if (!choice) throw new ContractDriftError("Vyce: không có choices[0]");
  if (choice.finish_reason && choice.finish_reason !== "stop") {
    throw new ContractDriftError(`Vyce finish_reason=${choice.finish_reason}`);
  }
  return {
    raw: extractJsonText(choice.message?.content ?? ""),
    input_tokens: json.usage?.prompt_tokens ?? 0,
    output_tokens: json.usage?.completion_tokens ?? 0,
    ms,
  };
}

async function callGemini(
  model: SupportedModel,
  systemPromptVi: string,
  userPayload: unknown,
  responseSchema: unknown,
  maxOutputTokens: number,
  forceUpstreamError?: ForceUpstreamError,
  rateLimitRetries?: number
): Promise<GeminiCallResult> {
  return withUpstreamRetry(
    (attemptNo) =>
      callGeminiOnce(
        model,
        systemPromptVi,
        userPayload,
        responseSchema,
        maxOutputTokens,
        // Bơm lỗi chỉ ở lần thử đầu để backoff/retry thật sự chạy rồi mới
        // thành công — dùng cho `npm test -- backoff` (W3). Truyền
        // `forceUpstreamError` bằng chuỗi cố định (không đổi theo attempt) để
        // mô phỏng lỗi dai dẳng khi cần (ví dụ Golden S14).
        forceUpstreamError && attemptNo === 0 ? forceUpstreamError : undefined
      ),
    { rateLimitRetries }
  );
}

/**
 * Gọi lần lượt các model trong `agentModelChain(agent)` (G34/Đ47). Model
 * không phải cuối: 0 retry cho 429/503 — dính là nhảy sang model kế. Model
 * cuối: backoff đầy đủ như cũ. Lỗi KHÔNG phải 429/503 (auth, blocked, drift,
 * 5xx khác) KHÔNG đổi model — đổi model không chữa được những lỗi đó và sẽ
 * che mất nguyên nhân thật. Trả kèm `model` đã dùng để pipeline ghi đúng
 * vào `steps` (R6).
 */
/** Đ53 — validator JSON+Zod dùng cho vòng Vyce; ném ContractDriftError giống hệt đường parse cũ. */
function zodValidator(schema: z.ZodTypeAny, label: string): (raw: string) => void {
  return (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new ContractDriftError(`JSON.parse hỏng (${label}): ${(e as Error).message}`);
    }
    const res = schema.safeParse(parsed);
    if (!res.success) throw new ContractDriftError(`Zod hỏng (${label}): ${res.error.message}`);
  };
}

async function callGeminiChain(
  agent: "A1" | "A2" | "A3",
  systemPromptVi: string,
  userPayload: unknown,
  responseSchema: unknown,
  maxOutputTokens: number,
  forceUpstreamError?: ForceUpstreamError,
  // Đ53 bổ sung (đo 2026-09-23: DeepSeek trả chuỗi rỗng / văn xuôi 6/50 ca):
  // kiểm JSON+Zod NGAY trong vòng Vyce để model Vyce trả JSON hỏng thì NHẢY
  // sang model Vyce kế (vd Sonnet). Gemini giữ nguyên hành vi cũ (drift không
  // đổi model — G34), vì responseSchema của Gemini là ràng buộc thật.
  validate?: (raw: string) => void
): Promise<GeminiCallResult & { model: AnyModel }> {
  const chain = agentModelChain(agent);
  // Đ53: bơm lỗi giả (test/Golden S14) KHÔNG được "chữa" bằng Vyce — ca đó
  // kiểm hành vi khi nhà cung cấp hỏng, fallback sẽ nuốt mất nó (cùng họ G30).
  const vyce = forceUpstreamError ? [] : vyceFallbackChain(agent);
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i]!;
    const isLast = i === chain.length - 1 && vyce.length === 0;
    try {
      const r = await callGemini(
        model,
        systemPromptVi,
        userPayload,
        responseSchema,
        maxOutputTokens,
        forceUpstreamError,
        isLast ? undefined : 0
      );
      return { ...r, model };
    } catch (err) {
      lastErr = err;
      const canFallOver =
        !isLast && (err instanceof UpstreamRateLimited || err instanceof UpstreamOverloaded);
      if (!canFallOver) throw err;
    }
  }
  for (let j = 0; j < vyce.length; j++) {
    const model = vyce[j]!;
    const isLast = j === vyce.length - 1;
    try {
      const r = await withUpstreamRetry(
        async () => {
          const out = await callVyceOnce(model, systemPromptVi, userPayload, responseSchema, maxOutputTokens);
          validate?.(out.raw); // ném ContractDriftError ⇒ withUpstreamRetry thử lại 1 lần cùng model
          return out;
        },
        { rateLimitRetries: isLast ? undefined : 0 }
      );
      return { ...r, model };
    } catch (err) {
      lastErr = err;
      const canFallOver =
        !isLast &&
        (err instanceof UpstreamRateLimited ||
          err instanceof UpstreamOverloaded ||
          err instanceof ContractDriftError);
      if (!canFallOver) throw err;
    }
  }
  throw lastErr;
}

/** CHỈ dùng trong tests/: gọi thẳng một lần, không qua retry — để kiểm
 *  classifyHttpError và lớp lỗi ném ra ứng với từng mã HTTP. */
export const __internal = { callGeminiOnce, callGemini, withUpstreamRetry, classifyHttpError, callGeminiChain, callVyceOnce, extractJsonText };

// ─────────────────────────────────────────────────────────────────────────
// Embedding — 01-CONTRACTS.md §4.3
// ─────────────────────────────────────────────────────────────────────────

export interface EmbedResult {
  vector: number[];
  raw_norm: number;
  ms: number;
}

async function embedOnce(
  text: string,
  outputDimensionality: number,
  forceUpstreamError?: ForceUpstreamError
): Promise<EmbedResult> {
  const started = Date.now();
  if (forceUpstreamError) throw simulateForcedError(forceUpstreamError);

  const apiKey = getApiKey();
  const url = `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const body = {
    content: { parts: [{ text }] },
    outputDimensionality,
  };
  let res: Response;
  try {
    res = await semaphore.run(() =>
      fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  } catch (e) {
    throw new UpstreamModelError(`fetch thất bại: ${(e as Error).message}`);
  }
  const ms = Date.now() - started;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw classifyHttpError(res.status, text);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length === 0) {
    throw new ContractDriftError("embedContent: thiếu embedding.values");
  }
  // C-08 / T-C11: CẤM cắt bớt vector để "cho khớp" — nếu API trả sai số
  // chiều so với yêu cầu (ví dụ bỏ sót outputDimensionality), phải NÉM LỖI
  // chứ không âm thầm cắt.
  if (values.length !== outputDimensionality) {
    throw new ContractDriftError(
      `embedContent trả ${values.length} chiều, kỳ vọng ${outputDimensionality} (C-08, T-C11)`
    );
  }
  return { vector: values, raw_norm: l2norm(values), ms };
}

/**
 * Sinh embedding đã CHUẨN HOÁ L2 cho một đoạn text (dùng cho CẢ seed lẫn
 * query — Đ20, 01-CONTRACTS §4.3). Ném lỗi nếu số chiều trả về sai —
 * KHÔNG âm thầm cắt/đệm (C-08).
 */
export async function embedText(
  text: string,
  opts?: { forceUpstreamError?: ForceUpstreamError; outputDimensionality?: number }
): Promise<EmbedResult & { normalized: number[] }> {
  const dims = opts?.outputDimensionality ?? EMBEDDING_DIMS;
  const result = await withUpstreamRetry(() => embedOnce(text, dims, opts?.forceUpstreamError));
  return { ...result, normalized: l2normalize(result.vector) };
}

// ─────────────────────────────────────────────────────────────────────────
// §8.0.1 — responseSchema (OpenAPI 3.0 con) + Zod song song
// ─────────────────────────────────────────────────────────────────────────

export const TargetSubjectsSchema = z.object({
  resident_ids: z.array(z.string()),
  property_ids: z.array(z.string()),
});

/**
 * Đ48 / H20 W1 — ý định HÀNH ĐỘNG mà A1 trích từ câu nói của cư dân.
 * Hình dạng SAO Y `ActionRequest` của `lib/types.ts` (hợp đồng chung với
 * pipeline và UI) — `satisfies` bên dưới giữ hai bên không trôi khỏi nhau.
 */
export const ActionRequestSchema = z.object({
  capability: z
    .enum(["amenity.create_booking", "amenity.cancel_booking", "amenity.list_my_bookings"])
    .nullable(),
  facility_hint_vi: z.string().nullable(),
  slot_start: z.string().nullable(),
  slot_end: z.string().nullable(),
  party_size: z.number().nullable(),
  booking_ref: z.string().nullable(),
  confirmed: z.boolean(),
});

/**
 * TƯƠNG THÍCH NGƯỢC (H20 W1): A1 của các vòng trước — và mọi transport giả
 * trong `tests/` đã viết trước Đ48 — KHÔNG trả trường `action`. `.default()`
 * dưới đây điền đúng giá trị "không có hành động nào", nên một lượt hỏi–đáp
 * thường vẫn đi hệt như cũ. CẤM đổi giá trị mặc định này thành một capability.
 */
export const EMPTY_ACTION_REQUEST = {
  capability: null,
  facility_hint_vi: null,
  slot_start: null,
  slot_end: null,
  party_size: null,
  booking_ref: null,
  confirmed: false,
} as const satisfies ActionRequest;

export const ClassifierOutputSchema = z.object({
  intent: z.enum(["I-01", "I-02", "I-03", "I-04", "I-05", "unsupported", "unresolved"]),
  is_emergency: z.boolean(),
  is_legal_or_compensation: z.boolean(),
  target_subjects: TargetSubjectsSchema,
  missing_required_fields: z.array(z.string()),
  clarify_question_vi: z.string().nullable(),
  normalized_query_vi: z.string(),
  action: ActionRequestSchema.default({ ...EMPTY_ACTION_REQUEST }),
});
export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

/** Kiểm bằng compiler: `action` của A1 đúng là `ActionRequest` của contract. */
const _actionShapeParity: ActionRequest = EMPTY_ACTION_REQUEST;
void _actionShapeParity;

export const CLASSIFIER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "STRING",
      enum: ["I-01", "I-02", "I-03", "I-04", "I-05", "unsupported", "unresolved"],
    },
    is_emergency: { type: "BOOLEAN" },
    is_legal_or_compensation: { type: "BOOLEAN" },
    target_subjects: {
      type: "OBJECT",
      properties: {
        resident_ids: { type: "ARRAY", items: { type: "STRING" } },
        property_ids: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["resident_ids", "property_ids"],
      propertyOrdering: ["resident_ids", "property_ids"],
    },
    missing_required_fields: { type: "ARRAY", items: { type: "STRING" } },
    clarify_question_vi: { type: "STRING", nullable: true },
    normalized_query_vi: { type: "STRING" },
    action: {
      type: "OBJECT",
      properties: {
        capability: {
          type: "STRING",
          enum: ["amenity.create_booking", "amenity.cancel_booking", "amenity.list_my_bookings"],
          nullable: true,
        },
        facility_hint_vi: { type: "STRING", nullable: true },
        slot_start: { type: "STRING", nullable: true },
        slot_end: { type: "STRING", nullable: true },
        party_size: { type: "INTEGER", nullable: true },
        booking_ref: { type: "STRING", nullable: true },
        confirmed: { type: "BOOLEAN" },
      },
      required: [
        "capability",
        "facility_hint_vi",
        "slot_start",
        "slot_end",
        "party_size",
        "booking_ref",
        "confirmed",
      ],
      propertyOrdering: [
        "capability",
        "facility_hint_vi",
        "slot_start",
        "slot_end",
        "party_size",
        "booking_ref",
        "confirmed",
      ],
    },
  },
  required: [
    "intent",
    "is_emergency",
    "is_legal_or_compensation",
    "target_subjects",
    "missing_required_fields",
    "clarify_question_vi",
    "normalized_query_vi",
    "action",
  ],
  propertyOrdering: [
    "intent",
    "is_emergency",
    "is_legal_or_compensation",
    "target_subjects",
    "missing_required_fields",
    "clarify_question_vi",
    "normalized_query_vi",
    "action",
  ],
} as const;

export interface ClassifierInput {
  question_vi: string;
  conversation_tail: Array<{ role: "user" | "assistant"; content_vi: string }>; // ≤ 6 lượt
  principal_summary: { owned_property_ids: string[]; property_type: string[] };
  /** Đ48 mục 6 — giờ máy chủ dạng ISO-8601 CÓ offset (`…+07:00`), tôn trọng
   *  `SIM_NOW`. A1 cần nó để quy "9 giờ sáng mai" ra `slot_start` tuyệt đối;
   *  không có nó thì mọi mốc tương đối đều là phỏng đoán. */
  server_time: string;
}

const CLASSIFIER_SYSTEM_PROMPT_VI = `Bạn phân loại câu hỏi của cư dân một khu đô thị.

BẮT BUỘC:
- Gán intent đúng MỘT trong: I-01 (thẻ cư dân/ra vào), I-02 (phương tiện/thẻ xe),
  I-03 (tiện ích chung), I-04 (chuyển đồ/thi công), I-05 (nội quy sinh hoạt),
  "unsupported" (ngoài phạm vi hỗ trợ), "unresolved" (chưa hiểu câu hỏi).
- is_emergency = true CHỈ khi có dấu hiệu khẩn cấp/nguy hiểm tính mạng.
- is_legal_or_compensation = true khi câu hỏi liên quan trách nhiệm pháp lý/bồi thường.
- target_subjects: liệt kê resident_id/property_id CỤ THỂ mà câu hỏi nhắc tới,
  nếu có (ví dụ hỏi thay cho căn hộ khác). Rỗng nếu câu hỏi chỉ về chính người hỏi
  hoặc về nội quy chung.
- normalized_query_vi: viết lại câu hỏi ngắn gọn, giữ đúng từ khoá cốt lõi
  (đối tượng, hành động, thời gian), BỎ các từ nghi vấn/đệm không mang nghĩa
  tra cứu (ví dụ "thì", "vậy", "à", "ạ"). Dùng để tra cứu tài liệu, không phải
  để hiển thị.
- missing_required_fields: liệt kê trường còn thiếu so với intent (nếu cần làm
  rõ trước khi trả lời). Rỗng nếu đã đủ.
- clarify_question_vi: null nếu không cần hỏi lại; một câu hỏi làm rõ ngắn gọn
  nếu missing_required_fields không rỗng.

CẤM suy diễn resident_id/property_id không được nêu trong câu hỏi hoặc ngữ cảnh.

TRƯỜNG "action" — ý định HÀNH ĐỘNG (Đ48). Trường "server_time" trong dữ liệu vào
là giờ máy chủ dạng ISO-8601 có offset; mọi mốc thời gian tương đối phải quy ra từ nó.
- action.capability chỉ khác null khi cư dân YÊU CẦU LÀM một việc:
  "amenity.create_booking" (đặt/book/giữ chỗ một tiện ích),
  "amenity.cancel_booking" (huỷ/bỏ một chỗ đã đặt),
  "amenity.list_my_bookings" (xem/liệt kê các chỗ tôi đã đặt).
- Câu HỎI về nội quy, giờ giấc, điều kiện, thủ tục ⇒ action.capability = null.
  "Sân bóng bàn mở cửa mấy giờ?" là câu hỏi, KHÔNG phải yêu cầu đặt chỗ.
- Câu xác nhận trống ("xác nhận", "đồng ý", "ừ huỷ đi", "ok làm đi") ⇒
  action.confirmed = true và action.capability = null.
- action.facility_hint_vi: cụm tiếng Việt cư dân dùng để gọi tiện ích, giữ NGUYÊN
  văn ("sân bóng bàn", "BBQ"). Không có ⇒ null.
- action.slot_start / action.slot_end: ISO-8601 CÓ offset, quy đổi từ server_time.
  "9 giờ sáng mai" với server_time "2026-09-20T23:39:00+07:00" ⇒ slot_start
  "2026-09-21T09:00:00+07:00". Không biết giờ kết thúc ⇒ slot_end = null.
- action.party_size: số người. Cư dân KHÔNG nói số người ⇒ 1 (chính cư dân đó).
- action.booking_ref: mã biên nhận "RC-…" hoặc mã chỗ đã đặt khi huỷ; không có ⇒ null.
- intent của một câu yêu cầu đặt/huỷ/xem chỗ tiện ích là I-03.
- CẤM tự điền capability cho một câu chỉ hỏi thông tin. CẤM tự đặt confirmed = true
  khi cư dân chưa nói lời xác nhận.`;

export async function runClassifier(
  i: ClassifierInput,
  opts?: { forceUpstreamError?: ForceUpstreamError }
): Promise<{
  output: ClassifierOutput;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  model: AnyModel;
}> {
  const { raw, input_tokens, output_tokens, ms, model } = await callGeminiChain(
    "A1",
    CLASSIFIER_SYSTEM_PROMPT_VI,
    i,
    CLASSIFIER_RESPONSE_SCHEMA,
    2048,
    opts?.forceUpstreamError,
    zodValidator(ClassifierOutputSchema, "classifier")
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ContractDriftError(`JSON.parse hỏng (classifier): ${(e as Error).message}`);
  }
  const result = ClassifierOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContractDriftError(`Zod hỏng (classifier): ${result.error.message}`);
  }
  return { output: result.data, input_tokens, output_tokens, ms, model };
}

// ─── A2 retriever ───────────────────────────────────────────────────────

const CITATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    document_id: { type: "STRING" },
    section_id: { type: "STRING" },
    document_title_vi: { type: "STRING" },
    heading_vi: { type: "STRING" },
    snippet_vi: { type: "STRING" },
  },
  required: ["document_id", "section_id", "document_title_vi", "heading_vi", "snippet_vi"],
  propertyOrdering: ["document_id", "section_id", "document_title_vi", "heading_vi", "snippet_vi"],
} as const;

export const RETRIEVER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    draft_vi: { type: "STRING" },
    citations: { type: "ARRAY", items: CITATION_SCHEMA },
    refused: { type: "BOOLEAN" },
    refusal_note_vi: { type: "STRING", nullable: true },
  },
  required: ["draft_vi", "citations", "refused", "refusal_note_vi"],
  propertyOrdering: ["draft_vi", "citations", "refused", "refusal_note_vi"],
} as const;

export const CitationSchema = z.object({
  document_id: z.string(),
  section_id: z.string(),
  document_title_vi: z.string(),
  heading_vi: z.string(),
  snippet_vi: z.string(),
});

export const RetrieverOutputSchema = z.object({
  draft_vi: z.string(),
  citations: z.array(CitationSchema),
  refused: z.boolean(),
  refusal_note_vi: z.string().nullable(),
});
export type RetrieverOutput = z.infer<typeof RetrieverOutputSchema>;

export interface RetrievedChunkForAgent {
  chunk_id: string;
  section_id: string;
  document_id: string;
  content_vi: string;
  score: number;
}

export interface RetrieverInput {
  normalized_query_vi: string;
  intent: IntentId;
  eligible_chunks: RetrievedChunkForAgent[];
}

const RETRIEVER_SYSTEM_PROMPT_VI = `Bạn soạn câu trả lời cho cư dân một khu đô thị, CHỈ dựa trên các đoạn trích được cung cấp.

BẮT BUỘC:
- Mỗi phát biểu mang tính quy định phải neo vào đúng một đoạn trích đã cho.
- Trả về citations gồm section_id của các đoạn thực sự đã dùng.
- Viết tiếng Việt, ngắn, đi thẳng vào việc.

CẤM:
- CẤM dùng kiến thức bên ngoài các đoạn trích, kể cả khi bạn chắc chắn nó đúng.
- CẤM suy diễn con số, giờ giấc, mức phí, hạn mức không có trong đoạn trích.
- CẤM trích dẫn section_id không nằm trong danh sách được cung cấp.
- CẤM trả lời "vòng quanh": nếu câu hỏi hỏi MỘT dữ kiện cụ thể (giờ, mức phí, con số, thời hạn, điều kiện)
  mà các đoạn trích KHÔNG chứa đúng dữ kiện đó cho đúng đối tượng được hỏi, thì KHÔNG được đưa
  thông tin lân cận thay thế (vd hỏi phí thẻ xe máy mà chỉ có phí thẻ cư dân; hỏi giờ mở cửa mà chỉ
  có quy định trang phục) — phải từ chối.
- Ngược lại, nếu một đoạn trích CÓ đúng dữ kiện được hỏi (kể cả diễn đạt khác chữ, vd "cấp lại
  thẻ do làm mất" = "làm lại thẻ bị mất") thì PHẢI trả lời và trích đoạn đó — từ chối lúc này là SAI.

KHI KHÔNG ĐỦ CĂN CỨ:
- Đặt refused = true và nêu ngắn gọn còn thiếu thông tin gì.
- Đây là hành vi ĐÚNG, không phải thất bại. Thà từ chối còn hơn đoán.`;

export async function runRetriever(
  i: RetrieverInput,
  opts?: { forceUpstreamError?: ForceUpstreamError }
): Promise<{
  output: RetrieverOutput;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  model: AnyModel;
}> {
  const { raw, input_tokens, output_tokens, ms, model } = await callGeminiChain(
    "A2",
    RETRIEVER_SYSTEM_PROMPT_VI,
    i,
    RETRIEVER_RESPONSE_SCHEMA,
    4096,
    opts?.forceUpstreamError,
    zodValidator(RetrieverOutputSchema, "retriever")
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ContractDriftError(`JSON.parse hỏng (retriever): ${(e as Error).message}`);
  }
  const result = RetrieverOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContractDriftError(`Zod hỏng (retriever): ${result.error.message}`);
  }
  return { output: result.data, input_tokens, output_tokens, ms, model };
}

// ─── A3 verifier ────────────────────────────────────────────────────────

export const VERIFIER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    claims: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          claim_vi: { type: "STRING" },
          verdict: { type: "STRING", enum: ["supported", "unsupported", "contradicted"] },
          supporting_section_id: { type: "STRING", nullable: true },
        },
        required: ["claim_vi", "verdict", "supporting_section_id"],
        propertyOrdering: ["claim_vi", "verdict", "supporting_section_id"],
      },
    },
    faithfulness: { type: "NUMBER" },
  },
  required: ["claims", "faithfulness"],
  propertyOrdering: ["claims", "faithfulness"],
} as const;

export const ClaimVerdictSchema = z.object({
  claim_vi: z.string(),
  verdict: z.enum(["supported", "unsupported", "contradicted"]),
  supporting_section_id: z.string().nullable(),
});

export const VerifierOutputSchema = z.object({
  claims: z.array(ClaimVerdictSchema),
  faithfulness: z.number(),
});
export type VerifierOutput = z.infer<typeof VerifierOutputSchema>;

export interface VerifierInput {
  draft_vi: string;
  evidence: Array<{ section_id: string; content_vi: string }>;
  // CỐ Ý KHÔNG CÓ question_vi — VC-03
}

const VERIFIER_SYSTEM_PROMPT_VI = `Bạn kiểm chứng một bản nháp dựa trên các đoạn trích kèm theo.

Việc của bạn:
1. Tách bản nháp thành từng mệnh đề kiểm chứng được (claim).
2. Với mỗi claim, gán đúng một verdict:
   - supported: đoạn trích nói rõ điều đó. Ghi supporting_section_id.
   - unsupported: đoạn trích không nói gì về điều đó.
   - contradicted: đoạn trích nói ngược lại.

CẤM:
- CẤM suy đoán ý định của người viết bản nháp.
- CẤM coi một claim là supported vì "nghe hợp lý" hoặc "thường là như vậy".
- CẤM gộp nhiều claim thành một để cho dễ.
- Khi phân vân giữa supported và unsupported: chọn unsupported.`;

export async function runVerifier(
  i: VerifierInput,
  opts?: { forceUpstreamError?: ForceUpstreamError }
): Promise<{
  output: VerifierOutput;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  model: AnyModel;
}> {
  const { raw, input_tokens, output_tokens, ms, model } = await callGeminiChain(
    "A3",
    VERIFIER_SYSTEM_PROMPT_VI,
    i,
    VERIFIER_RESPONSE_SCHEMA,
    4096,
    opts?.forceUpstreamError,
    zodValidator(VerifierOutputSchema, "verifier")
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ContractDriftError(`JSON.parse hỏng (verifier): ${(e as Error).message}`);
  }
  const result = VerifierOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContractDriftError(`Zod hỏng (verifier): ${result.error.message}`);
  }
  return { output: result.data, input_tokens, output_tokens, ms, model };
}

// Re-export cho tiện dùng ở lib/pipeline/ mà không phải import kiểu trùng tên.
export type { Citation, ClaimVerdict };
