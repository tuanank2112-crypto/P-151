// lib/simbackend/index.ts — điểm vào DUY NHẤT của backend cư dân mô phỏng (P05, Đ48).
//
// `lib/simbackend/` là BACKEND CƯ DÂN MÔ PHỎNG do chúng ta tự viết (Đ02). Mọi tên
// lệnh, trường, mã lỗi là hợp đồng tự định nghĩa — KHÔNG phải API Vinhomes, KHÔNG có
// lời gọi mạng ra ngoài.
//
// TRẠNG THÁI: KHUNG (SO viết 2026-09-23). Gói H19 thay thân hàm bằng cài đặt thật:
//   - PostgresSimBackend (qua getSql() của lib/adapters/db.ts — BB-07)
//   - MemorySimBackend (DATA_BACKEND=mock và test) — cùng ràng buộc với Postgres (Đ43)
// H20/H21 chỉ import `getSimBackend`, `__setSimBackendForTesting` và kiểu từ ./contract.ts.

import type { SimBackend } from "./contract.ts";

export * from "./contract.ts";

let injected: SimBackend | null = null;

/** CHỈ dùng trong tests/: tiêm backend giả. Gọi lại với null để trả về mặc định. */
export function __setSimBackendForTesting(backend: SimBackend | null): void {
  injected = backend;
}

export async function getSimBackend(): Promise<SimBackend> {
  if (injected) return injected;
  throw new Error(
    "lib/simbackend chưa được cài đặt (gói H19 đang thi công). Test dùng __setSimBackendForTesting()."
  );
}
