// lib/adapters/anthropic.ts — FILE DUY NHẤT trong app/ và lib/ được import
// SDK Anthropic (BB-07, 00-ARCHITECTURE.md §9). Kiểm bằng
// `scripts/check_adapter_boundary.sh` (W7).
//
// Gói P01a chỉ dựng khung + chữ ký (handoff §2) — KHÔNG có lời gọi mạng nào
// trong toàn bộ gói này. Ba agent A1/A2/A3 (lib/pipeline/) thuộc phạm vi P02,
// KHÔNG được viết ở đây.

import Anthropic from "@anthropic-ai/sdk";

/** Ba model đã chốt ở 00-ARCHITECTURE.md §10.1. CẤM thêm hậu tố ngày vào ID. */
export type SupportedModel = "claude-haiku-4-5" | "claude-opus-5" | "claude-sonnet-5";

let cachedClient: Anthropic | null = null;

/**
 * Trả về client Anthropic, tạo lười đúng một lần. Đọc `ANTHROPIC_API_KEY` lúc
 * gọi hàm (runtime), không đọc ở top-level module — nhờ vậy `npm run build`
 * không cần biến này. CẤM in `apiKey` ra log dưới mọi hình thức (OPERATIONS
 * §3).
 */
export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY chưa được cấu hình. Xem specs/OPERATIONS.md §3."
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}
