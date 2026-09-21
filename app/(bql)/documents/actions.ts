"use server";
// app/(bql)/documents/actions.ts — Server Actions vòng đời tài liệu (R7,
// SPEC-P03 §2.2). Mỗi action TỰ kiểm vai `bql` (E5 AuthzError,
// 00-ARCHITECTURE.md §8) — không chỉ dựa vào app/(bql)/layout.tsx, vì một
// Server Action có thể bị gọi trực tiếp, bỏ qua vòng render trang.

import { revalidatePath } from "next/cache";
import { getSessionPayload } from "../../../lib/auth/guard.ts";
import {
  checkBqlAuthz,
  setDocumentStatus as storeSetDocumentStatus,
  setEffectiveStatus as storeSetEffectiveStatus,
  type DocumentError,
} from "../../../lib/adapters/bql-store.ts";
import type { DocStatus, EffectiveStatus } from "../../../lib/types.ts";

function authzErrorResult(): { ok: false; error: DocumentError } {
  return {
    ok: false,
    error: { code: "AuthzError", message_vi: "Chỉ Ban quản lý được thao tác này." },
  };
}

export async function setDocumentStatus(input: {
  document_id: string;
  status: DocStatus;
}): Promise<{ ok: true; reindexed: boolean } | { ok: false; error: DocumentError }> {
  const session = await getSessionPayload();
  if (!checkBqlAuthz(session).ok) return authzErrorResult();
  const result = await storeSetDocumentStatus(input);
  if (result.ok) revalidatePath("/documents");
  return result;
}

export async function setEffectiveStatus(input: {
  document_id: string;
  effective_status: EffectiveStatus;
  effective_to: string | null;
}): Promise<{ ok: true } | { ok: false; error: DocumentError }> {
  const session = await getSessionPayload();
  if (!checkBqlAuthz(session).ok) return authzErrorResult();
  const result = await storeSetEffectiveStatus(input);
  if (result.ok) revalidatePath("/documents");
  return result;
}
